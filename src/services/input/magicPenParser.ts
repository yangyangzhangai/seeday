// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md
import { callMagicPenParseAPI } from '../../api/client';
import { buildDraftsFromAIResult, validateDrafts } from './magicPenDraftBuilder';
import { parseMagicPenInputLocal } from './magicPenParserLocalFallback';
import type { MagicPenParseResult } from './magicPenTypes';

interface ParseMagicPenOptions {
  now?: Date;
  lang?: 'zh' | 'en' | 'it';
}

function previewInput(text: string, maxLength: number = 120): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '[empty]';
  if (compact.length <= maxLength) return compact;
  const head = compact.slice(0, Math.floor(maxLength / 2));
  const tail = compact.slice(-Math.floor(maxLength / 2));
  return `${head} ... ${tail}`;
}

function logMagicPenParser(step: string, payload: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.log(`[magic-pen-parser] ${step}`, payload);
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
  const startedAt = Date.now();
  logMagicPenParser('parse.start', {
    inputLength: cleaned.length,
    inputPreview: previewInput(cleaned),
    lang: options.lang ?? 'zh',
    now: now.toISOString(),
  });

  try {
    const response = await callMagicPenParseAPI({
      rawText: cleaned,
      lang: options.lang ?? 'zh',
      todayDateStr: toLocalDateString(now),
      currentHour: now.getHours(),
      currentLocalDateTime: toLocalDateTimeString(now),
      timezoneOffsetMinutes: -now.getTimezoneOffset(),
    });

    logMagicPenParser('parse.api_response', {
      elapsedMs: Date.now() - startedAt,
      traceId: response.traceId,
      parseStrategy: response.parseStrategy,
      segmentCount: response.data.segments.length,
      unparsedCount: response.data.unparsed.length,
    });

    const built = buildDraftsFromAIResult(response.data, now, options.lang ?? 'zh');
    logMagicPenParser('parse.built', {
      draftCount: built.drafts.length,
      unparsedCount: built.unparsedSegments.length,
      autoWriteCount: built.autoWriteItems.length,
    });
    return {
      drafts: validateDrafts(built.drafts, [], now.getTime()),
      unparsedSegments: built.unparsedSegments,
      autoWriteItems: built.autoWriteItems,
    };
  } catch (error) {
    const fallback = parseMagicPenInputLocal(cleaned, now);
    logMagicPenParser('parse.fallback_local', {
      elapsedMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : 'unknown',
      draftCount: fallback.drafts.length,
      unparsedCount: fallback.unparsedSegments.length,
      autoWriteCount: fallback.autoWriteItems.length,
    });
    return fallback;
  }
}
