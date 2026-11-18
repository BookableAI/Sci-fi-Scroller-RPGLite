/**
 * Sector Sentinel — fixed-timestep combat engine (outside React render).
 * Exo-Rig vs Autonomous Hostile Constructs; rewards wire into Zustand store.
 * Luminous combat VFX: hit-flash, crit micro-shake, rarity trails, credit arcs.
 */

import { useGameStore } from '../store/useGameStore';
import {
  computeAffinityCombatBonuses,
  type AffinityCombatBonuses,
  type Rarity,
  type TargetingProtocol,
} from '../types/game';

export const TARGET_FPS = 60;
export const FIXED_DT = 1 / TARGET_FPS;

/** Projectile AABB used for collision (matches rendered bolt size + padding) */
const PROJECTILE_HIT_W = 14;
const PROJECTILE_HIT_H = 10;
/** Soft aim pad so bolts still connect when Y drifts slightly */
const HIT_PAD = 6;
/** Trail breadcrumb count per bolt */
const TRAIL_LENGTH = 6;
/** Hit-flash duration (seconds) */
const HIT_FLASH_LIFE = 0.09;
/** Disintegrate dissolve after lethal hit (seconds) */
const DISINTEGRATE_LIFE = 0.42;
/** Crit chance floor / weapon-scaled bonus */
const CRIT_BASE = 0.12;
const CRIT_PER_WEAPON_STAT = 0.0015;
const CRIT_DAMAGE_MULT = 1.75;
/** Camera micro-shake peak amplitude (px) + decay */
const SHAKE_PEAK = 3.2;
const SHAKE_DECAY = 9.5;

/** Trail band derived from equipped primary weapon rarity */
export type TrailBand = 'CYAN' | 'VIOLET' | 'CELESTIAL';

export type CreditKind = 'STANDARD' | 'GOLD';

export function trailBandForRarity(rarity: Rarity | null | undefined): TrailBand {
  if (rarity === 'RARE' || rarity === 'EPIC') {
    return 'VIOLET';
  }
  if (
    rarity === 'LEGENDARY' ||
    rarity === 'MYTHIC' ||
    rarity === 'CELESTIAL'
  ) {
    return 'CELESTIAL';
  }
  // COMMON / UNCOMMON / bare exo-rig baseline
  return 'CYAN';
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface ExoRigState {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  shieldIntegrity: number;
  /** 0–1 */
  shieldFraction: number;
}

export interface HostileConstruct {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  defense: number;
  speed: number;
  /** Inherent threat rating — used by STRONGEST / WEAKEST protocols */
  powerRating: number;
  /** Sector Warden gate boss (every 5th sector level) */
  isBoss: boolean;
  /** Remaining hit-flash seconds (luminous impact frame) */
  hitFlash: number;
  /** Remaining disintegrate seconds; 0 when intact */
  disintegrate: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  fromPlayer: boolean;
  life: number;
  /** Locked aim target id; homing while alive */
  targetId: number | null;
  /** Equipped-weapon rarity trail band */
  trailBand: TrailBand;
  /** Recent positions for luminous trail render */
  trail: readonly Vec2[];
}

export interface DamageNumber {
  id: number;
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
  isCrit: boolean;
}

/** Floating Standard / Gold Credit pickup after disintegrate */
export interface CreditPickup {
  id: number;
  kind: CreditKind;
  amount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface ParallaxLayer {
  offset: number;
  speed: number;
}

export interface CombatTelemetry {
  sectorWorld: number;
  sectorLevel: number;
  dps: number;
  shieldIntegrity: number;
  targetDistance: number;
  totalPowerRating: number;
  targetingProtocol: TargetingProtocol;
}

export interface BattlerSnapshot {
  exoRig: ExoRigState;
  hostiles: readonly HostileConstruct[];
  projectiles: readonly Projectile[];
  damageNumbers: readonly DamageNumber[];
  creditPickups: readonly CreditPickup[];
  parallax: readonly ParallaxLayer[];
  telemetry: CombatTelemetry;
  scrollX: number;
  running: boolean;
  aimTargetId: number | null;
  /** Camera micro-shake offset (crit impacts) */
  cameraShakeX: number;
  cameraShakeY: number;
}

export type BattlerListener = (snapshot: BattlerSnapshot) => void;

let entityId = 1;
function nextEntityId(): number {
  entityId += 1;
  return entityId;
}

/**
 * Early-game combat knobs (keep in sync with shared/BalanceConfig.json).
 * Tuned so W1-L1 at baseline PR (~40) dies in a few seconds, not a slog,
 * while later sectors still punish undergeared loadouts.
 */
const COMBAT_BALANCE = {
  enemyHpBase: 45,
  enemyHpPerTier: 19,
  enemyHpPerWorld: 26,
  enemyDefenseBase: 2,
  enemyDefensePerTier: 1.1,
  enemyDefensePerWorld: 1.8,
  defenseMitigation: 0.4,
  fireRateBase: 1.0,
  fireRateCapBonus: 0.8,
  fireRatePrDivisor: 550,
  shotDamageMin: 16,
  shotDamagePerPr: 0.48,
  /** Sector Warden (level % 5 === 0) */
  bossHpMultiplier: 3.5,
  bossRewardMultiplier: 3,
  bossWidth: 52,
  bossHeight: 64,
  normalWidth: 34,
  normalHeight: 42,
} as const;

/** Gate boss every 5th sector level (5, 10, …). */
export function isSectorWardenLevel(level: number): boolean {
  return level > 0 && level % 5 === 0;
}

function enemyStats(world: number, level: number): {
  hp: number;
  defense: number;
  speed: number;
  powerRating: number;
} {
  const tier = (world - 1) * 10 + level;
  const hp = Math.round(
    COMBAT_BALANCE.enemyHpBase +
      tier * COMBAT_BALANCE.enemyHpPerTier +
      world * COMBAT_BALANCE.enemyHpPerWorld,
  );
  const defense = Math.round(
    COMBAT_BALANCE.enemyDefenseBase +
      tier * COMBAT_BALANCE.enemyDefensePerTier +
      world * COMBAT_BALANCE.enemyDefensePerWorld,
  );
  return {
    hp,
    defense,
    speed: 38 + Math.min(40, tier * 1.2),
    powerRating: Math.round(hp * 0.35 + defense * 4 + tier * 6),
  };
}

/** Standard Credits — common kill salvage (funds Cache upgrades). */
function standardCreditsForKill(world: number, level: number, pr: number): number {
  const tier = (world - 1) * 10 + level;
  return Math.round(12 + tier * 4 + pr * 0.08);
}

/**
 * Gold Credits — scarcer kill salvage (spend to Open Cache).
 * Early W1 ≈ 1 GC/kill; open cost 5 → crates every ~5 kills early-game.
 */
function goldCreditsForKill(world: number, level: number): number {
  const tier = (world - 1) * 10 + level;
  return Math.max(1, Math.round(0.85 + tier * 0.12));
}

function distanceToHostile(exo: ExoRigState, hostile: HostileConstruct): number {
  const ax = exo.x + exo.width * 0.5;
  const ay = exo.y + exo.height * 0.5;
  const bx = hostile.x + hostile.width * 0.5;
  const by = hostile.y + hostile.height * 0.5;
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

/**
 * Pick the current aim target from live hostiles using the persisted protocol.
 * Strength uses construct powerRating (HP-scaled threat); distance uses exo→hostile.
 */
export function selectAimTarget(
  hostiles: readonly HostileConstruct[],
  exo: ExoRigState,
  protocol: TargetingProtocol,
): HostileConstruct | null {
  if (hostiles.length === 0) {
    return null;
  }
  if (hostiles.length === 1) {
    return hostiles[0];
  }

  let best = hostiles[0];
  let bestScore = scoreHostile(best, exo, protocol);

  for (let i = 1; i < hostiles.length; i += 1) {
    const h = hostiles[i];
    const score = scoreHostile(h, exo, protocol);
    const better =
      protocol === 'CLOSEST' || protocol === 'WEAKEST'
        ? score < bestScore
        : score > bestScore;
    if (better) {
      best = h;
      bestScore = score;
    }
  }
  return best;
}

function scoreHostile(
  hostile: HostileConstruct,
  exo: ExoRigState,
  protocol: TargetingProtocol,
): number {
  switch (protocol) {
    case 'CLOSEST':
      return distanceToHostile(exo, hostile);
    case 'FURTHEST':
      return distanceToHostile(exo, hostile);
    case 'STRONGEST':
      return hostile.powerRating;
    case 'WEAKEST':
      return hostile.hp;
    default:
      return distanceToHostile(exo, hostile);
  }
}

export class BattlerEngine {
  private accumulator = 0;
  private lastTimestamp: number | null = null;
  private rafHandle: number | null = null;
  private running = false;
  private listeners = new Set<BattlerListener>();

  private scrollX = 0;
  private fireCooldown = 0;
  private dpsWindowDamage = 0;
  private dpsWindowTime = 0;
  private displayedDps = 0;

  private exoRig: ExoRigState = {
    x: 56,
    y: 0,
    width: 36,
    height: 48,
    hp: 1000,
    maxHp: 1000,
    shieldIntegrity: 100,
    shieldFraction: 1,
  };

  private hostiles: HostileConstruct[] = [];
  private projectiles: Projectile[] = [];
  private damageNumbers: DamageNumber[] = [];
  private creditPickups: CreditPickup[] = [];
  /** Depth stack: stars → far ridges → mid terrain → near plates */
  private parallax: ParallaxLayer[] = [
    { offset: 0, speed: 8 },
    { offset: 0, speed: 18 },
    { offset: 0, speed: 36 },
    { offset: 0, speed: 58 },
  ];

  private viewportWidth = 390;
  private viewportHeight = 280;
  private shakeAmp = 0;
  private shakePhase = 0;

  setViewportSize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.exoRig.y = this.laneY(this.exoRig.height);
    // Keep live constructs on the same engagement lane after layout
    for (const hostile of this.hostiles) {
      hostile.y = this.laneY(hostile.height);
    }
  }

  /** Shared vertical lane so exo-rig, hostiles, and bolts share Y space */
  private laneY(entityHeight: number): number {
    return this.viewportHeight * 0.52 - entityHeight * 0.15;
  }

  subscribe(listener: BattlerListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): BattlerSnapshot {
    const store = useGameStore.getState();
    const protocol = store.targetingProtocol;
    const living = this.hostiles.filter(
      (h) => h.disintegrate <= 0 && h.hp > 0,
    );
    const target = selectAimTarget(living, this.exoRig, protocol);
    const targetDistance = target
      ? Math.max(0, target.x - (this.exoRig.x + this.exoRig.width))
      : 0;

    const shake = this.sampleShake();

    return {
      exoRig: { ...this.exoRig },
      hostiles: this.hostiles.map((h) => ({ ...h })),
      projectiles: this.projectiles.map((p) => ({
        ...p,
        trail: p.trail.map((t) => ({ ...t })),
      })),
      damageNumbers: this.damageNumbers.map((d) => ({ ...d })),
      creditPickups: this.creditPickups.map((c) => ({ ...c })),
      parallax: this.parallax.map((p) => ({ ...p })),
      telemetry: {
        sectorWorld: store.currentSectorWorld,
        sectorLevel: store.currentSectorLevel,
        dps: Math.round(this.displayedDps),
        shieldIntegrity: Math.round(this.exoRig.shieldFraction * 100),
        targetDistance: Math.round(targetDistance),
        totalPowerRating: store.getTotalPowerRating(),
        targetingProtocol: protocol,
      },
      scrollX: this.scrollX,
      running: this.running,
      aimTargetId: target?.id ?? null,
      cameraShakeX: shake.x,
      cameraShakeY: shake.y,
    };
  }

  private sampleShake(): Vec2 {
    if (this.shakeAmp <= 0.05) {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.sin(this.shakePhase * 47.3) * this.shakeAmp,
      y: Math.cos(this.shakePhase * 39.1) * this.shakeAmp * 0.7,
    };
  }

  private triggerCritShake(): void {
    this.shakeAmp = Math.max(this.shakeAmp, SHAKE_PEAK);
  }

  private updateShake(dt: number): void {
    if (this.shakeAmp <= 0) {
      this.shakeAmp = 0;
      return;
    }
    this.shakePhase += dt;
    this.shakeAmp = Math.max(0, this.shakeAmp - SHAKE_DECAY * dt);
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTimestamp = null;
    this.accumulator = 0;
    if (this.hostiles.length === 0) {
      this.spawnHostile();
    }
    this.rafHandle = requestAnimationFrame(this.frame);
    this.emit();
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastTimestamp = null;
    this.emit();
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  private frame = (timestamp: number): void => {
    if (!this.running) {
      return;
    }
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }
    const frameDelta = Math.min(0.25, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    // System Overclock (rewarded): 2x combat progression / movement
    const speed = useGameStore.getState().getCombatSpeedMultiplier();
    this.accumulator += frameDelta * speed;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 5) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }

    this.emit();
    this.rafHandle = requestAnimationFrame(this.frame);
  };

  private fixedUpdate(dt: number): void {
    const store = useGameStore.getState();
    const powerRating = store.getTotalPowerRating();

    this.scrollX += 40 * dt;
    for (const layer of this.parallax) {
      layer.offset = (layer.offset + layer.speed * dt) % this.viewportWidth;
    }

    this.regenerateShield(dt, powerRating);
    this.updateHostiles(dt);
    if (this.exoRig.hp <= 0) {
      this.resolveExoDestruction();
      return;
    }
    this.updatePlayerFire(dt, powerRating);
    this.updateProjectiles(dt, powerRating);
    this.updateDamageNumbers(dt);
    this.updateCreditPickups(dt);
    this.updateShake(dt);
    this.updateDpsMeter(dt);

    if (this.hostiles.length === 0) {
      this.spawnHostile();
    }
  }

  private regenerateShield(dt: number, powerRating: number): void {
    const maxShield = 80 + powerRating * 0.25;
    this.exoRig.shieldIntegrity = Math.min(
      maxShield,
      this.exoRig.shieldIntegrity + maxShield * 0.04 * dt,
    );
    this.exoRig.shieldFraction =
      maxShield > 0 ? this.exoRig.shieldIntegrity / maxShield : 0;
  }

  private spawnHostile(): void {
    const store = useGameStore.getState();
    const level = store.currentSectorLevel;
    const isBoss = isSectorWardenLevel(level);
    const stats = enemyStats(store.currentSectorWorld, level);
    const hp = isBoss
      ? Math.round(stats.hp * COMBAT_BALANCE.bossHpMultiplier)
      : stats.hp;
    const width = isBoss
      ? COMBAT_BALANCE.bossWidth
      : COMBAT_BALANCE.normalWidth;
    const height = isBoss
      ? COMBAT_BALANCE.bossHeight
      : COMBAT_BALANCE.normalHeight;
    const defense = isBoss
      ? Math.round(stats.defense * 1.35)
      : stats.defense;
    const powerRating = isBoss
      ? Math.round(stats.powerRating * COMBAT_BALANCE.bossHpMultiplier)
      : stats.powerRating;
    // Wardens advance slower — armored siege silhouette
    const speed = isBoss ? stats.speed * 0.72 : stats.speed;

    this.hostiles.push({
      id: nextEntityId(),
      x: this.viewportWidth + 40,
      y: this.laneY(height),
      width,
      height,
      hp,
      maxHp: hp,
      defense,
      speed,
      powerRating,
      isBoss,
      hitFlash: 0,
      disintegrate: 0,
    });
  }

  /**
   * Hull integrity failed. Sector Warden kills rewind one level (min 1)
   * so the pilot can farm gear and retry the gate.
   */
  private resolveExoDestruction(): void {
    const store = useGameStore.getState();
    const killedByBoss = this.hostiles.some((h) => h.isBoss);
    if (killedByBoss) {
      store.retreatFromBossDefeat();
    }

    this.exoRig.hp = this.exoRig.maxHp;
    this.exoRig.shieldIntegrity = 80 + store.getTotalPowerRating() * 0.25;
    this.exoRig.shieldFraction = 1;
    this.hostiles = [];
    this.projectiles = [];
    this.creditPickups = [];
    this.shakeAmp = 0;
    this.fireCooldown = 0.4;
    this.spawnHostile();
  }

  private updateHostiles(dt: number): void {
    const engageX = this.exoRig.x + this.exoRig.width + 90;
    const surviving: HostileConstruct[] = [];

    for (const hostile of this.hostiles) {
      if (hostile.hitFlash > 0) {
        hostile.hitFlash = Math.max(0, hostile.hitFlash - dt);
      }

      // Dissolving silhouettes no longer advance or pressure the exo-rig
      if (hostile.disintegrate > 0) {
        hostile.disintegrate = Math.max(0, hostile.disintegrate - dt);
        if (hostile.disintegrate > 0) {
          surviving.push(hostile);
        }
        continue;
      }

      if (hostile.x > engageX) {
        hostile.x -= hostile.speed * dt;
      } else {
        // Melee pressure against shield / hull
        const pressure = (8 + hostile.defense * 0.35) * dt;
        if (this.exoRig.shieldIntegrity > 0) {
          this.exoRig.shieldIntegrity = Math.max(
            0,
            this.exoRig.shieldIntegrity - pressure,
          );
        } else {
          this.exoRig.hp = Math.max(0, this.exoRig.hp - pressure * 0.6);
        }
      }
      surviving.push(hostile);
    }

    this.hostiles = surviving;
  }

  private resolveAffinityBonuses(): AffinityCombatBonuses {
    return computeAffinityCombatBonuses(useGameStore.getState().equippedGear);
  }

  private updatePlayerFire(dt: number, powerRating: number): void {
    this.fireCooldown -= dt;
    const store = useGameStore.getState();
    const protocol = store.targetingProtocol;
    const living = this.hostiles.filter((h) => h.disintegrate <= 0 && h.hp > 0);
    const target = selectAimTarget(living, this.exoRig, protocol);
    if (!target || this.fireCooldown > 0) {
      return;
    }

    const affinity = this.resolveAffinityBonuses();
    const fireRate =
      (COMBAT_BALANCE.fireRateBase +
        Math.min(
          COMBAT_BALANCE.fireRateCapBonus,
          powerRating / COMBAT_BALANCE.fireRatePrDivisor,
        )) *
      affinity.fireRateMult;
    this.fireCooldown = 1 / fireRate;
    const damage = Math.max(
      COMBAT_BALANCE.shotDamageMin,
      powerRating * COMBAT_BALANCE.shotDamagePerPr,
    );

    const originX = this.exoRig.x + this.exoRig.width;
    const originY = this.exoRig.y + this.exoRig.height * 0.4;
    const aimX = target.x + target.width * 0.35;
    const aimY = target.y + target.height * 0.45;
    const dx = aimX - originX;
    const dy = aimY - originY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = 320 + powerRating * 0.15;
    const weapon = store.equippedGear.WEAPON;
    const trailBand = trailBandForRarity(weapon?.rarity);

    this.projectiles.push({
      id: nextEntityId(),
      x: originX,
      y: originY,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      damage,
      fromPlayer: true,
      life: 2.5,
      targetId: target.id,
      trailBand,
      trail: [{ x: originX, y: originY }],
    });
  }

  private updateProjectiles(dt: number, powerRating: number): void {
    const remaining: Projectile[] = [];
    const boltSpeed = 320 + powerRating * 0.15;
    const weapon = useGameStore.getState().equippedGear.WEAPON;
    const affinity = this.resolveAffinityBonuses();
    const critChance = Math.min(
      0.42,
      CRIT_BASE + (weapon?.primaryStat ?? 0) * CRIT_PER_WEAPON_STAT,
    );
    const critDamageMult = CRIT_DAMAGE_MULT * affinity.critDamageMult;

    for (const shot of this.projectiles) {
      if (shot.fromPlayer && shot.targetId !== null) {
        const locked = this.hostiles.find(
          (h) => h.id === shot.targetId && h.disintegrate <= 0 && h.hp > 0,
        );
        if (locked) {
          // Homing correction so bolts stay on the selected protocol target
          const aimX = locked.x + locked.width * 0.35;
          const aimY = locked.y + locked.height * 0.45;
          const dx = aimX - shot.x;
          const dy = aimY - shot.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const desiredVx = (dx / dist) * boltSpeed;
          const desiredVy = (dy / dist) * boltSpeed;
          const turn = Math.min(1, 10 * dt);
          shot.vx += (desiredVx - shot.vx) * turn;
          shot.vy += (desiredVy - shot.vy) * turn;
        }
      }

      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;

      // Breadcrumb trail (mutable internal array)
      const trail = shot.trail as Vec2[];
      trail.push({ x: shot.x, y: shot.y });
      while (trail.length > TRAIL_LENGTH) {
        trail.shift();
      }

      if (shot.life <= 0 || shot.x > this.viewportWidth + 80 || shot.x < -40) {
        continue;
      }

      if (shot.fromPlayer) {
        let consumed = false;
        // Prefer locked target first so protocol selection lands reliably
        const ordered = this.orderHostilesForShot(shot);
        for (const hostile of ordered) {
          if (this.hitsHostile(shot, hostile)) {
            const mitigated = Math.max(
              1,
              shot.damage - hostile.defense * COMBAT_BALANCE.defenseMitigation,
            );
            const isCrit = Math.random() < critChance;
            const dealt = isCrit ? mitigated * critDamageMult : mitigated;
            hostile.hp -= dealt;
            hostile.hitFlash = HIT_FLASH_LIFE;
            this.dpsWindowDamage += dealt;
            this.spawnDamageNumber(
              hostile.x + hostile.width * 0.25,
              hostile.y,
              dealt,
              isCrit,
            );
            if (isCrit) {
              this.triggerCritShake();
            }
            consumed = true;
            if (hostile.hp <= 0 && hostile.disintegrate <= 0) {
              this.resolveKill(hostile, powerRating);
            }
            break;
          }
        }
        if (!consumed) {
          remaining.push(shot);
        }
      } else {
        remaining.push(shot);
      }
    }

    this.projectiles = remaining;
  }

  private orderHostilesForShot(shot: Projectile): HostileConstruct[] {
    const living = this.hostiles.filter(
      (h) => h.disintegrate <= 0 && h.hp > 0,
    );
    if (shot.targetId === null) {
      return living;
    }
    const locked = living.filter((h) => h.id === shot.targetId);
    const others = living.filter((h) => h.id !== shot.targetId);
    return [...locked, ...others];
  }

  private hitsHostile(shot: Projectile, hostile: HostileConstruct): boolean {
    const shotLeft = shot.x - HIT_PAD;
    const shotRight = shot.x + PROJECTILE_HIT_W + HIT_PAD;
    const shotTop = shot.y - PROJECTILE_HIT_H * 0.5 - HIT_PAD;
    const shotBottom = shot.y + PROJECTILE_HIT_H * 0.5 + HIT_PAD;

    const hostLeft = hostile.x;
    const hostRight = hostile.x + hostile.width;
    const hostTop = hostile.y;
    const hostBottom = hostile.y + hostile.height;

    return (
      shotLeft <= hostRight &&
      shotRight >= hostLeft &&
      shotTop <= hostBottom &&
      shotBottom >= hostTop
    );
  }

  private resolveKill(hostile: HostileConstruct, powerRating: number): void {
    const store = useGameStore.getState();
    const rewardMult = hostile.isBoss ? COMBAT_BALANCE.bossRewardMultiplier : 1;
    const affinity = this.resolveAffinityBonuses();
    const standard = Math.round(
      standardCreditsForKill(
        store.currentSectorWorld,
        store.currentSectorLevel,
        powerRating,
      ) * rewardMult,
    );
    const gold = Math.round(
      goldCreditsForKill(
        store.currentSectorWorld,
        store.currentSectorLevel,
      ) *
        rewardMult *
        affinity.goldCreditYieldMult,
    );
    store.applyCombatVictory(standard, gold);

    // Begin luminous disintegrate; keep silhouette while credit arcs rise
    hostile.hp = 0;
    hostile.disintegrate = DISINTEGRATE_LIFE;
    hostile.hitFlash = HIT_FLASH_LIFE * 1.6;
    this.spawnCreditArcs(hostile, standard, gold);

    // Soft heal on sector clear (Wardens restore more hull after a gate clear)
    const healFrac = hostile.isBoss ? 0.2 : 0.08;
    this.exoRig.hp = Math.min(
      this.exoRig.maxHp,
      this.exoRig.hp + this.exoRig.maxHp * healFrac,
    );
  }

  private spawnCreditArcs(
    hostile: HostileConstruct,
    standard: number,
    gold: number,
  ): void {
    const cx = hostile.x + hostile.width * 0.5;
    const cy = hostile.y + hostile.height * 0.2;

    this.creditPickups.push({
      id: nextEntityId(),
      kind: 'STANDARD',
      amount: standard,
      x: cx - 10,
      y: cy,
      vx: -28 - Math.random() * 18,
      vy: -78 - Math.random() * 24,
      life: 1.05,
      maxLife: 1.05,
    });

    this.creditPickups.push({
      id: nextEntityId(),
      kind: 'GOLD',
      amount: gold,
      x: cx + 10,
      y: cy,
      vx: 26 + Math.random() * 18,
      vy: -86 - Math.random() * 28,
      life: 1.15,
      maxLife: 1.15,
    });
  }

  private spawnDamageNumber(
    x: number,
    y: number,
    value: number,
    isCrit = false,
  ): void {
    this.damageNumbers.push({
      id: nextEntityId(),
      x,
      y,
      value: Math.round(value),
      life: isCrit ? 0.85 : 0.7,
      maxLife: isCrit ? 0.85 : 0.7,
      isCrit,
    });
  }

  private updateDamageNumbers(dt: number): void {
    const next: DamageNumber[] = [];
    for (const dn of this.damageNumbers) {
      dn.life -= dt;
      dn.y -= (dn.isCrit ? 36 : 28) * dt;
      if (dn.life > 0) {
        next.push(dn);
      }
    }
    this.damageNumbers = next;
  }

  private updateCreditPickups(dt: number): void {
    const next: CreditPickup[] = [];
    for (const pickup of this.creditPickups) {
      pickup.life -= dt;
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      // Soft arc gravity — floats up then settles
      pickup.vy += 110 * dt;
      pickup.vx *= 1 - 0.55 * dt;
      if (pickup.life > 0) {
        next.push(pickup);
      }
    }
    this.creditPickups = next;
  }

  private updateDpsMeter(dt: number): void {
    this.dpsWindowTime += dt;
    if (this.dpsWindowTime >= 1) {
      this.displayedDps = this.dpsWindowDamage / this.dpsWindowTime;
      this.dpsWindowDamage = 0;
      this.dpsWindowTime = 0;
    }
  }
}

/** Shared singleton used by the combat viewport */
export const battlerEngine = new BattlerEngine();
