/**
 * Combat diorama viewport — top 38% of the Sector Sentinel shell.
 * Driven by BattlerEngine (rAF fixed-timestep), not React timers.
 * Luminous VFX: hit-flash, crit micro-shake, rarity trails, credit arcs.
 * Arena: View-only nebula / starfield / terrain parallax (Expo Go safe).
 */

import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  battlerEngine,
  type BattlerSnapshot,
  type CreditPickup,
  type DamageNumber,
  type HostileConstruct,
  type Projectile,
  type TrailBand,
} from '../../engine/BattlerEngine';
import { COLORS, FONTS, RADII, TRAIL_COLORS } from '../../theme/colors';
import { TARGETING_PROTOCOL_LABELS } from '../../types/game';
import { ArenaBackground } from './ArenaBackground';

function trailPalette(band: TrailBand): { core: string; glow: string } {
  switch (band) {
    case 'VIOLET':
      return TRAIL_COLORS.violet;
    case 'CELESTIAL':
      return TRAIL_COLORS.celestial;
    case 'CYAN':
    default:
      return TRAIL_COLORS.cyan;
  }
}

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
  const isBoss = hostile.isBoss;
  const flashing = hostile.hitFlash > 0;
  const dissolving = hostile.disintegrate > 0;
  const dissolveOpacity = dissolving
    ? Math.max(0.12, hostile.disintegrate / 0.42)
    : 1;

  return (
    <View
      style={[
        styles.hostile,
        {
          left: hostile.x,
          top: hostile.y,
          width: hostile.width,
          height: hostile.height,
          opacity: dissolveOpacity,
        },
        isAimTarget && !dissolving && styles.hostileAimed,
        isBoss && styles.wardenAimed,
      ]}
    >
      {isBoss ? (
        <View
          style={[
            styles.wardenSilhouette,
            flashing && styles.hitFlashBoss,
            dissolving && styles.disintegrateFrame,
          ]}
        >
          <View style={styles.wardenPauldronLeft} />
          <View style={styles.wardenPauldronRight} />
          <View style={styles.wardenCore} />
          <View style={styles.wardenPlating} />
        </View>
      ) : (
        <View
          style={[
            styles.hostileBody,
            flashing && styles.hitFlashBody,
            dissolving && styles.disintegrateFrame,
          ]}
        />
      )}
      {!dissolving ? (
        <View
          style={[
            styles.hpTrack,
            isBoss && styles.wardenShieldTrack,
          ]}
        >
          <View
            style={[
              styles.hpFill,
              { width: `${pct}%`, backgroundColor: COLORS.amber },
              isBoss && styles.wardenShieldFill,
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function ProjectileView({ shot }: { shot: Projectile }) {
  const palette = trailPalette(shot.trailBand);
  return (
    <>
      {shot.trail.map((point, index) => {
        const t = (index + 1) / Math.max(1, shot.trail.length);
        return (
          <View
            key={`${shot.id}-trail-${index}`}
            style={[
              styles.projectileTrail,
              {
                left: point.x - 2,
                top: point.y - 1,
                width: 4 + t * 6,
                opacity: 0.18 + t * 0.45,
                backgroundColor: palette.glow,
                shadowColor: palette.core,
              },
            ]}
          />
        );
      })}
      <View
        style={[
          styles.projectile,
          {
            left: shot.x,
            top: shot.y - 1,
            backgroundColor: palette.core,
            shadowColor: palette.glow,
          },
          shot.trailBand === 'CELESTIAL' && styles.projectileCelestial,
          shot.trailBand === 'VIOLET' && styles.projectileViolet,
        ]}
      />
    </>
  );
}

function DamageNumberView({ dn }: { dn: DamageNumber }) {
  const opacity = Math.max(0, dn.life / dn.maxLife);
  return (
    <Text
      style={[
        styles.damageNumber,
        dn.isCrit && styles.damageNumberCrit,
        { left: dn.x, top: dn.y, opacity },
      ]}
    >
      {dn.isCrit ? `CRIT ${dn.value}` : dn.value}
    </Text>
  );
}

function CreditPickupView({ pickup }: { pickup: CreditPickup }) {
  const opacity = Math.max(0, pickup.life / pickup.maxLife);
  const isGold = pickup.kind === 'GOLD';
  return (
    <Text
      style={[
        styles.creditPickup,
        isGold ? styles.creditGold : styles.creditStandard,
        { left: pickup.x, top: pickup.y, opacity },
      ]}
    >
      {isGold ? `+${pickup.amount} GC` : `+${pickup.amount} STC`}
    </Text>
  );
}

function TelemetryOverlay({ snapshot }: { snapshot: BattlerSnapshot }) {
  const { telemetry } = snapshot;
  const wardenActive = snapshot.hostiles.some(
    (h) => h.isBoss && h.disintegrate <= 0,
  );
  return (
    <View style={styles.overlay}>
      <Text
        style={[
          styles.sectorReadout,
          wardenActive && styles.wardenReadout,
        ]}
      >
        {`SECTOR [${telemetry.sectorWorld}]-[${telemetry.sectorLevel}]`}
        {wardenActive ? '  ·  WARDEN' : ''}
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

  const shakeStyle = {
    transform: [
      { translateX: snapshot.cameraShakeX },
      { translateY: snapshot.cameraShakeY },
    ],
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={[styles.shakeLayer, shakeStyle]}>
        <ArenaBackground
          parallax={snapshot.parallax}
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
        {snapshot.creditPickups.map((c) => (
          <CreditPickupView key={c.id} pickup={c} />
        ))}
      </View>
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
  shakeLayer: {
    ...StyleSheet.absoluteFill,
  },
  frameBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    borderRadius: RADII.sm,
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
  wardenAimed: {
    shadowColor: COLORS.crimson,
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 4,
  },
  hostileBody: {
    width: '100%',
    height: '85%',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.hostile,
    borderRadius: RADII.sm,
  },
  hitFlashBody: {
    backgroundColor: COLORS.celestial,
    borderColor: COLORS.cyan,
  },
  hitFlashBoss: {
    backgroundColor: COLORS.celestial,
    borderColor: COLORS.gold,
  },
  disintegrateFrame: {
    borderColor: COLORS.violet,
    opacity: 0.85,
  },
  wardenSilhouette: {
    width: '100%',
    height: '86%',
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.crimson,
    borderRadius: RADII.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardenCore: {
    width: '42%',
    height: '58%',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: RADII.sm,
  },
  wardenPlating: {
    position: 'absolute',
    bottom: 4,
    width: '78%',
    height: '18%',
    backgroundColor: COLORS.borderGlow,
    borderWidth: 1,
    borderColor: COLORS.crimson,
  },
  wardenPauldronLeft: {
    position: 'absolute',
    left: 2,
    top: '18%',
    width: '22%',
    height: '38%',
    backgroundColor: COLORS.border,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  wardenPauldronRight: {
    position: 'absolute',
    right: 2,
    top: '18%',
    width: '22%',
    height: '38%',
    backgroundColor: COLORS.border,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  hpTrack: {
    marginTop: 3,
    width: '100%',
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  wardenShieldTrack: {
    height: 5,
    backgroundColor: COLORS.crimson,
    borderWidth: 1,
    borderColor: COLORS.crimson,
  },
  hpFill: {
    height: '100%',
  },
  wardenShieldFill: {
    backgroundColor: COLORS.amber,
  },
  projectileTrail: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    shadowOpacity: 0.45,
    shadowRadius: 3,
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
  projectileViolet: {
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  projectileCelestial: {
    height: 3.5,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  damageNumber: {
    position: 'absolute',
    color: COLORS.amber,
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  damageNumberCrit: {
    color: COLORS.celestial,
    fontSize: 13,
    textShadowColor: COLORS.gold,
    textShadowRadius: 4,
  },
  creditPickup: {
    position: 'absolute',
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  creditStandard: {
    color: COLORS.cyan,
    textShadowColor: COLORS.teal,
    textShadowRadius: 3,
  },
  creditGold: {
    color: COLORS.gold,
    textShadowColor: COLORS.amber,
    textShadowRadius: 4,
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
  wardenReadout: {
    color: COLORS.amber,
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
