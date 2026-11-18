/**
 * Monetization env placeholders — never hardcode live secrets/ad unit IDs.
 * Values are read from Expo public env (EAS / app config) when present.
 */

declare const process: {
  env: Record<string, string | undefined>;
};

function readEnv(key: string, fallback: string): string {
  const value = process.env[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}

/** Google test unit IDs used only as local fallbacks when env is unset. */
export const AdUnitIds = {
  interstitial: readEnv(
    'EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID',
    'ca-app-pub-3940256099942544/1033173712',
  ),
  rewarded: readEnv(
    'EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID',
    'ca-app-pub-3940256099942544/5224354917',
  ),
} as const;

export const RevenueCatConfig = {
  apiKeyIos: readEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', ''),
  apiKeyAndroid: readEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', ''),
} as const;

export const BackendConfig = {
  baseUrl: readEnv('EXPO_PUBLIC_API_BASE_URL', 'http://127.0.0.1:8000'),
} as const;
