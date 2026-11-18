/**
 * Gear comparison modal — shown when a Supply Cache finishes decryption.
 * New gear vs equipped slot; PR delta cyan (+) / amber (−).
 */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useGameStore } from '../../store/useGameStore';
import { COLORS, FONTS, RADII } from '../../theme/colors';
import type { GearItem } from '../../types/game';

const SLOT_LABEL: Readonly<Record<GearItem['slot'], string>> = {
  WEAPON: 'PRIMARY WEAPON',
  CHASSIS: 'CHASSIS',
  PROPULSION: 'PROPULSION',
  SHIELD: 'SHIELD SYSTEM',
  CORE_AI: 'CORE AI',
  UTILITY: 'UTILITY MODULE',
};

function GearColumn({
  title,
  item,
  emptyLabel,
}: {
  title: string;
  item: GearItem | undefined;
  emptyLabel: string;
}): React.ReactElement {
  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      {!item ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        <>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.meta}>{item.rarity}</Text>
          <Text style={styles.stat}>{`PR  ${item.powerRating}`}</Text>
          <Text style={styles.stat}>{`PRI ${item.primaryStat}`}</Text>
          <Text style={styles.stat}>{`SEC ${item.secondaryStat}`}</Text>
          <Text style={styles.salvage}>{`SALVAGE ${item.salvageValue} SC`}</Text>
        </>
      )}
    </View>
  );
}

export function GearComparisonModal(): React.ReactElement | null {
  const pending = useGameStore((s) => s.pendingComparisonGear);
  const equippedGear = useGameStore((s) => s.equippedGear);
  const queueLen = useGameStore((s) => s.comparisonQueue.length);
  const resolveComparisonEquip = useGameStore((s) => s.resolveComparisonEquip);
  const resolveComparisonSalvage = useGameStore((s) => s.resolveComparisonSalvage);

  if (!pending) {
    return null;
  }

  const equipped = equippedGear[pending.slot];
  const delta = pending.powerRating - (equipped?.powerRating ?? 0);
  const deltaPositive = delta >= 0;
  const deltaLabel =
    delta === 0
      ? '±0 PR'
      : deltaPositive
        ? `+${delta} PR`
        : `${delta} PR`;

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
        <View style={styles.sheet}>
          <Text style={styles.header}>DECRYPTION COMPLETE</Text>
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

          <View style={styles.deltaRow}>
            <Text style={styles.deltaLabel}>POWER RATING DELTA</Text>
            <Text
              style={[
                styles.deltaValue,
                deltaPositive ? styles.deltaCyan : styles.deltaAmber,
              ]}
            >
              {deltaLabel}
            </Text>
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
            <Text style={styles.secondaryBtnText}>SALVAGE IMMEDIATELY</Text>
          </Pressable>
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
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.lg,
    padding: 14,
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
  meta: {
    color: COLORS.violet,
    fontFamily: FONTS.mono,
    fontSize: 10,
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
  deltaRow: {
    marginTop: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.void,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deltaLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  deltaValue: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  deltaCyan: {
    color: COLORS.cyan,
  },
  deltaAmber: {
    color: COLORS.amber,
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
