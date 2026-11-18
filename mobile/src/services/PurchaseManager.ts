/**
 * RevenueCat purchase handlers — remove ads + Nanite Cache packs.
 *
 * Soft-fails in Expo Go / when the native module is unavailable.
 * RevenueCat is JS-configured (Purchases.configure); it is not an Expo config plugin.
 * Never statically imports react-native-purchases — require only after a native probe.
 */

import { Platform } from 'react-native';

import {
  NANITE_PACK_REWARDS,
  PRODUCT_IDS,
  REVENUECAT_ENTITLEMENT_NO_ADS,
  type ProductId,
} from '../types/monetization';
import { useGameStore } from '../store/useGameStore';
import { RevenueCatConfig } from './monetizationConfig';
import {
  NATIVE_MODULE_NAMES,
  canRequireNativeModule,
} from './nativeAvailability';

type PurchasesAPI = {
  configure: (opts: { apiKey: string; appUserID?: string }) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<{
    current: { availablePackages: PurchasesPackage[] } | null;
    all?: Record<string, { availablePackages: PurchasesPackage[] }>;
  }>;
  purchasePackage: (
    pkg: PurchasesPackage,
  ) => Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
  PURCHASES_ERROR_CODE?: PurchasesErrorCode;
};

type CustomerInfo = {
  entitlements: { active: Record<string, unknown> };
};

type PurchasesPackage = {
  product: { identifier: string };
};

type PurchasesErrorCode = {
  PURCHASE_CANCELLED_ERROR: string;
};

export type PurchaseResult =
  | { ok: true; customerInfo: CustomerInfo }
  | { ok: false; reason: string; userCancelled?: boolean };

let purchasesApi: PurchasesAPI | null | undefined;
let purchasesErrorCode: PurchasesErrorCode | null = null;
let configured = false;
let unavailableLogged = false;

function loadPurchasesModule(): PurchasesAPI | null {
  if (purchasesApi !== undefined) {
    return purchasesApi;
  }
  if (!canRequireNativeModule(NATIVE_MODULE_NAMES.purchases)) {
    purchasesApi = null;
    return purchasesApi;
  }
  try {
    // Native-only; require so Expo Go can boot without the module linked.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as {
      default?: PurchasesAPI;
      PURCHASES_ERROR_CODE?: PurchasesErrorCode;
    } & PurchasesAPI;
    purchasesApi = (mod.default ?? mod) as PurchasesAPI;
    purchasesErrorCode = mod.PURCHASES_ERROR_CODE ?? purchasesApi.PURCHASES_ERROR_CODE ?? null;
  } catch {
    purchasesApi = null;
    purchasesErrorCode = null;
  }
  return purchasesApi;
}

function warnUnavailable(action: string): void {
  if (!unavailableLogged) {
    unavailableLogged = true;
    console.warn(
      `[PurchaseManager] react-native-purchases unavailable (${action}). ` +
        'IAP requires a custom Expo dev client / EAS build, not Expo Go.',
    );
  }
}

function apiKeyForPlatform(): string {
  if (Platform.OS === 'ios') {
    return RevenueCatConfig.apiKeyIos;
  }
  if (Platform.OS === 'android') {
    return RevenueCatConfig.apiKeyAndroid;
  }
  return '';
}

export const PurchaseManager = {
  async configure(appUserId?: string): Promise<void> {
    if (configured) {
      return;
    }
    try {
      const Purchases = loadPurchasesModule();
      if (!Purchases) {
        warnUnavailable('configure');
        return;
      }
      const apiKey = apiKeyForPlatform();
      if (!apiKey) {
        // Keys unset in env — skip native configure so Expo Go / CI still typechecks & boots.
        return;
      }
      Purchases.configure({
        apiKey,
        appUserID: appUserId,
      });
      configured = true;
    } catch (error) {
      console.warn('[PurchaseManager] configure soft-failed', error);
    }
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      await this.configure();
      const Purchases = loadPurchasesModule();
      if (!Purchases || !configured) {
        return null;
      }
      return await Purchases.getCustomerInfo();
    } catch {
      return null;
    }
  },

  async hasNoAdsEntitlement(): Promise<boolean> {
    const info = await this.getCustomerInfo();
    if (!info) {
      return false;
    }
    return Boolean(info.entitlements.active[REVENUECAT_ENTITLEMENT_NO_ADS]);
  },

  async getPackageForProduct(productId: ProductId): Promise<PurchasesPackage | null> {
    await this.configure();
    const Purchases = loadPurchasesModule();
    if (!Purchases || !configured) {
      return null;
    }
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      return null;
    }
    const allPackages = [
      ...current.availablePackages,
      ...(offerings.all
        ? Object.values(offerings.all).flatMap((o) => o.availablePackages)
        : []),
    ];
    return (
      allPackages.find((pkg) => pkg.product.identifier === productId) ?? null
    );
  },

  async purchase(productId: ProductId): Promise<PurchaseResult> {
    try {
      await this.configure();
      const Purchases = loadPurchasesModule();
      if (!Purchases || !configured) {
        warnUnavailable('purchase');
        return { ok: false, reason: 'RevenueCat native module or API key not available' };
      }
      const pkg = await this.getPackageForProduct(productId);
      if (!pkg) {
        return { ok: false, reason: `Package not found for ${productId}` };
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      this.applyPurchaseSideEffects(productId, customerInfo);
      return { ok: true, customerInfo };
    } catch (error: unknown) {
      loadPurchasesModule();
      const cancelledCode = purchasesErrorCode?.PURCHASE_CANCELLED_ERROR;
      if (
        cancelledCode !== undefined &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === cancelledCode
      ) {
        return { ok: false, reason: 'cancelled', userCancelled: true };
      }
      const message =
        error instanceof Error ? error.message : 'Purchase failed';
      return { ok: false, reason: message };
    }
  },

  async purchaseRemoveAds(): Promise<PurchaseResult> {
    return this.purchase(PRODUCT_IDS.REMOVE_INTERSTITIAL_ADS);
  },

  async purchaseNanitePackSmall(): Promise<PurchaseResult> {
    return this.purchase(PRODUCT_IDS.NANITE_CACHE_PACK_SMALL);
  },

  async purchaseNanitePackLarge(): Promise<PurchaseResult> {
    return this.purchase(PRODUCT_IDS.NANITE_CACHE_PACK_LARGE);
  },

  applyPurchaseSideEffects(productId: ProductId, _customerInfo: CustomerInfo): void {
    if (
      productId === PRODUCT_IDS.NANITE_CACHE_PACK_SMALL ||
      productId === PRODUCT_IDS.NANITE_CACHE_PACK_LARGE
    ) {
      const reward = NANITE_PACK_REWARDS[productId];
      useGameStore.getState().grantNanitePack({
        cores: reward.cores,
        bonusCaches: reward.bonusCaches,
        fillEmptyCacheSlots: reward.fillEmptyCacheSlots,
      });
    }
  },

  async restorePurchases(): Promise<PurchaseResult> {
    try {
      await this.configure();
      const Purchases = loadPurchasesModule();
      if (!Purchases || !configured) {
        warnUnavailable('restore');
        return { ok: false, reason: 'RevenueCat native module or API key not available' };
      }
      const customerInfo = await Purchases.restorePurchases();
      return { ok: true, customerInfo };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Restore failed';
      return { ok: false, reason: message };
    }
  },

  /** True when the native Purchases module is linked (dev client / store build). */
  isNativeAvailable(): boolean {
    return loadPurchasesModule() !== null;
  },
} as const;
