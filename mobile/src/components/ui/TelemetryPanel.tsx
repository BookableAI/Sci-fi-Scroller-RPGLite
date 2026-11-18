/**
 * Equipped loadout matrix + aggregate telemetry diagnostics.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  computeTelemetryStats,
  useGameStore,
} from '../../store/useGameStore';
import { GEAR_SLOTS, type GearItem, type GearSlot } from '../../types/game';

const COLORS = {
  obsidian: '#0B0E14',
  panel: '#121721',
  border: '#1E293B',
  text: '#F8FAFC',
  muted: '#64748B',
  cyan: '#38BDF8',
  amber: '#F59E0B',
} as const;

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
        <Text style={styles.cellEmpty}>OFFLINE</Text>
      )}
    </View>
  );
}

export function TelemetryPanel(): React.ReactElement {
  const equippedGear = useGameStore((s) => s.equippedGear);
  const cores = useGameStore((s) => s.cores);
  const stats = computeTelemetryStats(equippedGear);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>TELEMETRY / LOADOUT MATRIX</Text>
        <Text style={styles.cores}>{`SRC ${cores}`}</Text>
      </View>

      <View style={styles.matrix}>
        {GEAR_SLOTS.map((slot) => (
          <LoadoutCell key={slot} slot={slot} item={equippedGear[slot]} />
        ))}
      </View>

      <View style={styles.statsBlock}>
        <StatRow label="TOTAL POWER RATING" value={stats.totalPowerRating} accent="cyan" />
        <StatRow label="KINETIC OUTPUT" value={stats.kineticOutput} accent="cyan" />
        <StatRow label="DEFLECTION INDEX" value={stats.deflectionIndex} accent="amber" />
        <StatRow
          label="CORE PROCESSING SPEED"
          value={stats.coreProcessingSpeed}
          accent="cyan"
        />
      </View>
    </View>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'cyan' | 'amber';
}): React.ReactElement {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          accent === 'cyan' ? styles.valueCyan : styles.valueAmber,
        ]}
      >
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
    fontFamily: 'Courier',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  cores: {
    color: COLORS.muted,
    fontFamily: 'Courier',
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
    backgroundColor: COLORS.obsidian,
    padding: 6,
  },
  cellFilled: {
    borderColor: COLORS.cyan,
  },
  cellSlot: {
    color: COLORS.muted,
    fontFamily: 'Courier',
    fontSize: 8,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  cellName: {
    color: COLORS.text,
    fontFamily: 'Courier',
    fontSize: 9,
    marginBottom: 2,
  },
  cellPr: {
    color: COLORS.cyan,
    fontFamily: 'Courier',
    fontSize: 10,
  },
  cellRarity: {
    marginTop: 2,
    color: COLORS.amber,
    fontFamily: 'Courier',
    fontSize: 7,
  },
  cellEmpty: {
    marginTop: 10,
    color: COLORS.muted,
    fontFamily: 'Courier',
    fontSize: 9,
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
    fontFamily: 'Courier',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: 'Courier',
    fontSize: 13,
  },
  valueCyan: {
    color: COLORS.cyan,
  },
  valueAmber: {
    color: COLORS.amber,
  },
});
