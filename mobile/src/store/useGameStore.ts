/**
 * Sector Sentinel — Zustand game store with MMKV persistence.
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import {
  generateGearItem,
  getUpgradeRequirements,
  decryptionTimeForTier,
} from '../engine/ProbabilityMatrix';
import { AdMobManager } from '../services/AdMobManager';
import { hasCustomNativeModules } from '../services/nativeAvailability';
import {
  OVERCLOCK_SPEED_MULTIPLIER,
} from '../types/monetization';
import {
  CACHE_BUFFER_CAPACITY,
  RARITY_RANK,
  type CacheBuffer,
  type CacheFabricationJob,
  type EquippedGear,
  type GearItem,
  type Inventory,
  type PersistedGameSnapshot,
  type Rarity,
  type SupplyCache,
  type TelemetryStats,
} from '../types/game';

export interface NanitePackGrant {
  cores: number;
  bonusCaches: number;
  fillEmptyCacheSlots: boolean;
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

  if (!hasCustomNativeModules()) {
    return memoryFallback();
  }
  try {
    // Native-only; require so Expo Go never evaluates the MMKV binding.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
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

const mmkvStateStorage: StateStorage = createPersistedStorage();

let cacheIdCounter = 0;

function createSupplyCache(tier: number): SupplyCache {
  cacheIdCounter += 1;
  return {
    id: `cache_${Date.now().toString(36)}_${cacheIdCounter}`,
    tier,
    decryptionTimeSeconds: decryptionTimeForTier(tier),
    isDecrypting: false,
    progress: 0,
  };
}

/** World 2+ parallel auto-open batch size: max(1, world - 1). World 1 stays manual. */
export function getBatchCapacity(currentSectorWorld: number): number {
  if (currentSectorWorld < 2) {
    return 0;
  }
  return Math.max(1, currentSectorWorld - 1);
}

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

export interface GameStoreState extends PersistedGameSnapshot {
  addCache: (tier?: number) => boolean;
  decryptCache: (id: string) => GearItem | null;
  equipItem: (item: GearItem) => void;
  salvageItem: (item: GearItem) => number;
  upgradeCacheLevel: () => boolean;
  autoSalvageBelowThreshold: (rarity: Rarity) => number;
  /** Active parallel decryption slots for World 2+ auto-open protocol */
  getBatchCapacity: () => number;
  /** Tick decrypting caches + fabrication; completes when progress reaches 1 */
  tickDecryption: (deltaSeconds: number) => GearItem[];
  /** Sum of equipped Power Ratings (minimum baseline applied) */
  getTotalPowerRating: () => number;
  getTelemetryStats: () => TelemetryStats;
  /**
   * Combat kill payout: Salvage Credits, optional Supply Cache drop,
   * then sector level++ (level past 10 advances World and resets to 1).
   */
  applyCombatVictory: (salvageCredits: number, dropSupplyCache: boolean) => void;
  /** EQUIP & SALVAGE OLD — equip pending gear, salvage displaced item for credits */
  resolveComparisonEquip: () => void;
  /** SALVAGE IMMEDIATELY — salvage pending gear for Salvage Credits */
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
}

const initialEquipped: EquippedGear = {};

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      inventory: [] as Inventory,
      equippedGear: initialEquipped,
      cacheBuffer: [] as CacheBuffer,
      credits: 0,
      cores: 0,
      currentSectorWorld: 1,
      currentSectorLevel: 1,
      cacheLevel: 1,
      cacheSlots: CACHE_BUFFER_CAPACITY,
      autoSalvageThreshold: null,
      cacheFabrication: null as CacheFabricationJob | null,
      pendingComparisonGear: null as GearItem | null,
      comparisonQueue: [] as GearItem[],
      overclockExpiresAtMs: null as number | null,

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
        let cacheBuffer = [...state.cacheBuffer];
        const cores = state.cores + Math.max(0, Math.floor(grant.cores));

        const pushCaches = (count: number): void => {
          for (let i = 0; i < count; i += 1) {
            if (cacheBuffer.length >= state.cacheSlots) {
              break;
            }
            cacheBuffer = [...cacheBuffer, createSupplyCache(state.cacheLevel)];
          }
        };

        pushCaches(Math.max(0, Math.floor(grant.bonusCaches)));
        if (grant.fillEmptyCacheSlots) {
          pushCaches(state.cacheSlots - cacheBuffer.length);
        }

        set({ cores, cacheBuffer });
      },

      applyCombatVictory: (salvageCredits: number, dropSupplyCache: boolean): void => {
        const state = get();
        const completedLevel = state.currentSectorLevel;
        const creditGain = Math.max(0, Math.floor(salvageCredits));
        let credits = state.credits + creditGain;

        let cacheBuffer = state.cacheBuffer;
        if (dropSupplyCache && cacheBuffer.length < state.cacheSlots) {
          cacheBuffer = [...cacheBuffer, createSupplyCache(state.cacheLevel)];
        }

        let currentSectorLevel = state.currentSectorLevel + 1;
        let currentSectorWorld = state.currentSectorWorld;
        if (currentSectorLevel > 10) {
          currentSectorLevel = 1;
          currentSectorWorld += 1;
        }

        set({
          credits,
          cacheBuffer,
          currentSectorLevel,
          currentSectorWorld,
        });

        // Interstitial on level % 5 === 0; preload when landing on X-4 / X-9
        void AdMobManager.handleSectorProgress(completedLevel, currentSectorLevel);
      },

      addCache: (tier?: number): boolean => {
        const state = get();
        if (state.cacheBuffer.length >= state.cacheSlots) {
          return false;
        }
        const cacheTier = tier ?? state.cacheLevel;
        const next = createSupplyCache(cacheTier);
        set({ cacheBuffer: [...state.cacheBuffer, next] });
        return true;
      },

      decryptCache: (id: string): GearItem | null => {
        const state = get();
        const target = state.cacheBuffer.find((c) => c.id === id);
        if (!target) {
          return null;
        }

        // Manual start: mark decrypting if not already
        if (!target.isDecrypting) {
          const decryptingCount = state.cacheBuffer.filter((c) => c.isDecrypting).length;
          const capacity =
            state.currentSectorWorld < 2
              ? 1
              : getBatchCapacity(state.currentSectorWorld);

          if (decryptingCount >= capacity) {
            return null;
          }

          set({
            cacheBuffer: state.cacheBuffer.map((c) =>
              c.id === id ? { ...c, isDecrypting: true } : c,
            ),
          });
          return null;
        }

        // Already decrypting and finished → open into inventory + comparison modal
        if (target.progress < 1) {
          return null;
        }

        const item = generateGearItem(state.cacheLevel);
        const remaining = state.cacheBuffer.filter((c) => c.id !== id);
        let inventory = [...state.inventory, item];
        let credits = state.credits;
        let pendingComparisonGear = state.pendingComparisonGear;
        let comparisonQueue = state.comparisonQueue;

        const threshold = state.autoSalvageThreshold;
        if (threshold !== null && RARITY_RANK[item.rarity] < RARITY_RANK[threshold]) {
          credits += item.salvageValue;
          inventory = inventory.filter((g) => g.id !== item.id);
          set({ cacheBuffer: remaining, inventory, credits });
          return item;
        }

        const enqueued = enqueueComparison(pendingComparisonGear, comparisonQueue, [
          item,
        ]);
        pendingComparisonGear = enqueued.pendingComparisonGear;
        comparisonQueue = enqueued.comparisonQueue;

        set({
          cacheBuffer: remaining,
          inventory,
          pendingComparisonGear,
          comparisonQueue,
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
          credits: state.credits + value,
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
        if (state.credits < costCredits) {
          return false;
        }

        // Instant fabrication (Level 1→2 timer can still be >0; timer 0 completes immediately)
        if (timerSeconds <= 0) {
          set({
            credits: state.credits - costCredits,
            cacheLevel: nextLevel,
            cacheFabrication: null,
          });
          return true;
        }

        set({
          credits: state.credits - costCredits,
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
          credits: state.credits + gained,
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
        let credits = state.credits;
        // Salvage displaced gear for Salvage Credits (do not return to inventory)
        if (previous) {
          credits += previous.salvageValue;
        }

        const advanced = advanceComparisonQueue(state.comparisonQueue);
        set({
          inventory: inventoryWithout,
          credits,
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
          credits: state.credits + value,
          inventory: state.inventory.filter((g) => g.id !== pending.id),
          pendingComparisonGear: advanced.pendingComparisonGear,
          comparisonQueue: advanced.comparisonQueue,
        });
      },

      tickDecryption: (deltaSeconds: number): GearItem[] => {
        const state = get();
        if (deltaSeconds <= 0) {
          return [];
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

        if (state.cacheBuffer.length === 0) {
          if (
            cacheLevel !== state.cacheLevel ||
            cacheFabrication !== state.cacheFabrication
          ) {
            set({ cacheLevel, cacheFabrication });
          }
          return [];
        }

        const batchCapacity =
          state.currentSectorWorld < 2
            ? 1
            : getBatchCapacity(state.currentSectorWorld);

        let decrypting = state.cacheBuffer.filter((c) => c.isDecrypting);
        let buffer = state.cacheBuffer.map((c) => ({ ...c }));

        // World 2+: auto-start idle caches up to batch capacity
        if (state.currentSectorWorld >= 2) {
          const idle = buffer.filter((c) => !c.isDecrypting);
          let slotsOpen = batchCapacity - decrypting.length;
          for (const cache of idle) {
            if (slotsOpen <= 0) break;
            const idx = buffer.findIndex((c) => c.id === cache.id);
            if (idx >= 0) {
              buffer[idx] = { ...buffer[idx], isDecrypting: true };
              slotsOpen -= 1;
            }
          }
          decrypting = buffer.filter((c) => c.isDecrypting);
        }

        const completedIds: string[] = [];
        buffer = buffer.map((cache) => {
          if (!cache.isDecrypting) {
            return cache;
          }
          const rate =
            cache.decryptionTimeSeconds > 0
              ? deltaSeconds / cache.decryptionTimeSeconds
              : 1;
          const progress = Math.min(1, cache.progress + rate);
          if (progress >= 1) {
            completedIds.push(cache.id);
          }
          return { ...cache, progress };
        });

        const opened: GearItem[] = [];
        let inventory = [...state.inventory];
        let credits = state.credits;
        const threshold = state.autoSalvageThreshold;
        let pendingComparisonGear = state.pendingComparisonGear;
        let comparisonQueue = [...state.comparisonQueue];

        const stillPending = buffer.filter((c) => {
          if (!completedIds.includes(c.id)) {
            return true;
          }
          const item = generateGearItem(cacheLevel);
          if (threshold !== null && RARITY_RANK[item.rarity] < RARITY_RANK[threshold]) {
            credits += item.salvageValue;
          } else {
            inventory.push(item);
            opened.push(item);
          }
          return false;
        });

        if (opened.length > 0) {
          const enqueued = enqueueComparison(
            pendingComparisonGear,
            comparisonQueue,
            opened,
          );
          pendingComparisonGear = enqueued.pendingComparisonGear;
          comparisonQueue = enqueued.comparisonQueue;
        }

        set({
          cacheBuffer: stillPending,
          inventory,
          credits,
          cacheLevel,
          cacheFabrication,
          pendingComparisonGear,
          comparisonQueue,
        });
        return opened;
      },
    }),
    {
      name: 'sector-sentinel-game-v1',
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state): PersistedGameSnapshot => ({
        inventory: state.inventory,
        equippedGear: state.equippedGear,
        cacheBuffer: state.cacheBuffer,
        credits: state.credits,
        cores: state.cores,
        currentSectorWorld: state.currentSectorWorld,
        currentSectorLevel: state.currentSectorLevel,
        cacheLevel: state.cacheLevel,
        cacheSlots: state.cacheSlots,
        autoSalvageThreshold: state.autoSalvageThreshold,
        cacheFabrication: state.cacheFabrication,
        pendingComparisonGear: state.pendingComparisonGear,
        comparisonQueue: state.comparisonQueue,
        overclockExpiresAtMs: state.overclockExpiresAtMs,
      }),
      merge: (persistedState, currentState): GameStoreState => {
        const persisted = (persistedState ?? {}) as Partial<PersistedGameSnapshot>;
        return {
          ...currentState,
          ...persisted,
          cacheFabrication: persisted.cacheFabrication ?? null,
          pendingComparisonGear: persisted.pendingComparisonGear ?? null,
          comparisonQueue: persisted.comparisonQueue ?? [],
          overclockExpiresAtMs: persisted.overclockExpiresAtMs ?? null,
        };
      },
    },
  ),
);
