/**
 * Sector Sentinel — fixed-timestep combat engine (outside React render).
 * Exo-Rig vs Autonomous Hostile Constructs; rewards wire into Zustand store.
 */

import { useGameStore } from '../store/useGameStore';

export const TARGET_FPS = 60;
export const FIXED_DT = 1 / TARGET_FPS;

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
}

export type BattlerListener = (snapshot: BattlerSnapshot) => void;

let entityId = 1;
function nextEntityId(): number {
  entityId += 1;
  return entityId;
}

function enemyStats(world: number, level: number): {
  hp: number;
  defense: number;
  speed: number;
} {
  const tier = (world - 1) * 10 + level;
  return {
    hp: Math.round(80 + tier * 28 + world * 40),
    defense: Math.round(4 + tier * 1.8 + world * 3),
    speed: 38 + Math.min(40, tier * 1.2),
  };
}

function salvageCreditsForKill(world: number, level: number, pr: number): number {
  const tier = (world - 1) * 10 + level;
  return Math.round(12 + tier * 4 + pr * 0.08);
}

/** ~40% chance a defeated construct drops a Supply Cache */
function rollSupplyCacheDrop(rng: () => number = Math.random): boolean {
  return rng() < 0.4;
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
    this.exoRig.y = height * 0.55;
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
    const target = this.hostiles[0];
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
      },
      scrollX: this.scrollX,
      running: this.running,
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
    this.accumulator += frameDelta;

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
    const y = this.viewportHeight * 0.52;
    this.hostiles.push({
      id: nextEntityId(),
      x: this.viewportWidth + 40,
      y,
      width: 34,
      height: 42,
      hp: stats.hp,
      maxHp: stats.hp,
      defense: stats.defense,
      speed: stats.speed,
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
    const target = this.hostiles[0];
    if (!target || this.fireCooldown > 0) {
      return;
    }

    const fireRate = 0.35 + Math.min(0.45, powerRating / 800);
    this.fireCooldown = 1 / fireRate;
    const damage = Math.max(6, powerRating * 0.22);

    this.projectiles.push({
      id: nextEntityId(),
      x: this.exoRig.x + this.exoRig.width,
      y: this.exoRig.y + this.exoRig.height * 0.35,
      vx: 320 + powerRating * 0.15,
      vy: 0,
      damage,
      fromPlayer: true,
      life: 2.5,
    });
  }

  private updateProjectiles(dt: number, powerRating: number): void {
    const remaining: Projectile[] = [];

    for (const shot of this.projectiles) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || shot.x > this.viewportWidth + 80) {
        continue;
      }

      if (shot.fromPlayer) {
        let consumed = false;
        for (const hostile of this.hostiles) {
          if (this.hitsHostile(shot, hostile)) {
            const mitigated = Math.max(1, shot.damage - hostile.defense * 0.45);
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

  private hitsHostile(shot: Projectile, hostile: HostileConstruct): boolean {
    return (
      shot.x >= hostile.x &&
      shot.x <= hostile.x + hostile.width &&
      shot.y >= hostile.y &&
      shot.y <= hostile.y + hostile.height
    );
  }

  private resolveKill(hostile: HostileConstruct, powerRating: number): void {
    const store = useGameStore.getState();
    const credits = salvageCreditsForKill(
      store.currentSectorWorld,
      store.currentSectorLevel,
      powerRating,
    );
    const dropCache = rollSupplyCacheDrop();
    store.applyCombatVictory(credits, dropCache);

    this.spawnDamageNumber(
      hostile.x + hostile.width * 0.5,
      hostile.y - 8,
      credits,
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
