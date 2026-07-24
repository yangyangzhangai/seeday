// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md

export type PlantDiaryLang = 'zh' | 'en' | 'it';

const MAX_CJK_CHARS = 40;
const MAX_LATIN_WORDS = 22;
const MAX_LATIN_CHARS = 140;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return normalizeText(text).split(' ').filter(Boolean).length;
}

function resolveContentLang(text: string, requestedLang: PlantDiaryLang): PlantDiaryLang {
  if (/[\u3400-\u9fff]/u.test(text)) return 'zh';
  return requestedLang === 'zh' ? 'en' : requestedLang;
}

export function resolvePlantDiaryLang(lang?: string): PlantDiaryLang {
  const normalized = lang?.toLowerCase() ?? 'en';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('it')) return 'it';
  return 'en';
}

export function isPlantDiaryTextWithinCardLimit(text: string, lang: PlantDiaryLang): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const contentLang = resolveContentLang(normalized, lang);
  if (contentLang === 'zh') return Array.from(normalized).length <= MAX_CJK_CHARS;
  return normalized.length <= MAX_LATIN_CHARS && countWords(normalized) <= MAX_LATIN_WORDS;
}

function compactChineseText(text: string): string {
  const normalized = normalizeText(text);
  const firstSentence = normalized.match(/^.*?[。！？]/)?.[0]?.trim();
  if (firstSentence && Array.from(firstSentence).length <= MAX_CJK_CHARS) {
    return firstSentence;
  }
  const chars = Array.from(normalized.replace(/[。！？]+$/u, ''));
  return `${chars.slice(0, MAX_CJK_CHARS - 1).join('').trim()}。`;
}

function compactLatinText(text: string): string {
  const normalized = normalizeText(text);
  const firstSentence = normalized.split(/(?<=[.!?])\s+/u)[0]?.trim();
  if (firstSentence && isPlantDiaryTextWithinCardLimit(firstSentence, 'en')) {
    return firstSentence;
  }

  const words = normalized.replace(/[.!?]+$/u, '').split(' ').filter(Boolean);
  const selected: string[] = [];
  for (const word of words) {
    const candidate = [...selected, word].join(' ');
    if (selected.length >= MAX_LATIN_WORDS || candidate.length > MAX_LATIN_CHARS - 1) break;
    selected.push(word);
  }
  return `${selected.join(' ').replace(/[,;:]+$/u, '')}.`;
}

export function compactPlantDiaryText(text: string, lang: PlantDiaryLang): string {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  const contentLang = resolveContentLang(normalized, lang);
  if (isPlantDiaryTextWithinCardLimit(normalized, contentLang)) return normalized;
  return contentLang === 'zh' ? compactChineseText(normalized) : compactLatinText(normalized);
}
