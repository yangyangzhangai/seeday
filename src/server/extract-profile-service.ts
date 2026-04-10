// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/用户画像模块_需求与技术文档_v1.md
import OpenAI from 'openai';
import { z } from 'zod';
import type { UserProfileV2 } from '../types/userProfile';

export interface ExtractProfileMessage {
  id: string;
  content: string;
  timestamp: number;
  duration?: number;
  activityType?: string;
  isMood?: boolean;
}

const confidenceStringSchema = z.object({
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(1).max(99),
  lastSeenAt: z.string().min(1),
});

const confidenceNumberArraySchema = z.object({
  value: z.array(z.number().int().min(0).max(23)).min(1).max(5),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(1).max(99),
  lastSeenAt: z.string().min(1),
});

const confidenceStringArraySchema = z.object({
  value: z.array(z.string().min(1)).min(1).max(8),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(1).max(99),
  lastSeenAt: z.string().min(1),
});

const confidenceRecordSchema = z.object({
  value: z.record(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(1).max(99),
  lastSeenAt: z.string().min(1),
});

const modelOutputSchema = z.object({
  observed: z.object({
    wakeTime: confidenceStringSchema.optional(),
    sleepTime: confidenceStringSchema.optional(),
    mealTimes: confidenceNumberArraySchema.optional(),
    activeWindows: confidenceStringArraySchema.optional(),
    moodByTimeBand: confidenceRecordSchema.optional(),
    efficiencyByTimeBand: confidenceRecordSchema.optional(),
  }).optional(),
  dynamicSignals: z.object({
    preferences: confidenceStringArraySchema.optional(),
    dislikes: confidenceStringArraySchema.optional(),
    copingPatterns: confidenceStringArraySchema.optional(),
    relationshipSignals: confidenceStringArraySchema.optional(),
    currentFocusInference: confidenceStringArraySchema.optional(),
  }).optional(),
  anniversariesVisible: z.array(z.object({
    label: z.string().min(1).max(30),
    date: z.string().min(1),
    repeating: z.boolean().optional(),
  })).max(3).optional(),
  hiddenMoments: z.array(z.object({
    kind: z.enum(['first_time', 'highlight', 'lowlight', 'milestone']),
    title: z.string().min(1).max(36),
    date: z.string().min(1),
    summary: z.string().min(1).max(120),
    sourceMessageIds: z.array(z.string().min(1)).max(5).optional(),
  })).max(5).optional(),
});

function toISO(value: string, fallback: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function isAnniversaryDate(value: string): boolean {
  return /^\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMomentDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildInputDigest(messages: ExtractProfileMessage[]): string {
  const lines = messages
    .slice(-80)
    .map((message) => {
      const time = new Date(message.timestamp).toISOString();
      const tags = [message.activityType || 'unknown', message.isMood ? 'mood' : 'activity']
        .filter(Boolean)
        .join('/');
      const duration = Number.isFinite(message.duration) ? ` (${message.duration}m)` : '';
      return `${time} [${tags}] ${message.content.trim().slice(0, 120)}${duration}`;
    });
  return lines.join('\n');
}

function buildPrompt(nowIso: string, messageDigest: string): string {
  return [
    'You are a profile extraction assistant for a journaling app.',
    'Analyze only the provided 7-day activity records and return STRICT JSON.',
    'No markdown. No explanation. JSON object only.',
    '',
    'Rules:',
    '- Be conservative: if uncertain, omit field.',
    '- Generate at most 3 anniversaries and 5 hidden moments.',
    '- anniversariesVisible.date uses MM-DD or YYYY-MM-DD.',
    '- hiddenMoments.date uses YYYY-MM-DD.',
    '- confidence must be 0-1.',
    '- evidenceCount must be integer >=1 when a signal exists.',
    '',
    'Output JSON shape:',
    '{',
    '  "observed": { ...optional confidence signals... },',
    '  "dynamicSignals": { ...optional confidence signals... },',
    '  "anniversariesVisible": [{ "label": "", "date": "MM-DD", "repeating": true }],',
    '  "hiddenMoments": [{ "kind": "highlight", "title": "", "date": "YYYY-MM-DD", "summary": "", "sourceMessageIds": [] }]',
    '}',
    '',
    `Now: ${nowIso}`,
    'Records:',
    messageDigest || '(empty)',
  ].join('\n');
}

function parseJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // fallback below
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function extractUserProfileFromMessages(params: {
  messages: ExtractProfileMessage[];
  apiKey: string;
  model?: string;
  openai?: OpenAI;
}): Promise<Partial<UserProfileV2>> {
  const nowIso = new Date().toISOString();
  const trimmedMessages = params.messages
    .filter((item) => typeof item.content === 'string' && item.content.trim().length > 0)
    .slice(-120);

  if (trimmedMessages.length === 0) {
    return { lastExtractedAt: nowIso };
  }

  const client = params.openai ?? new OpenAI({ apiKey: params.apiKey });
  const model = (params.model || process.env.PROFILE_EXTRACT_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const prompt = buildPrompt(nowIso, buildInputDigest(trimmedMessages));

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 1600,
  });

  const rawText = completion.choices?.[0]?.message?.content || '{}';
  const parsed = parseJsonObject(rawText);
  const validated = modelOutputSchema.safeParse(parsed);
  if (!validated.success) {
    return { lastExtractedAt: nowIso };
  }

  const data = validated.data;
  const anniversariesVisible = data.anniversariesVisible
    ?.filter((item) => isAnniversaryDate(item.date))
    .map((item) => ({
      id: createId('ann'),
      label: item.label.trim(),
      date: item.date,
      repeating: item.repeating ?? /^\d{2}-\d{2}$/.test(item.date),
      source: 'ai_auto' as const,
      createdAt: nowIso,
    }));

  const hiddenMoments = data.hiddenMoments
    ?.filter((item) => isMomentDate(item.date))
    .map((item) => ({
      id: createId('moment'),
      kind: item.kind,
      title: item.title.trim(),
      date: item.date,
      summary: item.summary.trim(),
      sourceMessageIds: (item.sourceMessageIds || []).slice(0, 5),
      createdAt: nowIso,
    }));

  return {
    observed: data.observed
      ? {
          ...data.observed,
          wakeTime: data.observed.wakeTime
            ? { ...data.observed.wakeTime, lastSeenAt: toISO(data.observed.wakeTime.lastSeenAt, nowIso) }
            : undefined,
          sleepTime: data.observed.sleepTime
            ? { ...data.observed.sleepTime, lastSeenAt: toISO(data.observed.sleepTime.lastSeenAt, nowIso) }
            : undefined,
          mealTimes: data.observed.mealTimes
            ? { ...data.observed.mealTimes, lastSeenAt: toISO(data.observed.mealTimes.lastSeenAt, nowIso) }
            : undefined,
          activeWindows: data.observed.activeWindows
            ? { ...data.observed.activeWindows, lastSeenAt: toISO(data.observed.activeWindows.lastSeenAt, nowIso) }
            : undefined,
          moodByTimeBand: data.observed.moodByTimeBand
            ? { ...data.observed.moodByTimeBand, lastSeenAt: toISO(data.observed.moodByTimeBand.lastSeenAt, nowIso) }
            : undefined,
          efficiencyByTimeBand: data.observed.efficiencyByTimeBand
            ? { ...data.observed.efficiencyByTimeBand, lastSeenAt: toISO(data.observed.efficiencyByTimeBand.lastSeenAt, nowIso) }
            : undefined,
        }
      : undefined,
    dynamicSignals: data.dynamicSignals
      ? {
          ...data.dynamicSignals,
          preferences: data.dynamicSignals.preferences
            ? { ...data.dynamicSignals.preferences, lastSeenAt: toISO(data.dynamicSignals.preferences.lastSeenAt, nowIso) }
            : undefined,
          dislikes: data.dynamicSignals.dislikes
            ? { ...data.dynamicSignals.dislikes, lastSeenAt: toISO(data.dynamicSignals.dislikes.lastSeenAt, nowIso) }
            : undefined,
          copingPatterns: data.dynamicSignals.copingPatterns
            ? { ...data.dynamicSignals.copingPatterns, lastSeenAt: toISO(data.dynamicSignals.copingPatterns.lastSeenAt, nowIso) }
            : undefined,
          relationshipSignals: data.dynamicSignals.relationshipSignals
            ? { ...data.dynamicSignals.relationshipSignals, lastSeenAt: toISO(data.dynamicSignals.relationshipSignals.lastSeenAt, nowIso) }
            : undefined,
          currentFocusInference: data.dynamicSignals.currentFocusInference
            ? {
                ...data.dynamicSignals.currentFocusInference,
                lastSeenAt: toISO(data.dynamicSignals.currentFocusInference.lastSeenAt, nowIso),
              }
            : undefined,
        }
      : undefined,
    anniversariesVisible: anniversariesVisible?.length ? anniversariesVisible : undefined,
    hiddenMoments: hiddenMoments?.length ? hiddenMoments : undefined,
    lastExtractedAt: nowIso,
  };
}
