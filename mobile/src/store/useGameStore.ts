/**
 * Sector Sentinel — Zustand game store with MMKV persistence.
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

import {
  generateGearItem,
  getUpgradeRequirements,
  decryptionTimeForTier,
} from '../engine/ProbabilityMatrix';
import {
  CACHE_BUFFER_CAPACITY,
  RARITY_RANK,
  type CacheBuffer,
  type EquippedGear,
  type GearItem,
  type Inventory,
  type PersistedGameSnapshot,
  type Rarity,
  type SupplyCache,
} from '../types/game';

const mmkv = new MMKV({ id: 'sector-sentinel-game' });

const mmkvStateStorage: StateStorage = {
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

export interface GameStoreState extends PersistedGameSnapshot {
  addCache: (tier?: number) => boolean;
  decryptCache: (id: string) => GearItem | null;
  equipItem: (item: GearItem) => void;
  salvageItem: (item: GearItem) => number;
  upgradeCacheLevel: () => boolean;
  autoSalvageBelowThreshold: (rarity: Rarity) => number;
  /** Active parallel decryption slots for World 2+ auto-open protocol */
  getBatchCapacity: () => number;
  /** Tick decrypting caches; completes when progress reaches 1 */
  tickDecryption: (deltaSeconds: number) => GearItem[];
  /** Sum of equipped Power Ratings (minimum baseline applied) */
  getTotalPowerRating: () => number;
  /**
   * Combat kill payout: Salvage Credits, optional Supply Cache drop,
   * then sector level++ (level past 10 advances World and resets to 1).
   */
  applyCombatVictory: (salvageCredits: number, dropSupplyCache: boolean) => void;
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

      getBatchCapacity: (): number => getBatchCapacity(get().currentSectorWorld),

      getTotalPowerRating: (): number => computeTotalPowerRating(get().equippedGear),

      applyCombatVictory: (salvageCredits: number, dropSupplyCache: boolean): void => {
        const state = get();
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

        // Already decrypting and finished → open into inventory
        if (target.progress < 1) {
          return null;
        }

        const item = generateGearItem(state.cacheLevel);
        const remaining = state.cacheBuffer.filter((c) => c.id !== id);
        let inventory = [...state.inventory, item];
        let credits = state.credits;

        const threshold = state.autoSalvageThreshold;
        if (threshold !== null && RARITY_RANK[item.rarity] < RARITY_RANK[threshold]) {
          credits += item.salvageValue;
          inventory = inventory.filter((g) => g.id !== item.id);
          set({ cacheBuffer: remaining, inventory, credits });
          return item;
        }

        set({ cacheBuffer: remaining, inventory });
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
        const { costCredits, nextLevel } = getUpgradeRequirements(state.cacheLevel);
        if (state.cacheLevel >= 15) {
          return false;
        }
        if (state.credits < costCredits) {
          return false;
        }
        set({
          credits: state.credits - costCredits,
          cacheLevel: nextLevel,
        });
        return true;
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

      tickDecryption: (deltaSeconds: number): GearItem[] => {
        const state = get();
        if (deltaSeconds <= 0 || state.cacheBuffer.length === 0) {
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

        const stillPending = buffer.filter((c) => {
          if (!completedIds.includes(c.id)) {
            return true;
          }
          const item = generateGearItem(state.cacheLevel);
          if (threshold !== null && RARITY_RANK[item.rarity] < RARITY_RANK[threshold]) {
            credits += item.salvageValue;
          } else {
            inventory.push(item);
          }
          opened.push(item);
          return false;
        });

        set({
          cacheBuffer: stillPending,
          inventory,
          credits,
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
      }),
    },
  ),
);
