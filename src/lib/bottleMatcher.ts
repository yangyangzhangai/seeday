// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md -> api/README.md

export type BottleLike = {
  id: string;
  name: string;
};

const MIN_MATCH_SCORE = 0.6;
const MIN_SCORE_GAP = 0.15;

const LATIN_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'with',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'e', 'o', 'di', 'da', 'del', 'della', 'delle', 'dei', 'degli',
]);

const CJK_SUFFIXES = ['打卡', '计划', '目标', '成长', '习惯'];

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function normalizeLatin(input: string): string {
  return normalizeWhitespace(
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  );
}

function extractLatinTokens(input: string): string[] {
  const normalized = normalizeLatin(input);
  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return tokens.filter((token) => token.length >= 2 && !LATIN_STOP_WORDS.has(token));
}

function extractCjkOnly(input: string): string {
  return input.replace(/[^\u3400-\u9fff\u3040-\u30ff]/g, '');
}

function stripCjkSuffix(input: string): string {
  let current = input;
  let changed = true;
  while (changed && current.length >= 2) {
    changed = false;
    for (const suffix of CJK_SUFFIXES) {
      if (current.endsWith(suffix) && current.length > suffix.length) {
        current = current.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }
  return current;
}

function buildNgrams(input: string, size: number): string[] {
  if (input.length < size) return [];
  const grams: string[] = [];
  for (let i = 0; i <= input.length - size; i += 1) {
    grams.push(input.slice(i, i + size));
  }
  return grams;
}

function latinScore(textTokens: Set<string>, bottleTokens: string[]): number {
  if (bottleTokens.length === 0) return 0;
  let hitCount = 0;
  for (const token of bottleTokens) {
    if (textTokens.has(token)) hitCount += 1;
  }
  if (hitCount === 0) return 0;
  const coverage = hitCount / bottleTokens.length;
  if (coverage === 1) {
    return bottleTokens.length >= 2 ? 0.95 : 0.8;
  }
  return coverage * 0.75;
}

function cjkScore(textCjk: string, bottleCjk: string): number {
  if (!bottleCjk || bottleCjk.length < 2 || !textCjk) return 0;
  const core = stripCjkSuffix(bottleCjk);
  if (core.length >= 2 && textCjk.includes(core)) return 1;
  if (textCjk.includes(bottleCjk)) return 1;

  const bi = buildNgrams(bottleCjk, 2);
  const tri = buildNgrams(bottleCjk, 3);
  const grams = tri.length > 0 ? tri : bi;
  if (grams.length === 0) return 0;

  let matched = 0;
  for (const gram of grams) {
    if (textCjk.includes(gram)) matched += 1;
  }
  const coverage = matched / grams.length;
  return coverage * 0.85;
}

type Candidate<T extends BottleLike> = {
  bottle: T;
  score: number;
};

export function matchBottleByKeywords<T extends BottleLike>(
  text: string,
  bottles: T[],
): T | null {
  const textTokens = new Set(extractLatinTokens(text));
  const textCjk = extractCjkOnly(text);

  const candidates: Candidate<T>[] = [];
  for (const bottle of bottles) {
    const bottleName = bottle.name || '';
    const bottleTokens = extractLatinTokens(bottleName);
    const bottleCjk = extractCjkOnly(bottleName);

    const score = Math.max(
      latinScore(textTokens, bottleTokens),
      cjkScore(textCjk, bottleCjk),
    );
    if (score > 0) {
      candidates.push({ bottle, score });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.bottle.name.length !== a.bottle.name.length) return b.bottle.name.length - a.bottle.name.length;
    return a.bottle.id.localeCompare(b.bottle.id);
  });

  const best = candidates[0];
  if (best.score < MIN_MATCH_SCORE) return null;
  const second = candidates[1];
  if (second && best.score - second.score < MIN_SCORE_GAP) return null;

  return best.bottle;
}

export function matchBottleIdByKeywords(text: string, bottles: BottleLike[]): string | null {
  return matchBottleByKeywords(text, bottles)?.id ?? null;
}
