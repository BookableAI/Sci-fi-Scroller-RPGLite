/**
 * Gear comparison modal — cache yield vs equipped slot.
 * Precedes with 0.6s Relic Decryption; holographic rarity frames on columns.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useGameStore } from '../../store/useGameStore';
import { COLORS, FONTS, RADII } from '../../theme/colors';
import { rarityVisual } from '../../theme/rarityVisuals';
import {
  AFFINITY_BADGE,
  type GearItem,
  type ManufacturerAffinity,
} from '../../types/game';
import { HoloRarityFrame } from '../ui/HoloRarityFrame';
import { RelicDecryptionSequence } from './RelicDecryptionSequence';

function AffinityBadge({
  affinity,
}: {
  affinity: ManufacturerAffinity;
}): React.ReactElement {
  return (
    <View style={styles.affinityBadge}>
      <Text style={styles.affinityBadgeText}>{AFFINITY_BADGE[affinity]}</Text>
    </View>
  );
}

const SLOT_LABEL: Readonly<Record<GearItem['slot'], string>> = {
  WEAPON: 'PRIMARY WEAPON',
  CHASSIS: 'CHASSIS',
  PROPULSION: 'PROPULSION',
  SHIELD: 'SHIELD SYSTEM',
  CORE_AI: 'CORE AI',
  UTILITY: 'UTILITY MODULE',
};

type DeltaTone = 'up' | 'down' | 'flat';

function deltaTone(delta: number): DeltaTone {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

function formatSigned(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '±0';
}

function toneColor(tone: DeltaTone): string {
  if (tone === 'up') return COLORS.cyan;
  if (tone === 'down') return COLORS.amber;
  return COLORS.muted;
}

function GearColumn({
  title,
  item,
  emptyLabel,
}: {
  title: string;
  item: GearItem | undefined;
  emptyLabel: string;
}): React.ReactElement {
  const body = !item ? (
    <Text style={styles.empty}>{emptyLabel}</Text>
  ) : (
    <>
      <Text style={styles.itemName} numberOfLines={2}>
        {item.name}
      </Text>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: rarityVisual(item.rarity).core }]}>
          {item.rarity}
        </Text>
        <AffinityBadge affinity={item.affinity} />
      </View>
      <Text style={styles.affinityFull} numberOfLines={1}>
        {item.affinity}
      </Text>
      <Text style={styles.stat}>{`PR  ${item.powerRating}`}</Text>
      <Text style={styles.stat}>{`PRI ${item.primaryStat}`}</Text>
      <Text style={styles.stat}>{`SEC ${item.secondaryStat}`}</Text>
      <Text style={styles.salvage}>{`SALVAGE ${item.salvageValue} STC`}</Text>
    </>
  );

  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      {item ? (
        <HoloRarityFrame rarity={item.rarity} style={styles.holoColumn}>
          <View style={styles.holoInner}>{body}</View>
        </HoloRarityFrame>
      ) : (
        body
      )}
    </View>
  );
}

function DeltaBar({
  label,
  newValue,
  oldValue,
  emphasize = false,
}: {
  label: string;
  newValue: number;
  oldValue: number;
  emphasize?: boolean;
}): React.ReactElement {
  const delta = newValue - oldValue;
  const tone = deltaTone(delta);
  const color = toneColor(tone);
  const arrow = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '●';
  const magnitude = Math.abs(delta);
  // Visual weight for the bar fill — caps so large jumps don't overflow
  const fillPct = Math.min(100, Math.round((magnitude / Math.max(oldValue, 1)) * 100));

  return (
    <View style={[styles.deltaBar, emphasize && styles.deltaBarHero]}>
      <View style={styles.deltaBarHeader}>
        <Text style={[styles.deltaBarLabel, emphasize && styles.deltaBarLabelHero]}>
          {label}
        </Text>
        <Text
          style={[
            styles.deltaBarValue,
            emphasize && styles.deltaBarValueHero,
            { color },
          ]}
        >
          {`${arrow} ${formatSigned(delta)}`}
        </Text>
      </View>
      <View style={styles.deltaTrack}>
        <View
          style={[
            styles.deltaFill,
            {
              width: (`${tone === 'flat' ? 0 : Math.max(fillPct, 8)}%` as `${number}%`),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={styles.deltaCompare}>
        {`${oldValue} → ${newValue}`}
      </Text>
    </View>
  );
}

export function GearComparisonModal(): React.ReactElement | null {
  const pending = useGameStore((s) => s.pendingComparisonGear);
  const equippedGear = useGameStore((s) => s.equippedGear);
  const queueLen = useGameStore((s) => s.comparisonQueue.length);
  const resolveComparisonEquip = useGameStore((s) => s.resolveComparisonEquip);
  const resolveComparisonSalvage = useGameStore((s) => s.resolveComparisonSalvage);
  const [revealedId, setRevealedId] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) {
      setRevealedId(null);
    }
  }, [pending]);

  if (!pending) {
    return null;
  }

  const decrypting = revealedId !== pending.id;

  if (decrypting) {
    return (
      <RelicDecryptionSequence
        item={pending}
        onComplete={() => setRevealedId(pending.id)}
      />
    );
  }

  const equipped = equippedGear[pending.slot];
  const oldPr = equipped?.powerRating ?? 0;
  const oldPri = equipped?.primaryStat ?? 0;
  const oldSec = equipped?.secondaryStat ?? 0;
  const oldSalvage = equipped?.salvageValue ?? 0;

  const prDelta = pending.powerRating - oldPr;
  const verdictTone = deltaTone(prDelta);
  const verdict =
    !equipped
      ? 'EMPTY SLOT · EQUIP RECOMMENDED'
      : verdictTone === 'up'
        ? 'POWER UP · EQUIP LOOKS STRONGER'
        : verdictTone === 'down'
          ? 'POWER DOWN · CONSIDER SALVAGE'
          : 'EVEN POWER · JUDGE BY STATS';
  const pendingVisual = rarityVisual(pending.rarity);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Force an explicit choice — salvage dismisses
        resolveComparisonSalvage();
      }}
    >
      <View style={styles.backdrop}>
        <HoloRarityFrame
          rarity={pending.rarity}
          style={styles.sheetHolo}
          shimmer
        >
        <View style={[styles.sheet, { borderColor: pendingVisual.core }]}>
          <Text style={[styles.header, { color: pendingVisual.core }]}>
            CACHE OPENED
          </Text>
          <Text style={styles.slotLine}>
            {`SLOT  ${SLOT_LABEL[pending.slot]}`}
          </Text>
          {queueLen > 0 && (
            <Text style={styles.queueNote}>{`QUEUE +${queueLen}`}</Text>
          )}

          <View style={styles.compareRow}>
            <GearColumn
              title="NEW GEAR"
              item={pending}
              emptyLabel="—"
            />
            <View style={styles.divider} />
            <GearColumn
              title="EQUIPPED"
              item={equipped}
              emptyLabel="NO MODULE"
            />
          </View>

          <View style={styles.infographic}>
            <Text style={styles.infographicTitle}>TELEMETRY DELTA</Text>
            <Text style={[styles.verdict, { color: toneColor(verdictTone) }]}>
              {verdict}
            </Text>

            <DeltaBar
              label="POWER RATING"
              newValue={pending.powerRating}
              oldValue={oldPr}
              emphasize
            />
            <DeltaBar
              label="PRIMARY STAT"
              newValue={pending.primaryStat}
              oldValue={oldPri}
            />
            <DeltaBar
              label="SECONDARY STAT"
              newValue={pending.secondaryStat}
              oldValue={oldSec}
            />
            <DeltaBar
              label="SALVAGE VALUE (STC)"
              newValue={pending.salvageValue}
              oldValue={oldSalvage}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Equip and salvage old"
            onPress={resolveComparisonEquip}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>EQUIP & SALVAGE OLD</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Salvage immediately"
            onPress={resolveComparisonSalvage}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>
              {`SALVAGE IMMEDIATELY · +${pending.salvageValue} STC`}
            </Text>
          </Pressable>
        </View>
        </HoloRarityFrame>
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
  sheetHolo: {
    borderRadius: RADII.lg,
  },
  sheet: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.lg,
    padding: 14,
  },
  holoColumn: {
    marginTop: 2,
  },
  holoInner: {
    padding: 6,
  },
  header: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 1.2,
  },
  slotLine: {
    marginTop: 4,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  queueNote: {
    marginTop: 2,
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  compareRow: {
    marginTop: 14,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    paddingHorizontal: 4,
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  columnTitle: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  empty: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  itemName: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 12,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  meta: {
    color: COLORS.violet,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  affinityBadge: {
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: RADII.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  affinityBadgeText: {
    color: COLORS.teal,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.6,
  },
  affinityFull: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  stat: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginBottom: 2,
  },
  salvage: {
    marginTop: 6,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  infographic: {
    marginTop: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.void,
    padding: 10,
    gap: 8,
  },
  infographicTitle: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  verdict: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  deltaBar: {
    gap: 3,
  },
  deltaBarHero: {
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    marginBottom: 2,
  },
  deltaBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deltaBarLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  deltaBarLabelHero: {
    color: COLORS.text,
    fontSize: 10,
    letterSpacing: 0.7,
  },
  deltaBarValue: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  deltaBarValueHero: {
    fontSize: 18,
    letterSpacing: 0.6,
  },
  deltaTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  deltaFill: {
    height: 4,
    borderRadius: 2,
  },
  deltaCompare: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
  },
  primaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: RADII.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: RADII.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
