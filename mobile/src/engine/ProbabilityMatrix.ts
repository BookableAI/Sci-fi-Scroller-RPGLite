/**
 * Supply Cache drop probability matrix & gear generator (master-plan §2.5).
 */

import {
  GEAR_SLOTS,
  MANUFACTURER_AFFINITIES,
  type GearItem,
  type GearSlot,
  type ManufacturerAffinity,
  type Rarity,
  RARITIES,
} from '../types/game';

export type Rng = () => number;

export type RarityWeights = Readonly<Record<Rarity, number>>;

export interface CacheLevelRow {
  level: number;
  weights: RarityWeights;
  upgradeCostCredits: number;
  /** Fabrication timer to reach this level from the previous (seconds). Level 1 = 0. */
  upgradeTimerSeconds: number;
}

/** Exact percent rows from master-plan §2.5 (Cache Level 1–15+). */
export const CACHE_LEVEL_MATRIX: readonly CacheLevelRow[] = [
  {
    level: 1,
    weights: {
      COMMON: 100.0,
      UNCOMMON: 0.0,
      RARE: 0.0,
      EPIC: 0.0,
      LEGENDARY: 0.0,
      MYTHIC: 0.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 0,
    upgradeTimerSeconds: 0,
  },
  {
    level: 2,
    weights: {
      COMMON: 92.0,
      UNCOMMON: 8.0,
      RARE: 0.0,
      EPIC: 0.0,
      LEGENDARY: 0.0,
      MYTHIC: 0.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 500,
    upgradeTimerSeconds: 10,
  },
  {
    level: 3,
    weights: {
      COMMON: 78.0,
      UNCOMMON: 18.0,
      RARE: 4.0,
      EPIC: 0.0,
      LEGENDARY: 0.0,
      MYTHIC: 0.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 1_500,
    upgradeTimerSeconds: 30,
  },
  {
    level: 4,
    weights: {
      COMMON: 60.0,
      UNCOMMON: 27.0,
      RARE: 11.0,
      EPIC: 2.0,
      LEGENDARY: 0.0,
      MYTHIC: 0.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 4_000,
    upgradeTimerSeconds: 60,
  },
  {
    level: 5,
    weights: {
      COMMON: 42.0,
      UNCOMMON: 33.0,
      RARE: 18.0,
      EPIC: 6.0,
      LEGENDARY: 1.0,
      MYTHIC: 0.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 10_000,
    upgradeTimerSeconds: 5 * 60,
  },
  {
    level: 6,
    weights: {
      COMMON: 28.0,
      UNCOMMON: 34.0,
      RARE: 24.0,
      EPIC: 11.0,
      LEGENDARY: 3.0,
      MYTHIC: 0.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 25_000,
    upgradeTimerSeconds: 15 * 60,
  },
  {
    level: 7,
    weights: {
      COMMON: 16.0,
      UNCOMMON: 30.0,
      RARE: 30.0,
      EPIC: 17.0,
      LEGENDARY: 6.0,
      MYTHIC: 1.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 60_000,
    upgradeTimerSeconds: 30 * 60,
  },
  {
    level: 8,
    weights: {
      COMMON: 8.0,
      UNCOMMON: 24.0,
      RARE: 33.0,
      EPIC: 22.0,
      LEGENDARY: 10.0,
      MYTHIC: 3.0,
      CELESTIAL: 0.0,
    },
    upgradeCostCredits: 150_000,
    upgradeTimerSeconds: 60 * 60,
  },
  {
    level: 9,
    weights: {
      COMMON: 3.0,
      UNCOMMON: 16.0,
      RARE: 32.0,
      EPIC: 27.0,
      LEGENDARY: 15.0,
      MYTHIC: 6.0,
      CELESTIAL: 1.0,
    },
    upgradeCostCredits: 350_000,
    upgradeTimerSeconds: 2 * 60 * 60,
  },
  {
    level: 10,
    weights: {
      COMMON: 1.0,
      UNCOMMON: 10.0,
      RARE: 28.0,
      EPIC: 30.0,
      LEGENDARY: 20.0,
      MYTHIC: 9.0,
      CELESTIAL: 2.0,
    },
    upgradeCostCredits: 800_000,
    upgradeTimerSeconds: 4 * 60 * 60,
  },
  {
    level: 11,
    weights: {
      COMMON: 0.0,
      UNCOMMON: 7.0,
      RARE: 22.0,
      EPIC: 31.0,
      LEGENDARY: 24.0,
      MYTHIC: 13.0,
      CELESTIAL: 3.0,
    },
    upgradeCostCredits: 1_800_000,
    upgradeTimerSeconds: 8 * 60 * 60,
  },
  {
    level: 12,
    weights: {
      COMMON: 0.0,
      UNCOMMON: 5.0,
      RARE: 18.0,
      EPIC: 30.0,
      LEGENDARY: 26.0,
      MYTHIC: 16.0,
      CELESTIAL: 5.0,
    },
    upgradeCostCredits: 4_000_000,
    upgradeTimerSeconds: 12 * 60 * 60,
  },
  {
    level: 13,
    weights: {
      COMMON: 0.0,
      UNCOMMON: 3.0,
      RARE: 14.0,
      EPIC: 28.0,
      LEGENDARY: 28.0,
      MYTHIC: 20.0,
      CELESTIAL: 7.0,
    },
    upgradeCostCredits: 9_000_000,
    upgradeTimerSeconds: 18 * 60 * 60,
  },
  {
    level: 14,
    weights: {
      COMMON: 0.0,
      UNCOMMON: 1.0,
      RARE: 10.0,
      EPIC: 25.0,
      LEGENDARY: 30.0,
      MYTHIC: 24.0,
      CELESTIAL: 10.0,
    },
    upgradeCostCredits: 20_000_000,
    upgradeTimerSeconds: 24 * 60 * 60,
  },
  {
    level: 15,
    weights: {
      COMMON: 0.0,
      UNCOMMON: 0.0,
      RARE: 5.0,
      EPIC: 20.0,
      LEGENDARY: 32.0,
      MYTHIC: 28.0,
      CELESTIAL: 15.0,
    },
    upgradeCostCredits: 50_000_000,
    upgradeTimerSeconds: 48 * 60 * 60,
  },
] as const;

/** PR rarity tier multipliers used in PR = primary*1.5 + secondary*0.8 + mult*10 */
export const RARITY_MULTIPLIER: Readonly<Record<Rarity, number>> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 5,
  LEGENDARY: 8,
  MYTHIC: 12,
  CELESTIAL: 20,
};

const SLOT_NAME_POOL: Readonly<Record<GearSlot, readonly string[]>> = {
  WEAPON: [
    'Railgun Core',
    'Kinetic Lance',
    'Arc Emitter',
    'Thermal Spike',
    'Plasma Node',
  ],
  CHASSIS: [
    'Ablative Mark-IV',
    'Composite Hull',
    'Energy Matrix Plate',
    'Carbide Carapace',
    'Reactive Lattice',
  ],
  PROPULSION: [
    'Ion Thruster Array',
    'Graviton Drive',
    'Afterburner Coil',
    'Vector Jet Pack',
    'Pulse Impeller',
  ],
  SHIELD: [
    'Deflector Array',
    'Pulse Shield',
    'Particle Barrier',
    'Phase Screen',
    'Kinetic Ward',
  ],
  CORE_AI: [
    'Sub-Routine Core',
    'Tactical Node',
    'Neural Mesh',
    'Logic Lattice',
    'Heuristic Kernel',
  ],
  UTILITY: [
    'Nanite Repair Kit',
    'Target Matrix',
    'Energy Recycler',
    'Telemetry Beacon',
    'Salvage Extractor',
  ],
};

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Clamp cache level into matrix bounds; levels above 15 use the Level 15+ row. */
export function resolveCacheLevelRow(cacheLevel: number): CacheLevelRow {
  const clamped = Math.max(1, Math.floor(cacheLevel));
  if (clamped >= 15) {
    return CACHE_LEVEL_MATRIX[CACHE_LEVEL_MATRIX.length - 1];
  }
  return CACHE_LEVEL_MATRIX[clamped - 1];
}

/** Cost/timer to upgrade FROM currentLevel TO currentLevel+1 (uses next row). */
export function getUpgradeRequirements(currentCacheLevel: number): {
  costCredits: number;
  timerSeconds: number;
  nextLevel: number;
} {
  const nextLevel = Math.max(1, Math.floor(currentCacheLevel)) + 1;
  const row = resolveCacheLevelRow(nextLevel);
  return {
    costCredits: row.upgradeCostCredits,
    timerSeconds: row.upgradeTimerSeconds,
    nextLevel: Math.min(nextLevel, 15),
  };
}

export function sampleRarity(weights: RarityWeights, rng: Rng = Math.random): Rarity {
  const roll = rng() * 100;
  let cumulative = 0;
  for (const rarity of RARITIES) {
    cumulative += weights[rarity];
    if (roll < cumulative) {
      return rarity;
    }
  }
  // Floating-point fallback: last rarity with non-zero weight, else CELESTIAL
  for (let i = RARITIES.length - 1; i >= 0; i -= 1) {
    const rarity = RARITIES[i];
    if (weights[rarity] > 0) {
      return rarity;
    }
  }
  return 'COMMON';
}

function pickSlot(rng: Rng): GearSlot {
  const index = Math.floor(rng() * GEAR_SLOTS.length);
  return GEAR_SLOTS[Math.min(index, GEAR_SLOTS.length - 1)];
}

function pickName(slot: GearSlot, rng: Rng): string {
  const pool = SLOT_NAME_POOL[slot];
  const index = Math.floor(rng() * pool.length);
  return pool[Math.min(index, pool.length - 1)];
}

/** Uniform manufacturer affinity roll across AETHER-DYNAMICS / KINETIC-FORGE / VOID-SYNTH. */
export function sampleManufacturerAffinity(
  rng: Rng = Math.random,
): ManufacturerAffinity {
  const index = Math.floor(rng() * MANUFACTURER_AFFINITIES.length);
  return MANUFACTURER_AFFINITIES[
    Math.min(index, MANUFACTURER_AFFINITIES.length - 1)
  ];
}

/**
 * Backfill manufacturer affinity on legacy persisted gear (pre-affinity saves).
 * Deterministic from gear id so reloads stay stable.
 */
export function ensureGearAffinity(
  item: Omit<GearItem, 'affinity'> & { affinity?: unknown },
): GearItem {
  if (
    typeof item.affinity === 'string' &&
    (MANUFACTURER_AFFINITIES as readonly string[]).includes(item.affinity)
  ) {
    return item as GearItem;
  }
  let hash = 0;
  for (let i = 0; i < item.id.length; i += 1) {
    hash = (hash * 31 + item.id.charCodeAt(i)) >>> 0;
  }
  const affinity =
    MANUFACTURER_AFFINITIES[hash % MANUFACTURER_AFFINITIES.length];
  return { ...item, affinity };
}

function rollStat(
  base: number,
  spread: number,
  rarityMult: number,
  cacheLevel: number,
  rng: Rng,
): number {
  const levelScale = 1 + (Math.max(1, cacheLevel) - 1) * 0.12;
  const raw = (base + rng() * spread) * rarityMult * levelScale;
  return Math.max(1, Math.round(raw));
}

export function calculatePowerRating(
  primaryStat: number,
  secondaryStat: number,
  rarity: Rarity,
): number {
  const rarityMultiplier = RARITY_MULTIPLIER[rarity];
  return Math.round(
    primaryStat * 1.5 + secondaryStat * 0.8 + rarityMultiplier * 10,
  );
}

function salvageValueFor(
  rarity: Rarity,
  powerRating: number,
  cacheLevel: number,
): number {
  const base = RARITY_MULTIPLIER[rarity] * 25;
  return Math.max(1, Math.round(base + powerRating * 0.15 + cacheLevel * 2));
}

/**
 * Sample §2.5 matrix for `cacheLevel`, roll stats, compute PR, assign sci-fi name
 * + manufacturer affinity (AETHER-DYNAMICS / KINETIC-FORGE / VOID-SYNTH).
 */
export function generateGearItem(
  cacheLevel: number,
  rng: Rng = Math.random,
): GearItem {
  const row = resolveCacheLevelRow(cacheLevel);
  const rarity = sampleRarity(row.weights, rng);
  const rarityMult = RARITY_MULTIPLIER[rarity];
  const slot = pickSlot(rng);
  const name = pickName(slot, rng);
  const affinity = sampleManufacturerAffinity(rng);

  const primaryStat = rollStat(8, 12, rarityMult, cacheLevel, rng);
  const secondaryStat = rollStat(4, 8, rarityMult * 0.75, cacheLevel, rng);
  const powerRating = calculatePowerRating(primaryStat, secondaryStat, rarity);
  const salvageValue = salvageValueFor(rarity, powerRating, cacheLevel);

  return {
    id: nextId('gear'),
    name,
    slot,
    rarity,
    powerRating,
    primaryStat,
    secondaryStat,
    salvageValue,
    affinity,
  };
}

/** Default decryption duration (seconds) by Supply Cache tier / cache level. */
export function decryptionTimeForTier(tier: number): number {
  const t = Math.max(1, Math.floor(tier));
  if (t <= 2) return 5;
  if (t <= 4) return 12;
  if (t <= 6) return 25;
  if (t <= 8) return 45;
  if (t <= 10) return 75;
  if (t <= 12) return 120;
  return 180;
}
