// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import i18n from '../i18n';
import type { SupportedLang } from '../services/input/lexicon/getLexicon';

export function resolveCurrentLang(): SupportedLang {
  const lang = i18n.language?.toLowerCase() ?? 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('it')) return 'it';
  return 'zh';
}

export function resolveLangForText(content: string): SupportedLang {
  if (/[\u3400-\u9fff]/.test(content)) return 'zh';
  const lowered = content.toLowerCase();
  if (/\b(sono|sto|stanco|stanca|felice|ansioso|ansiosa|sollevato|sollevata|sollievo|riunione|lezione|lavorando|studiando)\b/.test(lowered)) {
    return 'it';
  }
  if (/[A-Za-z\u00C0-\u017F]/.test(content)) return 'en';
  return resolveCurrentLang();
}
