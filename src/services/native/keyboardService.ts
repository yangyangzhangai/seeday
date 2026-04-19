import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const KEYBOARD_CLASS = 'keyboard-open';
const KEYBOARD_HEIGHT_VAR = '--keyboard-height';

function setKeyboardHeight(height: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(KEYBOARD_HEIGHT_VAR, `${Math.max(0, Math.round(height))}px`);
}

// Scroll the currently focused input above the keyboard in its nearest scrollable ancestor.
// Skips elements handled by the fixed CSS-var approach (chat input bar).
function scrollFocusedInputAboveKeyboard(keyboardHeight: number): void {
  window.setTimeout(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el.tagName === 'BODY') return;

    const rect = el.getBoundingClientRect();
    const safeBottom = window.innerHeight - keyboardHeight - 16;
    if (rect.bottom <= safeBottom) return;

    let scrollable: HTMLElement | null = el.parentElement;
    while (scrollable && scrollable !== document.body) {
      const { overflowY } = window.getComputedStyle(scrollable);
      if (overflowY === 'auto' || overflowY === 'scroll') break;
      scrollable = scrollable.parentElement;
    }

    if (scrollable && scrollable !== document.body) {
      scrollable.scrollTop += rect.bottom - safeBottom;
    }
  }, 150);
}

export async function setupKeyboardViewportFix(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.classList.remove(KEYBOARD_CLASS);
  setKeyboardHeight(0);

  await Keyboard.setScroll({ isDisabled: true }).catch(() => {});

  void Keyboard.addListener('keyboardWillShow', (info) => {
    root.classList.add(KEYBOARD_CLASS);
    setKeyboardHeight(info.keyboardHeight);
    scrollFocusedInputAboveKeyboard(info.keyboardHeight);
  });

  void Keyboard.addListener('keyboardWillHide', () => {
    root.classList.remove(KEYBOARD_CLASS);
    setKeyboardHeight(0);
    window.setTimeout(() => {
      window.scrollTo(0, 0);
    }, 16);
  });
}
