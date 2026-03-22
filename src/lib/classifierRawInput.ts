import type { SupportedLang } from '../services/input/lexicon/getLexicon';

export function buildClassifierRawInput(content: string, lang: SupportedLang): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return trimmed;
  }

  switch (lang) {
    case 'zh':
      return `${trimmed} 30分钟`;
    case 'it':
      return `${trimmed} 30 minuti`;
    default:
      return `${trimmed} 30 min`;
  }
}
