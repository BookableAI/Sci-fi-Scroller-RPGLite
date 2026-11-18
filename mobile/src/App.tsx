/**
 * Sector Sentinel — root shell.
 * Strict layout: top 38% combat diorama / bottom 62% interactive telemetry.
 */

import React, { useEffect } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { BattlerViewport } from './components/battler/BattlerViewport';
import { CacheGrid } from './components/cache/CacheGrid';
import { GearComparisonModal } from './components/cache/GearComparisonModal';
import { TelemetryPanel } from './components/ui/TelemetryPanel';
import { AdMobManager } from './services/AdMobManager';
import { PurchaseManager } from './services/PurchaseManager';

const COLORS = {
  obsidian: '#0B0E14',
  border: '#1E293B',
} as const;

function TelemetryPane(): React.ReactElement {
  return (
    <View style={styles.bottomRoot}>
      <ScrollView
        style={styles.bottomScroll}
        contentContainerStyle={styles.bottomContent}
        showsVerticalScrollIndicator={false}
      >
        <CacheGrid />
        <View style={styles.gap} />
        <TelemetryPanel />
      </ScrollView>
      <GearComparisonModal />
    </View>
  );
}

export default function App(): React.ReactElement {
  useEffect(() => {
    AdMobManager.initialize();
    void PurchaseManager.configure();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        <View style={styles.combatPane}>
          <BattlerViewport />
        </View>
        <View style={styles.telemetryPane}>
          <TelemetryPane />
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
  /** Bottom 62% — Supply Cache + telemetry */
  telemetryPane: {
    flex: 62,
    minHeight: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bottomRoot: {
    flex: 1,
    backgroundColor: COLORS.obsidian,
    minHeight: 0,
  },
  bottomScroll: {
    flex: 1,
  },
  bottomContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 16,
  },
  gap: {
    height: 10,
  },
});
