/**
 * AUTONOMOUS PATROL REPORT — offline STC/GC yield claim modal.
 * CLAIM grants 1×; 2X CLAIM [AD] routes through AdMobManager rewarded
 * (Expo Go soft-fails without granting the double).
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatAwayDuration } from '../../engine/combatEconomy';
import { useGameStore } from '../../store/useGameStore';
import { COLORS, FONTS, RADII } from '../../theme/colors';

function getAdMobManager(): {
  showOfflinePatrol2xRewarded: () => Promise<boolean>;
  isNativeAvailable: () => boolean;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (
      require('../../services/AdMobManager') as typeof import('../../services/AdMobManager')
    ).AdMobManager;
  } catch {
    return null;
  }
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US');
}

export function AutonomousPatrolModal(): React.ReactElement | null {
  const pending = useGameStore((s) => s.pendingOfflinePatrol);
  const claimOfflinePatrol = useGameStore((s) => s.claimOfflinePatrol);
  const [claiming2x, setClaiming2x] = useState(false);
  const [adHint, setAdHint] = useState<string | null>(null);

  if (!pending) {
    return null;
  }

  const away = formatAwayDuration(pending.elapsedMs);
  const cappedNote =
    pending.elapsedMs >= 8 * 60 * 60 * 1000
      ? 'ACCRUAL CAPPED AT 8H PATROL WINDOW'
      : 'EXO-RIG AUTONOMOUS SECTOR SWEEP';

  const onClaim = (): void => {
    claimOfflinePatrol(1);
    setAdHint(null);
  };

  const onClaim2x = async (): Promise<void> => {
    if (claiming2x) {
      return;
    }
    setClaiming2x(true);
    setAdHint(null);
    try {
      const ads = getAdMobManager();
      if (!ads) {
        setAdHint('RELAY OFFLINE · USE STANDARD CLAIM');
        return;
      }
      if (!ads.isNativeAvailable()) {
        // Expo Go / unlinked native ads — soft-fail, keep 1× claim available.
        setAdHint('AD RELAY UNAVAILABLE IN EXPO GO · CLAIM 1×');
        return;
      }
      const shown = await ads.showOfflinePatrol2xRewarded();
      if (!shown) {
        setAdHint('REWARD UPLINK NOT READY · RETRY OR CLAIM 1×');
      }
      // On success, AdMobManager EARNED_REWARD calls claimOfflinePatrol(2).
    } catch {
      setAdHint('REWARD UPLINK FAILED · CLAIM 1×');
    } finally {
      setClaiming2x(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClaim}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>SECTOR SENTINEL · TELEMETRY</Text>
          <Text style={styles.header}>AUTONOMOUS PATROL REPORT</Text>
          <Text style={styles.sub}>{cappedNote}</Text>

          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>TIME AWAY</Text>
            <Text style={styles.statValue}>{away}</Text>
          </View>

          <View style={styles.yieldRow}>
            <View style={styles.yieldCell}>
              <Text style={styles.yieldLabel}>STC SALVAGE</Text>
              <Text style={[styles.yieldValue, styles.stc]}>
                {`+${formatAmount(pending.standardCredits)}`}
              </Text>
            </View>
            <View style={styles.yieldDivider} />
            <View style={styles.yieldCell}>
              <Text style={styles.yieldLabel}>GC SALVAGE</Text>
              <Text style={[styles.yieldValue, styles.gc]}>
                {`+${formatAmount(pending.goldCredits)}`}
              </Text>
            </View>
          </View>

          <Text style={styles.kills}>
            {`EST. HOSTILES NEUTRALIZED  ${formatAmount(pending.estimatedKills)}`}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Claim patrol credits"
            onPress={onClaim}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>CLAIM</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Claim double patrol credits with rewarded ad"
            onPress={() => {
              void onClaim2x();
            }}
            disabled={claiming2x}
            style={[styles.secondaryBtn, claiming2x && styles.secondaryBtnDisabled]}
          >
            {claiming2x ? (
              <ActivityIndicator color={COLORS.gold} />
            ) : (
              <Text style={styles.secondaryBtnText}>2X CLAIM [AD]</Text>
            )}
          </Pressable>

          {adHint !== null && (
            <Text style={styles.hint}>{adHint}</Text>
          )}
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
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.lg,
    padding: 16,
  },
  eyebrow: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  header: {
    marginTop: 6,
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 14,
    letterSpacing: 1.1,
  },
  sub: {
    marginTop: 6,
    color: COLORS.teal,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  statBlock: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    backgroundColor: COLORS.panel,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  statValue: {
    marginTop: 4,
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 22,
    letterSpacing: 0.5,
  },
  yieldRow: {
    marginTop: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    backgroundColor: COLORS.panel,
    overflow: 'hidden',
  },
  yieldCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  yieldDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  yieldLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  yieldValue: {
    marginTop: 4,
    fontFamily: FONTS.mono,
    fontSize: 16,
  },
  stc: {
    color: COLORS.cyan,
  },
  gc: {
    color: COLORS.gold,
  },
  kills: {
    marginTop: 10,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: COLORS.cyan,
    borderRadius: RADII.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.void,
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADII.md,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryBtnDisabled: {
    opacity: 0.6,
  },
  secondaryBtnText: {
    color: COLORS.gold,
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
  },
  hint: {
    marginTop: 10,
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
