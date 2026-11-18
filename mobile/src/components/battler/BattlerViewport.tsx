/**
 * Combat diorama viewport — top 38% of the Sector Sentinel shell.
 * Driven by BattlerEngine (rAF fixed-timestep), not React timers.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  battlerEngine,
  type BattlerSnapshot,
  type DamageNumber,
  type HostileConstruct,
  type Projectile,
} from '../../engine/BattlerEngine';
import { COLORS, FONTS, RADII } from '../../theme/colors';
import { TARGETING_PROTOCOL_LABELS } from '../../types/game';

function useBattlerSnapshot(): BattlerSnapshot {
  const [snapshot, setSnapshot] = useState<BattlerSnapshot>(() =>
    battlerEngine.getSnapshot(),
  );

  useEffect(() => {
    const unsubscribe = battlerEngine.subscribe(setSnapshot);
    battlerEngine.start();
    return () => {
      unsubscribe();
      battlerEngine.stop();
    };
  }, []);

  return snapshot;
}

function GridOverlay({ width, height }: { width: number; height: number }) {
  const lines = useMemo(() => {
    const vertical: number[] = [];
    const horizontal: number[] = [];
    for (let x = 0; x < width; x += 28) vertical.push(x);
    for (let y = 0; y < height; y += 28) horizontal.push(y);
    return { vertical, horizontal };
  }, [width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines.vertical.map((x) => (
        <View
          key={`v-${x}`}
          style={[styles.gridV, { left: x, height }]}
        />
      ))}
      {lines.horizontal.map((y) => (
        <View
          key={`h-${y}`}
          style={[styles.gridH, { top: y, width }]}
        />
      ))}
    </View>
  );
}

function ParallaxBands({
  snapshot,
  width,
  height,
}: {
  snapshot: BattlerSnapshot;
  width: number;
  height: number;
}) {
  return (
    <>
      {snapshot.parallax.map((layer, index) => {
        const bandHeight = 10 + index * 6;
        const top = height * (0.72 + index * 0.05);
        const shift = -((layer.offset % 48) + 48);
        return (
          <View
            key={`parallax-${index}`}
            style={[
              styles.parallaxRow,
              {
                top,
                height: bandHeight,
                width: width * 2,
                left: shift,
                opacity: 0.3 + index * 0.14,
                borderColor:
                  index === 2
                    ? COLORS.teal
                    : index === 1
                      ? COLORS.violet
                      : COLORS.borderGlow,
              },
            ]}
          />
        );
      })}
    </>
  );
}

function ExoRigView({ snapshot }: { snapshot: BattlerSnapshot }) {
  const { exoRig } = snapshot;
  return (
    <View
      style={[
        styles.exoRig,
        {
          left: exoRig.x,
          top: exoRig.y,
          width: exoRig.width,
          height: exoRig.height,
        },
      ]}
    >
      <View style={styles.exoCore} />
      <View
        style={[
          styles.shieldRing,
          {
            opacity: 0.28 + exoRig.shieldFraction * 0.55,
            borderColor: COLORS.cyan,
          },
        ]}
      />
      <View style={styles.hpTrack}>
        <View
          style={[
            styles.hpFill,
            {
              width: `${Math.max(0, (exoRig.hp / exoRig.maxHp) * 100)}%`,
              backgroundColor: COLORS.cyan,
            },
          ]}
        />
      </View>
    </View>
  );
}

function HostileView({
  hostile,
  isAimTarget,
}: {
  hostile: HostileConstruct;
  isAimTarget: boolean;
}): React.ReactElement {
  const pct = Math.max(0, (hostile.hp / hostile.maxHp) * 100);
  return (
    <View
      style={[
        styles.hostile,
        {
          left: hostile.x,
          top: hostile.y,
          width: hostile.width,
          height: hostile.height,
        },
        isAimTarget && styles.hostileAimed,
      ]}
    >
      <View style={styles.hostileBody} />
      <View style={styles.hpTrack}>
        <View
          style={[
            styles.hpFill,
            { width: `${pct}%`, backgroundColor: COLORS.amber },
          ]}
        />
      </View>
    </View>
  );
}

function ProjectileView({ shot }: { shot: Projectile }) {
  return (
    <View
      style={[
        styles.projectile,
        { left: shot.x, top: shot.y - 1 },
      ]}
    />
  );
}

function DamageNumberView({ dn }: { dn: DamageNumber }) {
  const opacity = Math.max(0, dn.life / dn.maxLife);
  return (
    <Text
      style={[
        styles.damageNumber,
        { left: dn.x, top: dn.y, opacity },
      ]}
    >
      {dn.value}
    </Text>
  );
}

function TelemetryOverlay({ snapshot }: { snapshot: BattlerSnapshot }) {
  const { telemetry } = snapshot;
  return (
    <View style={styles.overlay}>
      <Text style={styles.sectorReadout}>
        {`SECTOR [${telemetry.sectorWorld}]-[${telemetry.sectorLevel}]`}
      </Text>
      <View style={styles.telemetryRow}>
        <Text style={styles.telemetryText}>
          {`DPS ${telemetry.dps}`}
        </Text>
        <Text style={styles.telemetryText}>
          {`SHIELD ${telemetry.shieldIntegrity}%`}
        </Text>
        <Text style={styles.telemetryText}>
          {`TGT ${telemetry.targetDistance}m`}
        </Text>
      </View>
      <Text style={styles.prReadout}>
        {`PR ${telemetry.totalPowerRating}  ·  ${TARGETING_PROTOCOL_LABELS[telemetry.targetingProtocol]}`}
      </Text>
    </View>
  );
}

export function BattlerViewport(): React.ReactElement {
  const snapshot = useBattlerSnapshot();
  const [size, setSize] = useState({ width: 390, height: 280 });

  const onLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }
    setSize({ width, height });
    battlerEngine.setViewportSize(width, height);
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GridOverlay width={size.width} height={size.height} />
      <ParallaxBands
        snapshot={snapshot}
        width={size.width}
        height={size.height}
      />
      <ExoRigView snapshot={snapshot} />
      {snapshot.hostiles.map((h) => (
        <HostileView
          key={h.id}
          hostile={h}
          isAimTarget={snapshot.aimTargetId === h.id}
        />
      ))}
      {snapshot.projectiles.map((p) => (
        <ProjectileView key={p.id} shot={p} />
      ))}
      {snapshot.damageNumbers.map((dn) => (
        <DamageNumberView key={dn.id} dn={dn} />
      ))}
      <TelemetryOverlay snapshot={snapshot} />
      <View style={styles.frameBorder} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.void,
    overflow: 'hidden',
    borderRadius: RADII.sm,
  },
  frameBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.sm,
  },
  gridV: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: COLORS.border,
    opacity: 0.35,
  },
  gridH: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: COLORS.border,
    opacity: 0.35,
  },
  parallaxRow: {
    position: 'absolute',
    borderTopWidth: 1,
    borderStyle: 'solid',
  },
  exoRig: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exoCore: {
    width: '70%',
    height: '78%',
    backgroundColor: COLORS.hull,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: RADII.sm,
  },
  shieldRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderRadius: RADII.sm,
  },
  hostile: {
    position: 'absolute',
    alignItems: 'center',
  },
  hostileAimed: {
    shadowColor: COLORS.teal,
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 3,
  },
  hostileBody: {
    width: '100%',
    height: '85%',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.hostile,
    borderRadius: RADII.sm,
  },
  hpTrack: {
    marginTop: 3,
    width: '100%',
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
  },
  projectile: {
    position: 'absolute',
    width: 12,
    height: 3,
    backgroundColor: COLORS.projectile,
    borderRadius: 2,
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
  damageNumber: {
    position: 'absolute',
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
  },
  sectorReadout: {
    color: COLORS.cyan,
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 1,
  },
  telemetryRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryText: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  prReadout: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
});

export default BattlerViewport;
