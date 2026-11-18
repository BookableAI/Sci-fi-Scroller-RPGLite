/**
 * Soft haptic helpers — expo-haptics works in Expo Go; soft-require for safety.
 */

type ImpactStyle = 'Light' | 'Medium' | 'Heavy';

type HapticsModule = {
  impactAsync: (style: unknown) => Promise<void>;
  notificationAsync: (type: unknown) => Promise<void>;
  ImpactFeedbackStyle: Record<ImpactStyle, unknown>;
  NotificationFeedbackType: { Success: unknown; Warning: unknown; Error: unknown };
};

function loadHaptics(): HapticsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-haptics') as HapticsModule;
  } catch {
    return null;
  }
}

/** Soft impact — used on Relic Decryption reveal. */
export async function hapticRelicReveal(): Promise<void> {
  const Haptics = loadHaptics();
  if (!Haptics) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Expo web / unsupported — ignore
    }
  }
}
