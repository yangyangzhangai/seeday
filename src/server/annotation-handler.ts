// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { extractComment, removeThinkingTags } from '../lib/aiParser.js';
import { normalizeAiCompanionMode } from '../lib/aiCompanion.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';
import {
  buildTodayActivitiesText,
  buildUserPrompt,
  getDefaultAnnotations,
  getModel,
  getSystemPrompt,
} from './annotation-prompts.js';

const openai = new OpenAI();

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

// ==================== 主 Handler ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { eventType, eventData, userContext, lang = 'zh', aiMode } = req.body;
  const resolvedAiMode = aiMode ? normalizeAiCompanionMode(aiMode) : undefined;

  if (!eventType || !eventData) {
    jsonError(res, 400, 'Missing eventType or eventData');
    return;
  }

  console.log('[Annotation API] mode:', {
    eventType,
    lang,
    requestedAiMode: aiMode || 'none',
    resolvedAiMode: resolvedAiMode || 'fallback',
  });

  const defaultSet = getDefaultAnnotations(lang);
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

  try {
    // 预处理事件数据（去除多余空白，避免 prompt 里混入奇怪换行）
    const eventSummary = (eventData.summary || eventData.content || JSON.stringify(eventData).slice(0, 50))
      .replace(/\s+/g, ' ')
      .trim();

    // 构建今日时间线（最近6个活动）
    const recentActivities = userContext?.todayActivitiesList?.slice(-3) || [];
    const todayActivitiesText = buildTodayActivitiesText(recentActivities, lang);

    // 最近批注：清洗掉可能导致 prompt 自我污染的内容（标签、指令关键词）
    const sanitizeAnnotation = (s: string) =>
      s.replace(/【[^】]*】/g, '').replace(/\b(IMPORTANT|OUTPUT|JSON|comment|system)\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const sanitizeMoodText = (s: string) =>
      s.replace(/【[^】]*】/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

    const rawRecentMoodMessages = userContext?.recentMoodMessages?.slice(-3) || [];
    const recentMoodText =
      rawRecentMoodMessages.map(sanitizeMoodText).filter(Boolean).join(' / ') ||
      (lang === 'en' ? 'None' : lang === 'it' ? 'Nessuno' : '无');

    const rawRecentAnnotations = userContext?.recentAnnotations?.slice(-3) || [];
    const recentAnnotationsList =
      rawRecentAnnotations.map(sanitizeAnnotation).filter(Boolean).join(' / ') ||
      (lang === 'en' ? 'None' : lang === 'it' ? 'Nessuna' : '无');
    const recentEmojis = extractRecentEmojisFromAnnotations(rawRecentAnnotations);
    const recentEmojisText = recentEmojis.join(' ');

    // 构建提示词
    const userPrompt = buildUserPrompt(
      lang,
      eventType,
      eventSummary,
      todayActivitiesText,
      recentMoodText,
      recentAnnotationsList,
      recentEmojisText
    );
    const systemPrompt = getSystemPrompt(lang, resolvedAiMode);
    const model = getModel(lang);

    openai.apiKey = apiKey;

    const llmResponse = await openai.responses.create({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      temperature: lang === 'zh' ? 0.75 : 0.8,
      max_output_tokens: lang === 'zh' ? 180 : 480,
    });

    const promptCacheHits = llmResponse.usage?.prompt_cache_hits ?? 0;
    const promptCacheMisses = llmResponse.usage?.prompt_cache_misses ?? 0;
    console.log('[Annotation API] LLM meta:', {
      lang,
      model,
      usage: llmResponse.usage,
      prompt_cache_hits: promptCacheHits,
      prompt_cache_misses: promptCacheMisses,
      cached: promptCacheHits > 0,
      response_id: llmResponse.id,
    });

    let content: string = llmResponse.output_text;

    if (!content || !content.trim()) {
      console.warn('[Annotation API] empty_content details:', { eventType, lang });
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
    const extractedContent = extractComment(content, lang === 'en' || lang === 'it' ? lang : 'zh');
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
