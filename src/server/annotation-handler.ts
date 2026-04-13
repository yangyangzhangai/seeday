// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
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
  isRecoveryContentCompliant,
  normalizeRecoverySuggestion,
  normalizeSuggestion,
} from './annotation-suggestion.js';
import {
  buildTodayActivitiesText,
  buildTodayContextText,
  getDefaultAnnotations,
  getModel,
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
import type { AnnotationPromptPackage } from './annotation-prompt-builder.js';
import { decomposeTodoWithAI } from './todo-decompose-service.js';
import {
  sampleAssociation,
  type CharacterId,
} from './lateral-association-sampler.js';
import {
  getLateralAssociationState,
  saveLateralAssociationState,
} from './lateral-association-state.js';
import { detectNarrativeEventKey, evaluateNarrativeDensity } from './narrative-density-scorer.js';
import { getTodayNarrativeCache, saveTodayNarrativeCache } from './narrative-density-state.js';
import { evaluateNarrativeTrigger } from './narrative-density-trigger.js';
import { buildNarrativeEventInstruction } from './narrative-event-library.js';
import { reportNarrativeTelemetry } from './narrative-density-telemetry.js';
import { NARRATIVE_EVENT_LOOKBACK_MS } from './narrative-density-constants.js';
import type { NarrativeTriggeredEvent } from './narrative-density-types.js';
import { createAnnotationClient, resolveAnnotationRuntime } from './annotation-provider-runtime.js';
import {
  buildDecomposeReadyActionLabel,
  buildDecomposeReadyContent,
  buildPromptDebugPayload,
  callAnnotationLLM,
  type PendingTodoLite,
  shouldPreDecomposeTodo,
} from './annotation-handler-utils.js';

type AnnotationLang = 'zh' | 'en' | 'it';

const MAX_REWRITE_ATTEMPTS = 1;
const SIMILARITY_THRESHOLD = 0.15;
const ENABLE_VERBOSE_ANNOTATION_LOGS = process.env.ANNOTATION_VERBOSE_LOGS === 'true';
const ENABLE_CHARACTER_STATE = process.env.ANNOTATION_CHARACTER_STATE_ENABLED !== 'false';
const LATERAL_ASSOCIATION_BASE_PROBABILITY = 0.5;
const LATERAL_ASSOCIATION_PROBABILITY_DELTA = 0.2;
const LATERAL_ASSOCIATION_MIN_PROBABILITY = 0.3;
const LATERAL_ASSOCIATION_MAX_PROBABILITY = 0.7;

function logAnnotationDebug(stage: string, payload: Record<string, unknown>): void {
  if (!ENABLE_VERBOSE_ANNOTATION_LOGS) return;
  console.log(`[Annotation API] ${stage}`, payload);
}

function normalizeAnnotationLang(lang: unknown): AnnotationLang {
  if (typeof lang !== 'string') return 'zh';
  const base = lang.toLowerCase().split('-')[0];
  if (base === 'en' || base === 'it') return base;
  return 'zh';
}

function normalizeCharacterId(value: unknown): CharacterId {
  if (value === 'van' || value === 'momo' || value === 'agnes' || value === 'zep') {
    return value;
  }
  return 'van';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeLateralAssociationProbability(narrativeScore: number): number {
  if (!Number.isFinite(narrativeScore)) return LATERAL_ASSOCIATION_BASE_PROBABILITY;
  const normalized = clamp(narrativeScore, 0, 1);
  const shifted = 1 - 2 * normalized;
  return clamp(
    LATERAL_ASSOCIATION_BASE_PROBABILITY + LATERAL_ASSOCIATION_PROBABILITY_DELTA * shifted,
    LATERAL_ASSOCIATION_MIN_PROBABILITY,
    LATERAL_ASSOCIATION_MAX_PROBABILITY,
  );
}

type LateralAssociationResolution = {
  associationInstruction?: string;
  triggered: boolean;
  probability: number;
  associationType?: string;
  originType?: string;
  toneTag?: string;
};

async function resolveLateralAssociationInstruction(params: {
  userId: string;
  characterId: CharacterId;
  userInput: string;
  lang: AnnotationLang;
  currentDate?: { isoDate?: string };
  narrativeScore: number;
}): Promise<LateralAssociationResolution> {
  const probability = computeLateralAssociationProbability(params.narrativeScore);
  const triggered = Math.random() < probability;
  if (!triggered) {
    void reportNarrativeTelemetry({
      userId: params.userId,
      eventName: 'lateral_sampled',
      eventData: {
        narrativeScore: params.narrativeScore,
        baseProbability: LATERAL_ASSOCIATION_BASE_PROBABILITY,
        probabilityDelta: LATERAL_ASSOCIATION_PROBABILITY_DELTA,
        finalProbability: probability,
        triggered,
        characterId: params.characterId,
        lang: params.lang,
      },
    });
    return {
      triggered,
      probability,
    };
  }

  const todayDate = params.currentDate?.isoDate || new Date().toISOString().slice(0, 10);
  const state = await getLateralAssociationState({
    userId: params.userId,
    characterId: params.characterId,
    todayDate,
  });

  const sampled = sampleAssociation({
    characterId: params.characterId,
    userInput: params.userInput,
    lang: params.lang,
    state,
    currentDate: todayDate,
  });

  await saveLateralAssociationState({
    userId: params.userId,
    characterId: params.characterId,
    state: sampled.nextState,
  });

  if (ENABLE_VERBOSE_ANNOTATION_LOGS) {
    console.log('[LateralAssociation]', {
      userId: params.userId,
      characterId: params.characterId,
      lang: params.lang,
      associationType: sampled.associationType,
      originType: sampled.originType,
      toneTag: sampled.toneTag,
      instruction: sampled.associationInstruction,
    });
  }

  void reportNarrativeTelemetry({
    userId: params.userId,
    eventName: 'lateral_sampled',
    eventData: {
      narrativeScore: params.narrativeScore,
      baseProbability: LATERAL_ASSOCIATION_BASE_PROBABILITY,
      probabilityDelta: LATERAL_ASSOCIATION_PROBABILITY_DELTA,
      finalProbability: probability,
      triggered,
      characterId: params.characterId,
      lang: params.lang,
      associationType: sampled.associationType,
      originType: sampled.originType,
      toneTag: sampled.toneTag,
    },
  });

  return {
    associationInstruction: sampled.associationInstruction ?? undefined,
    triggered,
    probability,
    associationType: sampled.associationType,
    originType: sampled.originType,
    toneTag: sampled.toneTag,
  };
}

async function resolveNarrativeEvent(params: {
  userId: string;
  characterId: CharacterId;
  userInput: string;
  lang: AnnotationLang;
  currentDate?: { isoDate?: string };
}): Promise<{
  narrativeEvent?: NarrativeTriggeredEvent;
  adjustedThreshold: number;
  triggerProbability: number;
  currentScore: number;
  todayRichness: number;
  isLowDensity: boolean;
  blockedReason?: string;
  dimensions: { freshness: number; density: number; emotion: number; vocab: number };
}> {
  const nowMs = Date.now();
  const todayDate = params.currentDate?.isoDate || new Date(nowMs).toISOString().slice(0, 10);
  const cache = await getTodayNarrativeCache({
    userId: params.userId,
    characterId: params.characterId,
    todayDate,
    nowMs,
  });

  const minRecentTs = nowMs - NARRATIVE_EVENT_LOOKBACK_MS;
  const eventKey = detectNarrativeEventKey(params.userInput);
  const recentEventKeys = (cache.recentEventKeys || []).filter((item) => item.ts >= minRecentTs);
  const recentCount7d = recentEventKeys.filter((item) => item.key === eventKey).length;
  const score = evaluateNarrativeDensity(params.userInput, recentCount7d);
  const isFirstEntry = cache.entryCount <= 0;
  const nextRichness = (cache.todayRichness * cache.entryCount + score.currentScore) / (cache.entryCount + 1);

  cache.entryCount += 1;
  cache.todayRichness = nextRichness;
  cache.entries = [...cache.entries, { score: score.currentScore, ts: nowMs, eventKey: score.eventKey }].slice(-300);
  cache.recentEventKeys = [...recentEventKeys, { key: score.eventKey, ts: nowMs }].slice(-600);

  const triggerDecision = evaluateNarrativeTrigger({
    isFirstEntry,
    currentScore: score.currentScore,
    todayRichness: nextRichness,
    cache,
  });
  const isLowDensity = score.currentScore < triggerDecision.adjustedThreshold;
  let narrativeEvent: NarrativeTriggeredEvent | undefined;
  let blockedReason = triggerDecision.blockedReason;

  if (triggerDecision.shouldTrigger && triggerDecision.selectedEventType) {
    const selected = buildNarrativeEventInstruction({
      characterId: params.characterId,
      eventType: triggerDecision.selectedEventType,
      lang: params.lang,
    });
    if (selected) {
      narrativeEvent = selected;
      cache.triggerCount.total += 1;
      if (selected.eventType === 'natural_event') cache.triggerCount.naturalEvent += 1;
      if (selected.eventType === 'character_mention') cache.triggerCount.characterMention += 1;
      if (selected.eventType === 'derived_event') cache.triggerCount.derivedEvent += 1;
    } else {
      blockedReason = 'event_library_empty';
    }
  }

  await saveTodayNarrativeCache({ userId: params.userId, characterId: params.characterId, cache });

  void reportNarrativeTelemetry({
    userId: params.userId,
    eventName: 'density_scored',
    eventData: {
      currentScore: score.currentScore,
      todayRichness: cache.todayRichness,
      adjustedThreshold: triggerDecision.adjustedThreshold,
      triggerProbability: triggerDecision.triggerProbability,
      isLowDensity,
      dimensions: score.dimensions,
    },
  });

  if (narrativeEvent) {
    void reportNarrativeTelemetry({
      userId: params.userId,
      eventName: 'event_triggered',
      eventData: {
        eventType: narrativeEvent.eventType,
        eventId: narrativeEvent.eventId,
      },
    });
  } else if (blockedReason) {
    void reportNarrativeTelemetry({
      userId: params.userId,
      eventName: 'trigger_blocked',
      eventData: {
        blockedReason,
        triggerCount: cache.triggerCount,
      },
    });
  }

  return {
    narrativeEvent,
    adjustedThreshold: triggerDecision.adjustedThreshold,
    triggerProbability: triggerDecision.triggerProbability,
    currentScore: score.currentScore,
    todayRichness: cache.todayRichness,
    isLowDensity,
    blockedReason,
    dimensions: score.dimensions,
  };
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
 * 调用多 provider 模型生成 AI 批注（气泡）
 *
 * POST /api/annotation
 * Body: { eventType: string, eventData: {...}, userContext: {...}, lang: 'zh' | 'en' | 'it', aiMode?: string }
 */

// ==================== 主 Handler ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { eventType, eventData, userContext, lang = 'zh', aiMode, debugPrompts } = req.body;
  const includePromptDebug = debugPrompts === true || process.env.ANNOTATION_PROMPT_DEBUG === 'true';
  const resolvedLang = normalizeAnnotationLang(lang);
  const resolvedAiMode = aiMode ? normalizeAiCompanionMode(aiMode) : undefined;
  const lateralCharacterId = normalizeCharacterId(resolvedAiMode);
  const lateralUserId = typeof userContext?.userId === 'string' && userContext.userId.trim()
    ? userContext.userId.trim()
    : '__anonymous__';

  if (!eventType || !eventData) {
    jsonError(res, 400, 'Missing eventType or eventData');
    return;
  }

  const debugCharacterState = {
    enabled: ENABLE_CHARACTER_STATE,
    text: ENABLE_CHARACTER_STATE ? String(userContext?.characterStateText || '').trim() : '',
    meta: userContext?.characterStateMeta,
  };

  logAnnotationDebug('request.received', {
    eventType,
    eventData,
    userContext,
    lang,
    resolvedLang,
    requestedAiMode: aiMode || 'none',
    resolvedAiMode: resolvedAiMode || 'fallback',
    debugPrompts,
    includePromptDebug,
  });

  const defaultSet = getDefaultAnnotations(resolvedLang);
  const routeModel = getModel(resolvedLang);
  const runtime = resolveAnnotationRuntime(routeModel);

  if (!runtime.apiKey) {
    const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
    logAnnotationDebug('response.no_key_fallback', {
      provider: runtime.provider,
      model: routeModel,
      response: {
        ...defaultAnnotation,
        displayDuration: 8000,
        source: 'default',
        reason: 'no_key',
      },
    });
    res.status(200).json({
      ...defaultAnnotation,
      displayDuration: 8000,
      source: 'default',
      reason: 'no_key',
      debugProvider: runtime.provider,
      debugModel: routeModel,
      debugAiMode: resolvedAiMode || 'fallback',
      debugCharacterState,
    });
    return;
  }

  const annotationClient = runtime.provider === 'gemini' && !/\/openai\/?$/i.test(String(runtime.baseURL || ''))
    ? undefined
    : createAnnotationClient(runtime);

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

  const sharedEventSummary = (eventData.summary || eventData.content || eventData.mood || JSON.stringify(eventData).slice(0, 50))
    .replace(/\s+/g, ' ')
    .trim();
  const narrativeContext = await resolveNarrativeEvent({
    userId: lateralUserId,
    characterId: lateralCharacterId,
    userInput: sharedEventSummary,
    lang: resolvedLang,
    currentDate: userContext?.currentDate,
  });
  const narrativeEventInstruction = narrativeContext.narrativeEvent?.instruction;
  const lateralAssociation = await resolveLateralAssociationInstruction({
    userId: lateralUserId,
    characterId: lateralCharacterId,
    userInput: sharedEventSummary,
    lang: resolvedLang,
    currentDate: userContext?.currentDate,
    narrativeScore: narrativeContext.currentScore,
  });
  const associationInstruction = lateralAssociation.associationInstruction;

  logAnnotationDebug('special_modes.resolved', {
    isSuggestionMode,
    forceSuggestion,
    narrative: {
      score: Number(narrativeContext.currentScore.toFixed(3)),
      threshold: Number(narrativeContext.adjustedThreshold.toFixed(3)),
      triggerProbability: Number(narrativeContext.triggerProbability.toFixed(3)),
      isLowDensity: narrativeContext.isLowDensity,
      blockedReason: narrativeContext.blockedReason,
      triggeredEventType: narrativeContext.narrativeEvent?.eventType,
      triggeredEventId: narrativeContext.narrativeEvent?.eventId,
      instruction: narrativeContext.narrativeEvent?.instruction,
    },
    lateralAssociation: {
      score: Number(narrativeContext.currentScore.toFixed(3)),
      probability: Number(lateralAssociation.probability.toFixed(3)),
      triggered: lateralAssociation.triggered,
      associationType: lateralAssociation.associationType,
      originType: lateralAssociation.originType,
      toneTag: lateralAssociation.toneTag,
      instruction: lateralAssociation.associationInstruction,
    },
  });

  if (isSuggestionMode) {
    let suggestionPromptPackage: AnnotationPromptPackage | undefined;
    try {
      const recentActivities = userContext?.todayActivitiesList?.slice(-3) || [];
      const todayActivitiesText = buildTodayActivitiesText(recentActivities, resolvedLang, userTimezone);
      const pendingTodos = (userContext?.pendingTodos || []).slice(0, 10);
      const recoveryNudge = userContext?.recoveryNudge as RecoveryNudgeContext | undefined;
      const currentHour = userContext?.currentHour;
      const currentMinute = userContext?.currentMinute;
      const todayContextText = buildTodayContextText(userContext?.todayContext, resolvedLang);
      const eventSummary = sharedEventSummary;
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
          characterStateText: ENABLE_CHARACTER_STATE ? userContext?.characterStateText : undefined,
          userProfileSnapshot: userContext?.userProfileSnapshot,
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
          associationInstruction,
          narrativeEventInstruction,
      });
      suggestionPromptPackage = promptPackage;
      logAnnotationDebug('prompt.suggestion.built', {
        provider: runtime.provider,
        model: promptPackage.model,
        systemPrompt: promptPackage.instructions,
        userPrompt: promptPackage.input,
      });

      const llmResponse = await callAnnotationLLM(annotationClient, {
        provider: runtime.provider,
        model: promptPackage.model,
        instructions: promptPackage.instructions,
        input: promptPackage.input,
        temperature: 0.6,
        maxOutputTokens: 300,
        apiKey: runtime.apiKey,
        baseURL: runtime.baseURL,
        expectJson: true,
      });

      const raw = removeThinkingTags(llmResponse.outputText || '').trim();
      logAnnotationDebug('llm.suggestion.raw_output', {
        provider: runtime.provider,
        model: promptPackage.model,
        finishReason: llmResponse.finishReason,
        outputText: llmResponse.outputText || '',
        outputTextAfterThinkingTagRemoval: raw,
        usage: llmResponse.usage,
        responseId: llmResponse.responseId,
      });
      const parsedPayload = extractSuggestionPayload(raw);

      if (parsedPayload) {
        const recoveryFallback = recoveryNudge
          ? buildRecoveryFallbackSuggestion(resolvedLang, recoveryNudge)
          : undefined;

        let finalContent = ensureEmoji(parsedPayload.content, recoveryNudge ? '⭐' : '🌿');
        const normalizedSuggestion = recoveryNudge
          ? normalizeRecoverySuggestion(resolvedLang, parsedPayload.suggestion, recoveryNudge)
          : (normalizeSuggestion(resolvedLang, parsedPayload.suggestion, recoveryNudge)
            ?? (forceSuggestion
              ? buildForcedFallbackSuggestion(resolvedLang, pendingTodos).suggestion
              : undefined));

        if (recoveryFallback && !isRecoveryContentCompliant(resolvedLang, finalContent)) {
          finalContent = recoveryFallback.content;
        }

        if (normalizedSuggestion?.type === 'todo' && typeof normalizedSuggestion.todoId === 'string') {
          const targetTodo = pendingTodos.find((todo) => todo.id === normalizedSuggestion.todoId) as PendingTodoLite | undefined;
          const canPreDecompose = shouldPreDecomposeTodo(targetTodo, Date.now());
          if (canPreDecompose && targetTodo?.title) {
            try {
              const steps = await decomposeTodoWithAI({
                title: targetTodo.title,
                lang: resolvedLang,
                qwenApiKey: process.env.QWEN_API_KEY,
                apiKey: process.env.OPENAI_API_KEY,
              });
              if (steps.length > 0) {
                normalizedSuggestion.decomposeReady = true;
                normalizedSuggestion.decomposeSourceTodoId = targetTodo.id;
                normalizedSuggestion.decomposeSteps = steps;
                normalizedSuggestion.actionLabel = buildDecomposeReadyActionLabel(resolvedLang);
                finalContent = buildDecomposeReadyContent(resolvedLang, targetTodo.title, steps.length);
              }
            } catch (decomposeError) {
              if (ENABLE_VERBOSE_ANNOTATION_LOGS) {
                console.warn('[Annotation API] pre-decompose failed, fallback to normal suggestion', decomposeError);
              }
            }
          }
        }

        logAnnotationDebug('response.suggestion.ai', {
          content: finalContent,
          suggestion: normalizedSuggestion,
          source: 'ai',
          displayDuration: normalizedSuggestion ? 15000 : 8000,
        });

        res.status(200).json({
          content: finalContent,
          tone: 'concerned',
          displayDuration: normalizedSuggestion ? 15000 : 8000,
          source: 'ai',
          narrativeEvent: narrativeContext.narrativeEvent ? {
            ...narrativeContext.narrativeEvent,
            isTriggeredReply: true,
          } : undefined,
          debugAiMode: resolvedAiMode || 'fallback',
          debugCharacterState,
          suggestion: normalizedSuggestion,
          ...buildPromptDebugPayload(suggestionPromptPackage, includePromptDebug),
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
          logAnnotationDebug('response.suggestion.force_fallback', {
            content: finalContent,
            source: 'ai',
            fallbackSuggestion: fallback.suggestion,
            displayDuration: 15000,
          });
          res.status(200).json({
            content: finalContent,
            tone: 'concerned',
            displayDuration: 15000,
            source: 'ai',
            narrativeEvent: narrativeContext.narrativeEvent ? {
              ...narrativeContext.narrativeEvent,
              isTriggeredReply: true,
            } : undefined,
            debugAiMode: resolvedAiMode || 'fallback',
            debugCharacterState,
            suggestion: fallback.suggestion,
            ...buildPromptDebugPayload(suggestionPromptPackage, includePromptDebug),
          });
          return;
        }

        logAnnotationDebug('response.suggestion.comment_only', {
          content: finalContent,
          source: 'ai',
          displayDuration: 8000,
        });

        res.status(200).json({
          content: finalContent,
          tone: 'concerned',
          displayDuration: 8000,
          source: 'ai',
          narrativeEvent: narrativeContext.narrativeEvent ? {
            ...narrativeContext.narrativeEvent,
            isTriggeredReply: true,
          } : undefined,
          debugAiMode: resolvedAiMode || 'fallback',
          debugCharacterState,
          ...buildPromptDebugPayload(suggestionPromptPackage, includePromptDebug),
        });
        return;
      }
    } catch (suggestionErr) {
      console.error('[Annotation API] Suggestion mode error:', {
        provider: runtime.provider,
        model: suggestionPromptPackage?.model,
        error: suggestionErr instanceof Error ? suggestionErr.message : String(suggestionErr),
      });
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
          narrativeEvent: narrativeContext.narrativeEvent ? {
            ...narrativeContext.narrativeEvent,
            isTriggeredReply: false,
          } : undefined,
          debugAiMode: resolvedAiMode || 'fallback',
          debugCharacterState,
          suggestion: fallback.suggestion,
          ...buildPromptDebugPayload(suggestionPromptPackage, includePromptDebug),
        });
        return;
      }
    }
    // suggestion 失败时回退普通批注
  }

  let annotationPromptPackage: AnnotationPromptPackage | undefined;
  try {
    // 预处理事件数据（去除多余空白，避免 prompt 里混入奇怪换行）
    const eventSummary = sharedEventSummary;

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
      characterStateText: ENABLE_CHARACTER_STATE ? userContext?.characterStateText : undefined,
      userProfileSnapshot: userContext?.userProfileSnapshot,
      currentDate: userContext?.currentDate,
      holiday,
      currentHour,
      currentMinute,
      weatherContext,
      seasonContext,
      weatherAlerts,
      associationInstruction,
      narrativeEventInstruction,
    });
    annotationPromptPackage = promptPackage;
    logAnnotationDebug('prompt.annotation.built', {
      provider: runtime.provider,
      model: promptPackage.model,
      systemPrompt: promptPackage.instructions,
      userPrompt: promptPackage.input,
    });

    const llmResponse = await callAnnotationLLM(annotationClient, {
      provider: runtime.provider,
      model: promptPackage.model,
      instructions: promptPackage.instructions,
      input: promptPackage.input,
      temperature: 0.7,
      maxOutputTokens: 480,
      apiKey: runtime.apiKey,
      baseURL: runtime.baseURL,
    });

    logAnnotationDebug('llm.annotation.raw_output', {
      provider: runtime.provider,
      model: promptPackage.model,
      finishReason: llmResponse.finishReason,
      outputText: llmResponse.outputText || '',
      usage: llmResponse.usage,
      responseId: llmResponse.responseId,
    });

    let content: string = llmResponse.outputText;

    if (!content || !content.trim()) {
      console.warn('[Annotation API] empty_content details:', { eventType, lang: resolvedLang });
      const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
      res.status(200).json({
        ...defaultAnnotation,
        displayDuration: 8000,
        source: 'default',
        reason: 'empty_content',
        debugAiMode: resolvedAiMode || 'fallback',
        debugCharacterState,
        ...buildPromptDebugPayload(annotationPromptPackage, includePromptDebug),
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
        debugCharacterState,
        ...buildPromptDebugPayload(annotationPromptPackage, includePromptDebug),
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

          const rewriteResponse = await callAnnotationLLM(annotationClient, {
            provider: runtime.provider,
            model: promptPackage.model,
            instructions: promptPackage.instructions,
            input: rewritePrompt,
            temperature: resolvedLang === 'zh' ? 0.75 : 0.8,
            maxOutputTokens: resolvedLang === 'zh' ? 180 : 480,
            apiKey: runtime.apiKey,
            baseURL: runtime.baseURL,
          });

          let rewriteRaw = rewriteResponse.outputText;
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
              finishReason: rewriteResponse.finishReason,
              similarity: Number(rewriteSimilarity.toFixed(3)),
              hasDuplicateEmoji: rewriteHasDuplicateEmoji,
              rawLength: rewriteRaw.length,
              rawOutput: rewriteRaw,
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
        debugCharacterState,
        ...buildPromptDebugPayload(annotationPromptPackage, includePromptDebug),
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

    logAnnotationDebug('response.annotation.ai', {
      content,
      tone,
      source: 'ai',
      displayDuration: 8000,
      narrativeEvent: narrativeContext.narrativeEvent,
    });

    res.status(200).json({
      content,
      tone,
      displayDuration: 8000,
      source: 'ai',
      narrativeEvent: narrativeContext.narrativeEvent ? {
        ...narrativeContext.narrativeEvent,
        isTriggeredReply: true,
      } : undefined,
      debugAiMode: resolvedAiMode || 'fallback',
      debugCharacterState,
      ...buildPromptDebugPayload(annotationPromptPackage, includePromptDebug),
    });
  } catch (error) {
    console.error('Annotation API error:', {
      provider: runtime.provider,
      model: annotationPromptPackage?.model,
      error: error instanceof Error ? error.message : String(error),
    });
    const defaultAnnotation = defaultSet[eventType] || defaultSet.activity_completed;
    res.status(200).json({
      ...defaultAnnotation,
      displayDuration: 8000,
      source: 'default',
      reason: 'exception',
      debugAiMode: resolvedAiMode || 'fallback',
      debugCharacterState,
      ...buildPromptDebugPayload(annotationPromptPackage, includePromptDebug),
    });
  }
}
