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
import { rarityVisual } from '../../theme/rarityVisuals';
import {
  AFFINITY_BADGE,
  computeAffinityCombatBonuses,
  GEAR_SLOTS,
  TARGETING_PROTOCOL_LABELS,
  TARGETING_PROTOCOLS,
  type AffinityResonanceStatus,
  type GearItem,
  type GearSlot,
  type ManufacturerAffinity,
  type TargetingProtocol,
} from '../../types/game';
import { HoloRarityFrame } from './HoloRarityFrame';

function AffinityBadge({
  affinity,
  compact = false,
}: {
  affinity: ManufacturerAffinity;
  compact?: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.affinityBadge, compact && styles.affinityBadgeCompact]}>
      <Text
        style={[
          styles.affinityBadgeText,
          compact && styles.affinityBadgeTextCompact,
        ]}
      >
        {AFFINITY_BADGE[affinity]}
      </Text>
    </View>
  );
}

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
  const content = (
    <>
      <Text style={styles.cellSlot}>{SLOT_SHORT[slot]}</Text>
      {item ? (
        <>
          <Text style={styles.cellName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.cellPr}>{`PR ${item.powerRating}`}</Text>
          <View style={styles.cellMetaRow}>
            <Text
              style={[
                styles.cellRarity,
                { color: rarityVisual(item.rarity).core },
              ]}
            >
              {item.rarity}
            </Text>
            <AffinityBadge affinity={item.affinity} compact />
          </View>
        </>
      ) : (
        <Text style={styles.cellEmpty}>STANDBY</Text>
      )}
    </>
  );

  if (!item) {
    return <View style={styles.cell}>{content}</View>;
  }

  return (
    <HoloRarityFrame rarity={item.rarity} style={styles.cellHolo} shimmer>
      <View style={styles.cellInner}>{content}</View>
    </HoloRarityFrame>
  );
}

export function TelemetryPanel(): React.ReactElement {
  const equippedGear = useGameStore((s) => s.equippedGear);
  const cores = useGameStore((s) => s.cores);
  const targetingProtocol = useGameStore((s) => s.targetingProtocol);
  const setTargetingProtocol = useGameStore((s) => s.setTargetingProtocol);
  const stats = computeTelemetryStats(equippedGear);
  const affinityBonuses = computeAffinityCombatBonuses(equippedGear);

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

      <View style={styles.resonanceBlock}>
        <Text style={styles.targetingLabel}>AFFINITY RESONANCE</Text>
        {affinityBonuses.resonance.map((status) => (
          <ResonanceRow key={status.affinity} status={status} />
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

function ResonanceRow({
  status,
}: {
  status: AffinityResonanceStatus;
}): React.ReactElement {
  const tierLabel =
    status.tier === 0 ? 'TIER —' : `TIER-${status.tier}`;
  return (
    <View style={styles.resonanceRow}>
      <View style={styles.resonanceLeft}>
        <AffinityBadge affinity={status.affinity} />
        <View style={styles.resonanceTextCol}>
          <Text style={styles.resonanceName} numberOfLines={1}>
            {status.affinity}
          </Text>
          <Text
            style={[
              styles.resonanceBonus,
              status.active ? styles.resonanceBonusActive : null,
            ]}
            numberOfLines={1}
          >
            {status.active ? status.bonusLabel : 'NO SET LINK'}
          </Text>
        </View>
      </View>
      <View style={styles.resonanceRight}>
        <Text style={styles.resonancePieces}>{`${status.pieces}/6`}</Text>
        <Text
          style={[
            styles.resonanceTier,
            status.active ? styles.resonanceTierActive : null,
          ]}
        >
          {tierLabel}
        </Text>
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
  cellHolo: {
    width: '32%',
    minHeight: 68,
    backgroundColor: COLORS.void,
  },
  cellInner: {
    padding: 6,
    minHeight: 68,
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
  cellMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  cellRarity: {
    color: COLORS.violet,
    fontFamily: FONTS.mono,
    fontSize: 7,
  },
  affinityBadge: {
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: RADII.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  affinityBadgeCompact: {
    paddingHorizontal: 3,
    paddingVertical: 0,
  },
  affinityBadgeText: {
    color: COLORS.teal,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  affinityBadgeTextCompact: {
    fontSize: 7,
  },
  cellEmpty: {
    marginTop: 10,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  resonanceBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    gap: 6,
  },
  resonanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  resonanceLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  resonanceTextCol: {
    flex: 1,
    minWidth: 0,
  },
  resonanceName: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.3,
  },
  resonanceBonus: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 7,
    letterSpacing: 0.3,
  },
  resonanceBonusActive: {
    color: COLORS.cyan,
  },
  resonanceRight: {
    alignItems: 'flex-end',
  },
  resonancePieces: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 8,
  },
  resonanceTier: {
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  resonanceTierActive: {
    color: COLORS.teal,
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
