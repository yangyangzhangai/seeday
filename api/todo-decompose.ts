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
  } catch (error) {
    console.error('[Todo Decompose API] request.failed', {
      lang,
      titleLength: typeof title === 'string' ? title.trim().length : 0,
      modelZh: process.env.TODO_DECOMPOSE_MODEL_ZH || 'qwen-plus',
      modelDefault: process.env.TODO_DECOMPOSE_MODEL || 'gemini-2.0-flash',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasQwenKey: Boolean(process.env.QWEN_API_KEY),
      qwenBase: process.env.QWEN_BASE_URL || process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      geminiBase: process.env.TODO_DECOMPOSE_GEMINI_BASE_URL || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      error: error instanceof Error ? error.message : String(error),
    });
    jsonError(res, 500, 'AI请求失败，请稍后重试', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
