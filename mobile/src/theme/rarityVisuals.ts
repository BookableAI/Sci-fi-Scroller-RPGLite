/**
 * Rarity → holographic glow / aura / shimmer tokens (Expo Go View-safe).
 */

import type { Rarity } from '../types/game';
import { RARITY_RANK } from '../types/game';
import { COLORS } from './colors';

export interface RarityVisual {
  core: string;
  glow: string;
  shimmer: string;
  /** Soft fill wash for holographic frames */
  wash: string;
}

export const RARITY_VISUALS: Readonly<Record<Rarity, RarityVisual>> = {
  COMMON: {
    core: COLORS.muted,
    glow: COLORS.borderGlow,
    shimmer: 'rgba(139, 155, 184, 0.35)',
    wash: 'rgba(139, 155, 184, 0.06)',
  },
  UNCOMMON: {
    core: COLORS.teal,
    glow: '#5EEAD4',
    shimmer: 'rgba(45, 212, 191, 0.4)',
    wash: 'rgba(45, 212, 191, 0.08)',
  },
  RARE: {
    core: COLORS.cyan,
    glow: COLORS.projectile,
    shimmer: 'rgba(56, 189, 248, 0.45)',
    wash: 'rgba(56, 189, 248, 0.09)',
  },
  EPIC: {
    core: COLORS.violet,
    glow: '#C4B5FD',
    shimmer: 'rgba(167, 139, 250, 0.5)',
    wash: 'rgba(167, 139, 250, 0.1)',
  },
  LEGENDARY: {
    core: COLORS.amber,
    glow: COLORS.gold,
    shimmer: 'rgba(251, 191, 36, 0.55)',
    wash: 'rgba(251, 191, 36, 0.1)',
  },
  MYTHIC: {
    core: COLORS.gold,
    glow: '#FFE08A',
    shimmer: 'rgba(245, 215, 110, 0.6)',
    wash: 'rgba(245, 215, 110, 0.12)',
  },
  CELESTIAL: {
    core: COLORS.celestial,
    glow: COLORS.gold,
    shimmer: 'rgba(248, 250, 252, 0.65)',
    wash: 'rgba(248, 250, 252, 0.12)',
  },
};

export function rarityVisual(rarity: Rarity | null | undefined): RarityVisual {
  if (!rarity) return RARITY_VISUALS.COMMON;
  return RARITY_VISUALS[rarity];
}

/** Highest equipped rarity, or COMMON when bare. */
export function maxEquippedRarity(
  rarities: readonly (Rarity | null | undefined)[],
): Rarity {
  let best: Rarity = 'COMMON';
  let bestRank = -1;
  for (const rarity of rarities) {
    if (!rarity) continue;
    const rank = RARITY_RANK[rarity];
    if (rank > bestRank) {
      best = rarity;
      bestRank = rank;
    }
  }
  return best;
}
