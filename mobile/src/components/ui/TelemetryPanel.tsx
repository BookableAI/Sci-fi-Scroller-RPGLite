/**
 * Equipped loadout matrix + aggregate telemetry diagnostics + targeting protocol.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  computeTelemetryStats,
  useGameStore,
} from '../../store/useGameStore';
import { COLORS, FONTS, RADII } from '../../theme/colors';
import {
  GEAR_SLOTS,
  TARGETING_PROTOCOL_LABELS,
  TARGETING_PROTOCOLS,
  type GearItem,
  type GearSlot,
  type TargetingProtocol,
} from '../../types/game';

const SLOT_SHORT: Readonly<Record<GearSlot, string>> = {
  WEAPON: 'WPN',
  CHASSIS: 'CHS',
  PROPULSION: 'PRP',
  SHIELD: 'SHD',
  CORE_AI: 'CAI',
  UTILITY: 'UTL',
};

function LoadoutCell({
  slot,
  item,
}: {
  slot: GearSlot;
  item: GearItem | undefined;
}): React.ReactElement {
  return (
    <View style={[styles.cell, item ? styles.cellFilled : null]}>
      <Text style={styles.cellSlot}>{SLOT_SHORT[slot]}</Text>
      {item ? (
        <>
          <Text style={styles.cellName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.cellPr}>{`PR ${item.powerRating}`}</Text>
          <Text style={styles.cellRarity}>{item.rarity}</Text>
        </>
      ) : (
        <Text style={styles.cellEmpty}>STANDBY</Text>
      )}
    </View>
  );
}

export function TelemetryPanel(): React.ReactElement {
  const equippedGear = useGameStore((s) => s.equippedGear);
  const cores = useGameStore((s) => s.cores);
  const targetingProtocol = useGameStore((s) => s.targetingProtocol);
  const setTargetingProtocol = useGameStore((s) => s.setTargetingProtocol);
  const stats = computeTelemetryStats(equippedGear);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>TELEMETRY / LOADOUT ARRAY</Text>
        <Text style={styles.cores}>{`SRC ${cores}`}</Text>
      </View>

      <View style={styles.matrix}>
        {GEAR_SLOTS.map((slot) => (
          <LoadoutCell key={slot} slot={slot} item={equippedGear[slot]} />
        ))}
      </View>

      <View style={styles.targetingBlock}>
        <Text style={styles.targetingLabel}>TARGETING PROTOCOL</Text>
        <View style={styles.targetingRow}>
          {TARGETING_PROTOCOLS.map((protocol) => (
            <TargetingChip
              key={protocol}
              protocol={protocol}
              active={targetingProtocol === protocol}
              onSelect={setTargetingProtocol}
            />
          ))}
        </View>
      </View>

      <View style={styles.statsBlock}>
        <StatRow label="TOTAL POWER RATING" value={stats.totalPowerRating} accent="cyan" />
        <StatRow label="KINETIC OUTPUT" value={stats.kineticOutput} accent="cyan" />
        <StatRow label="DEFLECTION INDEX" value={stats.deflectionIndex} accent="amber" />
        <StatRow
          label="CORE PROCESSING SPEED"
          value={stats.coreProcessingSpeed}
          accent="teal"
        />
      </View>
    </View>
  );
}

function TargetingChip({
  protocol,
  active,
  onSelect,
}: {
  protocol: TargetingProtocol;
  active: boolean;
  onSelect: (protocol: TargetingProtocol) => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Targeting protocol ${TARGETING_PROTOCOL_LABELS[protocol]}`}
      onPress={() => onSelect(protocol)}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {TARGETING_PROTOCOL_LABELS[protocol]}
      </Text>
    </Pressable>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'cyan' | 'amber' | 'teal';
}): React.ReactElement {
  const valueStyle =
    accent === 'cyan'
      ? styles.valueCyan
      : accent === 'amber'
        ? styles.valueAmber
        : styles.valueTeal;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>
        {value.toLocaleString('en-US')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: 10,
    minHeight: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1.1,
  },
  cores: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  matrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
  },
  cell: {
    width: '32%',
    minHeight: 68,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.void,
    borderRadius: RADII.sm,
    padding: 6,
  },
  cellFilled: {
    borderColor: COLORS.teal,
  },
  cellSlot: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  cellName: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 9,
    marginBottom: 2,
  },
  cellPr: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  cellRarity: {
    marginTop: 2,
    color: COLORS.violet,
    fontFamily: FONTS.mono,
    fontSize: 7,
  },
  cellEmpty: {
    marginTop: 10,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  targetingBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  targetingLabel: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },
  targetingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.void,
    borderRadius: RADII.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  chipActive: {
    borderColor: COLORS.cyan,
    backgroundColor: COLORS.panelElevated,
  },
  chipText: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.4,
  },
  chipTextActive: {
    color: COLORS.cyan,
  },
  statsBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  statLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: FONTS.mono,
    fontSize: 13,
  },
  valueCyan: {
    color: COLORS.cyan,
  },
  valueAmber: {
    color: COLORS.amber,
  },
  valueTeal: {
    color: COLORS.teal,
  },
});
