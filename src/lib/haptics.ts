import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

type HapticLevel = 'light' | 'medium' | 'heavy';

const IMPACT_STYLE: Record<HapticLevel, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

const VIBRATION_MS: Record<HapticLevel, number> = {
  light: 8,
  medium: 12,
  heavy: 18,
};

export function triggerHaptic(level: HapticLevel = 'light'): void {
  if (typeof window === 'undefined') return;

  void (async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Shift one level softer globally:
        // light -> selection pulse, medium -> light impact, heavy -> medium impact
        if (level === 'light') {
          await Haptics.selectionChanged();
          return;
        }
        const softenedLevel = level === 'heavy' ? 'medium' : 'light';
        await Haptics.impact({ style: IMPACT_STYLE[softenedLevel] });
        return;
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const softenedLevel = level === 'heavy' ? 'medium' : level === 'medium' ? 'light' : 'light';
        navigator.vibrate(Math.max(4, VIBRATION_MS[softenedLevel] - 2));
      }
    } catch {
      // Ignore haptic failures because UI actions should never be blocked.
    }
  })();
}

export function triggerLightHaptic(): void {
  triggerHaptic('light');
}
