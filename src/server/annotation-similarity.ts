// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
type AnnotationLang = 'zh' | 'en' | 'it';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

function normalizeSimilarityText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[\u200d\ufe0f]/g, '')
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim();
}

function tokenizeForSimilarity(text: string, lang: AnnotationLang): string[] {
  const normalized = normalizeSimilarityText(text);
  if (!normalized) return [];

  if (lang === 'zh') {
    const compact = normalized.replace(/\s+/g, '');
    if (!compact) return [];
    if (compact.length <= 2) return [compact];

    const grams: string[] = [];
    for (let i = 0; i < compact.length - 1; i += 1) {
      grams.push(compact.slice(i, i + 2));
    }
    return grams;
  }

  const words = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return words;
}

function jaccardSimilarity(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  const union = leftSet.size + rightSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function getMaxSimilarityAgainstRecent(candidate: string, recentAnnotations: string[], lang: AnnotationLang): number {
  const candidateTokens = tokenizeForSimilarity(candidate, lang);
  const normalizedCandidate = normalizeSimilarityText(candidate).replace(/\s+/g, '');
  let maxSimilarity = 0;

  for (const previous of recentAnnotations) {
    const normalizedPrevious = normalizeSimilarityText(previous).replace(/\s+/g, '');
    if (!normalizedPrevious) continue;

    if (normalizedCandidate && normalizedCandidate.length >= 8) {
      if (normalizedPrevious.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedPrevious)) {
        maxSimilarity = Math.max(maxSimilarity, 1);
        continue;
      }
    }

    const score = jaccardSimilarity(candidateTokens, tokenizeForSimilarity(previous, lang));
    maxSimilarity = Math.max(maxSimilarity, score);
  }

  return maxSimilarity;
}

export function buildRewritePrompt(
  lang: AnnotationLang,
  basePrompt: string,
  candidate: string,
  recentAnnotations: string[],
): string {
  const recentText = recentAnnotations
    .map((text, idx) => `${idx + 1}. ${text}`)
    .join('\n');

  if (lang === 'en') {
    return [
      basePrompt,
      'The draft below is too similar to recent annotations. Rewrite from a completely different angle.',
      `Draft to avoid: ${candidate}`,
      `Recent annotations:\n${recentText}`,
      'Hard rules: keep intent but change metaphor, stance, and opening words; do not reuse key phrases from draft/recent lines; output one short annotation only; end with exactly one emoji.',
    ].join('\n\n');
  }

  if (lang === 'it') {
    return [
      basePrompt,
      "La bozza seguente e troppo simile alle annotazioni recenti. Riscrivila da un'angolazione completamente diversa.",
      `Bozza da evitare: ${candidate}`,
      `Annotazioni recenti:\n${recentText}`,
      'Regole rigide: mantieni il senso ma cambia metafora, prospettiva e apertura; non riusare frasi chiave; stampa una sola annotazione breve; chiudi con esattamente una emoji.',
    ].join('\n\n');
  }

  return [
    basePrompt,
    '下面这条草稿和最近批注过于相似，请从完全不同的角度重写。',
    `需要避开的草稿：${candidate}`,
    `最近批注：\n${recentText}`,
    '硬性规则：保留当下事件意图，但必须更换比喻、立场和开头词；不能复用草稿或最近批注的关键短语；只输出一句短批注；句末只能有一个 emoji。',
  ].join('\n\n');
}

export function extractRecentEmojisFromAnnotations(list: string[]): string[] {
  const emojiRe = /\p{Extended_Pictographic}/gu;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const text of list || []) {
    const matches = text?.match(emojiRe) || [];
    for (const e of matches) {
      if (!seen.has(e)) {
        seen.add(e);
        out.push(e);
      }
    }
  }
  return out.slice(-5);
}

export function ensureEmoji(text: string, fallbackEmoji: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return text;

  if (EMOJI_RE.test(trimmed)) return text;

  const fb = (fallbackEmoji || '✨').trim();
  return trimmed + fb;
}
