// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md
import { callMagicPenParseAPI } from '../../api/client';
import { buildDraftsFromAIResult, validateDrafts } from './magicPenDraftBuilder';
import { parseMagicPenInputLocal } from './magicPenParserLocalFallback';
import type { MagicPenParseResult } from './magicPenTypes';

interface ParseMagicPenOptions {
  now?: Date;
  lang?: 'zh' | 'en' | 'it';
}

function preprocessRawText(rawText: string): string {
  return rawText.trim().replace(/[^\S\n]+/g, ' ').slice(0, 500);
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalDateTimeString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export async function parseMagicPenInput(
  rawText: string,
  options: ParseMagicPenOptions = {},
): Promise<MagicPenParseResult> {
  const cleaned = preprocessRawText(rawText);
  if (!cleaned) {
    return { drafts: [], unparsedSegments: [], autoWriteItems: [] };
  }

  const now = options.now ?? new Date();
  try {
    const response = await callMagicPenParseAPI({
      rawText: cleaned,
      lang: options.lang ?? 'zh',
      todayDateStr: toLocalDateString(now),
      currentHour: now.getHours(),
      currentLocalDateTime: toLocalDateTimeString(now),
      timezoneOffsetMinutes: -now.getTimezoneOffset(),
    });
    const built = buildDraftsFromAIResult(response.data, now, options.lang ?? 'zh');
    return {
      drafts: validateDrafts(built.drafts, [], now.getTime()),
      unparsedSegments: built.unparsedSegments,
      autoWriteItems: built.autoWriteItems,
    };
  } catch {
    return parseMagicPenInputLocal(cleaned, now);
  }
}
