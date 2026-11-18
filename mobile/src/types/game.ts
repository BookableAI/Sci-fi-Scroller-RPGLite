/**
 * Sector Sentinel — core game type definitions.
 * Terminology: Supply Cache, Standard Credits, Gold Credits, Sub-Routine Cores.
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
  /** Salvage payout in Standard Credits */
  salvageValue: number;
}

export type EquippedGear = Partial<Record<GearSlot, GearItem>>;

export interface PlayerState {
  /** Standard Credits — common salvage currency for Cache upgrades */
  standardCredits: number;
  /** Gold Credits — scarcer currency spent to open Supply Caches */
  goldCredits: number;
  /** Sub-Routine Cores — IAP / premium currency */
  cores: number;
  currentSectorWorld: number;
  currentSectorLevel: number;
  cacheLevel: number;
  equippedGear: EquippedGear;
}

/** Gear held in inventory (unequipped) */
export type Inventory = GearItem[];

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

/**
 * Gold Credits spent to open one Supply Cache.
 * Early kills grant ~1 GC; cost 5 → open roughly every 5 kills early-game.
 */
export const OPEN_CACHE_GOLD_COST = 5;

/** Active Cache Upgrade fabrication job (Standard Credits already spent). */
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
  standardCredits: number;
  goldCredits: number;
  cores: number;
  currentSectorWorld: number;
  currentSectorLevel: number;
  cacheLevel: number;
  /** Rarity below which auto-salvage applies; null disables filter */
  autoSalvageThreshold: Rarity | null;
  /** In-progress Cache Upgrade fabrication; null when idle */
  cacheFabrication: CacheFabricationJob | null;
  /**
   * Newly opened gear awaiting comparison modal resolution.
   * Held here (and in inventory) until EQUIP & SALVAGE OLD / SALVAGE IMMEDIATELY.
   */
  pendingComparisonGear: GearItem | null;
  /** Additional opened gear queued behind the active comparison modal */
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
}
