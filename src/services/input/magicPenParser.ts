// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import { callMagicPenParseAPI } from '../../api/client';
import { buildDraftsFromAIResult, validateDrafts } from './magicPenDraftBuilder';
import { parseMagicPenInputLocal } from './magicPenParserLocalFallback';
import { salvageTodoDraftFromUnparsedSegment } from './magicPenTodoSalvage';
import type { MagicPenParseResult } from './magicPenTypes';

interface ParseMagicPenOptions {
  now?: Date;
  lang?: 'zh' | 'en' | 'it';
}


function classifyParseOutcome(response: {
  parseStrategy?: 'direct_json' | 'wrapped_object' | 'fallback_failed';
  providerUsed?: 'zhipu' | 'qwen_flash_fallback' | 'none';
  failureCategory?: 'model_output_invalid' | 'provider_call_failed' | 'unknown';
  data: { unparsed: string[] };
}): 'ok' | 'partial_unrecognized' | 'parse_failed' {
  if (response.parseStrategy === 'fallback_failed' || response.providerUsed === 'none') {
    return 'parse_failed';
  }
  if (response.data.unparsed.length > 0) {
    return 'partial_unrecognized';
  }
  return 'ok';
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
    const parseOutcome = classifyParseOutcome(response);

    if (parseOutcome === 'parse_failed') {
    }

    const built = buildDraftsFromAIResult(response.data, now, options.lang ?? 'zh');
    const salvagedDrafts = (options.lang ?? 'zh') === 'zh'
      ? built.unparsedSegments
        .map((segment) => salvageTodoDraftFromUnparsedSegment(segment, now))
        .filter((draft): draft is NonNullable<typeof draft> => !!draft)
      : [];
    const salvagedSourceSet = new Set(salvagedDrafts.map((draft) => draft.sourceText.trim()));
    const remainingUnparsed = built.unparsedSegments.filter((segment) => !salvagedSourceSet.has(segment.trim()));
    return {
      drafts: validateDrafts([...built.drafts, ...salvagedDrafts], [], now.getTime()),
      unparsedSegments: remainingUnparsed,
      autoWriteItems: built.autoWriteItems,
    };
  } catch (error) {
    const fallback = parseMagicPenInputLocal(cleaned, now, options.lang ?? 'zh');
    void error;
    return fallback;
  }
}
