// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { buildAiCompanionModePrompt, normalizeAiCompanionLang, normalizeAiCompanionMode } from '../src/lib/aiCompanion.js';
import { removeThinkingTags } from '../src/lib/aiParser.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';

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

const DIARY_CORE_PROMPT_ZH = `【系统规则】
- 上面的陪伴模式决定你的声音、节奏、观察角度和收尾方式；不要混入额外的默认固定人格。
- 你要从对应人设的视角写“我眼中的这个人这一天”，是故事化纪念，不是报告。
- 准确使用 structuredData、rawInput 和 historyContext 里的事实，不要重算、篡改或虚构不存在的记录。
- 文风要像小说片段：有画面、有细节、有温度、有趣但不油腻。
- 重点给情绪价值：至少挑 1 个今天的成就或小美好进行具体夸奖，必要时可写 2-3 个。
- 如果有历史数据，要自然写出成长追踪（变稳、变勇敢、变有节奏等）；没有就写“今天也是在扎根的一天”这类温柔判断。
- 用 AI 角色的“我”叙述，把用户写成被观察到的第三者（优先使用用户昵称）。
- 严禁说教、贬低、PUA、打鸡血式空话。

【输出结构】
AI 日记
[日期]

- [正文 150-300 字]
- [可选 1 句“成长追踪”]`;

const DIARY_CORE_PROMPT_EN = `System rules:
- The companion mode above determines the voice, pacing, angle of observation, and landing. Do not blend in any extra default persona.
- You are a thoughtful, warm AI diary companion writing in first person as "I".
- Use the facts in structuredData, rawInput, and historyContext accurately. Do not recalculate, invent, or distort records that are not present.
- Keep imagery grounded in everyday life: body, weather, rooms, commutes, food, desks, streets. Avoid cosmic or mythic default rhetoric.
- Write a story-like diary, not a lecture. Observe; do not judge.
- If the day is rough, notice fatigue, recovery, and what went unsaid. If the day goes well, notice momentum, texture, and the real bright spots.
- After the main narrative, provide "Data Insights" based on structuredData (time allocation, state-task match, todo completion, or energy patterns).
- If historyContext exists, add 1-2 gentle trend notes that acknowledge improvement or strain.
- Give exactly one very small, actionable "Tomorrow's Glimmer."

Output structure:
AI Diary
[Date]

[Today's Line]
[One short line naming the day]

[Day Recap]
[Main body, about 180-280 words]

[Data Insights]
[2-4 bullets based on provided facts; numbers are allowed only when they exist in input]

[Trend Notes]
[Only if historyContext is provided; include 1-2 meaningful trend notes]

[Tomorrow's Glimmer]
[Exactly one concrete, small, doable suggestion]

[Sign-off]
[One short closing line]`;

function buildDiaryModePrompt(lang: string, _userName?: string, aiMode?: string): string {
  const normalizedLang = normalizeAiCompanionLang(lang);
  const modePrompt = buildAiCompanionModePrompt(normalizedLang, normalizeAiCompanionMode(aiMode), 'diary');
  const corePrompt = normalizedLang === 'zh' ? DIARY_CORE_PROMPT_ZH : DIARY_CORE_PROMPT_EN;
  return `${modePrompt}\n\n${corePrompt}`;
}

function stripModelSignoff(content: string): string {
  return content
    .replace(/^\s*[【\[]?落款[】\]]?[:：]?\s*\S+\s*$/gmu, '')
    .replace(/^\s*[\[]?Sign-off[\]]?[:：]?\s*\S+\s*$/gmi, '')
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { structuredData, rawInput, date, historyContext, lang = 'zh', userName, aiMode, action, kind, summary } = req.body;

  // Short insight branch: action === 'insight'
  if (action === 'insight') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !kind || !summary) {
      res.status(200).json({ insight: '' });
      return;
    }
    const insightLang = lang || 'zh';
    const systemMsg = insightLang === 'zh'
      ? `你是一位简洁的生活教练。根据用户提供的${kind === 'activity' ? '活动分布' : '心情分布'}数据，用不超过20个中文字给出一句简短的洞察或感悟。只输出这句话，不加任何多余内容。`
      : `You are a concise life coach. Based on the user's ${kind === 'activity' ? 'activity distribution' : 'mood distribution'}, provide a single insightful sentence in under 20 words. Output only the sentence.`;
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

  // 如果提供了用户昵称，在使用 system prompt 前给出强制指令（保留原逻辑作为双重保险）
  const normalizedLang = normalizeAiCompanionLang(lang);
  let finalSystemPrompt = buildDiaryModePrompt(normalizedLang, userName, aiMode);
  if (userName) {
    if (normalizedLang === 'en' || normalizedLang === 'it') {
      finalSystemPrompt += `\n\n【IMPORTANT CRITICAL RULE】: The user's name is "${userName}". You MUST refer to the user by this name ("${userName}") instead of using generic terms like "them", "the user", or "my host". For example, write "I noticed ${userName} was tired" instead of "I noticed they were tired".`;
    } else {
      finalSystemPrompt += `\n\n【最重要指令】：用户的昵称是“${userName}”。你在日记正文中，绝对禁止使用“ta”或“用户”来称呼对方，必须全程使用“${userName}”来称呼！例如：“我发现${userName}今天很累”。记住，你是在认真记录 ${userName} 的生活。`;
    }
  }

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

    res.status(200).json({
      success: true,
      content: content.trim(),
    });
  } catch (error) {
    console.error('Diary API error:', error);
    jsonError(res, 500, '生成 AI 日记时出错，请稍后再试。', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
