/**
 * 0.6s Relic Decryption sequence before GearComparison modal.
 * Sigil → rarity flash → radial rings; expo-haptics on reveal.
 * View-only / Expo Go safe (no Skia).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { hapticRelicReveal } from '../../services/haptics';
import { COLORS, FONTS, RADII } from '../../theme/colors';
import { rarityVisual } from '../../theme/rarityVisuals';
import type { GearItem } from '../../types/game';

export const RELIC_DECRYPTION_MS = 600;

type RelicDecryptionSequenceProps = {
  item: GearItem;
  onComplete: () => void;
};

export function RelicDecryptionSequence({
  item,
  onComplete,
}: RelicDecryptionSequenceProps): React.ReactElement {
  const visual = rarityVisual(item.rarity);
  const [tick, setTick] = useState(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    completedRef.current = false;
    const started = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - started;
      setTick(elapsed);
      if (elapsed >= RELIC_DECRYPTION_MS && !completedRef.current) {
        completedRef.current = true;
        clearInterval(interval);
        void hapticRelicReveal().finally(() => {
          onCompleteRef.current();
        });
      }
    }, 32);
    return () => {
      clearInterval(interval);
    };
  }, [item.id]);

  const progress = Math.min(1, tick / RELIC_DECRYPTION_MS);
  const flashOpacity =
    progress > 0.55 && progress < 0.78
      ? Math.sin(((progress - 0.55) / 0.23) * Math.PI) * 0.7
      : 0;
  const rings = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const local = Math.max(0, Math.min(1, (progress - i * 0.12) / 0.7));
        return {
          key: `ring-${i}`,
          size: 48 + local * (72 + i * 28),
          opacity: (1 - local) * (0.55 - i * 0.12),
        };
      }),
    [progress],
  );

  const sigilScale = 0.7 + progress * 0.45;
  const sigilOpacity = 0.35 + progress * 0.65;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.stage, { borderColor: visual.core }]}>
          <Text style={styles.label}>RELIC DECRYPTION</Text>
          <Text style={[styles.rarity, { color: visual.core }]}>
            {item.rarity}
          </Text>

          <View style={styles.sigilWell}>
            {rings.map((ring) => (
              <View
                key={ring.key}
                style={[
                  styles.ring,
                  {
                    width: ring.size,
                    height: ring.size,
                    borderRadius: ring.size / 2,
                    opacity: ring.opacity,
                    borderColor: visual.glow,
                  },
                ]}
              />
            ))}
            <View
              style={[
                styles.sigil,
                {
                  borderColor: visual.core,
                  backgroundColor: visual.wash,
                  opacity: sigilOpacity,
                  transform: [{ scale: sigilScale }],
                },
              ]}
            >
              <View style={[styles.sigilCrossH, { backgroundColor: visual.core }]} />
              <View style={[styles.sigilCrossV, { backgroundColor: visual.core }]} />
              <View
                style={[
                  styles.sigilDiamond,
                  { borderColor: visual.glow },
                ]}
              />
            </View>
            {flashOpacity > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.rarityFlash,
                  {
                    opacity: flashOpacity,
                    backgroundColor: visual.glow,
                  },
                ]}
              />
            ) : null}
          </View>

          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(progress * 100)}%` as `${number}%`,
                  backgroundColor: visual.core,
                },
              ]}
            />
          </View>
          <Text style={styles.hint}>SYNCHRONIZING TELEMETRY…</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  stage: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderRadius: RADII.lg,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  label: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  rarity: {
    marginTop: 6,
    fontFamily: FONTS.mono,
    fontSize: 14,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  sigilWell: {
    marginTop: 18,
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  sigil: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderRadius: RADII.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilCrossH: {
    position: 'absolute',
    width: '62%',
    height: 2,
  },
  sigilCrossV: {
    position: 'absolute',
    width: 2,
    height: '62%',
  },
  sigilDiamond: {
    width: 22,
    height: 22,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  rarityFlash: {
    ...StyleSheet.absoluteFill,
    borderRadius: 90,
  },
  itemName: {
    marginTop: 10,
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  progressTrack: {
    marginTop: 14,
    width: '100%',
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  hint: {
    marginTop: 10,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
});

export default RelicDecryptionSequence;
