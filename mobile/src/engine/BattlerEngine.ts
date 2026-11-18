/**
 * Sector Sentinel — fixed-timestep combat engine (outside React render).
 * Exo-Rig vs Autonomous Hostile Constructs; rewards wire into Zustand store.
 */

import { useGameStore } from '../store/useGameStore';
import type { TargetingProtocol } from '../types/game';

export const TARGET_FPS = 60;
export const FIXED_DT = 1 / TARGET_FPS;

/** Projectile AABB used for collision (matches rendered bolt size + padding) */
const PROJECTILE_HIT_W = 14;
const PROJECTILE_HIT_H = 10;
/** Soft aim pad so bolts still connect when Y drifts slightly */
const HIT_PAD = 6;

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
}

export interface DamageNumber {
  id: number;
  x: number;
  y: number;
  value: number;
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
  parallax: readonly ParallaxLayer[];
  telemetry: CombatTelemetry;
  scrollX: number;
  running: boolean;
  aimTargetId: number | null;
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
} as const;

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
  private parallax: ParallaxLayer[] = [
    { offset: 0, speed: 12 },
    { offset: 0, speed: 28 },
    { offset: 0, speed: 52 },
  ];

  private viewportWidth = 390;
  private viewportHeight = 280;

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
    const target = selectAimTarget(this.hostiles, this.exoRig, protocol);
    const targetDistance = target
      ? Math.max(0, target.x - (this.exoRig.x + this.exoRig.width))
      : 0;

    return {
      exoRig: { ...this.exoRig },
      hostiles: this.hostiles.map((h) => ({ ...h })),
      projectiles: this.projectiles.map((p) => ({ ...p })),
      damageNumbers: this.damageNumbers.map((d) => ({ ...d })),
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
    };
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
    this.updatePlayerFire(dt, powerRating);
    this.updateProjectiles(dt, powerRating);
    this.updateDamageNumbers(dt);
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
    const stats = enemyStats(store.currentSectorWorld, store.currentSectorLevel);
    const height = 42;
    this.hostiles.push({
      id: nextEntityId(),
      x: this.viewportWidth + 40,
      y: this.laneY(height),
      width: 34,
      height,
      hp: stats.hp,
      maxHp: stats.hp,
      defense: stats.defense,
      speed: stats.speed,
      powerRating: stats.powerRating,
    });
  }

  private updateHostiles(dt: number): void {
    const engageX = this.exoRig.x + this.exoRig.width + 90;
    for (const hostile of this.hostiles) {
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
    }
  }

  private updatePlayerFire(dt: number, powerRating: number): void {
    this.fireCooldown -= dt;
    const protocol = useGameStore.getState().targetingProtocol;
    const target = selectAimTarget(this.hostiles, this.exoRig, protocol);
    if (!target || this.fireCooldown > 0) {
      return;
    }

    const fireRate =
      COMBAT_BALANCE.fireRateBase +
      Math.min(COMBAT_BALANCE.fireRateCapBonus, powerRating / COMBAT_BALANCE.fireRatePrDivisor);
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
    });
  }

  private updateProjectiles(dt: number, powerRating: number): void {
    const remaining: Projectile[] = [];
    const boltSpeed = 320 + powerRating * 0.15;

    for (const shot of this.projectiles) {
      if (shot.fromPlayer && shot.targetId !== null) {
        const locked = this.hostiles.find((h) => h.id === shot.targetId);
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
            hostile.hp -= mitigated;
            this.dpsWindowDamage += mitigated;
            this.spawnDamageNumber(hostile.x, hostile.y, mitigated);
            consumed = true;
            if (hostile.hp <= 0) {
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
    this.hostiles = this.hostiles.filter((h) => h.hp > 0);
  }

  private orderHostilesForShot(shot: Projectile): HostileConstruct[] {
    if (shot.targetId === null) {
      return this.hostiles;
    }
    const locked = this.hostiles.filter((h) => h.id === shot.targetId);
    const others = this.hostiles.filter((h) => h.id !== shot.targetId);
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
    const standard = standardCreditsForKill(
      store.currentSectorWorld,
      store.currentSectorLevel,
      powerRating,
    );
    const gold = goldCreditsForKill(
      store.currentSectorWorld,
      store.currentSectorLevel,
    );
    store.applyCombatVictory(standard, gold);

    this.spawnDamageNumber(
      hostile.x + hostile.width * 0.5,
      hostile.y - 8,
      standard,
    );

    // Soft heal on sector clear
    this.exoRig.hp = Math.min(this.exoRig.maxHp, this.exoRig.hp + this.exoRig.maxHp * 0.08);
  }

  private spawnDamageNumber(x: number, y: number, value: number): void {
    this.damageNumbers.push({
      id: nextEntityId(),
      x,
      y,
      value: Math.round(value),
      life: 0.7,
      maxLife: 0.7,
    });
  }

  private updateDamageNumbers(dt: number): void {
    const next: DamageNumber[] = [];
    for (const dn of this.damageNumbers) {
      dn.life -= dt;
      dn.y -= 28 * dt;
      if (dn.life > 0) {
        next.push(dn);
      }
    }
    this.damageNumbers = next;
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
