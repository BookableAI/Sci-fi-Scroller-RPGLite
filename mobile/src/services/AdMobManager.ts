/**
 * AdMob interstitial + rewarded pipeline.
 * Interstitials: every 5th sector clear; preload at X-4 / X-9; skip if no_ads.
 */

import {
  AdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';

import {
  OVERCLOCK_DURATION_MS,
  type RewardedAdKind,
} from '../types/monetization';
import { useGameStore } from '../store/useGameStore';
import { AdUnitIds } from './monetizationConfig';
import { PurchaseManager } from './PurchaseManager';

type InterstitialHandle = ReturnType<typeof InterstitialAd.createForAdRequest>;
type RewardedHandle = ReturnType<typeof RewardedAd.createForAdRequest>;

let interstitial: InterstitialHandle | null = null;
let interstitialLoaded = false;
let interstitialShowing = false;

let rewarded: RewardedHandle | null = null;
let rewardedLoaded = false;
let pendingReward: RewardedAdKind | null = null;

function detachInterstitial(): void {
  interstitial = null;
  interstitialLoaded = false;
}

function detachRewarded(): void {
  rewarded = null;
  rewardedLoaded = false;
}

function createAndLoadInterstitial(): void {
  detachInterstitial();
  const ad = InterstitialAd.createForAdRequest(AdUnitIds.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });
  interstitial = ad;

  ad.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    detachInterstitial();
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialShowing = false;
    detachInterstitial();
  });

  ad.load();
}

function createAndLoadRewarded(): void {
  detachRewarded();
  const ad = RewardedAd.createForAdRequest(AdUnitIds.rewarded, {
    requestNonPersonalizedAdsOnly: true,
  });
  rewarded = ad;

  ad.addAdEventListener(AdEventType.LOADED, () => {
    rewardedLoaded = true;
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    detachRewarded();
    pendingReward = null;
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    detachRewarded();
    // Keep a warm rewarded ready for the next request
    createAndLoadRewarded();
  });
  ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    const kind = pendingReward;
    pendingReward = null;
    if (kind === 'OVERCLOCK') {
      useGameStore.getState().activateOverclock(OVERCLOCK_DURATION_MS);
    } else if (kind === 'FABRICATION_SKIP') {
      useGameStore.getState().completeFabricationNow();
    }
  });

  ad.load();
}

function shouldPreloadForLevel(level: number): boolean {
  // Levels X-4 and X-9 within a 1–10 sector band
  return level % 5 === 4;
}

function shouldShowInterstitialForCompletedLevel(completedLevel: number): boolean {
  return completedLevel > 0 && completedLevel % 5 === 0;
}

export const AdMobManager = {
  /** Warm interstitial + rewarded once at app start. */
  initialize(): void {
    createAndLoadInterstitial();
    createAndLoadRewarded();
  },

  /**
   * Called after a sector clear advances progression.
   * @param completedLevel Level that was just cleared (pre-increment).
   * @param nextLevel Level after victory (post-increment / wrap).
   */
  async handleSectorProgress(
    completedLevel: number,
    nextLevel: number,
  ): Promise<void> {
    if (shouldPreloadForLevel(nextLevel) && !interstitialLoaded) {
      createAndLoadInterstitial();
    }

    if (!shouldShowInterstitialForCompletedLevel(completedLevel)) {
      return;
    }

    const noAds = await PurchaseManager.hasNoAdsEntitlement();
    if (noAds) {
      return;
    }

    await this.showInterstitial();
  },

  async showInterstitial(): Promise<boolean> {
    if (interstitialShowing) {
      return false;
    }
    const noAds = await PurchaseManager.hasNoAdsEntitlement();
    if (noAds) {
      return false;
    }
    if (!interstitial || !interstitialLoaded) {
      createAndLoadInterstitial();
      return false;
    }
    try {
      interstitialShowing = true;
      await interstitial.show();
      return true;
    } catch {
      interstitialShowing = false;
      detachInterstitial();
      createAndLoadInterstitial();
      return false;
    }
  },

  /** Preload helper for explicit X-4 / X-9 hooks. */
  preloadInterstitialForLevel(level: number): void {
    if (shouldPreloadForLevel(level)) {
      createAndLoadInterstitial();
    }
  },

  async showRewarded(kind: RewardedAdKind): Promise<boolean> {
    if (!rewarded || !rewardedLoaded) {
      createAndLoadRewarded();
      return false;
    }
    pendingReward = kind;
    try {
      await rewarded.show();
      return true;
    } catch {
      pendingReward = null;
      detachRewarded();
      createAndLoadRewarded();
      return false;
    }
  },

  showOverclockRewarded(): Promise<boolean> {
    return this.showRewarded('OVERCLOCK');
  },

  showFabricationSkipRewarded(): Promise<boolean> {
    return this.showRewarded('FABRICATION_SKIP');
  },

  isInterstitialReady(): boolean {
    return interstitialLoaded;
  },

  isRewardedReady(): boolean {
    return rewardedLoaded;
  },
} as const;
