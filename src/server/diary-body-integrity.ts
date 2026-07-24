// DOC-DEPS: LLM.md -> api/README.md -> src/api/README.md

export type DiaryBodyLang = 'zh' | 'en' | 'it';

const SIGNOFF_LINE_PATTERN = /^(?:[-—–]{1,2}\s*.+|.*(?:van|agnes|zep|momo)\s*[—–-]{1,2}\s*)$/iu;
const TRAILING_CLOSERS_PATTERN = /[\s"'”’」』】）)\]]+$/gu;

function splitDiarySignoffTail(content: string): { body: string; signoff: string } {
  const lines = content.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { body: '', signoff: '' };

  const last = lines.at(-1) || '';
  if (!SIGNOFF_LINE_PATTERN.test(last)) {
    return { body: lines.join('\n').trim(), signoff: '' };
  }

  return {
    body: lines.slice(0, -1).join('\n').trim(),
    signoff: last,
  };
}

export function hasCompleteDiaryEnding(content: string, lang: DiaryBodyLang): boolean {
  const { body } = splitDiarySignoffTail(content);
  const ending = body.replace(TRAILING_CLOSERS_PATTERN, '').trim();
  if (!ending) return false;

  return lang === 'zh'
    ? /[。！？!?…]$/u.test(ending)
    : /[.!?…]$/u.test(ending);
}

export function shouldRetryDiaryDraft(
  content: string,
  finishReason: string | null | undefined,
  lang: DiaryBodyLang,
): boolean {
  if (finishReason && finishReason !== 'stop') return true;
  return !hasCompleteDiaryEnding(content, lang);
}
