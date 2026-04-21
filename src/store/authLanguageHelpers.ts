import i18n from '../i18n';
import { patchUserMetadata } from './authMetadataQueue';

export type SupportedUiLanguage = 'zh' | 'en' | 'it';

const SUPPORTED_UI_LANGUAGES: SupportedUiLanguage[] = ['zh', 'en', 'it'];

export function normalizeUiLanguage(raw: unknown): SupportedUiLanguage {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('it')) return 'it';
  return 'en';
}

function languageFromMeta(meta: Record<string, any>): SupportedUiLanguage | null {
  const value = meta.i18nextLng;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = normalizeUiLanguage(value);
  return SUPPORTED_UI_LANGUAGES.includes(normalized) ? normalized : null;
}

function languageFromLocalStorage(): SupportedUiLanguage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const value = window.localStorage.getItem('i18nextLng');
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = normalizeUiLanguage(value);
  return SUPPORTED_UI_LANGUAGES.includes(normalized) ? normalized : null;
}

export function persistLanguageToLocalStorage(language: SupportedUiLanguage): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem('i18nextLng', language);
}

export function syncI18nLanguageFromMeta(meta: Record<string, any>): void {
  const cloudLanguage = languageFromMeta(meta);
  const localLanguage = languageFromLocalStorage();
  const current = normalizeUiLanguage(i18n.language);

  if (localLanguage) {
    if (current !== localLanguage) {
      void i18n.changeLanguage(localLanguage);
    }
    persistLanguageToLocalStorage(localLanguage);
    return;
  }

  if (!cloudLanguage) return;

  if (current !== cloudLanguage) {
    void i18n.changeLanguage(cloudLanguage);
  }
  persistLanguageToLocalStorage(cloudLanguage);
}

export async function ensureCloudLanguageMetadata(user: any | null): Promise<any | null> {
  if (!user) return user;

  const meta = (user.user_metadata || {}) as Record<string, any>;
  const cloudLanguage = languageFromMeta(meta);
  if (cloudLanguage) {
    syncI18nLanguageFromMeta(meta);
    return user;
  }

  const fallbackLanguage = normalizeUiLanguage(i18n.language);
  const { user: updatedUser, error } = await patchUserMetadata({ i18nextLng: fallbackLanguage });

  if (error || !updatedUser) {
    return user;
  }

  return updatedUser;
}
