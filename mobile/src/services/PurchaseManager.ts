/**
 * RevenueCat purchase handlers — remove ads + Nanite Cache packs.
 */

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

import {
  NANITE_PACK_REWARDS,
  PRODUCT_IDS,
  REVENUECAT_ENTITLEMENT_NO_ADS,
  type ProductId,
} from '../types/monetization';
import { useGameStore } from '../store/useGameStore';
import { RevenueCatConfig } from './monetizationConfig';

export type PurchaseResult =
  | { ok: true; customerInfo: CustomerInfo }
  | { ok: false; reason: string; userCancelled?: boolean };

let configured = false;

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
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      await this.configure();
      if (!configured) {
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
    if (!configured) {
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
      if (!configured) {
        return { ok: false, reason: 'RevenueCat API key not configured' };
      }
      const pkg = await this.getPackageForProduct(productId);
      if (!pkg) {
        return { ok: false, reason: `Package not found for ${productId}` };
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      this.applyPurchaseSideEffects(productId, customerInfo);
      return { ok: true, customerInfo };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
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
      if (!configured) {
        return { ok: false, reason: 'RevenueCat API key not configured' };
      }
      const customerInfo = await Purchases.restorePurchases();
      return { ok: true, customerInfo };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Restore failed';
      return { ok: false, reason: message };
    }
  },
} as const;
