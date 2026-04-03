type HapticLevel = 'light' | 'medium' | 'heavy';

const CAPACITOR_IMPACT_STYLE: Record<HapticLevel, 'LIGHT' | 'MEDIUM' | 'HEAVY'> = {
  light: 'LIGHT',
  medium: 'MEDIUM',
  heavy: 'HEAVY',
};

export function triggerHaptic(level: HapticLevel = 'light'): void {
  if (typeof window === 'undefined') return;

  const w = window as typeof window & {
    Capacitor?: {
      Plugins?: {
        Haptics?: {
          impact?: (opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => void;
          vibrate?: (opts: { duration: number }) => void;
        };
      };
    };
    TapticEngine?: {
      impact?: (opts: { style: HapticLevel }) => void;
    };
    webkit?: {
      messageHandlers?: {
        haptic?: {
          postMessage?: (payload: HapticLevel) => void;
        };
      };
    };
  };

  try {
    const haptics = w.Capacitor?.Plugins?.Haptics;
    if (haptics?.impact) {
      haptics.impact({ style: CAPACITOR_IMPACT_STYLE[level] });
      return;
    }

    if (haptics?.vibrate) {
      haptics.vibrate({ duration: level === 'light' ? 8 : level === 'medium' ? 12 : 18 });
      return;
    }

    if (w.TapticEngine?.impact) {
      w.TapticEngine.impact({ style: level });
      return;
    }

    if (w.webkit?.messageHandlers?.haptic?.postMessage) {
      w.webkit.messageHandlers.haptic.postMessage(level);
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(level === 'light' ? 8 : level === 'medium' ? 12 : 18);
    }
  } catch {
    // Ignore haptic failures because UI actions should never be blocked.
  }
}

export function triggerLightHaptic(): void {
  triggerHaptic('light');
}

