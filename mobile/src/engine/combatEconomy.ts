/**
 * Shared combat economy helpers — kill payouts + offline kill-rate estimate.
 * Kept free of React / Zustand so BattlerEngine and the game store can both use it.
 */

/** Mirrors BattlerEngine COMBAT_BALANCE (keep in sync with BalanceConfig.json). */
export const COMBAT_ECONOMY = {
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
  /** Soft travel / acquire buffer added to TTK for offline sim */
  approachBufferSeconds: 0.85,
} as const;

/** Offline patrol accrual hard cap (8 hours). */
export const OFFLINE_PATROL_CAP_MS = 8 * 60 * 60 * 1000;

/** Ignore brief background blips — only report meaningful away time. */
export const OFFLINE_PATROL_MIN_MS = 60 * 1000;

export function sectorTier(world: number, level: number): number {
  return (world - 1) * 10 + level;
}

export function enemyHp(world: number, level: number): number {
  const tier = sectorTier(world, level);
  return Math.round(
    COMBAT_ECONOMY.enemyHpBase +
      tier * COMBAT_ECONOMY.enemyHpPerTier +
      world * COMBAT_ECONOMY.enemyHpPerWorld,
  );
}

export function enemyDefense(world: number, level: number): number {
  const tier = sectorTier(world, level);
  return Math.round(
    COMBAT_ECONOMY.enemyDefenseBase +
      tier * COMBAT_ECONOMY.enemyDefensePerTier +
      world * COMBAT_ECONOMY.enemyDefensePerWorld,
  );
}

/** Standard Credits — common kill salvage (funds Cache upgrades). */
export function standardCreditsForKill(
  world: number,
  level: number,
  powerRating: number,
): number {
  const tier = sectorTier(world, level);
  return Math.round(12 + tier * 4 + powerRating * 0.08);
}

/**
 * Gold Credits — scarcer kill salvage (spend to Open Cache).
 * Early W1 ≈ 1 GC/kill; open cost 5 → crates every ~5 kills early-game.
 */
export function goldCreditsForKill(world: number, level: number): number {
  const tier = sectorTier(world, level);
  return Math.max(1, Math.round(0.85 + tier * 0.12));
}

/**
 * Estimated autonomous kills / second at the current sector for a given Power Rating.
 * Models normal (non-Warden) hostiles — offline patrol does not advance sectors.
 */
export function estimateSectorKillRatePerSecond(
  world: number,
  level: number,
  powerRating: number,
): number {
  const pr = Math.max(40, powerRating);
  const fireRate =
    COMBAT_ECONOMY.fireRateBase +
    Math.min(
      COMBAT_ECONOMY.fireRateCapBonus,
      pr / COMBAT_ECONOMY.fireRatePrDivisor,
    );
  const rawDamage = Math.max(
    COMBAT_ECONOMY.shotDamageMin,
    pr * COMBAT_ECONOMY.shotDamagePerPr,
  );
  const dmgPerShot = Math.max(
    1,
    rawDamage - enemyDefense(world, level) * COMBAT_ECONOMY.defenseMitigation,
  );
  const shotsToKill = Math.max(1, Math.ceil(enemyHp(world, level) / dmgPerShot));
  const ttk =
    shotsToKill / Math.max(0.25, fireRate) + COMBAT_ECONOMY.approachBufferSeconds;
  return 1 / Math.max(0.5, ttk);
}

export interface OfflinePatrolYield {
  /** Capped elapsed away time in ms */
  elapsedMs: number;
  estimatedKills: number;
  standardCredits: number;
  goldCredits: number;
}

/** Simulate STC + GC accrued while away, capped at 8h, from sector kill rate. */
export function simulateOfflinePatrolYield(params: {
  elapsedMs: number;
  world: number;
  level: number;
  powerRating: number;
}): OfflinePatrolYield {
  const elapsedMs = Math.max(
    0,
    Math.min(OFFLINE_PATROL_CAP_MS, Math.floor(params.elapsedMs)),
  );
  const elapsedSec = elapsedMs / 1000;
  const killRate = estimateSectorKillRatePerSecond(
    params.world,
    params.level,
    params.powerRating,
  );
  const estimatedKills = Math.floor(killRate * elapsedSec);
  const stcPerKill = standardCreditsForKill(
    params.world,
    params.level,
    params.powerRating,
  );
  const gcPerKill = goldCreditsForKill(params.world, params.level);
  return {
    elapsedMs,
    estimatedKills,
    standardCredits: estimatedKills * stcPerKill,
    goldCredits: estimatedKills * gcPerKill,
  };
}

/** Human-readable away duration for the patrol report modal. */
export function formatAwayDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}
