// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';

/**
 * Vercel Serverless Function - Short Insight API
 * 根据活动/心情分布生成 ≤20 字的简短 AI 分析
 *
 * POST /api/short-insight
 * Body: { kind: 'activity' | 'mood', summary: string, lang?: 'zh' | 'en' | 'it' }
 * Response: { insight: string }
 */

const openai = new OpenAI();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { kind, summary, lang = 'zh' } = req.body || {};

  if (!kind || !summary) {
    jsonError(res, 400, 'Missing kind or summary');
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ insight: '' });
    return;
  }

  openai.apiKey = apiKey;

  const systemPrompt = lang === 'zh'
    ? `你是一位简洁的生活观察者。根据用户提供的${kind === 'activity' ? '活动分布' : '心情分布'}数据，用不超过20个中文字给出一句简短的洞察或感悟。只输出这句话，不加标点符号以外的任何内容。`
    : `You are a concise life observer. Based on the user's ${kind === 'activity' ? 'activity distribution' : 'mood distribution'}, provide a single insightful sentence in under 20 words. Output only the sentence.`;

  const userPrompt = `${kind === 'activity' ? '活动分布' : '心情分布'}：${summary}`;

  try {
    const llmResponse = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions: systemPrompt,
      input: userPrompt,
      temperature: 0.7,
      max_output_tokens: 60,
    });

    const raw = (llmResponse.output_text || '').trim();
    // Trim to ≤20 chars for safety
    const insight = raw.slice(0, 20);
    res.status(200).json({ insight });
  } catch (err) {
    console.error('[ShortInsight API] error:', err);
    res.status(200).json({ insight: '' });
  }
}
