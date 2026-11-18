/**
 * Sector world biomes for BattlerViewport / ArenaBackground.
 * W1 Obsidian Astral Ruins · W2 Crystalline Spire Wastes · W3+ Solar Forge Orbit
 */

import { COLORS } from './colors';

export type BiomeId = 'OBSIDIAN_ASTRAL' | 'CRYSTALLINE_SPIRE' | 'SOLAR_FORGE';

export interface BiomePalette {
  id: BiomeId;
  label: string;
  /** Deep wash behind the arena */
  voidWash: string;
  skyWash: string;
  nebulaA: string;
  nebulaB: string;
  nebulaC: string;
  horizon: string;
  farFill: string;
  farEdge: string;
  midFill: string;
  nearFill: string;
  groundPlane: string;
  groundEdge: string;
  accents: readonly string[];
  starTints: readonly string[];
  scan: string;
}

export const BIOME_BY_WORLD: Readonly<Record<1 | 2 | 3, BiomePalette>> = {
  1: {
    id: 'OBSIDIAN_ASTRAL',
    label: 'OBSIDIAN ASTRAL RUINS',
    voidWash: '#06080F',
    skyWash: 'rgba(14, 18, 40, 0.55)',
    nebulaA: 'rgba(56, 189, 248, 0.08)',
    nebulaB: 'rgba(167, 139, 250, 0.12)',
    nebulaC: 'rgba(30, 41, 59, 0.35)',
    horizon: 'rgba(167, 139, 250, 0.07)',
    farFill: 'rgba(12, 14, 28, 0.9)',
    farEdge: 'rgba(100, 116, 139, 0.55)',
    midFill: 'rgba(18, 22, 40, 0.94)',
    nearFill: 'rgba(24, 30, 48, 0.8)',
    groundPlane: 'rgba(8, 10, 18, 0.96)',
    groundEdge: 'rgba(167, 139, 250, 0.5)',
    accents: [COLORS.violet, COLORS.borderGlow, COLORS.cyan],
    starTints: [COLORS.celestial, COLORS.violet, COLORS.cyan],
    scan: COLORS.violet,
  },
  2: {
    id: 'CRYSTALLINE_SPIRE',
    label: 'CRYSTALLINE SPIRE WASTES',
    voidWash: '#071018',
    skyWash: 'rgba(12, 40, 48, 0.5)',
    nebulaA: 'rgba(45, 212, 191, 0.12)',
    nebulaB: 'rgba(56, 189, 248, 0.1)',
    nebulaC: 'rgba(167, 139, 250, 0.08)',
    horizon: 'rgba(45, 212, 191, 0.1)',
    farFill: 'rgba(10, 28, 36, 0.88)',
    farEdge: 'rgba(45, 212, 191, 0.55)',
    midFill: 'rgba(14, 36, 48, 0.92)',
    nearFill: 'rgba(20, 48, 58, 0.78)',
    groundPlane: 'rgba(6, 18, 24, 0.95)',
    groundEdge: 'rgba(45, 212, 191, 0.65)',
    accents: [COLORS.teal, COLORS.cyan, COLORS.violet],
    starTints: [COLORS.teal, COLORS.cyan, COLORS.celestial],
    scan: COLORS.teal,
  },
  3: {
    id: 'SOLAR_FORGE',
    label: 'SOLAR FORGE ORBIT',
    voidWash: '#100806',
    skyWash: 'rgba(56, 28, 12, 0.48)',
    nebulaA: 'rgba(251, 191, 36, 0.12)',
    nebulaB: 'rgba(220, 38, 38, 0.08)',
    nebulaC: 'rgba(245, 215, 110, 0.07)',
    horizon: 'rgba(251, 191, 36, 0.12)',
    farFill: 'rgba(36, 18, 12, 0.9)',
    farEdge: 'rgba(251, 191, 36, 0.5)',
    midFill: 'rgba(48, 24, 14, 0.92)',
    nearFill: 'rgba(58, 30, 16, 0.8)',
    groundPlane: 'rgba(16, 8, 6, 0.96)',
    groundEdge: 'rgba(245, 215, 110, 0.7)',
    accents: [COLORS.amber, COLORS.gold, COLORS.crimson],
    starTints: [COLORS.gold, COLORS.amber, COLORS.celestial],
    scan: COLORS.amber,
  },
};

/** Map sector world → biome (W4+ reuses Solar Forge Orbit chrome). */
export function biomeForWorld(world: number): BiomePalette {
  if (world <= 1) return BIOME_BY_WORLD[1];
  if (world === 2) return BIOME_BY_WORLD[2];
  return BIOME_BY_WORLD[3];
}
