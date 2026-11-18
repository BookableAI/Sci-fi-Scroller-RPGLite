/**
 * AdMob interstitial + rewarded pipeline.
 * Interstitials: every 5th sector clear; preload at X-4 / X-9; skip if no_ads.
 *
 * Soft-fails in Expo Go / when the native module is unavailable (dev client required).
 * Never statically imports react-native-google-mobile-ads — require only after a
 * TurboModule probe so Expo Go never touches RNGoogleMobileAdsModule.
 */

import {
  OVERCLOCK_DURATION_MS,
  type RewardedAdKind,
} from '../types/monetization';
import { useGameStore } from '../store/useGameStore';
import { AdUnitIds } from './monetizationConfig';
import {
  NATIVE_MODULE_NAMES,
  canRequireNativeModule,
} from './nativeAvailability';

type AdsModule = {
  InterstitialAd: {
    createForAdRequest: (
      unitId: string,
      opts?: { requestNonPersonalizedAdsOnly?: boolean },
    ) => InterstitialHandle;
  };
  RewardedAd: {
    createForAdRequest: (
      unitId: string,
      opts?: { requestNonPersonalizedAdsOnly?: boolean },
    ) => RewardedHandle;
  };
  AdEventType: {
    LOADED: string;
    ERROR: string;
    CLOSED: string;
  };
  RewardedAdEventType: {
    EARNED_REWARD: string;
  };
};

type InterstitialHandle = {
  addAdEventListener: (event: string, cb: () => void) => void;
  load: () => void;
  show: () => Promise<void>;
};

type RewardedHandle = {
  addAdEventListener: (event: string, cb: () => void) => void;
  load: () => void;
  show: () => Promise<void>;
};

let adsModule: AdsModule | null | undefined;
let unavailableLogged = false;

function loadAdsModule(): AdsModule | null {
  if (adsModule !== undefined) {
    return adsModule;
  }
  // Probe first — never evaluate the package (getEnforcing) in Expo Go.
  if (!canRequireNativeModule(NATIVE_MODULE_NAMES.admob)) {
    adsModule = null;
    return adsModule;
  }
  try {
    // Native-only; require so Expo Go can boot without the module linked.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    adsModule = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    adsModule = null;
  }
  return adsModule;
}

function warnUnavailable(action: string): void {
  if (!unavailableLogged) {
    unavailableLogged = true;
    console.warn(
      `[AdMobManager] react-native-google-mobile-ads unavailable (${action}). ` +
        'Ads require a custom Expo dev client / EAS build, not Expo Go.',
    );
  }
}

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
  const ads = loadAdsModule();
  if (!ads) {
    warnUnavailable('createInterstitial');
    return;
  }
  detachInterstitial();
  const ad = ads.InterstitialAd.createForAdRequest(AdUnitIds.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });
  interstitial = ad;

  ad.addAdEventListener(ads.AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });
  ad.addAdEventListener(ads.AdEventType.ERROR, () => {
    detachInterstitial();
  });
  ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
    interstitialShowing = false;
    detachInterstitial();
  });

  ad.load();
}

function createAndLoadRewarded(): void {
  const ads = loadAdsModule();
  if (!ads) {
    warnUnavailable('createRewarded');
    return;
  }
  detachRewarded();
  const ad = ads.RewardedAd.createForAdRequest(AdUnitIds.rewarded, {
    requestNonPersonalizedAdsOnly: true,
  });
  rewarded = ad;

  ad.addAdEventListener(ads.AdEventType.LOADED, () => {
    rewardedLoaded = true;
  });
  ad.addAdEventListener(ads.AdEventType.ERROR, () => {
    detachRewarded();
    pendingReward = null;
  });
  ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
    detachRewarded();
    // Keep a warm rewarded ready for the next request
    createAndLoadRewarded();
  });
  ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
    const kind = pendingReward;
    pendingReward = null;
    if (kind === 'OVERCLOCK') {
      useGameStore.getState().activateOverclock(OVERCLOCK_DURATION_MS);
    } else if (kind === 'FABRICATION_SKIP') {
      useGameStore.getState().completeFabricationNow();
    } else if (kind === 'OFFLINE_PATROL_2X') {
      useGameStore.getState().claimOfflinePatrol(2);
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

function getPurchaseManager(): typeof import('./PurchaseManager').PurchaseManager | null {
  try {
    // Lazy to keep PurchaseManager off the critical AdMob type graph at parse time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (
      require('./PurchaseManager') as typeof import('./PurchaseManager')
    ).PurchaseManager;
  } catch {
    return null;
  }
}

export const AdMobManager = {
  /** Warm interstitial + rewarded once at app start. Soft-fails without native ads. */
  initialize(): void {
    try {
      if (!loadAdsModule()) {
        warnUnavailable('initialize');
        return;
      }
      createAndLoadInterstitial();
      createAndLoadRewarded();
    } catch (error) {
      console.warn('[AdMobManager] initialize soft-failed', error);
    }
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

    const PurchaseManager = getPurchaseManager();
    const noAds = PurchaseManager
      ? await PurchaseManager.hasNoAdsEntitlement()
      : false;
    if (noAds) {
      return;
    }

    await this.showInterstitial();
  },

  async showInterstitial(): Promise<boolean> {
    if (!loadAdsModule()) {
      warnUnavailable('showInterstitial');
      return false;
    }
    if (interstitialShowing) {
      return false;
    }
    const PurchaseManager = getPurchaseManager();
    const noAds = PurchaseManager
      ? await PurchaseManager.hasNoAdsEntitlement()
      : false;
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
    if (!loadAdsModule()) {
      warnUnavailable('showRewarded');
      return false;
    }
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

  /** Double offline patrol STC/GC after a successful rewarded view. */
  showOfflinePatrol2xRewarded(): Promise<boolean> {
    return this.showRewarded('OFFLINE_PATROL_2X');
  },

  isInterstitialReady(): boolean {
    return interstitialLoaded;
  },

  isRewardedReady(): boolean {
    return rewardedLoaded;
  },

  /** True when the native AdMob module is linked (dev client / store build). */
  isNativeAvailable(): boolean {
    return loadAdsModule() !== null;
  },
} as const;
