// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { buildAiCompanionModePrompt, normalizeAiCompanionLang, normalizeAiCompanionMode } from '../src/lib/aiCompanion.js';
import { removeThinkingTags } from '../src/lib/aiParser.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { buildDiaryTeaser } from '../src/server/diaryTeasers.js';

const openai = new OpenAI();

/**
 * Vercel Serverless Function - AI Diary API
 * 调用大模型生成每日 AI 日记
 *
 * POST /api/diary
 * Body: {
 *   structuredData: string,  // 来自计算层的格式化数据
 *   rawInput?: string,       // 用户的原始输入（用于情感切入点）
 *   date?: string,           // 日期
 *   historyContext?: string  // 可选的历史上下文
 * }
 */

function buildDiaryModePrompt(lang: string, addressee: string, aiMode?: string): string {
  const normalizedLang = normalizeAiCompanionLang(lang);
  const modePrompt = buildAiCompanionModePrompt(normalizedLang, normalizeAiCompanionMode(aiMode), 'diary');
  return modePrompt.replace(/__ADDRESSEE__/g, addressee);
}

const FALLBACK_ADDRESSEE: Record<'zh' | 'en' | 'it', string> = {
  zh: '园主',
  en: 'Gardener',
  it: 'Custode',
};

const SIGNOFF_FALLBACKS: Record<'zh' | 'en' | 'it', Record<'van' | 'agnes' | 'zep' | 'momo', string>> = {
  zh: {
    van: '——你的喇叭花Van',
    agnes: '——你的龙血树Agnes',
    zep: '——你的鹈鹕Zep',
    momo: '——你的小蘑菇Momo',
  },
  en: {
    van: '- Your morning glory Van',
    agnes: '- Your dragon tree Agnes',
    zep: '- Your pelican Zep',
    momo: '- Your little mushroom Momo',
  },
  it: {
    van: '- La tua campanula Van',
    agnes: '- La tua dracena Agnes',
    zep: '- Il tuo pellicano Zep',
    momo: '- Il tuo piccolo fungo Momo',
  },
};

function resolveDiaryAddressee(lang: 'zh' | 'en' | 'it', userName: unknown): string {
  if (typeof userName !== 'string') return FALLBACK_ADDRESSEE[lang];
  const cleaned = userName.replace(/[\r\n]+/g, ' ').replace(/["“”'`]/g, '').trim();
  if (!cleaned) return FALLBACK_ADDRESSEE[lang];
  return cleaned.slice(0, 24);
}

function buildDiaryAddresseeUserRule(lang: 'zh' | 'en' | 'it', addressee: string): string {
  if (lang === 'zh') {
    return `全文用${addressee}称呼对方，直接输出名字，不加任何引号。`;
  }
  if (lang === 'it') {
    return `Chiama sempre la persona ${addressee}, scrivi il nome direttamente senza virgolette.`;
  }
  return `Address the person as ${addressee} throughout, write the name directly with no quotation marks.`;
}

function stripModelSignoff(content: string): string {
  return content
    .replace(/^\s*[【\[]?落款[】\]]?[:：]?\s*$/gmu, '')
    .replace(/^\s*[\[]?Sign-off[\]]?[:：]?\s*$/gmi, '')
    .trim();
}

function containsGenericUserRefs(content: string, lang: 'zh' | 'en' | 'it'): boolean {
  if (lang === 'zh') {
    return /(用户|\bta\b)/i.test(content);
  }
  if (lang === 'it') {
    return /(the\s+user|my\s+host|\bl['’]?utente\b|\butente\b)/i.test(content);
  }
  return /(\bthe\s+user\b|\bmy\s+host\b|\bthey\b|\bthem\b|\btheir\b)/i.test(content);
}

function forceAddresseeReplacement(content: string, lang: 'zh' | 'en' | 'it', addressee: string): string {
  if (lang === 'zh') {
    return content
      .replace(/用户/g, addressee)
      .replace(/\bta\b/gi, addressee);
  }
  if (lang === 'it') {
    return content
      .replace(/\bl['’]?utente\b/gi, addressee)
      .replace(/\butente\b/gi, addressee)
      .replace(/\bthe\s+user\b/gi, addressee)
      .replace(/\bmy\s+host\b/gi, addressee);
  }
  return content
    .replace(/\bthe\s+user\b/gi, addressee)
    .replace(/\bmy\s+host\b/gi, addressee)
    .replace(/\bthey\b/gi, addressee)
    .replace(/\bthem\b/gi, addressee)
    .replace(/\btheir\b/gi, `${addressee}'s`);
}

function hasAnySignoff(content: string): boolean {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tail = lines.slice(-3);
  return tail.some(
    (line) => /^[-—–]{1,2}\s*.+/.test(line) || /[—–]{1,2}[一-龥A-Za-z]/.test(line),
  );
}

function ensureDiarySignoff(
  content: string,
  lang: 'zh' | 'en' | 'it',
  aiMode: 'van' | 'agnes' | 'zep' | 'momo',
): string {
  const trimmed = content.trim();
  if (!trimmed) return `${trimmed}\n\n${SIGNOFF_FALLBACKS[lang][aiMode]}`.trim();
  if (hasAnySignoff(trimmed)) return trimmed;
  return `${trimmed}\n\n${SIGNOFF_FALLBACKS[lang][aiMode]}`;
}

// buildDiaryTeaser moved to src/server/diaryTeasers.ts

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { structuredData, rawInput, date, historyContext, lang = 'zh', userName, aiMode, action, kind, summary, mode = 'full' } = req.body;

  // Short insight branch: action === 'insight'
  if (action === 'insight') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !kind || !summary) {
      res.status(200).json({ insight: '' });
      return;
    }
    const insightLang = lang || 'zh';
    const normalizedLang = normalizeAiCompanionLang(insightLang);
    const modePrompt = buildAiCompanionModePrompt(normalizedLang, normalizeAiCompanionMode(aiMode), 'annotation');
    const zhTopicMap: Record<string, string> = {
      activity: '活动分布',
      mood: '心情分布',
      todo: '待办完成内容与完成度',
      habit: '习惯/目标完成情况',
    };
    const enTopicMap: Record<string, string> = {
      activity: 'activity distribution',
      mood: 'mood distribution',
      todo: 'todo completion and pacing',
      habit: 'habit and goal completion',
    };
    const topicZh = zhTopicMap[kind] || '今日数据';
    const topicEn = enTopicMap[kind] || 'today data';
    const behaviorRule = kind === 'todo'
      ? (normalizedLang === 'zh'
        ? '需覆盖完成内容、完成度和时间安排是否合理。'
        : 'Cover completion content, completion rate, and whether time planning looks reasonable.')
      : kind === 'habit'
        ? (normalizedLang === 'zh'
          ? '需概括习惯/目标整体完成度并给出一个微建议。'
          : 'Summarize overall habit/goal completion and give one tiny suggestion.')
        : (normalizedLang === 'zh' ? '给出一句具体洞察。' : 'Give one specific insight.');
    const systemMsg = normalizedLang === 'zh'
      ? `${modePrompt}\n\n你是一位简洁的生活教练。根据用户提供的${topicZh}数据，输出一句不超过20个中文字的洞察。${behaviorRule}只输出这句话，不加任何多余内容。`
      : `${modePrompt}\n\nYou are a concise life coach. Based on the user's ${topicEn}, output one short insight sentence (about 20 words max). ${behaviorRule} Output only that sentence.`;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: String(summary) }],
        temperature: 0.7,
        max_tokens: 60,
      });
      const raw: string = completion.choices?.[0]?.message?.content || '';
      res.status(200).json({ insight: raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim().slice(0, 20) });
    } catch {
      res.status(200).json({ insight: '' });
    }
    return;
  }

  if (!structuredData || typeof structuredData !== 'string') {
    jsonError(res, 400, 'Missing or invalid structuredData');
    return;
  }

  const normalizedLang = normalizeAiCompanionLang(lang);
  const normalizedMode = normalizeAiCompanionMode(aiMode);

  if (mode === 'teaser') {
    const teaser = buildDiaryTeaser(normalizedLang, structuredData, rawInput);
    res.status(200).json({ success: true, content: teaser });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    jsonError(res, 500, 'Server configuration error: Missing API key');
    return;
  }

  // 构建用户输入
  let userContent = structuredData;

  if (rawInput) {
    userContent += '\n\n【用户原始记录片段】\n' + rawInput.slice(0, 800); // 包含活动心情标签
  }

  if (date) {
    userContent = `日期：${date}\n\n` + userContent;
  }

  if (historyContext) {
    userContent += '\n\n【历史观测背景】\n' + historyContext;
  }

  const addressee = resolveDiaryAddressee(normalizedLang, userName);
  const addresseeUserRule = buildDiaryAddresseeUserRule(normalizedLang, addressee);
  userContent += `\n\n[Addressee rule]\n${addresseeUserRule}`;

  // 用户称呼规则通过 system prompt 占位符与 user prompt 显式规则双重注入。
  const finalSystemPrompt = buildDiaryModePrompt(normalizedLang, addressee, normalizedMode);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.75,
      max_tokens: 1000,
    });
    let content = completion.choices?.[0]?.message?.content || '';

    // 如果返回内容看起来像错误信息，视为失败
    if (!content || content.startsWith('ERROR:') || content.includes('Cannot read')) {
      const errorMsg = content || 'AI 返回内容为空';
      console.error('Diary API returned error content:', errorMsg);
      jsonError(res, 500, 'AI 服务返回异常', errorMsg);
      return;
    }

    content = stripModelSignoff(removeThinkingTags(content));

    if (containsGenericUserRefs(content, normalizedLang)) {
      content = forceAddresseeReplacement(content, normalizedLang, addressee);
    }

    content = ensureDiarySignoff(content, normalizedLang, normalizedMode);

    res.status(200).json({
      success: true,
      content: content.trim(),
    });
  } catch (error) {
    console.error('Diary API error:', error);
    jsonError(res, 500, '生成 AI 日记时出错，请稍后再试。', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
