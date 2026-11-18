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

/** Manufacturer affinities — drive 2/4/6-piece set resonance bonuses */
export const MANUFACTURER_AFFINITIES = [
  'AETHER-DYNAMICS',
  'KINETIC-FORGE',
  'VOID-SYNTH',
] as const;

export type ManufacturerAffinity = (typeof MANUFACTURER_AFFINITIES)[number];

/** Compact badge labels for loadout / comparison chrome */
export const AFFINITY_BADGE: Readonly<Record<ManufacturerAffinity, string>> = {
  'AETHER-DYNAMICS': 'AETH',
  'KINETIC-FORGE': 'KFRG',
  'VOID-SYNTH': 'VOID',
};

/** Piece thresholds that unlock resonance tiers */
export const AFFINITY_RESONANCE_TIERS = [2, 4, 6] as const;

export type AffinityResonanceTier = (typeof AFFINITY_RESONANCE_TIERS)[number] | 0;

/**
 * Signature set bonus per manufacturer (activates at ≥2 matching pieces).
 * AETHER-DYNAMICS → fire rate · KINETIC-FORGE → Gold Credit yield · VOID-SYNTH → crit damage
 */
export const AFFINITY_SET_BONUS: Readonly<
  Record<
    ManufacturerAffinity,
    Readonly<{
      fireRateBonus: number;
      goldCreditYieldBonus: number;
      critDamageBonus: number;
      label: string;
    }>
  >
> = {
  'AETHER-DYNAMICS': {
    fireRateBonus: 0.15,
    goldCreditYieldBonus: 0,
    critDamageBonus: 0,
    label: '+15% FIRE RATE',
  },
  'KINETIC-FORGE': {
    fireRateBonus: 0,
    goldCreditYieldBonus: 0.2,
    critDamageBonus: 0,
    label: '+20% GC YIELD',
  },
  'VOID-SYNTH': {
    fireRateBonus: 0,
    goldCreditYieldBonus: 0,
    critDamageBonus: 0.25,
    label: '+25% CRIT DMG',
  },
};

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
  /** Manufacturer affinity for set resonance */
  affinity: ManufacturerAffinity;
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
  /**
   * World 2+ AUTO-DECRYPT: auto-spend Gold Credits to open caches
   * up to batch capacity per tick cycle. Ignored in World 1.
   */
  autoDecryptEnabled: boolean;
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

/** Per-affinity piece count + unlocked resonance tier (0 / 2 / 4 / 6) */
export interface AffinityResonanceStatus {
  affinity: ManufacturerAffinity;
  pieces: number;
  tier: AffinityResonanceTier;
  /** True when ≥2 pieces — signature set bonus is live */
  active: boolean;
  bonusLabel: string;
}

/** Aggregated combat multipliers from equipped affinity sets */
export interface AffinityCombatBonuses {
  fireRateMult: number;
  goldCreditYieldMult: number;
  critDamageMult: number;
  resonance: readonly AffinityResonanceStatus[];
}

/** Highest unlocked resonance tier for a piece count (0 if below 2). */
export function resonanceTierForPieces(pieces: number): AffinityResonanceTier {
  if (pieces >= 6) return 6;
  if (pieces >= 4) return 4;
  if (pieces >= 2) return 2;
  return 0;
}

export function isManufacturerAffinity(
  value: unknown,
): value is ManufacturerAffinity {
  return (
    typeof value === 'string' &&
    (MANUFACTURER_AFFINITIES as readonly string[]).includes(value)
  );
}

/** Count equipped pieces per manufacturer affinity. */
export function countEquippedAffinities(
  equipped: EquippedGear,
): Record<ManufacturerAffinity, number> {
  const counts: Record<ManufacturerAffinity, number> = {
    'AETHER-DYNAMICS': 0,
    'KINETIC-FORGE': 0,
    'VOID-SYNTH': 0,
  };
  for (const item of Object.values(equipped)) {
    if (!item) continue;
    const affinity = isManufacturerAffinity(item.affinity)
      ? item.affinity
      : null;
    if (affinity) {
      counts[affinity] += 1;
    }
  }
  return counts;
}

/**
 * Resolve 2/4/6-piece resonance + stacked set multipliers from the loadout.
 * Each manufacturer contributes its signature bonus when ≥2 pieces are equipped.
 */
export function computeAffinityCombatBonuses(
  equipped: EquippedGear,
): AffinityCombatBonuses {
  const counts = countEquippedAffinities(equipped);
  let fireRateMult = 1;
  let goldCreditYieldMult = 1;
  let critDamageMult = 1;
  const resonance: AffinityResonanceStatus[] = [];

  for (const affinity of MANUFACTURER_AFFINITIES) {
    const pieces = counts[affinity];
    const tier = resonanceTierForPieces(pieces);
    const active = pieces >= 2;
    const spec = AFFINITY_SET_BONUS[affinity];
    if (active) {
      fireRateMult += spec.fireRateBonus;
      goldCreditYieldMult += spec.goldCreditYieldBonus;
      critDamageMult += spec.critDamageBonus;
    }
    resonance.push({
      affinity,
      pieces,
      tier,
      active,
      bonusLabel: spec.label,
    });
  }

  return {
    fireRateMult,
    goldCreditYieldMult,
    critDamageMult,
    resonance,
  };
}
