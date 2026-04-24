// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';
import { decomposeTodoWithAIDiagnostics } from '../src/server/todo-decompose-service.js';
import { matchBottleByKeywords } from '../src/lib/bottleMatcher.js';

const CLASSIFIER_PROMPT = `你是 Seeday 的单条输入分类器。
任务：对一条用户输入做一次分类，并严格输出 JSON。
不要输出任何解释、前缀、后缀或 Markdown 代码块，只输出 JSON。

【硬性约束】
- kind 只能是 "activity" 或 "mood"，禁止输出 null/unknown
- 必须在两者中二选一
- activity_type 必须是以下六类之一：
  "study" | "work" | "social" | "life" | "entertainment" | "health"
- mood_type 只能是以下八类之一或 null：
  "happy" | "calm" | "focused" | "satisfied" | "tired" | "anxious" | "bored" | "down"

【判定规则】
- 输入主要描述行为/事件 -> kind="activity"
- 输入主要表达心情/感受，且缺少明确事件 -> kind="mood"
- 若边界不清，优先按“可执行行为”判为 activity
- activity_type 必须给出（不可为 null）
- matched_bottle 仅当与 habits/goals 语义相关度 >= 0.6 时返回，否则返回 null
- matched_bottle 最多返回一个，stars 固定为 1

【输出格式】
{
  "kind": "activity" | "mood",
  "activity_type": "study" | "work" | "social" | "life" | "entertainment" | "health",
  "mood_type": "happy" | "calm" | "focused" | "satisfied" | "tired" | "anxious" | "bored" | "down" | null,
  "matched_bottle": { "type": "habit" | "goal", "id": "瓶子id", "stars": 1 } | null,
  "confidence": 0-1 的数字
}`;

const CLASSIFIER_PROMPT_EN = `You are Seeday's single-input classifier.
Task: classify one user input once and return strict JSON.
Do NOT output explanations, prefixes, suffixes, or Markdown code blocks. Output JSON only.

[Hard Constraints]
- kind must be "activity" or "mood" only; never null/unknown
- You must choose exactly one of the two
- activity_type must be one of:
  "study" | "work" | "social" | "life" | "entertainment" | "health"
- mood_type must be one of these or null:
  "happy" | "calm" | "focused" | "satisfied" | "tired" | "anxious" | "bored" | "down"

[Decision Rules]
- If the text mainly describes behavior/event -> kind="activity"
- If the text mainly expresses feeling/emotion without a clear event -> kind="mood"
- On ambiguous boundary, prefer activity when there is an actionable behavior
- activity_type is required and must not be null
- matched_bottle should be returned only when semantic relevance to habits/goals >= 0.6; otherwise null
- Return at most one matched_bottle; stars must be 1

[Output]
{
  "kind": "activity" | "mood",
  "activity_type": "study" | "work" | "social" | "life" | "entertainment" | "health",
  "mood_type": "happy" | "calm" | "focused" | "satisfied" | "tired" | "anxious" | "bored" | "down" | null,
  "matched_bottle": { "type": "habit" | "goal", "id": "bottle-id", "stars": 1 } | null,
  "confidence": number between 0 and 1
}`;

const CLASSIFIER_PROMPT_IT = `Sei il classificatore di input singolo di Seeday.
Compito: classifica una singola frase utente una sola volta e restituisci JSON rigoroso.
NON produrre spiegazioni, prefissi, suffissi o blocchi Markdown. Solo JSON.

[Vincoli rigidi]
- kind deve essere solo "activity" o "mood"; mai null/unknown
- Devi scegliere esattamente una delle due opzioni
- activity_type deve essere uno tra:
  "study" | "work" | "social" | "life" | "entertainment" | "health"
- mood_type deve essere uno tra questi oppure null:
  "happy" | "calm" | "focused" | "satisfied" | "tired" | "anxious" | "bored" | "down"

[Regole decisionali]
- Se il testo descrive soprattutto un'azione/evento -> kind="activity"
- Se il testo esprime soprattutto uno stato emotivo senza evento chiaro -> kind="mood"
- In caso di ambiguità, preferisci activity se c'è un comportamento eseguibile
- activity_type è obbligatorio e non può essere null
- matched_bottle va restituito solo se la rilevanza semantica verso habits/goals è >= 0.6; altrimenti null
- Restituisci al massimo un matched_bottle; stars deve essere 1

[Output]
{
  "kind": "activity" | "mood",
  "activity_type": "study" | "work" | "social" | "life" | "entertainment" | "health",
  "mood_type": "happy" | "calm" | "focused" | "satisfied" | "tired" | "anxious" | "bored" | "down" | null,
  "matched_bottle": { "type": "habit" | "goal", "id": "id-bottle", "stars": 1 } | null,
  "confidence": numero tra 0 e 1
}`;

type BottleRef = { id: string; name: string; type: 'habit' | 'goal' };

type ClassifyKind = 'activity' | 'mood';

type ClassifyActivityType = 'study' | 'work' | 'social' | 'life' | 'entertainment' | 'health';

type ClassifyMoodType = 'happy' | 'calm' | 'focused' | 'satisfied' | 'tired' | 'anxious' | 'bored' | 'down';

type MatchedBottle = { type: 'habit' | 'goal'; id: string; stars: number };

type UnifiedClassifyResponse = {
  kind: ClassifyKind;
  activity_type: ClassifyActivityType;
  mood_type: ClassifyMoodType | null;
  matched_bottle: MatchedBottle | null;
  confidence: number;
};

type MembershipPlan = 'free' | 'plus';

const PLUS_PLAN_ALIASES = new Set([
  'plus',
  'premium',
  'pro',
  'vip',
  'true',
  '1',
]);

const FREE_PLAN_ALIASES = new Set([
  'free',
  'basic',
  'false',
  '0',
]);

function normalizeMembershipPlan(raw: unknown): MembershipPlan | null {
  if (typeof raw === 'boolean') return raw ? 'plus' : 'free';
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 0 ? 'plus' : 'free';
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (PLUS_PLAN_ALIASES.has(normalized)) return 'plus';
  if (FREE_PLAN_ALIASES.has(normalized)) return 'free';
  return null;
}

function resolveMembershipPlan(user: { user_metadata?: Record<string, any>; app_metadata?: Record<string, any> }): MembershipPlan {
  const userMeta = user.user_metadata || {};
  const appMeta = user.app_metadata || {};
  const candidates = [
    appMeta.membership_plan,
    userMeta.membership_plan,
    appMeta.plan,
    userMeta.plan,
    appMeta.subscription_plan,
    userMeta.subscription_plan,
    appMeta.membership_tier,
    userMeta.membership_tier,
    appMeta.tier,
    userMeta.tier,
    appMeta.membership?.plan,
    userMeta.membership?.plan,
    appMeta.subscription?.plan,
    userMeta.subscription?.plan,
    appMeta.is_plus,
    userMeta.is_plus,
    appMeta.plus_member,
    userMeta.plus_member,
    appMeta.vip,
    userMeta.vip,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeMembershipPlan(candidate);
    if (normalized) return normalized;
  }

  const trialStartedAtRaw = appMeta.trial_started_at ?? userMeta.trial_started_at;
  const trialStartedAtMs = typeof trialStartedAtRaw === 'string' || typeof trialStartedAtRaw === 'number'
    ? new Date(trialStartedAtRaw).getTime()
    : Number.NaN;
  const trialWindowMs = 7 * 24 * 60 * 60 * 1000;
  if (Number.isFinite(trialStartedAtMs) && trialStartedAtMs <= Date.now() && Date.now() - trialStartedAtMs < trialWindowMs) {
    return 'plus';
  }

  return 'free';
}

/**
 * Try to keyword-match an item name against a list of bottles.
 * Returns the first bottle whose keywords appear in the item text, or null.
 */
function keywordMatch(text: string, bottles: BottleRef[]): MatchedBottle | null {
  const matchedBottle = matchBottleByKeywords(text, bottles);
  if (!matchedBottle) return null;
  return { type: matchedBottle.type, id: matchedBottle.id, stars: 1 };
}

// ─────────────────────────────────────────────────────────────────────────────

function parseClassifierResponse(raw: string): unknown {
  try {
    return JSON.parse(raw.trim());
  } catch {
    // try next
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // fallback
    }
  }

  console.warn('⚠️ classify parse failed, fallback to defaults');
  return null;
}

function normalizeKind(value: unknown, rawInput: string): ClassifyKind {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'activity' || normalized === 'mood') {
    return normalized;
  }

  const moodSignals = /\b(开心|高兴|平静|满足|疲惫|累|焦虑|无聊|低落|happy|calm|satisfied|tired|anxious|bored|down|felice|calmo|stanco|ansioso|annoiato|gi[uù]|triste)\b/i;
  return moodSignals.test(rawInput) ? 'mood' : 'activity';
}

function normalizeActivityType(value: unknown): ClassifyActivityType | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    normalized === 'study'
    || normalized === 'work'
    || normalized === 'social'
    || normalized === 'life'
    || normalized === 'entertainment'
    || normalized === 'health'
  ) {
    return normalized;
  }
  return null;
}

function normalizeMoodType(value: unknown): ClassifyMoodType | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    normalized === 'happy'
    || normalized === 'calm'
    || normalized === 'focused'
    || normalized === 'satisfied'
    || normalized === 'tired'
    || normalized === 'anxious'
    || normalized === 'bored'
    || normalized === 'down'
  ) {
    return normalized;
  }
  return null;
}

function normalizeConfidence(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0.5;
  return Math.max(0, Math.min(1, next));
}

function normalizeMatchedBottle(value: unknown, bottles: BottleRef[]): MatchedBottle | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { type?: unknown; id?: unknown; stars?: unknown };
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const type = candidate.type === 'habit' || candidate.type === 'goal' ? candidate.type : null;
  if (!id || !type) return null;

  const exists = bottles.some((item) => item.id === id && item.type === type);
  if (!exists) return null;

  const stars = Number(candidate.stars);
  return {
    type,
    id,
    stars: Number.isFinite(stars) && stars > 0 ? 1 : 1,
  };
}

function normalizeClassifyResponse(parsed: unknown, rawInput: string, bottles: BottleRef[]): UnifiedClassifyResponse {
  const payload = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};

  const fallbackMatch = keywordMatch(rawInput, bottles);
  const kind = normalizeKind(payload.kind, rawInput);
  const moodType = normalizeMoodType(payload.mood_type);
  const activityType = normalizeActivityType(payload.activity_type) || 'life';

  return {
    kind,
    activity_type: activityType,
    mood_type: moodType,
    matched_bottle: normalizeMatchedBottle(payload.matched_bottle, bottles) ?? fallbackMatch,
    confidence: normalizeConfidence(payload.confidence),
  };
}

// Bottle matching section appended to any prompt when habits/goals are provided
function buildBottleMatchSection(
  habits: Array<{ id: string; name: string }>,
  goals: Array<{ id: string; name: string }>,
  lang: string
): string {
  if (habits.length === 0 && goals.length === 0) return '';

  const habitsStr = habits.length > 0
    ? habits.map((h, i) => `${i + 1}. id="${h.id}" name="${h.name}"`).join('\n')
    : '(none)';
  const goalsStr = goals.length > 0
    ? goals.map((g, i) => `${i + 1}. id="${g.id}" name="${g.name}"`).join('\n')
    : '(none)';

  if (lang === 'zh') {
    return `

【用户设置的习惯】
${habitsStr}

【用户设置的目标】
${goalsStr}

【匹配规则】
- 判断当前输入与上述习惯/目标的语义关联度（0%~100%）
- 必须基于语义理解，不得仅依赖关键词
- 关联度 >= 60% 时输出 matched_bottle，否则为 null
- matched_bottle 最多输出一个（取最高相关）
- matched_bottle 格式：{ "type": "habit" | "goal", "id": "瓶子id", "stars": 1 }
- 严禁臆造不存在的 id`;
  }

  if (lang === 'it') {
    return `

[Abitudini impostate dall'utente]
${habitsStr}

[Obiettivi impostati dall'utente]
${goalsStr}

[Regole di corrispondenza]
- Valuta la correlazione semantica tra l'input corrente e abitudini/obiettivi (0%~100%)
- La valutazione deve essere semantica, non solo keyword matching
- correlazione >= 60%: restituisci matched_bottle; < 60%: matched_bottle = null
- Restituisci al massimo un bottle (quello con correlazione più alta)
- Formato matched_bottle: { "type": "habit" | "goal", "id": "id-bottle", "stars": 1 }
- Non inventare id non presenti`;
  }

  // English (default)
  return `

[User Habits]
${habitsStr}

[User Goals]
${goalsStr}

[Matching Rules]
- Assess semantic relevance between current input and habits/goals (0%~100%)
- Matching must be semantic, not just keyword matching
- relevance >= 60%: return matched_bottle; otherwise matched_bottle = null
- Return at most one bottle (highest relevance)
- matched_bottle format: { "type": "habit" | "goal", "id": "bottle-id", "stars": 1 }
- Never invent IDs that are not listed`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) return;
  if (resolveMembershipPlan(auth.user) !== 'plus') {
    jsonError(res, 403, 'membership_required');
    return;
  }

  const isTodoDecomposeMode = req.body?.module === 'todo_decompose'
    || (typeof req.body?.title === 'string' && typeof req.body?.rawInput !== 'string');
  if (isTodoDecomposeMode) {
    const { title, lang = 'zh' } = req.body ?? {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      jsonError(res, 400, 'Missing or invalid title');
      return;
    }

    try {
      const result = await decomposeTodoWithAIDiagnostics({
        title,
        lang: lang === 'en' || lang === 'it' ? lang : 'zh',
        qwenApiKey: process.env.QWEN_API_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY,
      });

      res.status(200).json({
        success: true,
        steps: result.steps,
        parseStatus: result.parseStatus,
        model: result.model,
        provider: result.provider,
      });
      return;
    } catch (error) {
      console.error('[Todo Decompose API] request.failed', {
        lang,
        titleLength: typeof title === 'string' ? title.trim().length : 0,
        modelZh: process.env.TODO_DECOMPOSE_MODEL_ZH || 'qwen-plus',
        modelDefault: process.env.TODO_DECOMPOSE_MODEL || 'gemini-2.5-flash',
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        hasQwenKey: Boolean(process.env.QWEN_API_KEY),
        qwenBase: process.env.QWEN_BASE_URL || process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        geminiBase: process.env.TODO_DECOMPOSE_GEMINI_BASE_URL || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
        error: error instanceof Error ? error.message : String(error),
      });
      jsonError(res, 500, 'AI请求失败，请稍后重试', undefined, error instanceof Error ? error.message : 'Unknown error');
      return;
    }
  }

  const { rawInput, lang = 'zh', habits = [], goals = [] } = req.body;

  if (!rawInput || typeof rawInput !== 'string') {
    jsonError(res, 400, 'Missing or invalid rawInput');
    return;
  }

  const dashscopeBase = (
    process.env.QWEN_BASE_URL
    || process.env.DASHSCOPE_BASE_URL
    || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/$/, '');
  const apiUrl = `${dashscopeBase}/chat/completions`;
  const model = (process.env.CLASSIFY_MODEL || 'qwen-plus').trim() || 'qwen-plus';
  const qwenApiKey = process.env.QWEN_API_KEY;

  if (!qwenApiKey) {
    jsonError(res, 500, 'Server configuration error: Missing QWEN_API_KEY');
    return;
  }

  // Build a combined bottle list for keyword matching
  const allBottles: BottleRef[] = [
    ...(habits as Array<{ id: string; name: string }>).map((h) => ({ ...h, type: 'habit' as const })),
    ...(goals as Array<{ id: string; name: string }>).map((g) => ({ ...g, type: 'goal' as const })),
  ];

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qwenApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: (lang === 'en' ? CLASSIFIER_PROMPT_EN : lang === 'it' ? CLASSIFIER_PROMPT_IT : CLASSIFIER_PROMPT)
              + buildBottleMatchSection(habits, goals, lang)
          },
          { role: 'user', content: rawInput }
        ],
        temperature: 0.6,
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Classifier API error:', response.status, errorText);
      jsonError(res, response.status, `AI service error: ${response.statusText}`, errorText);
      return;
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content || '';
    const parsed = parseClassifierResponse(rawContent);
    const normalized = normalizeClassifyResponse(parsed, rawInput, allBottles);

    res.status(200).json({
      success: true,
      data: normalized,
      raw: rawContent,
    });
  } catch (error) {
    console.error('Classifier API error:', error);
    jsonError(res, 500, 'API请求出错，请稍后重试', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
