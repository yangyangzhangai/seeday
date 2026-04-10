import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const KEYBOARD_CLASS = 'keyboard-open';
const KEYBOARD_HEIGHT_VAR = '--keyboard-height';

function setKeyboardHeight(height: number): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty(KEYBOARD_HEIGHT_VAR, `${Math.max(0, Math.round(height))}px`);
}

export async function setupKeyboardViewportFix(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  await Keyboard.setScroll({ isDisabled: true }).catch(() => {});

  void Keyboard.addListener('keyboardWillShow', (info) => {
    root.classList.add(KEYBOARD_CLASS);
    setKeyboardHeight(info.keyboardHeight);
  });

  void Keyboard.addListener('keyboardWillHide', () => {
    root.classList.remove(KEYBOARD_CLASS);
    setKeyboardHeight(0);
    window.setTimeout(() => {
      window.scrollTo(0, 0);
    }, 16);
  });
}
