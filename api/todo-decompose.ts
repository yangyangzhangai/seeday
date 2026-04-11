// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { decomposeTodoWithAIDiagnostics } from '../src/server/todo-decompose-service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { title, lang = 'zh' } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    jsonError(res, 400, 'Missing or invalid title');
    return;
  }

  try {
    const result = await decomposeTodoWithAIDiagnostics({
      title,
      lang: lang === 'en' || lang === 'it' ? lang : 'zh',
      apiKey: process.env.OPENAI_API_KEY,
      qwenApiKey: process.env.QWEN_API_KEY,
    });

    res.status(200).json({
      success: true,
      steps: result.steps,
      parseStatus: result.parseStatus,
      model: result.model,
      provider: result.provider,
    });
  } catch (error) {
    jsonError(res, 500, 'AI请求失败，请稍后重试', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
