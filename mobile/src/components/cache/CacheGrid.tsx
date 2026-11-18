/**
 * Supply Cache bay — single Open Cache (Gold) + upgrade (Standard Credits).
 * Auto-open / multi-open deferred.
 */

import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getUpgradeRequirements } from '../../engine/ProbabilityMatrix';
import { useGameStore } from '../../store/useGameStore';
import { COLORS, FONTS, RADII } from '../../theme/colors';
import { OPEN_CACHE_GOLD_COST } from '../../types/game';

/** Lazy monetization accessors — keep ads/purchases packages off the CacheGrid module graph. */
function getAdMobManager(): {
  showFabricationSkipRewarded: () => Promise<boolean>;
  showOverclockRewarded: () => Promise<boolean>;
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

function getPurchaseManager(): {
  purchaseRemoveAds: () => Promise<unknown>;
  purchaseNanitePackSmall: () => Promise<unknown>;
  purchaseNanitePackLarge: () => Promise<unknown>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (
      require('../../services/PurchaseManager') as typeof import('../../services/PurchaseManager')
    ).PurchaseManager;
  } catch {
    return null;
  }
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const remM = Math.floor((s % 3600) / 60);
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US');
}

export function CacheGrid(): React.ReactElement {
  const cacheLevel = useGameStore((s) => s.cacheLevel);
  const standardCredits = useGameStore((s) => s.standardCredits);
  const goldCredits = useGameStore((s) => s.goldCredits);
  const fabrication = useGameStore((s) => s.cacheFabrication);
  const overclockExpiresAtMs = useGameStore((s) => s.overclockExpiresAtMs);
  const openCache = useGameStore((s) => s.openCache);
  const upgradeCacheLevel = useGameStore((s) => s.upgradeCacheLevel);
  const tickFabrication = useGameStore((s) => s.tickFabrication);

  const lastTickRef = useRef<number>(Date.now());
  const overclockActive =
    overclockExpiresAtMs !== null && overclockExpiresAtMs > Date.now();
  const overclockRemainSec =
    overclockActive && overclockExpiresAtMs !== null
      ? Math.max(0, Math.ceil((overclockExpiresAtMs - Date.now()) / 1000))
      : 0;

  useEffect(() => {
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      tickFabrication(delta);
    }, 250);
    return () => clearInterval(id);
  }, [tickFabrication]);

  const upgradeReqs =
    cacheLevel >= 15
      ? null
      : getUpgradeRequirements(cacheLevel);
  const canAffordUpgrade =
    upgradeReqs !== null &&
    standardCredits >= upgradeReqs.costCredits &&
    fabrication === null;
  const canOpenCache = goldCredits >= OPEN_CACHE_GOLD_COST;
  const fabricationPct = Math.round((fabrication?.progress ?? 0) * 100);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>SUPPLY CACHE BAY</Text>
        <View style={styles.currencyCol}>
          <Text style={styles.standardCredits}>
            {`STC ${formatAmount(standardCredits)}`}
          </Text>
          <Text style={styles.goldCredits}>
            {`GC ${formatAmount(goldCredits)}`}
          </Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        STANDARD CREDITS FUND UPGRADES · GOLD OPENS CACHES
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Supply Cache"
        disabled={!canOpenCache}
        onPress={() => {
          openCache();
        }}
        style={[styles.openBtn, !canOpenCache && styles.openBtnDisabled]}
      >
        <Text
          style={[styles.openBtnText, !canOpenCache && styles.disabledText]}
        >
          OPEN CACHE
        </Text>
        <Text
          style={[styles.openBtnCost, !canOpenCache && styles.disabledText]}
        >
          {`${OPEN_CACHE_GOLD_COST} GOLD CREDITS  ·  TIER ${cacheLevel}`}
        </Text>
      </Pressable>

      <View style={styles.upgradePanel}>
        <View style={styles.upgradeHeader}>
          <Text style={styles.upgradeLevel}>{`CACHE UPGRADE LEVEL ${cacheLevel}`}</Text>
          {fabrication && (
            <Text style={styles.fabLabel}>
              {`FABRICATING → L${fabrication.targetLevel}  ${fabricationPct}%`}
            </Text>
          )}
        </View>

        <View style={styles.fabTrack}>
          <View
            style={[
              styles.fabFill,
              {
                width: fabrication
                  ? (`${fabricationPct}%` as `${number}%`)
                  : ('0%' as const),
              },
            ]}
          />
        </View>

        {cacheLevel >= 15 ? (
          <Text style={styles.maxed}>CACHE MATRIX MAXED (L15)</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upgrade Cache Level"
            disabled={!canAffordUpgrade}
            onPress={() => {
              upgradeCacheLevel();
            }}
            style={[styles.upgradeBtn, !canAffordUpgrade && styles.upgradeBtnDisabled]}
          >
            <Text
              style={[
                styles.upgradeBtnText,
                !canAffordUpgrade && styles.disabledText,
              ]}
            >
              UPGRADE CACHE LEVEL
            </Text>
            {upgradeReqs && (
              <Text
                style={[
                  styles.upgradeCost,
                  !canAffordUpgrade && styles.disabledText,
                ]}
              >
                {fabrication
                  ? `FABRICATION ${formatTimer(
                      Math.ceil(
                        fabrication.durationSeconds * (1 - fabrication.progress),
                      ),
                    )} REMAINING`
                  : `${formatAmount(upgradeReqs.costCredits)} STC  ·  ${formatTimer(
                      upgradeReqs.timerSeconds,
                    )}`}
              </Text>
            )}
          </Pressable>
        )}

        {fabrication !== null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Instant Fabrication Skip rewarded ad"
            onPress={() => {
              void getAdMobManager()?.showFabricationSkipRewarded();
            }}
            style={styles.rewardBtn}
          >
            <Text style={styles.rewardBtnText}>INSTANT FABRICATION SKIP</Text>
            <Text style={styles.rewardBtnMeta}>REWARDED VIDEO</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.monetizationPanel}>
        <Text style={styles.monetizationTitle}>SYSTEM PROTOCOLS</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="System Overclock rewarded ad"
          disabled={overclockActive}
          onPress={() => {
            void getAdMobManager()?.showOverclockRewarded();
          }}
          style={[styles.rewardBtn, overclockActive && styles.upgradeBtnDisabled]}
        >
          <Text
            style={[
              styles.rewardBtnText,
              overclockActive && styles.disabledText,
            ]}
          >
            {overclockActive
              ? `OVERCLOCK 2X · ${formatTimer(overclockRemainSec)}`
              : 'SYSTEM OVERCLOCK 2X (20M)'}
          </Text>
          <Text
            style={[
              styles.rewardBtnMeta,
              overclockActive && styles.disabledText,
            ]}
          >
            REWARDED VIDEO
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove interstitial ads"
          onPress={() => {
            void getPurchaseManager()?.purchaseRemoveAds();
          }}
          style={styles.iapBtn}
        >
          <Text style={styles.iapBtnText}>REMOVE INTERSTITIAL ADS</Text>
        </Pressable>
        <View style={styles.iapRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nanite cache pack small"
            onPress={() => {
              void getPurchaseManager()?.purchaseNanitePackSmall();
            }}
            style={[styles.iapBtn, styles.iapHalf]}
          >
            <Text style={styles.iapBtnText}>NANITE PACK S</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nanite cache pack large"
            onPress={() => {
              void getPurchaseManager()?.purchaseNanitePackLarge();
            }}
            style={[styles.iapBtn, styles.iapHalf]}
          >
            <Text style={styles.iapBtnText}>NANITE PACK L</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1.1,
  },
  currencyCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  standardCredits: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  goldCredits: {
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  openBtn: {
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.void,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  openBtnDisabled: {
    borderColor: COLORS.border,
  },
  openBtnText: {
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 1.2,
  },
  openBtnCost: {
    marginTop: 4,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  disabledText: {
    color: COLORS.muted,
  },
  upgradePanel: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  upgradeHeader: {
    marginBottom: 6,
  },
  upgradeLevel: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  fabLabel: {
    marginTop: 2,
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  fabTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fabFill: {
    height: 4,
    backgroundColor: COLORS.cyan,
  },
  upgradeBtn: {
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: RADII.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  upgradeBtnDisabled: {
    borderColor: COLORS.border,
  },
  upgradeBtnText: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  upgradeCost: {
    marginTop: 3,
    color: COLORS.teal,
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  maxed: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 10,
    textAlign: 'center',
    paddingVertical: 8,
  },
  monetizationPanel: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    gap: 8,
  },
  monetizationTitle: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 2,
  },
  rewardBtn: {
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: RADII.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  rewardBtnText: {
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  rewardBtnMeta: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
  },
  iapBtn: {
    borderWidth: 1,
    borderColor: COLORS.violet,
    borderRadius: RADII.sm,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  iapHalf: {
    flex: 1,
  },
  iapRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iapBtnText: {
    color: COLORS.violet,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
