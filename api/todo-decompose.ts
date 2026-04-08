// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { decomposeTodoWithAI } from '../src/server/todo-decompose-service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { title, lang = 'zh' } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    jsonError(res, 400, 'Missing or invalid title');
    return;
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    jsonError(res, 500, 'Server configuration error: Missing OPENAI_API_KEY');
    return;
  }
  try {
    const steps = await decomposeTodoWithAI({
      title,
      lang: lang === 'en' || lang === 'it' ? lang : 'zh',
      apiKey: openaiApiKey,
      model: process.env.TODO_DECOMPOSE_MODEL,
    });

    res.status(200).json({ success: true, steps });
  } catch (error) {
    jsonError(res, 500, 'AI请求失败，请稍后重试', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
