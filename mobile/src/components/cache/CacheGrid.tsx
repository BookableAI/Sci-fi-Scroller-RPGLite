/**
 * Supply Cache buffer grid — 6 industrial slots + upgrade / auto-open telemetry.
 */

import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getUpgradeRequirements } from '../../engine/ProbabilityMatrix';
import {
  getBatchCapacity,
  useGameStore,
} from '../../store/useGameStore';
import { CACHE_BUFFER_CAPACITY, type SupplyCache } from '../../types/game';

const COLORS = {
  obsidian: '#0B0E14',
  panel: '#121721',
  border: '#1E293B',
  text: '#F8FAFC',
  muted: '#64748B',
  cyan: '#38BDF8',
  amber: '#F59E0B',
} as const;

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

function formatCredits(n: number): string {
  return n.toLocaleString('en-US');
}

function CacheSlot({
  cache,
  index,
  onDecrypt,
}: {
  cache: SupplyCache | undefined;
  index: number;
  onDecrypt: (id: string) => void;
}): React.ReactElement {
  const occupied = cache !== undefined;
  const decrypting = cache?.isDecrypting === true;
  const progressPct = Math.round((cache?.progress ?? 0) * 100);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        occupied
          ? `Supply Cache slot ${index + 1}`
          : `Empty Supply Cache slot ${index + 1}`
      }
      disabled={!occupied || decrypting}
      onPress={() => {
        if (cache && !cache.isDecrypting) {
          onDecrypt(cache.id);
        }
      }}
      style={[
        styles.slot,
        occupied && styles.slotOccupied,
        decrypting && styles.slotDecrypting,
      ]}
    >
      <Text style={styles.slotIndex}>{`S${index + 1}`}</Text>
      {!occupied && <Text style={styles.slotEmpty}>EMPTY</Text>}
      {occupied && !decrypting && (
        <>
          <Text style={styles.slotTier}>{`T${cache.tier}`}</Text>
          <Text style={styles.slotAction}>DECRYPT</Text>
        </>
      )}
      {occupied && decrypting && (
        <>
          <Text style={styles.slotProgress}>{`${progressPct}%`}</Text>
          <View style={styles.miniBarTrack}>
            <View
              style={[styles.miniBarFill, { width: `${progressPct}%` as `${number}%` }]}
            />
          </View>
        </>
      )}
    </Pressable>
  );
}

export function CacheGrid(): React.ReactElement {
  const cacheBuffer = useGameStore((s) => s.cacheBuffer);
  const cacheSlots = useGameStore((s) => s.cacheSlots);
  const cacheLevel = useGameStore((s) => s.cacheLevel);
  const credits = useGameStore((s) => s.credits);
  const world = useGameStore((s) => s.currentSectorWorld);
  const fabrication = useGameStore((s) => s.cacheFabrication);
  const decryptCache = useGameStore((s) => s.decryptCache);
  const upgradeCacheLevel = useGameStore((s) => s.upgradeCacheLevel);
  const tickDecryption = useGameStore((s) => s.tickDecryption);

  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      tickDecryption(delta);
    }, 250);
    return () => clearInterval(id);
  }, [tickDecryption]);

  const slotCount = Math.min(CACHE_BUFFER_CAPACITY, cacheSlots);
  const slots: Array<SupplyCache | undefined> = Array.from(
    { length: slotCount },
    (_, i) => cacheBuffer[i],
  );

  const upgradeReqs =
    cacheLevel >= 15
      ? null
      : getUpgradeRequirements(cacheLevel);
  const canAfford =
    upgradeReqs !== null && credits >= upgradeReqs.costCredits && fabrication === null;
  const batchCapacity = world >= 2 ? Math.max(1, world - 1) : getBatchCapacity(world);
  const fabricationPct = Math.round((fabrication?.progress ?? 0) * 100);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>SUPPLY CACHE BUFFER</Text>
        <Text style={styles.credits}>{`SC ${formatCredits(credits)}`}</Text>
      </View>

      <View style={styles.slotRow}>
        {slots.map((cache, index) => (
          <CacheSlot
            key={cache?.id ?? `empty-${index}`}
            cache={cache}
            index={index}
            onDecrypt={decryptCache}
          />
        ))}
      </View>

      {world >= 2 && (
        <View style={styles.autoOpen}>
          <Text style={styles.autoOpenLabel}>AUTO-OPEN PROTOCOL: ACTIVE</Text>
          <Text style={styles.autoOpenMeta}>
            {`BATCH CAPACITY ${batchCapacity}  ·  WORLD ${world}`}
          </Text>
        </View>
      )}

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
            disabled={!canAfford}
            onPress={() => {
              upgradeCacheLevel();
            }}
            style={[styles.upgradeBtn, !canAfford && styles.upgradeBtnDisabled]}
          >
            <Text
              style={[
                styles.upgradeBtnText,
                !canAfford && styles.upgradeBtnTextDisabled,
              ]}
            >
              UPGRADE CACHE LEVEL
            </Text>
            {upgradeReqs && (
              <Text
                style={[
                  styles.upgradeCost,
                  !canAfford && styles.upgradeBtnTextDisabled,
                ]}
              >
                {fabrication
                  ? `FABRICATION ${formatTimer(
                      Math.ceil(
                        fabrication.durationSeconds * (1 - fabrication.progress),
                      ),
                    )} REMAINING`
                  : `${formatCredits(upgradeReqs.costCredits)} SC  ·  ${formatTimer(
                      upgradeReqs.timerSeconds,
                    )}`}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: COLORS.cyan,
    fontFamily: 'Courier',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  credits: {
    color: COLORS.amber,
    fontFamily: 'Courier',
    fontSize: 11,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  slot: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 72,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  slotOccupied: {
    borderColor: COLORS.cyan,
  },
  slotDecrypting: {
    borderColor: COLORS.amber,
  },
  slotIndex: {
    position: 'absolute',
    top: 3,
    left: 4,
    color: COLORS.muted,
    fontFamily: 'Courier',
    fontSize: 8,
  },
  slotEmpty: {
    color: COLORS.muted,
    fontFamily: 'Courier',
    fontSize: 8,
  },
  slotTier: {
    color: COLORS.text,
    fontFamily: 'Courier',
    fontSize: 12,
  },
  slotAction: {
    marginTop: 2,
    color: COLORS.cyan,
    fontFamily: 'Courier',
    fontSize: 7,
  },
  slotProgress: {
    color: COLORS.amber,
    fontFamily: 'Courier',
    fontSize: 11,
  },
  miniBarTrack: {
    marginTop: 4,
    width: '80%',
    height: 3,
    backgroundColor: COLORS.border,
  },
  miniBarFill: {
    height: 3,
    backgroundColor: COLORS.amber,
  },
  autoOpen: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  autoOpenLabel: {
    color: COLORS.cyan,
    fontFamily: 'Courier',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  autoOpenMeta: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: 'Courier',
    fontSize: 9,
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
    fontFamily: 'Courier',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  fabLabel: {
    marginTop: 2,
    color: COLORS.amber,
    fontFamily: 'Courier',
    fontSize: 9,
  },
  fabTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    marginBottom: 8,
  },
  fabFill: {
    height: 4,
    backgroundColor: COLORS.cyan,
  },
  upgradeBtn: {
    borderWidth: 1,
    borderColor: COLORS.cyan,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  upgradeBtnDisabled: {
    borderColor: COLORS.border,
  },
  upgradeBtnText: {
    color: COLORS.cyan,
    fontFamily: 'Courier',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  upgradeBtnTextDisabled: {
    color: COLORS.muted,
  },
  upgradeCost: {
    marginTop: 3,
    color: COLORS.amber,
    fontFamily: 'Courier',
    fontSize: 9,
  },
  maxed: {
    color: COLORS.muted,
    fontFamily: 'Courier',
    fontSize: 10,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
