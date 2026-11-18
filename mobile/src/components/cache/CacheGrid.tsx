/**
 * Supply Cache bay — Open Cache (Gold), World 2+ AUTO-DECRYPT,
 * AUTO-SALVAGE threshold, upgrade (Standard Credits), drop-chance matrix.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  resolveCacheLevelRow,
  getUpgradeRequirements,
} from '../../engine/ProbabilityMatrix';
import {
  AUTO_SALVAGE_OPTIONS,
  getBatchCapacity,
  useGameStore,
  type AutoSalvageOption,
} from '../../store/useGameStore';
import { COLORS, FONTS, RADII } from '../../theme/colors';
import {
  OPEN_CACHE_GOLD_COST,
  RARITIES,
  RARITY_RANK,
  type Rarity,
} from '../../types/game';

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

function formatPercent(n: number): string {
  if (n === 0) return '—';
  if (Number.isInteger(n)) return `${n}%`;
  return `${n.toFixed(1)}%`;
}

const RARITY_TINT: Readonly<Record<Rarity, string>> = {
  COMMON: COLORS.muted,
  UNCOMMON: COLORS.teal,
  RARE: COLORS.cyan,
  EPIC: COLORS.violet,
  LEGENDARY: COLORS.amber,
  MYTHIC: COLORS.gold,
  CELESTIAL: COLORS.celestial,
};

export function CacheGrid(): React.ReactElement {
  const cacheLevel = useGameStore((s) => s.cacheLevel);
  const standardCredits = useGameStore((s) => s.standardCredits);
  const goldCredits = useGameStore((s) => s.goldCredits);
  const world = useGameStore((s) => s.currentSectorWorld);
  const fabrication = useGameStore((s) => s.cacheFabrication);
  const overclockExpiresAtMs = useGameStore((s) => s.overclockExpiresAtMs);
  const autoDecryptEnabled = useGameStore((s) => s.autoDecryptEnabled);
  const autoSalvageThreshold = useGameStore((s) => s.autoSalvageThreshold);
  const openCache = useGameStore((s) => s.openCache);
  const upgradeCacheLevel = useGameStore((s) => s.upgradeCacheLevel);
  const tickFabrication = useGameStore((s) => s.tickFabrication);
  const setAutoDecryptEnabled = useGameStore((s) => s.setAutoDecryptEnabled);
  const autoSalvageBelowThreshold = useGameStore(
    (s) => s.autoSalvageBelowThreshold,
  );

  const [dropModalVisible, setDropModalVisible] = useState(false);

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
    cacheLevel >= 15 ? null : getUpgradeRequirements(cacheLevel);
  const canAffordUpgrade =
    upgradeReqs !== null &&
    standardCredits >= upgradeReqs.costCredits &&
    fabrication === null;
  const canOpenCache = goldCredits >= OPEN_CACHE_GOLD_COST;
  const fabricationPct = Math.round((fabrication?.progress ?? 0) * 100);
  const batchCapacity = getBatchCapacity(world);
  const dropRow = resolveCacheLevelRow(cacheLevel);

  const onSalvageChip = (option: AutoSalvageOption): void => {
    if (autoSalvageThreshold === option) {
      autoSalvageBelowThreshold(null);
      return;
    }
    autoSalvageBelowThreshold(option);
  };

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

      {world >= 2 && (
        <View style={styles.autoPanel}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: autoDecryptEnabled }}
            accessibilityLabel="Auto-decrypt toggle"
            onPress={() => {
              setAutoDecryptEnabled(!autoDecryptEnabled);
            }}
            style={[
              styles.autoDecryptBtn,
              autoDecryptEnabled && styles.autoDecryptBtnActive,
            ]}
          >
            <Text
              style={[
                styles.autoDecryptLabel,
                autoDecryptEnabled && styles.autoDecryptLabelActive,
              ]}
            >
              {autoDecryptEnabled
                ? 'AUTO-DECRYPT · ENGAGED'
                : 'AUTO-DECRYPT · STANDBY'}
            </Text>
            <Text style={styles.autoDecryptMeta}>
              {`BATCH ${batchCapacity}/CYCLE  ·  WORLD ${world}  ·  ${OPEN_CACHE_GOLD_COST} GC EACH`}
            </Text>
          </Pressable>

          <Text style={styles.salvageLabel}>AUTO-SALVAGE BELOW</Text>
          <View style={styles.salvageRow}>
            {AUTO_SALVAGE_OPTIONS.map((option) => {
              const active = autoSalvageThreshold === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Auto-salvage below ${option}`}
                  onPress={() => {
                    onSalvageChip(option);
                  }}
                  style={[
                    styles.salvageChip,
                    active && styles.salvageChipActive,
                    active && {
                      borderColor: RARITY_TINT[option],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.salvageChipText,
                      active && {
                        color: RARITY_TINT[option],
                      },
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.salvageHint}>
            {autoSalvageThreshold
              ? `GEAR BELOW ${autoSalvageThreshold} → STC · ${autoSalvageThreshold}+ SHOWS COMPARISON`
              : 'TAP A RARITY TO AUTO-SALVAGE WEAKER DROPS'}
          </Text>
        </View>
      )}

      <View style={styles.upgradePanel}>
        <View style={styles.upgradeHeader}>
          <Text style={styles.upgradeLevel}>
            {`CACHE UPGRADE LEVEL ${cacheLevel}`}
          </Text>
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

        <View style={styles.upgradeRow}>
          {cacheLevel >= 15 ? (
            <Text style={[styles.maxed, styles.upgradeFlex]}>
              CACHE MATRIX MAXED (L15)
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upgrade Cache Level"
              disabled={!canAffordUpgrade}
              onPress={() => {
                upgradeCacheLevel();
              }}
              style={[
                styles.upgradeBtn,
                styles.upgradeFlex,
                !canAffordUpgrade && styles.upgradeBtnDisabled,
              ]}
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
                          fabrication.durationSeconds *
                            (1 - fabrication.progress),
                        ),
                      )} REMAINING`
                    : `${formatAmount(upgradeReqs.costCredits)} STC  ·  ${formatTimer(
                        upgradeReqs.timerSeconds,
                      )}`}
                </Text>
              )}
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show drop chances for current cache level"
            onPress={() => {
              setDropModalVisible(true);
            }}
            style={styles.dropChanceBtn}
          >
            <Text style={styles.dropChanceBtnText}>DROP %</Text>
            <Text style={styles.dropChanceBtnMeta}>{`L${cacheLevel}`}</Text>
          </Pressable>
        </View>

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

      <Modal
        animationType="fade"
        transparent
        visible={dropModalVisible}
        onRequestClose={() => {
          setDropModalVisible(false);
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss drop chances"
          style={styles.modalBackdrop}
          onPress={() => {
            setDropModalVisible(false);
          }}
        >
          <Pressable
            accessibilityRole="none"
            onPress={(e) => {
              e.stopPropagation?.();
            }}
            style={styles.modalCard}
          >
            <Text style={styles.modalTitle}>
              {`DROP MATRIX · CACHE L${dropRow.level}`}
            </Text>
            <Text style={styles.modalSubtitle}>
              PROBABILITY MATRIX §2.5 · CURRENT TIER WEIGHTS
            </Text>
            {RARITIES.map((rarity) => {
              const weight = dropRow.weights[rarity];
              const muted = weight <= 0;
              return (
                <View key={rarity} style={styles.dropRow}>
                  <Text
                    style={[
                      styles.dropRarity,
                      { color: muted ? COLORS.muted : RARITY_TINT[rarity] },
                    ]}
                  >
                    {rarity}
                  </Text>
                  <Text
                    style={[
                      styles.dropPct,
                      muted && styles.disabledText,
                      !muted &&
                        autoSalvageThreshold !== null &&
                        RARITY_RANK[rarity] <
                          RARITY_RANK[autoSalvageThreshold] &&
                        styles.dropPctSalvage,
                    ]}
                  >
                    {formatPercent(weight)}
                  </Text>
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close drop chances"
              onPress={() => {
                setDropModalVisible(false);
              }}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>CLOSE</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  autoPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.void,
    padding: 8,
  },
  autoDecryptBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.sm,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  autoDecryptBtnActive: {
    borderColor: COLORS.teal,
    backgroundColor: COLORS.panelElevated,
  },
  autoDecryptLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  autoDecryptLabelActive: {
    color: COLORS.teal,
  },
  autoDecryptMeta: {
    marginTop: 3,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.3,
  },
  salvageLabel: {
    marginTop: 10,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  salvageRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  salvageChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.sm,
    paddingVertical: 7,
    alignItems: 'center',
  },
  salvageChipActive: {
    backgroundColor: COLORS.panelElevated,
  },
  salvageChipText: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  salvageHint: {
    marginTop: 6,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.2,
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
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  upgradeFlex: {
    flex: 1,
  },
  upgradeBtn: {
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: RADII.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  dropChanceBtn: {
    borderWidth: 1,
    borderColor: COLORS.violet,
    borderRadius: RADII.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  dropChanceBtnText: {
    color: COLORS.violet,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.7,
  },
  dropChanceBtnMeta: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.md,
    padding: 14,
  },
  modalTitle: {
    color: COLORS.violet,
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
  modalSubtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.4,
  },
  dropRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dropRarity: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  dropPct: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  dropPctSalvage: {
    color: COLORS.amber,
  },
  modalClose: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: RADII.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
});
