/**
 * Holographic rarity glow / shimmer frame — View-only, Expo Go safe.
 * Caps child Views; no Animated / shadows required for the shimmer band.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Rarity } from '../../types/game';
import { rarityVisual } from '../../theme/rarityVisuals';
import { RADII } from '../../theme/colors';

type HoloRarityFrameProps = {
  rarity: Rarity | null | undefined;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When false, only border tint — no shimmer band (cheaper). */
  shimmer?: boolean;
};

/**
 * Lightweight shimmer phase driven by a capped interval (not per-frame).
 * Shared across frames via module timer so many cells don't spawn intervals.
 */
let shimmerPhase = 0;
const shimmerListeners = new Set<(phase: number) => void>();
let shimmerTimer: ReturnType<typeof setInterval> | null = null;

function ensureShimmerClock(): void {
  if (shimmerTimer !== null) return;
  shimmerTimer = setInterval(() => {
    shimmerPhase = (shimmerPhase + 1) % 12;
    for (const listener of shimmerListeners) {
      listener(shimmerPhase);
    }
  }, 90);
}

function releaseShimmerClock(): void {
  if (shimmerListeners.size > 0) return;
  if (shimmerTimer !== null) {
    clearInterval(shimmerTimer);
    shimmerTimer = null;
  }
}

function useShimmerPhase(enabled: boolean): number {
  const [phase, setPhase] = useState(shimmerPhase);
  useEffect(() => {
    if (!enabled) return undefined;
    ensureShimmerClock();
    shimmerListeners.add(setPhase);
    return () => {
      shimmerListeners.delete(setPhase);
      releaseShimmerClock();
    };
  }, [enabled]);
  return enabled ? phase : 0;
}

export function HoloRarityFrame({
  rarity,
  children,
  style,
  shimmer = true,
}: HoloRarityFrameProps): React.ReactElement {
  const visual = rarityVisual(rarity);
  const phase = useShimmerPhase(shimmer && rarity != null);
  const bandLeft = `${(phase / 12) * 100}%` as `${number}%`;

  return (
    <View
      style={[
        styles.frame,
        {
          borderColor: visual.core,
          backgroundColor: visual.wash,
        },
        style,
      ]}
    >
      {shimmer && rarity ? (
        <View pointerEvents="none" style={styles.shimmerTrack}>
          <View
            style={[
              styles.shimmerBand,
              {
                left: bandLeft,
                backgroundColor: visual.shimmer,
              },
            ]}
          />
        </View>
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.innerGlow, { borderColor: visual.glow }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: RADII.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerTrack: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  shimmerBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '18%',
    opacity: 0.55,
  },
  innerGlow: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.sm,
    opacity: 0.55,
  },
});

export default HoloRarityFrame;
