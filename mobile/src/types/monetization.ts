/**
 * Monetization product / entitlement identifiers (RevenueCat + AdMob).
 */

export const REVENUECAT_ENTITLEMENT_NO_ADS = 'no_ads' as const;

export const PRODUCT_IDS = {
  REMOVE_INTERSTITIAL_ADS: 'remove_interstitial_ads',
  NANITE_CACHE_PACK_SMALL: 'nanite_cache_pack_small',
  NANITE_CACHE_PACK_LARGE: 'nanite_cache_pack_large',
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export type RewardedAdKind = 'OVERCLOCK' | 'FABRICATION_SKIP';

/** Duration for System Overclock rewarded grant */
export const OVERCLOCK_DURATION_MS = 20 * 60 * 1000;

export const OVERCLOCK_SPEED_MULTIPLIER = 2;

/**
 * Nanite pack grants — Sub-Routine Cores (IAP) + Gold Credits for Supply Cache opens.
 * Small ≈ 2 opens; Large ≈ 6 opens at OPEN_CACHE_GOLD_COST (5).
 */
export const NANITE_PACK_REWARDS: Readonly<
  Record<
    typeof PRODUCT_IDS.NANITE_CACHE_PACK_SMALL | typeof PRODUCT_IDS.NANITE_CACHE_PACK_LARGE,
    { cores: number; goldCredits: number }
  >
> = {
  [PRODUCT_IDS.NANITE_CACHE_PACK_SMALL]: {
    cores: 50,
    goldCredits: 10,
  },
  [PRODUCT_IDS.NANITE_CACHE_PACK_LARGE]: {
    cores: 150,
    goldCredits: 30,
  },
};
