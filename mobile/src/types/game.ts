/**
 * Sector Sentinel — core game type definitions.
 * Terminology: Supply Cache, Salvage Credits, Sub-Routine Cores.
 */

export const RARITIES = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY',
  'MYTHIC',
  'CELESTIAL',
] as const;

export type Rarity = (typeof RARITIES)[number];

export const GEAR_SLOTS = [
  'WEAPON',
  'CHASSIS',
  'PROPULSION',
  'SHIELD',
  'CORE_AI',
  'UTILITY',
] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  powerRating: number;
  primaryStat: number;
  secondaryStat: number;
  salvageValue: number;
}

export interface SupplyCache {
  id: string;
  tier: number;
  decryptionTimeSeconds: number;
  isDecrypting: boolean;
  /** 0–1 progress toward decryption completion */
  progress: number;
}

export type EquippedGear = Partial<Record<GearSlot, GearItem>>;

export interface PlayerState {
  /** Salvage Credits */
  credits: number;
  /** Sub-Routine Cores */
  cores: number;
  currentSectorWorld: number;
  currentSectorLevel: number;
  cacheLevel: number;
  /** Max Supply Cache buffer slots (blueprint: 6) */
  cacheSlots: number;
  equippedGear: EquippedGear;
}

/** Gear held in inventory (unequipped) */
export type Inventory = GearItem[];

/** Supply Cache buffer — hard cap of CACHE_BUFFER_CAPACITY slots */
export type CacheBuffer = SupplyCache[];

export const CACHE_BUFFER_CAPACITY = 6;

/** Ordered rarity rank for threshold comparisons (lower = worse) */
export const RARITY_RANK: Readonly<Record<Rarity, number>> = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
  CELESTIAL: 6,
};

export type PersistedGameSnapshot = {
  inventory: Inventory;
  equippedGear: EquippedGear;
  cacheBuffer: CacheBuffer;
  credits: number;
  cores: number;
  currentSectorWorld: number;
  currentSectorLevel: number;
  cacheLevel: number;
  cacheSlots: number;
  /** Rarity below which auto-salvage applies; null disables filter */
  autoSalvageThreshold: Rarity | null;
};
