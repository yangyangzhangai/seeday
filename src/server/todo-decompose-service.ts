// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import OpenAI from 'openai';

type DecomposeLang = 'zh' | 'en' | 'it';

export interface TodoDecomposeStep {
  title: string;
  durationMinutes: number;
}

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

function resolvePrompt(lang: DecomposeLang): string {
  if (lang === 'en') return DECOMPOSE_PROMPT_EN;
  if (lang === 'it') return DECOMPOSE_PROMPT_IT;
  return DECOMPOSE_PROMPT_ZH;
}

function parseResponse(raw: string): { steps: TodoDecomposeStep[] } {
  try {
    return JSON.parse(raw.trim());
  } catch {
    // fallback below
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // fallback below
    }
  }
  return { steps: [] };
}

function normalizeSteps(steps: unknown): TodoDecomposeStep[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((item): item is { title: unknown; durationMinutes: unknown } => Boolean(item && typeof item === 'object'))
    .filter((item) => typeof item.title === 'string' && item.title.trim())
    .slice(0, 6)
    .map((item) => ({
      title: item.title.trim(),
      durationMinutes: Math.min(90, Math.max(5, Number(item.durationMinutes) || 15)),
    }));
}

export async function decomposeTodoWithAI(params: {
  title: string;
  lang: DecomposeLang;
  apiKey: string;
  model?: string;
  openai?: OpenAI;
}): Promise<TodoDecomposeStep[]> {
  const client = params.openai ?? new OpenAI({ apiKey: params.apiKey });
  const model = (params.model || process.env.TODO_DECOMPOSE_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: resolvePrompt(params.lang) },
      { role: 'user', content: params.title.trim() },
    ],
    temperature: 0.5,
    max_tokens: 512,
  });

  const rawContent = completion.choices?.[0]?.message?.content || '';
  const parsed = parseResponse(rawContent);
  return normalizeSteps(parsed.steps);
}
