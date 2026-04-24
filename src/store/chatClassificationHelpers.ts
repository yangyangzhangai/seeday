// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import i18n from '../i18n';
import { callClassifierAPI } from '../api/client';
import { buildClassifierRawInput } from '../lib/classifierRawInput';
import { mapDiaryClassifierCategoryToActivityType } from '../lib/categoryAdapters';
import { classifyRecordActivityType, type ActivityRecordType } from '../lib/activityType';
import type { SupportedLang } from '../services/input/lexicon/getLexicon';
import { supabase } from '../api/supabase';
import { resolveAutoActivityDurationMinutes } from './chatDayBoundary';

export type MessageClassificationResult = {
  activityType: ActivityRecordType;
  matchedBottleId: string | null;
  classificationPath: 'local_rule' | 'ai' | 'ai_fallback_local';
  aiCalled: boolean;
};

const messageClassificationTaskMap = new Map<string, Promise<MessageClassificationResult>>();

export function resolveCurrentLang(): SupportedLang {
  const lang = i18n.language?.toLowerCase() ?? 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('it')) return 'it';
  return 'zh';
}

export function resolveLangForText(content: string): SupportedLang {
  if (/[\u3400-\u9fff]/.test(content)) return 'zh';
  const lowered = content.toLowerCase();
  if (/\b(sono|sto|stanco|stanca|felice|ansioso|ansiosa|sollevato|sollevata|sollievo|riunione|lezione|lavorando|studiando)\b/.test(lowered)) {
    return 'it';
  }
  if (/[A-Za-z\u00C0-\u017F]/.test(content)) return 'en';
  return resolveCurrentLang();
}

export function keywordMatchBottleId(text: string, bottles: { id: string; name: string }[]): string | null {
  const lower = text.toLowerCase();
  for (const bottle of bottles) {
    const words = bottle.name.toLowerCase().split(/\s+/);
    if (words.some((word) => word.length >= 2 && lower.includes(word))) {
      return bottle.id;
    }
  }
  return null;
}

function resolveMatchedBottleId(aiResult: Awaited<ReturnType<typeof callClassifierAPI>>): string | null {
  if (!aiResult.success || !Array.isArray(aiResult.data?.items)) return null;
  for (const item of aiResult.data.items) {
    if (item.matched_bottle?.id) return item.matched_bottle.id;
  }
  return null;
}

export function ensureMessageClassification(params: {
  messageId: string;
  content: string;
  lang: SupportedLang;
  isPlus: boolean;
  habits: Array<{ id: string; name: string }>;
  goals: Array<{ id: string; name: string }>;
}): Promise<MessageClassificationResult> {
  const existingTask = messageClassificationTaskMap.get(params.messageId);
  if (existingTask) return existingTask;

  const task = (async (): Promise<MessageClassificationResult> => {
    const fallbackType = classifyRecordActivityType(params.content, params.lang).activityType;
    if (!params.isPlus) {
      return {
        activityType: fallbackType,
        matchedBottleId: null,
        classificationPath: 'local_rule',
        aiCalled: false,
      };
    }

    try {
      const aiResult = await callClassifierAPI({
        rawInput: buildClassifierRawInput(params.content, params.lang),
        lang: params.lang,
        habits: params.habits,
        goals: params.goals,
      });
      const aiCategory = aiResult.data?.items?.[0]?.category;
      return {
        activityType: aiCategory
          ? mapDiaryClassifierCategoryToActivityType(aiCategory, params.content, params.lang)
          : fallbackType,
        matchedBottleId: resolveMatchedBottleId(aiResult),
        classificationPath: 'ai',
        aiCalled: true,
      };
    } catch {
      return {
        activityType: fallbackType,
        matchedBottleId: null,
        classificationPath: 'ai_fallback_local',
        aiCalled: true,
      };
    }
  })();

  messageClassificationTaskMap.set(params.messageId, task);
  return task;
}

export function deleteMessageClassificationTask(messageId: string): void {
  messageClassificationTaskMap.delete(messageId);
}

export function clearMessageClassificationTasks(): void {
  messageClassificationTaskMap.clear();
}

export async function closeCrossDayActiveMessagesInDb(userId: string, nowMs: number): Promise<void> {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  const { data, error } = await supabase
    .from('messages')
    .select('id,timestamp')
    .eq('user_id', userId)
    .eq('is_mood', false)
    .is('duration', null)
    .lt('timestamp', todayStartMs);

  if (error) throw error;
  if (!data || data.length === 0) return;

  await Promise.all(
    data.map(async (row) => {
      const startedAt = Number(row.timestamp);
      if (!Number.isFinite(startedAt)) return;
      const duration = resolveAutoActivityDurationMinutes(startedAt, nowMs);
      const { error: updateError } = await supabase
        .from('messages')
        .update({ duration, is_active: false })
        .eq('id', row.id)
        .eq('user_id', userId);
      if (updateError) throw updateError;
    }),
  );
}
