/**
 * Sector Sentinel — Zustand game store with MMKV persistence.
 * Dual currency: Standard Credits (upgrades/salvage) + Gold Credits (open caches).
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import {
  generateGearItem,
  getUpgradeRequirements,
} from '../engine/ProbabilityMatrix';
import {
  NATIVE_MODULE_NAMES,
  canRequireNativeModule,
} from '../services/nativeAvailability';
import {
  OVERCLOCK_SPEED_MULTIPLIER,
} from '../types/monetization';
import {
  OPEN_CACHE_GOLD_COST,
  RARITY_RANK,
  type CacheFabricationJob,
  type EquippedGear,
  type GearItem,
  type Inventory,
  type PersistedGameSnapshot,
  type Rarity,
  type TargetingProtocol,
  type TelemetryStats,
} from '../types/game';

export interface NanitePackGrant {
  cores: number;
  goldCredits: number;
}

/** Prefer MMKV; fall back to in-memory storage so Expo Go can boot without the native module. */
function createPersistedStorage(): StateStorage {
  const memoryFallback = (): StateStorage => {
    console.warn(
      '[useGameStore] react-native-mmkv unavailable; using in-memory persistence (Expo Go).',
    );
    const memory = new Map<string, string>();
    return {
      getItem: (name: string): string | null => memory.get(name) ?? null,
      setItem: (name: string, value: string): void => {
        memory.set(name, value);
      },
      removeItem: (name: string): void => {
        memory.delete(name);
      },
    };
  };

  // Probe MmkvCxx before require — package entry calls getEnforcing.
  if (!canRequireNativeModule(NATIVE_MODULE_NAMES.mmkv)) {
    return memoryFallback();
  }
  try {
    // Native-only; require so Expo Go never evaluates the MMKV binding.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (opts: { id: string }) => {
        getString: (key: string) => string | undefined;
        set: (key: string, value: string) => void;
        delete: (key: string) => void;
      };
    };
    const mmkv = new MMKV({ id: 'sector-sentinel-game' });
    return {
      getItem: (name: string): string | null => {
        const value = mmkv.getString(name);
        return value === undefined ? null : value;
      },
      setItem: (name: string, value: string): void => {
        mmkv.set(name, value);
      },
      removeItem: (name: string): void => {
        mmkv.delete(name);
      },
    };
  } catch {
    return memoryFallback();
  }
}

/** Lazy AdMob access — keeps react-native-google-mobile-ads off the store module graph. */
function getAdMobManager(): {
  handleSectorProgress: (
    completedLevel: number,
    nextLevel: number,
  ) => Promise<void>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (
      require('../services/AdMobManager') as typeof import('../services/AdMobManager')
    ).AdMobManager;
  } catch {
    return null;
  }
}

const mmkvStateStorage: StateStorage = createPersistedStorage();

export function computeTotalPowerRating(equipped: EquippedGear): number {
  let total = 0;
  for (const item of Object.values(equipped)) {
    if (item) {
      total += item.powerRating;
    }
  }
  // Baseline exo-rig output so combat functions before first equip
  return Math.max(40, total);
}

/** Kinetic / deflection / core metrics derived from equipped loadout. */
export function computeTelemetryStats(equipped: EquippedGear): TelemetryStats {
  const weapon = equipped.WEAPON;
  const shield = equipped.SHIELD;
  const core = equipped.CORE_AI;
  const chassis = equipped.CHASSIS;
  const propulsion = equipped.PROPULSION;

  const kineticOutput =
    (weapon?.primaryStat ?? 0) +
    Math.round((weapon?.secondaryStat ?? 0) * 0.35) +
    Math.round((propulsion?.secondaryStat ?? 0) * 0.15);

  const deflectionIndex =
    (shield?.primaryStat ?? 0) +
    Math.round((chassis?.primaryStat ?? 0) * 0.4) +
    Math.round((shield?.secondaryStat ?? 0) * 0.5);

  const coreProcessingSpeed =
    (core?.primaryStat ?? 0) +
    Math.round((core?.secondaryStat ?? 0) * 0.6) +
    Math.round((equipped.UTILITY?.secondaryStat ?? 0) * 0.25);

  return {
    totalPowerRating: computeTotalPowerRating(equipped),
    kineticOutput,
    deflectionIndex,
    coreProcessingSpeed,
  };
}

function enqueueComparison(
  pending: GearItem | null,
  queue: GearItem[],
  items: GearItem[],
): { pendingComparisonGear: GearItem | null; comparisonQueue: GearItem[] } {
  if (items.length === 0) {
    return { pendingComparisonGear: pending, comparisonQueue: queue };
  }
  if (pending === null) {
    const [first, ...rest] = items;
    return {
      pendingComparisonGear: first,
      comparisonQueue: [...queue, ...rest],
    };
  }
  return {
    pendingComparisonGear: pending,
    comparisonQueue: [...queue, ...items],
  };
}

function advanceComparisonQueue(
  queue: GearItem[],
): { pendingComparisonGear: GearItem | null; comparisonQueue: GearItem[] } {
  if (queue.length === 0) {
    return { pendingComparisonGear: null, comparisonQueue: [] };
  }
  const [next, ...rest] = queue;
  return { pendingComparisonGear: next, comparisonQueue: rest };
}

function ingestOpenedGear(
  state: {
    inventory: Inventory;
    standardCredits: number;
    autoSalvageThreshold: Rarity | null;
    pendingComparisonGear: GearItem | null;
    comparisonQueue: GearItem[];
  },
  item: GearItem,
): {
  inventory: Inventory;
  standardCredits: number;
  pendingComparisonGear: GearItem | null;
  comparisonQueue: GearItem[];
  autoSalvaged: boolean;
} {
  const threshold = state.autoSalvageThreshold;
  if (threshold !== null && RARITY_RANK[item.rarity] < RARITY_RANK[threshold]) {
    return {
      inventory: state.inventory,
      standardCredits: state.standardCredits + item.salvageValue,
      pendingComparisonGear: state.pendingComparisonGear,
      comparisonQueue: state.comparisonQueue,
      autoSalvaged: true,
    };
  }

  const inventory = [...state.inventory, item];
  const enqueued = enqueueComparison(
    state.pendingComparisonGear,
    state.comparisonQueue,
    [item],
  );
  return {
    inventory,
    standardCredits: state.standardCredits,
    pendingComparisonGear: enqueued.pendingComparisonGear,
    comparisonQueue: enqueued.comparisonQueue,
    autoSalvaged: false,
  };
}

export interface GameStoreState extends PersistedGameSnapshot {
  /** Spend Gold Credits to instantly open one Supply Cache → gear comparison */
  openCache: () => GearItem | null;
  equipItem: (item: GearItem) => void;
  salvageItem: (item: GearItem) => number;
  /** Spend Standard Credits only to start Cache Level fabrication */
  upgradeCacheLevel: () => boolean;
  autoSalvageBelowThreshold: (rarity: Rarity) => number;
  /** Tick Cache Upgrade fabrication only (auto-open / multi-open deferred) */
  tickFabrication: (deltaSeconds: number) => void;
  /** Sum of equipped Power Ratings (minimum baseline applied) */
  getTotalPowerRating: () => number;
  getTelemetryStats: () => TelemetryStats;
  /**
   * Combat kill payout: Standard + Gold Credits, then sector level++
   * (level past 10 advances World and resets to 1).
   */
  applyCombatVictory: (standardCredits: number, goldCredits: number) => void;
  /** EQUIP & SALVAGE OLD — equip pending gear, salvage displaced item for Standard Credits */
  resolveComparisonEquip: () => void;
  /** SALVAGE IMMEDIATELY — salvage pending gear for Standard Credits */
  resolveComparisonSalvage: () => void;
  /** Skip remaining fabrication timer (e.g. rewarded Instant Fabrication) */
  completeFabricationNow: () => void;
  /** Activate System Overclock (2x combat speed) for durationMs */
  activateOverclock: (durationMs: number) => void;
  isOverclockActive: () => boolean;
  /** 2 while overclock active, else 1 — consumed by BattlerEngine */
  getCombatSpeedMultiplier: () => number;
  /** Apply RevenueCat Nanite Cache pack contents */
  grantNanitePack: (grant: NanitePackGrant) => void;
  /** Persist combat targeting priority protocol */
  setTargetingProtocol: (protocol: TargetingProtocol) => void;
}

const initialEquipped: EquippedGear = {};

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      inventory: [] as Inventory,
      equippedGear: initialEquipped,
      standardCredits: 0,
      goldCredits: 0,
      cores: 0,
      currentSectorWorld: 1,
      currentSectorLevel: 1,
      cacheLevel: 1,
      autoSalvageThreshold: null,
      cacheFabrication: null as CacheFabricationJob | null,
      pendingComparisonGear: null as GearItem | null,
      comparisonQueue: [] as GearItem[],
      overclockExpiresAtMs: null as number | null,
      targetingProtocol: 'CLOSEST' as TargetingProtocol,

      setTargetingProtocol: (protocol: TargetingProtocol): void => {
        set({ targetingProtocol: protocol });
      },

      getTotalPowerRating: (): number => computeTotalPowerRating(get().equippedGear),

      getTelemetryStats: (): TelemetryStats =>
        computeTelemetryStats(get().equippedGear),

      activateOverclock: (durationMs: number): void => {
        const ms = Math.max(0, Math.floor(durationMs));
        if (ms <= 0) {
          return;
        }
        const now = Date.now();
        const current = get().overclockExpiresAtMs;
        const base = current !== null && current > now ? current : now;
        set({ overclockExpiresAtMs: base + ms });
      },

      isOverclockActive: (): boolean => {
        const expires = get().overclockExpiresAtMs;
        return expires !== null && expires > Date.now();
      },

      getCombatSpeedMultiplier: (): number => {
        const expires = get().overclockExpiresAtMs;
        if (expires !== null && expires > Date.now()) {
          return OVERCLOCK_SPEED_MULTIPLIER;
        }
        return 1;
      },

      grantNanitePack: (grant: NanitePackGrant): void => {
        const state = get();
        set({
          cores: state.cores + Math.max(0, Math.floor(grant.cores)),
          goldCredits:
            state.goldCredits + Math.max(0, Math.floor(grant.goldCredits)),
        });
      },

      applyCombatVictory: (standardGain: number, goldGain: number): void => {
        const state = get();
        const completedLevel = state.currentSectorLevel;
        const standardCredits =
          state.standardCredits + Math.max(0, Math.floor(standardGain));
        const goldCredits =
          state.goldCredits + Math.max(0, Math.floor(goldGain));

        let currentSectorLevel = state.currentSectorLevel + 1;
        let currentSectorWorld = state.currentSectorWorld;
        if (currentSectorLevel > 10) {
          currentSectorLevel = 1;
          currentSectorWorld += 1;
        }

        set({
          standardCredits,
          goldCredits,
          currentSectorLevel,
          currentSectorWorld,
        });

        // Interstitial on level % 5 === 0; preload when landing on X-4 / X-9
        const ads = getAdMobManager();
        if (ads) {
          void ads.handleSectorProgress(completedLevel, currentSectorLevel);
        }
      },

      openCache: (): GearItem | null => {
        const state = get();
        if (state.goldCredits < OPEN_CACHE_GOLD_COST) {
          return null;
        }

        const item = generateGearItem(state.cacheLevel);
        const ingested = ingestOpenedGear(
          {
            inventory: state.inventory,
            standardCredits: state.standardCredits,
            autoSalvageThreshold: state.autoSalvageThreshold,
            pendingComparisonGear: state.pendingComparisonGear,
            comparisonQueue: state.comparisonQueue,
          },
          item,
        );

        set({
          goldCredits: state.goldCredits - OPEN_CACHE_GOLD_COST,
          inventory: ingested.inventory,
          standardCredits: ingested.standardCredits,
          pendingComparisonGear: ingested.pendingComparisonGear,
          comparisonQueue: ingested.comparisonQueue,
        });
        return item;
      },

      equipItem: (item: GearItem): void => {
        const state = get();
        const fromInventory = state.inventory.some((g) => g.id === item.id);
        if (!fromInventory) {
          return;
        }

        const previous = state.equippedGear[item.slot];
        const inventoryWithout = state.inventory.filter((g) => g.id !== item.id);
        const nextInventory = previous
          ? [...inventoryWithout, previous]
          : inventoryWithout;

        set({
          inventory: nextInventory,
          equippedGear: {
            ...state.equippedGear,
            [item.slot]: item,
          },
        });
      },

      salvageItem: (item: GearItem): number => {
        const state = get();
        const inInventory = state.inventory.some((g) => g.id === item.id);
        const equipped = state.equippedGear[item.slot];
        const isEquipped = equipped?.id === item.id;

        if (!inInventory && !isEquipped) {
          return 0;
        }

        const value = item.salvageValue;
        const nextEquipped: EquippedGear = { ...state.equippedGear };
        if (isEquipped) {
          delete nextEquipped[item.slot];
        }

        set({
          standardCredits: state.standardCredits + value,
          inventory: state.inventory.filter((g) => g.id !== item.id),
          equippedGear: nextEquipped,
        });
        return value;
      },

      upgradeCacheLevel: (): boolean => {
        const state = get();
        if (state.cacheLevel >= 15) {
          return false;
        }
        if (state.cacheFabrication !== null) {
          return false;
        }
        const { costCredits, timerSeconds, nextLevel } = getUpgradeRequirements(
          state.cacheLevel,
        );
        if (state.standardCredits < costCredits) {
          return false;
        }

        // Instant fabrication when timer is 0
        if (timerSeconds <= 0) {
          set({
            standardCredits: state.standardCredits - costCredits,
            cacheLevel: nextLevel,
            cacheFabrication: null,
          });
          return true;
        }

        set({
          standardCredits: state.standardCredits - costCredits,
          cacheFabrication: {
            targetLevel: nextLevel,
            durationSeconds: timerSeconds,
            progress: 0,
          },
        });
        return true;
      },

      completeFabricationNow: (): void => {
        const state = get();
        const job = state.cacheFabrication;
        if (!job) {
          return;
        }
        set({
          cacheLevel: job.targetLevel,
          cacheFabrication: null,
        });
      },

      autoSalvageBelowThreshold: (rarity: Rarity): number => {
        const state = get();
        const kept: Inventory = [];
        let gained = 0;

        for (const item of state.inventory) {
          if (RARITY_RANK[item.rarity] < RARITY_RANK[rarity]) {
            gained += item.salvageValue;
          } else {
            kept.push(item);
          }
        }

        set({
          inventory: kept,
          standardCredits: state.standardCredits + gained,
          autoSalvageThreshold: rarity,
        });
        return gained;
      },

      resolveComparisonEquip: (): void => {
        const state = get();
        const pending = state.pendingComparisonGear;
        if (!pending) {
          return;
        }

        const inInventory = state.inventory.some((g) => g.id === pending.id);
        if (!inInventory) {
          const advanced = advanceComparisonQueue(state.comparisonQueue);
          set({
            pendingComparisonGear: advanced.pendingComparisonGear,
            comparisonQueue: advanced.comparisonQueue,
          });
          return;
        }

        const previous = state.equippedGear[pending.slot];
        const inventoryWithout = state.inventory.filter((g) => g.id !== pending.id);
        let standardCredits = state.standardCredits;
        // Salvage displaced gear for Standard Credits (do not return to inventory)
        if (previous) {
          standardCredits += previous.salvageValue;
        }

        const advanced = advanceComparisonQueue(state.comparisonQueue);
        set({
          inventory: inventoryWithout,
          standardCredits,
          equippedGear: {
            ...state.equippedGear,
            [pending.slot]: pending,
          },
          pendingComparisonGear: advanced.pendingComparisonGear,
          comparisonQueue: advanced.comparisonQueue,
        });
      },

      resolveComparisonSalvage: (): void => {
        const state = get();
        const pending = state.pendingComparisonGear;
        if (!pending) {
          return;
        }

        const value = state.inventory.some((g) => g.id === pending.id)
          ? pending.salvageValue
          : 0;

        const advanced = advanceComparisonQueue(state.comparisonQueue);
        set({
          standardCredits: state.standardCredits + value,
          inventory: state.inventory.filter((g) => g.id !== pending.id),
          pendingComparisonGear: advanced.pendingComparisonGear,
          comparisonQueue: advanced.comparisonQueue,
        });
      },

      tickFabrication: (deltaSeconds: number): void => {
        const state = get();
        if (deltaSeconds <= 0) {
          return;
        }

        const job = state.cacheFabrication;
        if (!job) {
          return;
        }

        const rate =
          job.durationSeconds > 0 ? deltaSeconds / job.durationSeconds : 1;
        const progress = Math.min(1, job.progress + rate);
        if (progress >= 1) {
          set({
            cacheLevel: job.targetLevel,
            cacheFabrication: null,
          });
          return;
        }

        set({
          cacheFabrication: { ...job, progress },
        });
      },
    }),
    {
      name: 'sector-sentinel-game-v2',
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state): PersistedGameSnapshot => ({
        inventory: state.inventory,
        equippedGear: state.equippedGear,
        standardCredits: state.standardCredits,
        goldCredits: state.goldCredits,
        cores: state.cores,
        currentSectorWorld: state.currentSectorWorld,
        currentSectorLevel: state.currentSectorLevel,
        cacheLevel: state.cacheLevel,
        autoSalvageThreshold: state.autoSalvageThreshold,
        cacheFabrication: state.cacheFabrication,
        pendingComparisonGear: state.pendingComparisonGear,
        comparisonQueue: state.comparisonQueue,
        overclockExpiresAtMs: state.overclockExpiresAtMs,
        targetingProtocol: state.targetingProtocol,
      }),
      merge: (persistedState, currentState): GameStoreState => {
        const raw = (persistedState ?? {}) as Partial<PersistedGameSnapshot> & {
          /** Legacy single-currency field from v1 saves */
          credits?: number;
        };

        const standardCredits =
          raw.standardCredits ??
          (typeof raw.credits === 'number' ? raw.credits : currentState.standardCredits);
        const goldCredits =
          raw.goldCredits ?? currentState.goldCredits;

        return {
          ...currentState,
          ...raw,
          standardCredits,
          goldCredits,
          cacheFabrication: raw.cacheFabrication ?? null,
          pendingComparisonGear: raw.pendingComparisonGear ?? null,
          comparisonQueue: raw.comparisonQueue ?? [],
          overclockExpiresAtMs: raw.overclockExpiresAtMs ?? null,
          targetingProtocol: raw.targetingProtocol ?? 'CLOSEST',
        };
      },
    },
  ),
);
