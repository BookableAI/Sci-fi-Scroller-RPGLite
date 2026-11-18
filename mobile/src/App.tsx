/**
 * Sector Sentinel — root shell.
 * Strict layout: top 38% combat diorama / bottom 62% telemetry placeholder.
 */

import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { BattlerViewport } from './components/battler/BattlerViewport';

const COLORS = {
  obsidian: '#0B0E14',
  panel: '#121721',
  border: '#1E293B',
  text: '#F8FAFC',
  muted: '#64748B',
  cyan: '#38BDF8',
} as const;

function TelemetryPlaceholder(): React.ReactElement {
  return (
    <View style={styles.bottomPanel}>
      <Text style={styles.panelTitle}>TELEMETRY / CACHE SYSTEM</Text>
      <Text style={styles.panelBody}>
        Supply Cache buffer, gear comparison, and auto-open protocol mount here
        (Prompt 3).
      </Text>
      <View style={styles.slotRow}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={`slot-${i}`} style={styles.cacheSlot}>
            <Text style={styles.slotLabel}>{`S${i + 1}`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function App(): React.ReactElement {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        <View style={styles.combatPane}>
          <BattlerViewport />
        </View>
        <View style={styles.telemetryPane}>
          <TelemetryPlaceholder />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.obsidian,
  },
  shell: {
    flex: 1,
  },
  /** Top 38% — combat diorama */
  combatPane: {
    flex: 38,
    minHeight: 0,
  },
  /** Bottom 62% — interactive telemetry (placeholder) */
  telemetryPane: {
    flex: 62,
    minHeight: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bottomPanel: {
    flex: 1,
    backgroundColor: COLORS.panel,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  panelTitle: {
    color: COLORS.cyan,
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  panelBody: {
    marginTop: 8,
    color: COLORS.muted,
    fontFamily: 'Courier',
    fontSize: 11,
    lineHeight: 16,
  },
  slotRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cacheSlot: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    color: COLORS.text,
    fontFamily: 'Courier',
    fontSize: 10,
  },
});
