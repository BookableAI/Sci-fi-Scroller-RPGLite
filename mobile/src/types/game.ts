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

/** Active Cache Upgrade fabrication job (Salvage Credits already spent). */
export interface CacheFabricationJob {
  targetLevel: number;
  durationSeconds: number;
  /** 0–1 fabrication progress */
  progress: number;
}

/** Player-selectable combat targeting priority */
export const TARGETING_PROTOCOLS = [
  'CLOSEST',
  'STRONGEST',
  'FURTHEST',
  'WEAKEST',
] as const;

export type TargetingProtocol = (typeof TARGETING_PROTOCOLS)[number];

export const TARGETING_PROTOCOL_LABELS: Readonly<
  Record<TargetingProtocol, string>
> = {
  CLOSEST: 'CLOSEST FIRST',
  STRONGEST: 'STRONGEST FIRST',
  FURTHEST: 'FURTHEST FIRST',
  WEAKEST: 'WEAKEST FIRST',
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
  /** In-progress Cache Upgrade fabrication; null when idle */
  cacheFabrication: CacheFabricationJob | null;
  /**
   * Newly decrypted gear awaiting comparison modal resolution.
   * Held here (and in inventory) until EQUIP & SALVAGE OLD / SALVAGE IMMEDIATELY.
   */
  pendingComparisonGear: GearItem | null;
  /** Additional decrypted gear queued behind the active comparison modal */
  comparisonQueue: GearItem[];
  /** Epoch ms when System Overclock (2x) expires; null when inactive */
  overclockExpiresAtMs: number | null;
  /** Combat aim priority protocol (persisted) */
  targetingProtocol: TargetingProtocol;
};

/** Derived loadout telemetry shown in TelemetryPanel */
export interface TelemetryStats {
  totalPowerRating: number;
  kineticOutput: number;
  deflectionIndex: number;
  coreProcessingSpeed: number;
};
