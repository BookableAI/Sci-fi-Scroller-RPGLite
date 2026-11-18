/**
 * Combat diorama viewport — top 38% of the Sector Sentinel shell.
 * Driven by BattlerEngine (rAF fixed-timestep), not React timers.
 * Visual suite: world biomes, exo evolution, archetypes, combat juice.
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
  type CreditPickup,
  type DamageNumber,
  type HostileArchetype,
  type HostileConstruct,
  type Projectile,
  type ShatterShard,
  type SparkParticle,
  type TrailBand,
} from '../../engine/BattlerEngine';
import { useGameStore } from '../../store/useGameStore';
import { COLORS, FONTS, RADII, TRAIL_COLORS } from '../../theme/colors';
import {
  maxEquippedRarity,
  rarityVisual,
} from '../../theme/rarityVisuals';
import {
  GEAR_SLOTS,
  RARITY_RANK,
  TARGETING_PROTOCOL_LABELS,
  type EquippedGear,
} from '../../types/game';
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

function ExoRigView({
  snapshot,
  equippedGear,
}: {
  snapshot: BattlerSnapshot;
  equippedGear: EquippedGear;
}): React.ReactElement {
  const { exoRig } = snapshot;
  const auraRarity = useMemo(
    () =>
      maxEquippedRarity(GEAR_SLOTS.map((slot) => equippedGear[slot]?.rarity)),
    [equippedGear],
  );
  const aura = rarityVisual(auraRarity);
  const propulsion = equippedGear.PROPULSION;
  const weapon = equippedGear.WEAPON;
  const thrusterLen = Math.min(
    28,
    8 + (propulsion?.primaryStat ?? 0) * 0.08 + (propulsion ? RARITY_RANK[propulsion.rarity] * 2.2 : 0),
  );
  const weaponRank = weapon ? RARITY_RANK[weapon.rarity] : 0;
  const barrelW = 6 + Math.min(10, weaponRank * 1.6);
  const barrelH = 2 + Math.min(3, weaponRank * 0.45);

  return (
    <View
      style={[
        styles.exoRig,
        {
          left: exoRig.x - exoRig.recoilX,
          top: exoRig.y,
          width: exoRig.width,
          height: exoRig.height,
        },
      ]}
    >
      {/* Thruster plume — length scales with PROPULSION */}
      <View
        style={[
          styles.thruster,
          {
            width: thrusterLen,
            left: -thrusterLen + 2,
            backgroundColor: aura.glow,
            opacity: 0.35 + (propulsion ? 0.35 : 0.1),
          },
        ]}
      />
      <View
        style={[
          styles.thrusterCore,
          {
            width: Math.max(4, thrusterLen * 0.45),
            left: -Math.max(4, thrusterLen * 0.45) + 2,
            backgroundColor: COLORS.cyan,
          },
        ]}
      />

      {/* Aura ring by max equipped rarity */}
      <View
        style={[
          styles.auraRing,
          {
            borderColor: aura.core,
            shadowColor: aura.glow,
            opacity: 0.35 + RARITY_RANK[auraRarity] * 0.08,
          },
        ]}
      />

      <View
        style={[
          styles.exoCore,
          { borderColor: aura.core, backgroundColor: COLORS.hull },
        ]}
      />

      {/* Weapon barrel — shape scales with WEAPON rarity */}
      <View
        style={[
          styles.weaponBarrel,
          {
            width: barrelW,
            height: barrelH,
            backgroundColor: weapon ? rarityVisual(weapon.rarity).core : COLORS.projectile,
            top: exoRig.height * 0.38,
          },
        ]}
      />

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

function hostileIdleOffset(
  archetype: HostileArchetype,
  phase: number,
): { dx: number; dy: number } {
  switch (archetype) {
    case 'SCARAB':
      // Skitter bob
      return { dx: Math.sin(phase * 2.2) * 2.2, dy: Math.abs(Math.sin(phase * 3.1)) * 1.6 };
    case 'AEGIS':
      // Slow armored settle
      return { dx: Math.sin(phase) * 0.6, dy: Math.sin(phase * 0.7) * 0.8 };
    case 'VOID_WEAVER':
      // Hover weave
      return { dx: Math.sin(phase) * 3.2, dy: Math.sin(phase * 1.7) * 4.5 };
    case 'SECTOR_WARDEN':
      // Heavy pulse
      return { dx: Math.sin(phase * 0.8) * 0.8, dy: Math.sin(phase) * 1.2 };
    default:
      return { dx: 0, dy: 0 };
  }
}

function HostileView({
  hostile,
  isAimTarget,
}: {
  hostile: HostileConstruct;
  isAimTarget: boolean;
}): React.ReactElement {
  const pct = Math.max(0, (hostile.hp / hostile.maxHp) * 100);
  const flashing = hostile.hitFlash > 0;
  const dissolving = hostile.disintegrate > 0;
  const dissolveOpacity = dissolving
    ? Math.max(0.1, hostile.disintegrate / 0.48)
    : 1;
  const idle = hostileIdleOffset(hostile.archetype, hostile.idlePhase);
  const { archetype } = hostile;

  return (
    <View
      style={[
        styles.hostile,
        {
          left: hostile.x + idle.dx,
          top: hostile.y + idle.dy,
          width: hostile.width,
          height: hostile.height,
          opacity: dissolveOpacity,
        },
        isAimTarget && !dissolving && styles.hostileAimed,
        archetype === 'SECTOR_WARDEN' && styles.wardenAimed,
      ]}
    >
      {archetype === 'SECTOR_WARDEN' ? (
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
      ) : archetype === 'SCARAB' ? (
        <View
          style={[
            styles.scarabBody,
            flashing && styles.hitFlashBody,
            dissolving && styles.disintegrateFrame,
          ]}
        >
          <View style={styles.scarabCarapace} />
          <View style={styles.scarabLegL} />
          <View style={styles.scarabLegR} />
        </View>
      ) : archetype === 'AEGIS' ? (
        <View
          style={[
            styles.aegisBody,
            flashing && styles.hitFlashBody,
            dissolving && styles.disintegrateFrame,
          ]}
        >
          <View style={styles.aegisShield} />
          <View style={styles.aegisCore} />
        </View>
      ) : (
        <View
          style={[
            styles.weaverBody,
            flashing && styles.hitFlashBody,
            dissolving && styles.disintegrateFrame,
          ]}
        >
          <View style={styles.weaverOrb} />
          <View style={styles.weaverThread} />
        </View>
      )}

      {!dissolving ? (
        <>
          {archetype === 'AEGIS' ? (
            <View style={styles.aegisShieldTrack}>
              <View
                style={[
                  styles.hpFill,
                  {
                    width: `${Math.min(100, pct + 12)}%`,
                    backgroundColor: COLORS.teal,
                  },
                ]}
              />
            </View>
          ) : null}
          <View
            style={[
              styles.hpTrack,
              archetype === 'SECTOR_WARDEN' && styles.wardenShieldTrack,
              archetype === 'VOID_WEAVER' && styles.weaverHpTrack,
              archetype === 'SCARAB' && styles.scarabHpTrack,
            ]}
          >
            <View
              style={[
                styles.hpFill,
                {
                  width: `${pct}%`,
                  backgroundColor:
                    archetype === 'VOID_WEAVER'
                      ? COLORS.violet
                      : archetype === 'SCARAB'
                        ? COLORS.hostile
                        : COLORS.amber,
                },
                archetype === 'SECTOR_WARDEN' && styles.wardenShieldFill,
              ]}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

function ProjectileView({ shot }: { shot: Projectile }) {
  const palette = trailPalette(shot.trailBand);
  const celestial = shot.trailBand === 'CELESTIAL';
  const violet = shot.trailBand === 'VIOLET';
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
                width: 4 + t * (celestial ? 9 : violet ? 7 : 6),
                height: celestial ? 3 : 2,
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
            top: shot.y - (celestial ? 2 : 1),
            width: celestial ? 16 : violet ? 13 : 11,
            height: celestial ? 4 : violet ? 3.5 : 3,
            backgroundColor: palette.core,
            shadowColor: palette.glow,
            borderRadius: celestial ? 1 : violet ? 3 : 2,
          },
          celestial && styles.projectileCelestial,
          violet && styles.projectileViolet,
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
    <View
      style={[
        styles.creditOrb,
        isGold ? styles.creditOrbGold : styles.creditOrbStandard,
        { left: pickup.x, top: pickup.y, opacity },
      ]}
    >
      <Text
        style={[
          styles.creditPickup,
          isGold ? styles.creditGold : styles.creditStandard,
        ]}
      >
        {isGold ? `+${pickup.amount} GC` : `+${pickup.amount} STC`}
      </Text>
    </View>
  );
}

function SparkView({ spark }: { spark: SparkParticle }) {
  const t = Math.max(0, spark.life / spark.maxLife);
  return (
    <View
      style={[
        styles.spark,
        {
          left: spark.x,
          top: spark.y,
          opacity: t,
          width: 2 + t * 2,
          height: 2 + t * 2,
        },
      ]}
    />
  );
}

function ShatterView({ shard }: { shard: ShatterShard }) {
  const t = Math.max(0, shard.life / shard.maxLife);
  return (
    <View
      style={[
        styles.shard,
        {
          left: shard.x,
          top: shard.y,
          width: shard.width,
          height: shard.height,
          opacity: t,
          transform: [{ rotate: `${shard.rotation}deg` }],
        },
      ]}
    />
  );
}

function TelemetryOverlay({ snapshot }: { snapshot: BattlerSnapshot }) {
  const { telemetry } = snapshot;
  const wardenActive = snapshot.hostiles.some(
    (h) => h.isBoss && h.disintegrate <= 0,
  );
  const live = snapshot.hostiles.find((h) => h.disintegrate <= 0 && h.hp > 0);
  const archLabel =
    live?.archetype === 'SCARAB'
      ? 'SCARAB SKIRMISHER'
      : live?.archetype === 'AEGIS'
        ? 'AEGIS BASTION'
        : live?.archetype === 'VOID_WEAVER'
          ? 'VOID WEAVER'
          : live?.archetype === 'SECTOR_WARDEN'
            ? 'SECTOR WARDEN'
            : null;

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
      {archLabel ? (
        <Text style={styles.archetypeReadout}>{archLabel}</Text>
      ) : null}
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
  const equippedGear = useGameStore((s) => s.equippedGear);
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

  const flashOpacity =
    snapshot.screenFlash > 0
      ? Math.min(0.55, (snapshot.screenFlash / 0.06) * 0.55)
      : 0;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={[styles.shakeLayer, shakeStyle]}>
        <ArenaBackground
          parallax={snapshot.parallax}
          width={size.width}
          height={size.height}
          sectorWorld={snapshot.telemetry.sectorWorld}
        />
        <ExoRigView snapshot={snapshot} equippedGear={equippedGear} />
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
        {snapshot.shatterShards.map((s) => (
          <ShatterView key={s.id} shard={s} />
        ))}
        {snapshot.sparks.map((s) => (
          <SparkView key={s.id} spark={s} />
        ))}
        {snapshot.damageNumbers.map((dn) => (
          <DamageNumberView key={dn.id} dn={dn} />
        ))}
        {snapshot.creditPickups.map((c) => (
          <CreditPickupView key={c.id} pickup={c} />
        ))}
      </View>
      {flashOpacity > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.screenFlash, { opacity: flashOpacity }]}
        />
      ) : null}
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
  screenFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.celestial,
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
  thruster: {
    position: 'absolute',
    height: 8,
    top: '42%',
    borderRadius: 2,
  },
  thrusterCore: {
    position: 'absolute',
    height: 3,
    top: '48%',
    borderRadius: 1,
    opacity: 0.85,
  },
  auraRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderRadius: RADII.md,
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  exoCore: {
    width: '70%',
    height: '78%',
    backgroundColor: COLORS.hull,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: RADII.sm,
  },
  weaponBarrel: {
    position: 'absolute',
    right: -4,
    borderRadius: 1,
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
  scarabBody: {
    width: '100%',
    height: '82%',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.hostile,
    borderRadius: RADII.sm,
    overflow: 'hidden',
  },
  scarabCarapace: {
    position: 'absolute',
    top: '10%',
    left: '15%',
    right: '15%',
    height: '45%',
    backgroundColor: COLORS.border,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  scarabLegL: {
    position: 'absolute',
    left: 1,
    bottom: 2,
    width: '28%',
    height: 3,
    backgroundColor: COLORS.hostile,
  },
  scarabLegR: {
    position: 'absolute',
    right: 1,
    bottom: 2,
    width: '28%',
    height: 3,
    backgroundColor: COLORS.hostile,
  },
  aegisBody: {
    width: '100%',
    height: '86%',
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.teal,
    borderRadius: RADII.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aegisShield: {
    position: 'absolute',
    left: 2,
    top: '12%',
    width: '34%',
    height: '70%',
    backgroundColor: 'rgba(45, 212, 191, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.teal,
  },
  aegisCore: {
    width: '40%',
    height: '50%',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.cyan,
  },
  weaverBody: {
    width: '100%',
    height: '88%',
    backgroundColor: 'rgba(26, 16, 48, 0.92)',
    borderWidth: 1,
    borderColor: COLORS.violet,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  weaverOrb: {
    width: '46%',
    height: '36%',
    borderRadius: 20,
    backgroundColor: COLORS.violet,
    opacity: 0.7,
  },
  weaverThread: {
    position: 'absolute',
    bottom: 6,
    width: '70%',
    height: 2,
    backgroundColor: COLORS.violet,
    opacity: 0.55,
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
  scarabHpTrack: {
    height: 2,
  },
  weaverHpTrack: {
    height: 3,
    backgroundColor: 'rgba(167, 139, 250, 0.35)',
  },
  aegisShieldTrack: {
    marginTop: 2,
    width: '100%',
    height: 2,
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
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  spark: {
    position: 'absolute',
    backgroundColor: COLORS.celestial,
    borderRadius: 2,
  },
  shard: {
    position: 'absolute',
    backgroundColor: COLORS.violet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.celestial,
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
  creditOrb: {
    position: 'absolute',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  creditOrbStandard: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: COLORS.cyan,
  },
  creditOrbGold: {
    backgroundColor: 'rgba(245, 215, 110, 0.2)',
    borderColor: COLORS.gold,
  },
  creditPickup: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  creditStandard: {
    color: COLORS.cyan,
  },
  creditGold: {
    color: COLORS.gold,
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
  archetypeReadout: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.6,
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
