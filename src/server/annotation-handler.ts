// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { extractComment, removeThinkingTags } from '../lib/aiParser.js';
import { normalizeAiCompanionMode } from '../lib/aiCompanion.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';
import {
  buildRewritePrompt,
  ensureEmoji,
  extractRecentEmojisFromAnnotations,
  getMaxSimilarityAgainstRecent,
} from './annotation-similarity.js';
import {
  buildForcedFallbackSuggestion,
  buildRecoveryFallbackSuggestion,
  extractSuggestionPayload,
  normalizeSuggestion,
} from './annotation-suggestion.js';
import {
  buildTodayActivitiesText,
  buildTodayContextText,
  getDefaultAnnotations,
} from './annotation-prompts.js';
import type { RecoveryNudgeContext } from '../types/annotation.js';
import { resolveCountryCode } from './country-resolver.js';
import { resolveHoliday } from './holiday-resolver.js';
import { resolveSeasonContext } from '../lib/seasonContext.js';
import { fetchWeatherSnapshot } from './weather-provider.js';
import { buildWeatherContext } from './weather-context.js';
import { fetchAirQualitySnapshot } from './air-quality-provider.js';
import { buildWeatherAlerts } from './weather-alerts.js';
import { buildAnnotationPromptPackage } from './annotation-prompt-builder.js';

const openai = new OpenAI();

type AnnotationLang = 'zh' | 'en' | 'it';

const MAX_REWRITE_ATTEMPTS = 1;
const SIMILARITY_THRESHOLD = 0.15;
const ENABLE_VERBOSE_ANNOTATION_LOGS = process.env.ANNOTATION_VERBOSE_LOGS === 'true';

function normalizeAnnotationLang(lang: unknown): AnnotationLang {
  if (typeof lang !== 'string') return 'zh';
  const base = lang.toLowerCase().split('-')[0];
  if (base === 'en' || base === 'it') return base;
  return 'zh';
}

async function withElapsed<T>(task: Promise<T>): Promise<{ value: T; elapsedMs: number }> {
  const startedAt = Date.now();
  const value = await task;
  return {
    value,
    elapsedMs: Date.now() - startedAt,
  };
}

/**
 * Vercel Serverless Function - Annotation API
 * 调用 OpenAI Responses API 生成 AI 批注（气泡）
 *
 * POST /api/annotation
 * Body: { eventType: string, eventData: {...}, userContext: {...}, lang: 'zh' | 'en' | 'it', aiMode?: string }
 */

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

  if (ENABLE_VERBOSE_ANNOTATION_LOGS) {
    console.log('[Annotation API] mode:', {
      eventType,
      lang: resolvedLang,
      requestedAiMode: aiMode || 'none',
      resolvedAiMode: resolvedAiMode || 'fallback',
    });
  }

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
  const userTimezone = typeof userContext?.timezone === 'string' ? userContext.timezone : undefined;
  const resolvedCountry = resolveCountryCode({
    countryCode: userContext?.countryCode,
    timezone: userTimezone,
  });
  const holiday = resolveHoliday({
    countryCode: resolvedCountry.countryCode,
    lang: resolvedLang,
    currentDate: userContext?.currentDate,
  });
  const seasonContext = resolveSeasonContext(userContext?.currentDate);
  const latitude = typeof userContext?.latitude === 'number' ? userContext.latitude : undefined;
  const longitude = typeof userContext?.longitude === 'number' ? userContext.longitude : undefined;

  const [weatherResult, airQualityResult] = await Promise.all([
    withElapsed(fetchWeatherSnapshot({ latitude, longitude, timeoutMs: 800 })),
    withElapsed(fetchAirQualitySnapshot({ latitude, longitude, timeoutMs: 800 })),
  ]);

  const weatherContext = buildWeatherContext(weatherResult.value);
  const weatherAlerts = buildWeatherAlerts({
    weather: weatherResult.value,
    airQuality: airQualityResult.value,
  });

  if (ENABLE_VERBOSE_ANNOTATION_LOGS) {
    console.log('[Annotation API] Env context meta:', {
      weather_source: weatherContext.source,
      weather_conditions: weatherContext.conditions,
      weather_temperature_c: weatherContext.temperatureC,
      season: seasonContext.season,
      alerts: weatherAlerts,
      weather_fetch_ms: weatherResult.elapsedMs,
      air_quality_fetch_ms: airQualityResult.elapsedMs,
    });
  }

  if (isSuggestionMode) {
    try {
      const recentActivities = userContext?.todayActivitiesList?.slice(-3) || [];
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

      const promptPackage = buildAnnotationPromptPackage({
        mode: 'suggestion',
        lang: resolvedLang,
        aiMode: resolvedAiMode,
        eventType,
        eventSummary,
        todayActivitiesText,
        recentMoodText,
        todayContextText,
        statusSummary: userContext?.statusSummary,
        contextHints: userContext?.contextHints,
        frequentActivities: userContext?.frequentActivities,
        pendingTodos,
        currentDate: userContext?.currentDate,
        holiday,
        currentHour,
        currentMinute,
        consecutiveTextCount: userContext?.consecutiveTextCount,
        forceSuggestion,
        recoveryNudge,
        weatherContext,
        seasonContext,
        weatherAlerts,
      });

      openai.apiKey = apiKey;
      const llmResponse = await openai.responses.create({
        model: promptPackage.model,
        instructions: promptPackage.instructions,
        input: promptPackage.input,
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
    const promptPackage = buildAnnotationPromptPackage({
      mode: 'annotation',
      lang: resolvedLang,
      aiMode: resolvedAiMode,
      eventType,
      eventSummary,
      todayActivitiesText,
      recentMoodText,
      todayContextText,
      currentDate: userContext?.currentDate,
      holiday,
      currentHour,
      currentMinute,
      weatherContext,
      seasonContext,
      weatherAlerts,
    });

    openai.apiKey = apiKey;

    const llmResponse = await openai.responses.create({
      model: promptPackage.model,
      instructions: promptPackage.instructions,
      input: promptPackage.input,
      temperature: 0.7,
      max_output_tokens: 480,
    });

    const promptCacheHits = (llmResponse.usage as any)?.prompt_cache_hits ?? 0;
    const promptCacheMisses = (llmResponse.usage as any)?.prompt_cache_misses ?? 0;
    if (ENABLE_VERBOSE_ANNOTATION_LOGS) {
      console.log('[Annotation API] LLM meta:', {
        lang: resolvedLang,
        model: promptPackage.model,
        usage: llmResponse.usage,
        prompt_cache_hits: promptCacheHits,
        prompt_cache_misses: promptCacheMisses,
        cached: promptCacheHits > 0,
        response_id: llmResponse.id,
      });
    }

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
            promptPackage.input,
            content,
            rawRecentAnnotations.slice(-3),
          );

          const rewriteResponse = await openai.responses.create({
            model: promptPackage.model,
            instructions: promptPackage.instructions,
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

          if (ENABLE_VERBOSE_ANNOTATION_LOGS) {
            console.log('[Annotation API] 重写候选', {
              attempt,
              similarity: Number(rewriteSimilarity.toFixed(3)),
              hasDuplicateEmoji: rewriteHasDuplicateEmoji,
            });
          }

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
