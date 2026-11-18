/**
 * Sector Sentinel — Zustand game store with MMKV persistence.
 * Dual currency: Standard Credits (upgrades/salvage) + Gold Credits (open caches).
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import {
  ensureGearAffinity,
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
  GEAR_SLOTS,
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

/** Migrate inventory / equipped / comparison gear to include manufacturer affinity. */
function migrateGearCollection(items: Inventory | undefined): Inventory {
  if (!items || items.length === 0) {
    return items ?? [];
  }
  return items.map((item) => ensureGearAffinity(item));
}

function migrateEquippedGear(equipped: EquippedGear | undefined): EquippedGear {
  if (!equipped) {
    return {};
  }
  const next: EquippedGear = {};
  for (const slot of GEAR_SLOTS) {
    const item = equipped[slot];
    if (item) {
      next[slot] = ensureGearAffinity(item);
    }
  }
  return next;
}

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

/**
 * World 2+ parallel auto-decrypt batch size: max(1, world - 1).
 * World 1 stays manual (capacity 0).
 */
export function getBatchCapacity(currentSectorWorld: number): number {
  if (currentSectorWorld < 2) {
    return 0;
  }
  return Math.max(1, currentSectorWorld - 1);
}

/** Auto-salvage threshold chips shown in the Supply Cache bay */
export const AUTO_SALVAGE_OPTIONS = [
  'RARE',
  'EPIC',
  'LEGENDARY',
] as const satisfies readonly Rarity[];

export type AutoSalvageOption = (typeof AUTO_SALVAGE_OPTIONS)[number];

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
  /** Persist World 2+ AUTO-DECRYPT toggle */
  setAutoDecryptEnabled: (enabled: boolean) => void;
  /**
   * Set AUTO-SALVAGE BELOW threshold (or clear with null) and immediately
   * salvage inventory gear below that rarity for Standard Credits.
   */
  autoSalvageBelowThreshold: (rarity: Rarity | null) => number;
  /** World 2+ batch capacity for AUTO-DECRYPT opens per tick */
  getBatchCapacity: () => number;
  /** Tick Cache Upgrade fabrication + World 2+ AUTO-DECRYPT opens */
  tickFabrication: (deltaSeconds: number) => void;
  /** Sum of equipped Power Ratings (minimum baseline applied) */
  getTotalPowerRating: () => number;
  getTelemetryStats: () => TelemetryStats;
  /**
   * Combat kill payout: Standard + Gold Credits, then sector level++
   * (level past 10 advances World and resets to 1).
   */
  applyCombatVictory: (standardCredits: number, goldCredits: number) => void;
  /**
   * Exo-Rig destroyed by a Sector Warden: drop one sector level (min 1)
   * so the pilot can farm and retry the gate.
   */
  retreatFromBossDefeat: () => void;
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
      autoDecryptEnabled: false,
      cacheFabrication: null as CacheFabricationJob | null,
      pendingComparisonGear: null as GearItem | null,
      comparisonQueue: [] as GearItem[],
      overclockExpiresAtMs: null as number | null,
      targetingProtocol: 'CLOSEST' as TargetingProtocol,

      setTargetingProtocol: (protocol: TargetingProtocol): void => {
        set({ targetingProtocol: protocol });
      },

      setAutoDecryptEnabled: (enabled: boolean): void => {
        set({ autoDecryptEnabled: enabled });
      },

      getBatchCapacity: (): number => getBatchCapacity(get().currentSectorWorld),

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

      retreatFromBossDefeat: (): void => {
        const state = get();
        set({
          currentSectorLevel: Math.max(1, state.currentSectorLevel - 1),
        });
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

      autoSalvageBelowThreshold: (rarity: Rarity | null): number => {
        const state = get();
        if (rarity === null) {
          set({ autoSalvageThreshold: null });
          return 0;
        }

        const kept: Inventory = [];
        let gained = 0;

        for (const item of state.inventory) {
          if (RARITY_RANK[item.rarity] < RARITY_RANK[rarity]) {
            gained += item.salvageValue;
          } else {
            kept.push(item);
          }
        }

        // Opened gear lives in inventory + comparison queue — prune both.
        let comparisonQueue = state.comparisonQueue.filter(
          (g) => RARITY_RANK[g.rarity] >= RARITY_RANK[rarity],
        );
        let pendingComparisonGear = state.pendingComparisonGear;
        if (
          pendingComparisonGear !== null &&
          RARITY_RANK[pendingComparisonGear.rarity] < RARITY_RANK[rarity]
        ) {
          const advanced = advanceComparisonQueue(comparisonQueue);
          pendingComparisonGear = advanced.pendingComparisonGear;
          comparisonQueue = advanced.comparisonQueue;
        }

        set({
          inventory: kept,
          standardCredits: state.standardCredits + gained,
          autoSalvageThreshold: rarity,
          pendingComparisonGear,
          comparisonQueue,
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

        let cacheLevel = state.cacheLevel;
        let cacheFabrication = state.cacheFabrication
          ? { ...state.cacheFabrication }
          : null;

        // Advance Cache Upgrade fabrication
        if (cacheFabrication) {
          const rate =
            cacheFabrication.durationSeconds > 0
              ? deltaSeconds / cacheFabrication.durationSeconds
              : 1;
          const progress = Math.min(1, cacheFabrication.progress + rate);
          if (progress >= 1) {
            cacheLevel = cacheFabrication.targetLevel;
            cacheFabrication = null;
          } else {
            cacheFabrication = { ...cacheFabrication, progress };
          }
        }

        let goldCredits = state.goldCredits;
        let inventory = state.inventory;
        let standardCredits = state.standardCredits;
        let pendingComparisonGear = state.pendingComparisonGear;
        let comparisonQueue = state.comparisonQueue;
        let openedCount = 0;

        // World 2+ AUTO-DECRYPT: spend Gold Credits up to batch capacity / cycle
        const batchCapacity = getBatchCapacity(state.currentSectorWorld);
        if (
          state.autoDecryptEnabled &&
          state.currentSectorWorld >= 2 &&
          batchCapacity > 0
        ) {
          const maxOpens = Math.min(
            batchCapacity,
            Math.floor(goldCredits / OPEN_CACHE_GOLD_COST),
          );
          for (let i = 0; i < maxOpens; i += 1) {
            goldCredits -= OPEN_CACHE_GOLD_COST;
            const item = generateGearItem(cacheLevel);
            const ingested = ingestOpenedGear(
              {
                inventory,
                standardCredits,
                autoSalvageThreshold: state.autoSalvageThreshold,
                pendingComparisonGear,
                comparisonQueue,
              },
              item,
            );
            inventory = ingested.inventory;
            standardCredits = ingested.standardCredits;
            pendingComparisonGear = ingested.pendingComparisonGear;
            comparisonQueue = ingested.comparisonQueue;
            openedCount += 1;
          }
        }

        const fabricationChanged =
          cacheLevel !== state.cacheLevel ||
          cacheFabrication?.progress !== state.cacheFabrication?.progress ||
          (cacheFabrication === null) !== (state.cacheFabrication === null);

        if (!fabricationChanged && openedCount === 0) {
          return;
        }

        set({
          cacheLevel,
          cacheFabrication,
          goldCredits,
          inventory,
          standardCredits,
          pendingComparisonGear,
          comparisonQueue,
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
        autoDecryptEnabled: state.autoDecryptEnabled,
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

        const pendingRaw = raw.pendingComparisonGear ?? null;
        return {
          ...currentState,
          ...raw,
          standardCredits,
          goldCredits,
          inventory: migrateGearCollection(raw.inventory),
          equippedGear: migrateEquippedGear(raw.equippedGear),
          autoDecryptEnabled: raw.autoDecryptEnabled ?? false,
          autoSalvageThreshold: raw.autoSalvageThreshold ?? null,
          cacheFabrication: raw.cacheFabrication ?? null,
          pendingComparisonGear: pendingRaw
            ? ensureGearAffinity(pendingRaw)
            : null,
          comparisonQueue: migrateGearCollection(raw.comparisonQueue),
          overclockExpiresAtMs: raw.overclockExpiresAtMs ?? null,
          targetingProtocol: raw.targetingProtocol ?? 'CLOSEST',
        };
      },
    },
  ),
);
