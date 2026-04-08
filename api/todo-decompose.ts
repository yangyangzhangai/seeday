// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';

const DECOMPOSE_PROMPT_ZH = `你是一个任务拆解助手。
将用户提供的待办事项拆解成3到6个具体可执行的子步骤。
输出严格的JSON格式，不要输出任何解释、前缀、后缀或Markdown代码块，只输出JSON本身。

【拆解原则】
- 子步骤必须具体、可独立执行，不要太抽象
- 子步骤按执行顺序排列
- 每个子步骤给出建议时长（分钟），范围5到90分钟
- 时长要符合实际，比如"买菜"15-30分钟，"做菜"30-60分钟
- 步骤数量：简单任务3步，复杂任务最多6步

【输出格式】
{
  "steps": [
    { "title": "子步骤名称", "durationMinutes": 数字 },
    ...
  ]
}`;

const DECOMPOSE_PROMPT_EN = `You are a task breakdown assistant.
Break down the user's todo item into 3 to 6 specific, actionable sub-steps.
Output strictly in JSON format. Do NOT output any explanations, prefixes, suffixes, or Markdown code blocks. Output the JSON only.

[Breakdown Principles]
- Each sub-step must be specific and independently executable, not abstract
- Sub-steps are ordered by execution sequence
- Provide a suggested duration (minutes) for each step, range 5 to 90 minutes
- Durations should be realistic
- Step count: 3 steps for simple tasks, up to 6 for complex ones

[Output Format]
{
  "steps": [
    { "title": "sub-step name", "durationMinutes": number },
    ...
  ]
}`;

const DECOMPOSE_PROMPT_IT = `Sei un assistente per la scomposizione dei compiti.
Scomponi il todo dell'utente in 3-6 sotto-passi specifici ed eseguibili.
Restituisci rigorosamente in formato JSON. NON produrre spiegazioni, prefissi, suffissi o blocchi Markdown. Solo JSON.

[Principi]
- Ogni sotto-passo deve essere specifico e indipendentemente eseguibile
- I sotto-passi sono ordinati per sequenza di esecuzione
- Fornisci una durata suggerita (minuti) per ogni passo, da 5 a 90 minuti
- Numero di passi: 3 per compiti semplici, massimo 6 per quelli complessi

[Formato Output]
{
  "steps": [
    { "title": "nome sotto-passo", "durationMinutes": numero },
    ...
  ]
}`;

function parseDecomposeResponse(raw: string): { steps: Array<{ title: string; durationMinutes: number }> } {
  try {
    return JSON.parse(raw.trim());
  } catch {
    // try extracting JSON object
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // fallback
    }
  }
  return { steps: [] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { title, lang = 'zh' } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    jsonError(res, 400, 'Missing or invalid title');
    return;
  }

  const qwenApiKey = process.env.QWEN_API_KEY;
  if (!qwenApiKey) {
    jsonError(res, 500, 'Server configuration error: Missing QWEN_API_KEY');
    return;
  }

  const dashscopeBase = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
  const apiUrl = `${dashscopeBase}/chat/completions`;
  const model = (process.env.CLASSIFY_MODEL || 'qwen-plus').trim() || 'qwen-plus';

  const systemPrompt = lang === 'en' ? DECOMPOSE_PROMPT_EN : lang === 'it' ? DECOMPOSE_PROMPT_IT : DECOMPOSE_PROMPT_ZH;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qwenApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: title.trim() },
        ],
        temperature: 0.7,
        max_tokens: 512,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      jsonError(res, response.status, `AI service error: ${response.statusText}`, errorText);
      return;
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content || '';
    const parsed = parseDecomposeResponse(rawContent);

    // Validate and clamp
    const steps = (parsed.steps ?? [])
      .filter((s: unknown) => s && typeof (s as any).title === 'string' && (s as any).title.trim())
      .slice(0, 6)
      .map((s: any) => ({
        title: String(s.title).trim(),
        durationMinutes: Math.min(90, Math.max(5, Number(s.durationMinutes) || 15)),
      }));

    res.status(200).json({ success: true, steps });
  } catch (error) {
    jsonError(res, 500, 'AI请求失败，请稍后重试', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
