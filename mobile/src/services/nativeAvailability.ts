/**
 * Detect environments / bindings where custom native modules are not linked.
 *
 * Expo Go has no AdMob / RevenueCat / MMKV native code. Prefer TurboModule /
 * NativeModules probes over environment heuristics so we never call
 * getEnforcing-backed package entry points when the module is missing.
 */

type ExpoConstantsLike = {
  default?: {
    appOwnership?: string | null;
    executionEnvironment?: string | null;
  };
  appOwnership?: string | null;
  executionEnvironment?: string | null;
};

/** Known native module names for monetization / persistence deps. */
export const NATIVE_MODULE_NAMES = {
  admob: 'RNGoogleMobileAdsModule',
  purchases: 'RNPurchases',
  mmkv: 'MmkvCxx',
} as const;

/**
 * True when running inside Expo Go (no custom native modules).
 * Uses a soft require so typecheck/boot still work if expo-constants is unresolved.
 *
 * Only `appOwnership === 'expo'` is definitive. `executionEnvironment === 'storeClient'`
 * is ambiguous (Expo Go OR expo-dev-client) and must not gate native requires alone —
 * use `canRequireNativeModule` / `isNativeModulePresent` instead.
 */
export function isExpoGo(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as ExpoConstantsLike;
    const constants = mod.default ?? mod;
    return constants.appOwnership === 'expo';
  } catch {
    return false;
  }
}

/**
 * Non-enforcing native-module probe (TurboModuleRegistry.get + NativeModules).
 * Never calls getEnforcing, so Expo Go stays quiet.
 */
export function isNativeModulePresent(name: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as {
      TurboModuleRegistry?: {
        get?: (moduleName: string) => unknown;
      };
      NativeModules?: Record<string, unknown>;
    };
    if (rn.TurboModuleRegistry?.get?.(name) != null) {
      return true;
    }
    return rn.NativeModules?.[name] != null;
  } catch {
    return false;
  }
}

/** @deprecated Prefer isNativeModulePresent */
export function isTurboModulePresent(name: string): boolean {
  return isNativeModulePresent(name);
}

/**
 * True when a specific native package may safely be required.
 * Definite Expo Go → false; missing native binding → false; linked client → true.
 */
export function canRequireNativeModule(moduleName: string): boolean {
  if (isExpoGo()) {
    return false;
  }
  return isNativeModulePresent(moduleName);
}

/**
 * True when AdMob / Purchases / MMKV native code may be linked.
 * Coarse Expo Go gate only; prefer `canRequireNativeModule` before any package require.
 */
export function hasCustomNativeModules(): boolean {
  return !isExpoGo();
}
