// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { extractComment, removeThinkingTags } from '../lib/aiParser.js';
import { normalizeAiCompanionMode } from '../lib/aiCompanion.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';
import {
  buildSuggestionAwareUserPrompt,
  buildTodayActivitiesText,
  buildTodayContextText,
  buildUserPrompt,
  getDefaultAnnotations,
  getModel,
  getSystemPrompt,
} from './annotation-prompts.js';
import type { RecoveryNudgeContext } from '../types/annotation';

const openai = new OpenAI();

type AnnotationLang = 'zh' | 'en' | 'it';

const MAX_REWRITE_ATTEMPTS = 1;
const SIMILARITY_THRESHOLD = 0.15;

function normalizeAnnotationLang(lang: unknown): AnnotationLang {
  if (typeof lang !== 'string') return 'zh';
  const base = lang.toLowerCase().split('-')[0];
  if (base === 'en' || base === 'it') return base;
  return 'zh';
}

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

function getMaxSimilarityAgainstRecent(candidate: string, recentAnnotations: string[], lang: AnnotationLang): number {
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

function buildRewritePrompt(
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

/**
 * Vercel Serverless Function - Annotation API
 * 调用 OpenAI Responses API 生成 AI 批注（气泡）
 *
 * POST /api/annotation
 * Body: { eventType: string, eventData: {...}, userContext: {...}, lang: 'zh' | 'en' | 'it', aiMode?: string }
 */

// ==================== Emoji 保障函数 ====================

// Unicode 属性匹配，覆盖组合 emoji / 旗帜 / 变体符号，比 codepoint 范围可靠
const EMOJI_RE = /\p{Extended_Pictographic}/u;

/**
 * 检查批注中是否有任何 Emoji，一个都没有则补上指定的 fallbackEmoji
 */
function ensureEmoji(text: string, fallbackEmoji: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return text;

  if (EMOJI_RE.test(trimmed)) return text;

  // .trim() 防止 fallbackEmoji 自带空格导致 UI 多出空白
  const fb = (fallbackEmoji || '✨').trim();
  console.log(`[Annotation API] AI 批注无任何 Emoji，自动补: ${fb}`);
  return trimmed + fb;
}

// ==================== Prompt 构造（已拆分） ====================

function extractRecentEmojisFromAnnotations(list: string[]): string[] {
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

function extractSuggestionPayload(raw: string): {
  content: string;
  suggestion?: Record<string, unknown>;
} | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);

    if (parsed && parsed.mode === 'suggestion' && parsed.suggestion) {
      const content = String(parsed.content || '').trim();
      if (!content) return null;
      return {
        content,
        suggestion: parsed.suggestion,
      };
    }

    if (parsed && (parsed.type === 'todo' || parsed.type === 'activity')) {
      const content = String(parsed.message || parsed.content || '').trim();
      if (!content) return null;
      return {
        content,
        suggestion: {
          type: parsed.type,
          actionLabel: parsed.actionLabel,
          activityName: parsed.activityName,
          todoId: parsed.todoId,
          todoTitle: parsed.todoTitle,
        },
      };
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeSuggestion(
  lang: AnnotationLang,
  suggestion: Record<string, unknown> | undefined,
  recoveryNudge?: RecoveryNudgeContext,
): Record<string, unknown> | undefined {
  if (!suggestion) return undefined;

  const suggestionType = suggestion.type === 'todo' ? 'todo' : 'activity';
  const normalized: Record<string, unknown> = {
    type: suggestionType,
    actionLabel: String(suggestion.actionLabel || '').trim(),
  };

  if (suggestionType === 'todo' && suggestion.todoId) {
    normalized.todoId = String(suggestion.todoId);
    normalized.todoTitle = String(suggestion.todoTitle || '').trim();
  } else {
    normalized.type = 'activity';
    normalized.activityName = String(suggestion.activityName || '').trim();
  }

  if (!normalized.actionLabel) {
    const title = String(normalized.todoTitle || normalized.activityName || '').trim();
    if (lang === 'zh') {
      normalized.actionLabel = title ? `去${title}` : '去行动';
    } else if (lang === 'it') {
      normalized.actionLabel = title ? `Vai ${title}` : 'Vai ora';
    } else {
      normalized.actionLabel = title ? `Go ${title}` : 'Take action';
    }
  }

  const rewardStarsFromPayload = Number(suggestion.rewardStars);
  if (Number.isFinite(rewardStarsFromPayload) && rewardStarsFromPayload > 1) {
    normalized.rewardStars = Math.floor(rewardStarsFromPayload);
  }

  if (typeof suggestion.rewardBottleId === 'string' && suggestion.rewardBottleId.trim()) {
    normalized.rewardBottleId = suggestion.rewardBottleId.trim();
  }

  if (typeof suggestion.recoveryKey === 'string' && suggestion.recoveryKey.trim()) {
    normalized.recoveryKey = suggestion.recoveryKey.trim();
  }

  if (recoveryNudge) {
    normalized.rewardStars = 2;
    normalized.recoveryKey = recoveryNudge.key;
    if (recoveryNudge.bottleId) {
      normalized.rewardBottleId = recoveryNudge.bottleId;
    }
    if (recoveryNudge.todoId) {
      normalized.type = 'todo';
      normalized.todoId = recoveryNudge.todoId;
      if (recoveryNudge.todoTitle) {
        normalized.todoTitle = recoveryNudge.todoTitle;
      }
    } else if (recoveryNudge.activityName) {
      normalized.type = 'activity';
      normalized.activityName = recoveryNudge.activityName;
    }
  }

  return normalized;
}

function buildRecoveryFallbackSuggestion(
  lang: AnnotationLang,
  recoveryNudge: RecoveryNudgeContext,
): { content: string; suggestion: Record<string, unknown> } {
  const actionLabel = lang === 'en'
    ? 'Start now'
    : lang === 'it'
      ? 'Inizia ora'
      : '现在开始';

  const title = recoveryNudge.todoTitle || recoveryNudge.bottleName || recoveryNudge.activityName || '';
  const content = lang === 'en'
    ? `You can bounce back today - finish ${title || 'one small step'} and earn two stars ⭐`
    : lang === 'it'
      ? `Puoi ripartire oggi: completa ${title || 'un piccolo passo'} e ottieni due stelle ⭐`
      : `你今天补回来就能拿到两颗星，先完成${title || '一个小步骤'} ⭐`;

  return {
    content,
    suggestion: {
      type: recoveryNudge.todoId ? 'todo' : 'activity',
      actionLabel,
      todoId: recoveryNudge.todoId,
      todoTitle: recoveryNudge.todoTitle,
      activityName: recoveryNudge.activityName,
      rewardStars: 2,
      rewardBottleId: recoveryNudge.bottleId,
      recoveryKey: recoveryNudge.key,
    },
  };
}

function buildForcedFallbackSuggestion(
  lang: AnnotationLang,
  pendingTodos: Array<{ id: string; title: string; category?: string }> = [],
): { content: string; suggestion: Record<string, unknown> } {
  const firstTodo = pendingTodos[0];

  if (firstTodo) {
    if (lang === 'en') {
      return {
        content: `Let's start small: ${firstTodo.title}, just begin now 🌿`,
        suggestion: {
          type: 'todo',
          todoId: firstTodo.id,
          todoTitle: firstTodo.title,
          actionLabel: 'Start now',
        },
      };
    }

    if (lang === 'it') {
      return {
        content: `Partiamo in piccolo: ${firstTodo.title}, inizia ora 🌿`,
        suggestion: {
          type: 'todo',
          todoId: firstTodo.id,
          todoTitle: firstTodo.title,
          actionLabel: 'Inizia ora',
        },
      };
    }

    return {
      content: `先从小步开始：${firstTodo.title}，现在就动一下 🌿`,
      suggestion: {
        type: 'todo',
        todoId: firstTodo.id,
        todoTitle: firstTodo.title,
        actionLabel: '现在去做',
      },
    };
  }

  if (lang === 'en') {
    return {
      content: 'Try a tiny reset: drink water and walk for two minutes 🌿',
      suggestion: {
        type: 'activity',
        activityName: 'drink water and walk for two minutes',
        actionLabel: 'Do it now',
      },
    };
  }

  if (lang === 'it') {
    return {
      content: 'Fai un reset minimo: acqua e due minuti di movimento 🌿',
      suggestion: {
        type: 'activity',
        activityName: 'bevi acqua e cammina due minuti',
        actionLabel: 'Vai ora',
      },
    };
  }

  return {
    content: '先做一个两分钟的小动作：喝水并走一走 🌿',
    suggestion: {
      type: 'activity',
      activityName: '喝水并走两分钟',
      actionLabel: '去行动',
    },
  };
}

// ==================== 主 Handler ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { eventType, eventData, userContext, lang = 'zh', aiMode } = req.body;
  const resolvedLang = normalizeAnnotationLang(lang);
  const resolvedAiMode = aiMode ? normalizeAiCompanionMode(aiMode) : undefined;

  if (!eventType || !eventData) {
    jsonError(res, 400, 'Missing eventType or eventData');
    return;
  }

  console.log('[Annotation API] mode:', {
    eventType,
    lang: resolvedLang,
    requestedAiMode: aiMode || 'none',
    resolvedAiMode: resolvedAiMode || 'fallback',
  });

  const defaultSet = getDefaultAnnotations(resolvedLang);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
    res.status(200).json({
      ...defaultAnnotation,
      displayDuration: 8000,
      source: 'default',
      reason: 'no_key',
      debugAiMode: resolvedAiMode || 'fallback',
    });
    return;
  }

  // ==================== 建议模式（客户端门控透传） ====================
  const forceSuggestion = userContext?.forceSuggestion === true;
  const isSuggestionMode = userContext?.allowSuggestion === true || forceSuggestion;

  if (isSuggestionMode) {
    try {
      const recentActivities = userContext?.todayActivitiesList?.slice(-3) || [];
      const userTimezone = typeof userContext?.timezone === 'string' ? userContext.timezone : undefined;
      const todayActivitiesText = buildTodayActivitiesText(recentActivities, resolvedLang, userTimezone);
      const pendingTodos = (userContext?.pendingTodos || []).slice(0, 10);
      const recoveryNudge = userContext?.recoveryNudge as RecoveryNudgeContext | undefined;
      const currentHour = userContext?.currentHour;
      const currentMinute = userContext?.currentMinute;
      const todayContextText = buildTodayContextText(userContext?.todayContext, resolvedLang);
      const eventSummary = (eventData.summary || eventData.content || eventData.mood || JSON.stringify(eventData).slice(0, 50))
        .replace(/\s+/g, ' ')
        .trim();
      const recentMoodText = (userContext?.recentMoodMessages || []).slice(-3).join(' / ') || 'none';

      const suggestionPrompt = buildSuggestionAwareUserPrompt({
        lang: resolvedLang,
        eventType,
        eventSummary,
        todayActivitiesText,
        recentMoodText,
        todayContextText,
        statusSummary: userContext?.statusSummary,
        contextHints: userContext?.contextHints,
        frequentActivities: userContext?.frequentActivities,
        pendingTodos,
        currentHour,
        currentMinute,
        consecutiveTextCount: userContext?.consecutiveTextCount,
        forceSuggestion,
        recoveryNudge,
      });
      const systemPrompt = getSystemPrompt(resolvedLang, resolvedAiMode);
      const model = getModel(resolvedLang);

      openai.apiKey = apiKey;
      const llmResponse = await openai.responses.create({
        model,
        instructions: systemPrompt,
        input: suggestionPrompt,
        temperature: 0.6,
        max_output_tokens: 300,
      });

      const raw = removeThinkingTags(llmResponse.output_text || '').trim();
      const parsedPayload = extractSuggestionPayload(raw);

      if (parsedPayload) {
        const finalContent = ensureEmoji(parsedPayload.content, '🌿');
        const normalizedSuggestion = normalizeSuggestion(resolvedLang, parsedPayload.suggestion, recoveryNudge)
          ?? (forceSuggestion
            ? (recoveryNudge
              ? buildRecoveryFallbackSuggestion(resolvedLang, recoveryNudge).suggestion
              : buildForcedFallbackSuggestion(resolvedLang, pendingTodos).suggestion)
            : undefined);

        res.status(200).json({
          content: finalContent,
          tone: 'concerned',
          displayDuration: normalizedSuggestion ? 15000 : 8000,
          source: 'ai',
          debugAiMode: resolvedAiMode || 'fallback',
          suggestion: normalizedSuggestion,
        });
        return;
      }

      const extractedText = extractComment(raw, resolvedLang);
      if (extractedText) {
        const finalContent = ensureEmoji(extractedText, '🌿');
        if (forceSuggestion) {
          const fallback = recoveryNudge
            ? buildRecoveryFallbackSuggestion(resolvedLang, recoveryNudge)
            : buildForcedFallbackSuggestion(resolvedLang, pendingTodos);
          res.status(200).json({
            content: finalContent,
            tone: 'concerned',
            displayDuration: 15000,
            source: 'ai',
            debugAiMode: resolvedAiMode || 'fallback',
            suggestion: fallback.suggestion,
          });
          return;
        }

        res.status(200).json({
          content: finalContent,
          tone: 'concerned',
          displayDuration: 8000,
          source: 'ai',
          debugAiMode: resolvedAiMode || 'fallback',
        });
        return;
      }
    } catch (suggestionErr) {
      console.error('[Annotation API] Suggestion mode error:', suggestionErr);
      if (forceSuggestion) {
        const pendingTodos = (userContext?.pendingTodos || []).slice(0, 10);
        const recoveryNudge = userContext?.recoveryNudge as RecoveryNudgeContext | undefined;
        const fallback = recoveryNudge
          ? buildRecoveryFallbackSuggestion(resolvedLang, recoveryNudge)
          : buildForcedFallbackSuggestion(resolvedLang, pendingTodos);
        res.status(200).json({
          content: fallback.content,
          tone: 'concerned',
          displayDuration: 15000,
          source: 'default',
          reason: 'suggestion_force_fallback',
          debugAiMode: resolvedAiMode || 'fallback',
          suggestion: fallback.suggestion,
        });
        return;
      }
    }
    // suggestion 失败时回退普通批注
  }

  try {
    // 预处理事件数据（去除多余空白，避免 prompt 里混入奇怪换行）
    const eventSummary = (eventData.summary || eventData.content || eventData.mood || JSON.stringify(eventData).slice(0, 50))
      .replace(/\s+/g, ' ')
      .trim();

    // 构建今日时间线（最近3个活动）
    const recentActivities = userContext?.todayActivitiesList?.slice(-3) || [];
    const userTimezone = typeof userContext?.timezone === 'string' ? userContext.timezone : undefined;
    const todayActivitiesText = buildTodayActivitiesText(recentActivities, resolvedLang, userTimezone);

    const sanitizeMoodText = (s: string) =>
      s.replace(/【[^】]*】/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

    const rawRecentMoodMessages = userContext?.recentMoodMessages?.slice(-3) || [];
    const rawMoodConversationHistory = (userContext?.moodConversationHistory || []).slice(-6);
    const recentMoodText = (() => {
      if (rawMoodConversationHistory.length > 1) {
        return rawMoodConversationHistory.map((entry: { role: string; content: string }) => {
          const label = entry.role === 'user'
            ? (resolvedLang === 'zh' ? '用户' : resolvedLang === 'it' ? 'Utente' : 'User')
            : 'AI';
          return `${label}：${sanitizeMoodText(entry.content)}`;
        }).join('\n');
      }
      return rawRecentMoodMessages.map(sanitizeMoodText).filter(Boolean).join(' / ')
        || (resolvedLang === 'en' ? 'None' : resolvedLang === 'it' ? 'Nessuno' : '无');
    })();

    const rawRecentAnnotations = userContext?.recentAnnotations?.slice(-3) || [];
    const rawRecentAnnotationsForEmoji = userContext?.recentAnnotations?.slice(-5) || [];
    const recentEmojis = extractRecentEmojisFromAnnotations(rawRecentAnnotationsForEmoji);

    // 构建提示词
    const currentHour = userContext?.currentHour;
    const currentMinute = userContext?.currentMinute;
    const todayContextText = buildTodayContextText(userContext?.todayContext, resolvedLang);
    const userPrompt = buildUserPrompt(
      resolvedLang,
      eventType,
      eventSummary,
      todayActivitiesText,
      recentMoodText,
      todayContextText,
      currentHour,
      currentMinute
    );
    console.log('[Annotation API] User Prompt:', userPrompt);
    const systemPrompt = getSystemPrompt(resolvedLang, resolvedAiMode);
    const model = getModel(resolvedLang);

    openai.apiKey = apiKey;

    const llmResponse = await openai.responses.create({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      temperature: 0.7,
      max_output_tokens: 480,
    });

    const promptCacheHits = (llmResponse.usage as any)?.prompt_cache_hits ?? 0;
    const promptCacheMisses = (llmResponse.usage as any)?.prompt_cache_misses ?? 0;
    console.log('[Annotation API] LLM meta:', {
      lang: resolvedLang,
      model,
      usage: llmResponse.usage,
      prompt_cache_hits: promptCacheHits,
      prompt_cache_misses: promptCacheMisses,
      cached: promptCacheHits > 0,
      response_id: llmResponse.id,
    });

    let content: string = llmResponse.output_text;

    if (!content || !content.trim()) {
      console.warn('[Annotation API] empty_content details:', { eventType, lang: resolvedLang });
      const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
      res.status(200).json({
        ...defaultAnnotation,
        displayDuration: 8000,
        source: 'default',
        reason: 'empty_content',
        debugAiMode: resolvedAiMode || 'fallback',
      });
      return;
    }

    // 移除 thinking 标签（支持被截断的没有闭合标签的情况）
    content = removeThinkingTags(content);

    // 提取有效批注（处理 prompt 泄漏等 bad case），传入 lang 以使用正确的长度校验
    const extractedContent = extractComment(content, resolvedLang);
    if (!extractedContent) {
      console.warn('[Annotation API] 提取失败，使用默认批注');
      const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
      res.status(200).json({
        ...defaultAnnotation,
        displayDuration: 8000,
        source: 'default',
        reason: 'extract_failed',
        debugAiMode: resolvedAiMode || 'fallback',
      });
      return;
    }

    content = extractedContent;
    console.log('[Annotation API] 提取后:', content);

    let finalContent = content;
    const similarityScore = getMaxSimilarityAgainstRecent(content, rawRecentAnnotations, resolvedLang);
    const contentEmojis = extractRecentEmojisFromAnnotations([content]);
    const hasDuplicateEmoji = contentEmojis.some(e => recentEmojis.includes(e));

    let needsRewrite = false;
    if (rawRecentAnnotations.length > 0 && similarityScore >= SIMILARITY_THRESHOLD) {
      console.warn('[Annotation API] 检测到高相似批注，触发重写', {
        similarityScore: Number(similarityScore.toFixed(3)),
        threshold: SIMILARITY_THRESHOLD,
      });
      needsRewrite = true;
    } else if (hasDuplicateEmoji) {
      console.warn('[Annotation API] 检测到 emoji 重复，触发重写');
      needsRewrite = true;
    }

    if (needsRewrite) {
      let rewrittenContent: string | null = null;

      for (let attempt = 1; attempt <= MAX_REWRITE_ATTEMPTS; attempt += 1) {
        try {
          const rewritePrompt = buildRewritePrompt(
            resolvedLang,
            userPrompt,
            content,
            rawRecentAnnotations.slice(-3),
          );

          const rewriteResponse = await openai.responses.create({
            model,
            instructions: systemPrompt,
            input: rewritePrompt,
            temperature: resolvedLang === 'zh' ? 0.75 : 0.8,
            max_output_tokens: resolvedLang === 'zh' ? 180 : 480,
          });

          let rewriteRaw = rewriteResponse.output_text;
          rewriteRaw = removeThinkingTags(rewriteRaw);
          const extractedRewrite = extractComment(rewriteRaw, resolvedLang);

          if (!extractedRewrite) {
            console.warn('[Annotation API] 重写提取失败，保留首稿', { attempt });
            continue;
          }

          const rewriteSimilarity = getMaxSimilarityAgainstRecent(extractedRewrite, rawRecentAnnotations, resolvedLang);
          const rewriteEmojis = extractRecentEmojisFromAnnotations([extractedRewrite]);
          const rewriteHasDuplicateEmoji = rewriteEmojis.some(e => recentEmojis.includes(e));

          rewrittenContent = extractedRewrite;

          console.log('[Annotation API] 重写候选', {
            attempt,
            similarity: Number(rewriteSimilarity.toFixed(3)),
            hasDuplicateEmoji: rewriteHasDuplicateEmoji,
          });

          if (rewriteSimilarity < SIMILARITY_THRESHOLD && !rewriteHasDuplicateEmoji) {
            break;
          }
        } catch (rewriteError) {
          console.warn('[Annotation API] 重写请求失败，保留首稿', {
            attempt,
            error: rewriteError instanceof Error ? rewriteError.message : String(rewriteError),
          });
        }
      }

      if (rewrittenContent) {
        finalContent = rewrittenContent;
      }
    }

    // 最终检查是否仍然与最近批注重复或包含重复的Emoji
    const finalSim = getMaxSimilarityAgainstRecent(finalContent, rawRecentAnnotations, resolvedLang);
    const finalEmojis = extractRecentEmojisFromAnnotations([finalContent]);
    const finalHasDuplicateEmoji = finalEmojis.some(e => recentEmojis.includes(e));

    if ((rawRecentAnnotations.length > 0 && finalSim >= SIMILARITY_THRESHOLD) || finalHasDuplicateEmoji) {
      console.warn('[Annotation API] AI回复相似度过高或Emoji重复，不显示给用户，使用默认批注');
      const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
      res.status(200).json({
        ...defaultAnnotation,
        displayDuration: 8000,
        source: 'default',
        reason: 'duplicate_or_emoji_repeated',
        debugAiMode: resolvedAiMode || 'fallback',
      });
      return;
    }

    content = finalContent;

    // tone 和 fallbackEmoji 均从 defaultSet 取，不分析生成内容
    const eventDefaults = defaultSet[eventType] || defaultSet.activity_completed;
    const tone = eventDefaults.tone;
    const fallbackEmoji = eventDefaults.fallbackEmoji;

    // 如果 AI 忘记加 emoji，补上该 eventType 专属的兜底 emoji
    content = ensureEmoji(content, fallbackEmoji);

    res.status(200).json({
      content,
      tone,
      displayDuration: 8000,
      source: 'ai',
      debugAiMode: resolvedAiMode || 'fallback',
    });
  } catch (error) {
    console.error('Annotation API error:', error);
    const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
    res.status(200).json({
      ...defaultAnnotation,
      displayDuration: 8000,
      source: 'default',
      reason: 'exception',
      debugAiMode: resolvedAiMode || 'fallback',
    });
  }
}
