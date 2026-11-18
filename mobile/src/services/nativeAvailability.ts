/**
 * Detect environments where custom native modules are not linked (Expo Go).
 */

type ExpoConstantsLike = {
  default?: {
    appOwnership?: string | null;
    executionEnvironment?: string | null;
  };
  appOwnership?: string | null;
  executionEnvironment?: string | null;
};

/**
 * True when running inside Expo Go (no custom native modules).
 * Uses a soft require so typecheck/boot still work if expo-constants is unresolved.
 * Prefers `executionEnvironment` (SDK 58+) and falls back to `appOwnership`.
 */
export function isExpoGo(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as ExpoConstantsLike;
    const constants = mod.default ?? mod;
    const executionEnvironment = constants.executionEnvironment;
    if (executionEnvironment === 'storeClient') {
      return true;
    }
    const ownership = constants.appOwnership;
    return ownership === 'expo';
  } catch {
    return false;
  }
}

/**
 * True when AdMob / Purchases / MMKV native code may be linked.
 * Expo Go → false; custom dev client / store builds → true.
 */
export function hasCustomNativeModules(): boolean {
  return !isExpoGo();
}
