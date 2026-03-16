// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md
import { callMagicPenParseAPI } from '../../api/client';
import { buildDraftsFromAIResult, validateDrafts } from './magicPenDraftBuilder';
import { parseMagicPenInputLocal } from './magicPenParserLocalFallback';
import { salvageTodoDraftFromUnparsedSegment } from './magicPenTodoSalvage';
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

function summarizeSegments(
  segments: Array<{
    kind: string;
    confidence: string;
    timeRelation?: string;
    sourceText: string;
  }>,
): Array<{ kind: string; confidence: string; timeRelation?: string; sourcePreview: string }> {
  return segments.map((segment) => ({
    kind: segment.kind,
    confidence: segment.confidence,
    timeRelation: segment.timeRelation,
    sourcePreview: previewInput(segment.sourceText, 48),
  }));
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
      providerUsed: response.providerUsed,
      fallbackFrom: response.fallbackFrom,
      segmentCount: response.data.segments.length,
      unparsedCount: response.data.unparsed.length,
      segments: summarizeSegments(response.data.segments),
      unparsedPreview: response.data.unparsed.map((segment) => previewInput(segment, 48)),
    });

    const built = buildDraftsFromAIResult(response.data, now, options.lang ?? 'zh');
    const salvagedDrafts = (options.lang ?? 'zh') === 'zh'
      ? built.unparsedSegments
        .map((segment) => salvageTodoDraftFromUnparsedSegment(segment, now))
        .filter((draft): draft is NonNullable<typeof draft> => !!draft)
      : [];
    const salvagedSourceSet = new Set(salvagedDrafts.map((draft) => draft.sourceText.trim()));
    const remainingUnparsed = built.unparsedSegments.filter((segment) => !salvagedSourceSet.has(segment.trim()));
    logMagicPenParser('parse.built', {
      draftCount: built.drafts.length,
      unparsedCount: built.unparsedSegments.length,
      autoWriteCount: built.autoWriteItems.length,
      autoWriteKinds: built.autoWriteItems.map((item) => item.kind),
      salvagedTodoCount: salvagedDrafts.length,
    });
    return {
      drafts: validateDrafts([...built.drafts, ...salvagedDrafts], [], now.getTime()),
      unparsedSegments: remainingUnparsed,
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
