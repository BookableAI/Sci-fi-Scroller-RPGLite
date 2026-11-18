/**
 * Detect environments where custom native modules are not linked (Expo Go).
 */

type ExpoConstantsLike = {
  default?: { appOwnership?: string | null };
  appOwnership?: string | null;
};

/**
 * True when running inside Expo Go (no custom native modules).
 * Uses a soft require so typecheck/boot still work if expo-constants is unresolved.
 */
export function isExpoGo(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as ExpoConstantsLike;
    const ownership = mod.default?.appOwnership ?? mod.appOwnership;
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
