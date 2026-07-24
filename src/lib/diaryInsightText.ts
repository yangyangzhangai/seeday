// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md

export type DiaryInsightLang = 'zh' | 'en' | 'it';

const TERMINAL_PUNCTUATION = /[。！？.!?]$/u;
const CLAUSE_PUNCTUATION = /[，,；;：:。！？.!?]/u;

function cleanInsightText(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/gu, '');
}

function finishSentence(text: string, lang: DiaryInsightLang): string {
  const trimmed = text.trim().replace(/[，,；;：:]+$/u, '');
  if (!trimmed || TERMINAL_PUNCTUATION.test(trimmed)) return trimmed;
  return `${trimmed}${lang === 'zh' ? '。' : '.'}`;
}

function compactWordBasedInsight(text: string, lang: 'en' | 'it', maxWords: number): string {
  const words = text.split(' ').filter(Boolean);
  if (words.length <= maxWords) return finishSentence(text, lang);

  const selected = words.slice(0, maxWords);
  let punctuationIndex = -1;
  selected.forEach((word, index) => {
    if (TERMINAL_PUNCTUATION.test(word)) punctuationIndex = index;
  });
  const completeWords = punctuationIndex >= 2 ? selected.slice(0, punctuationIndex + 1) : selected;
  return finishSentence(completeWords.join(' '), lang);
}

function compactChineseInsight(text: string, maxChars: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return finishSentence(text, 'zh');

  const selected = chars.slice(0, maxChars);
  let boundary = -1;
  selected.forEach((char, index) => {
    if (CLAUSE_PUNCTUATION.test(char)) boundary = index;
  });
  const compacted = boundary >= Math.floor(maxChars / 2)
    ? selected.slice(0, boundary + 1).join('')
    : selected.join('');
  return finishSentence(compacted, 'zh');
}

export function compactDiaryInsight(
  raw: string,
  lang: DiaryInsightLang,
  options: { maxWords?: number; maxChineseChars?: number } = {},
): string {
  const text = cleanInsightText(raw);
  if (!text) return '';
  if (lang === 'zh') {
    return compactChineseInsight(text, options.maxChineseChars ?? 20);
  }
  return compactWordBasedInsight(text, lang, options.maxWords ?? 8);
}

export function isLegacyTruncatedDiaryInsight(raw: string): boolean {
  const text = cleanInsightText(raw);
  if (!text) return false;
  if (text.endsWith('…')) return true;
  return Array.from(text).length === 20 && !TERMINAL_PUNCTUATION.test(text);
}
