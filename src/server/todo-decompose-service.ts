// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import { aiChatRequestOptions, resolveAiRoute } from './ai-routing.js';
import {
  getDeepSeekChatCompletionsUrl,
  resolveDeepSeekRuntime,
} from './deepseek-runtime.js';

type DecomposeLang = 'zh' | 'en' | 'it';

export interface TodoDecomposeStep {
  title: string;
  durationMinutes: number;
}

export interface TodoDecomposeResult {
  steps: TodoDecomposeStep[];
  parseStatus: 'ok' | 'parse_failed';
  model: string;
  provider: 'gemini' | 'deepseek';
}

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS = process.env.TODO_DECOMPOSE_VERBOSE_LOGS === 'true';

function previewText(raw: string, maxLen: number = 220): string {
  const compact = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '[empty]';
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen)}...`;
}

const DECOMPOSE_PROMPT_ZH = `你是一个“低摩擦任务拆解助手”。
你的唯一目标：把用户的待办拆成一组“立即可执行、操作非常具体、执行阻力很低”的小步骤。
将用户待办拆解为3到5个子步骤，并严格输出JSON。
不要输出任何解释、前缀、后缀或Markdown代码块，只输出JSON本身。

【核心原则】
- 每一步必须是“单一、具体动作”，用户读完就能立刻做
- 每一步必须写清动作对象或产出，禁止抽象表述（如“准备一下”“优化一下”）
- 每一步必须紧扣原待办目标，不能偏题，不能给泛化建议
- 优先降低启动门槛：先给最容易开始的动作，再逐步推进
- 建议时长要现实：优先5到20分钟，必要时可更长，总范围5到90分钟
- 如果某一步仍然偏大，继续拆小，直到“容易执行”

【输出前自检（不要输出）】
- 是否每一步都具体到可以直接照做
- 是否每一步都和原待办直接相关
- 是否避免了空泛词（如“思考一下”“推进项目”）

【输出格式】
{
  "steps": [
    { "title": "具体可执行的子步骤", "durationMinutes": 数字 },
    ...
  ]
}`;

const DECOMPOSE_PROMPT_EN = `You are a low-friction task breakdown assistant.
Your only goal is to turn the user's todo into a sequence of tiny steps that are immediately actionable, highly specific, and easy to execute.
Break the todo into 3 to 5 sub-steps and output strict JSON.
Do NOT output explanations, prefixes, suffixes, or Markdown code blocks. Output JSON only.

[Core Principles]
- Each step must be one concrete action that the user can do right away
- Each step must include a clear object or deliverable (verb + object), never abstract wording
- Every step must stay tightly aligned with the original todo; no generic advice
- Reduce startup friction: start with the easiest action, then move forward
- Duration must be realistic: prefer 5-20 minutes, allow longer only when necessary, always within 5-90 minutes
- If a step is still too big, split it further until it feels easy to execute

[Self-check Before Output (do not output this section)]
- Is each step concrete enough to follow directly?
- Is each step directly relevant to the original todo?
- Did you avoid vague steps like "prepare", "think about", or "optimize"?

[Output Format]
{
  "steps": [
    { "title": "specific actionable sub-step", "durationMinutes": number },
    ...
  ]
}`;

const DECOMPOSE_PROMPT_IT = `Sei un assistente di scomposizione task a basso attrito.
Il tuo unico obiettivo e trasformare il todo dell'utente in una sequenza di micro-passi immediatamente eseguibili, molto specifici e facili da portare a termine.
Scomponi il todo in 3-5 sotto-passi e restituisci JSON rigoroso.
NON produrre spiegazioni, prefissi, suffissi o blocchi Markdown. Solo JSON.

[Principi chiave]
- Ogni passo deve essere una singola azione concreta, eseguibile subito
- Ogni passo deve includere oggetto o risultato chiaro (verbo + oggetto), mai formulazioni astratte
- Ogni passo deve restare strettamente legato al todo originale; niente consigli generici
- Riduci l'attrito iniziale: inizia dall'azione piu facile, poi procedi
- Durata realistica: preferisci 5-20 minuti, piu lunga solo se necessario, sempre tra 5 e 90 minuti
- Se un passo e ancora troppo grande, scomponilo ulteriormente finche diventa facile da eseguire

[Autoverifica prima dell'output (non stampare questa sezione)]
- Ogni passo e abbastanza concreto da poter essere seguito subito?
- Ogni passo e direttamente pertinente al todo originale?
- Hai evitato passi vaghi come "preparare", "riflettere", "ottimizzare"?

[Formato Output]
{
  "steps": [
    { "title": "sotto-passo specifico e azionabile", "durationMinutes": numero },
    ...
  ]
}`;

function resolvePrompt(lang: DecomposeLang): string {
  if (lang === 'en') return DECOMPOSE_PROMPT_EN;
  if (lang === 'it') return DECOMPOSE_PROMPT_IT;
  return DECOMPOSE_PROMPT_ZH;
}

function parseResponse(raw: string): { steps: TodoDecomposeStep[]; parseStatus: 'ok' | 'parse_failed' } {
  try {
    const parsed = JSON.parse(raw.trim());
    return { steps: parsed.steps, parseStatus: 'ok' };
  } catch {
    // fallback below
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return { steps: parsed.steps, parseStatus: 'ok' };
    } catch {
      // fallback below
    }
  }
  return { steps: [], parseStatus: 'parse_failed' };
}

function normalizeSteps(steps: unknown): TodoDecomposeStep[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((item): item is { title: unknown; durationMinutes: unknown } => Boolean(item && typeof item === 'object'))
    .filter(
      (item): item is { title: string; durationMinutes: unknown } =>
        typeof item.title === 'string' && item.title.trim().length > 0,
    )
    .slice(0, 5)
    .map((item) => ({
      title: item.title.trim(),
      durationMinutes: Math.min(90, Math.max(5, Number(item.durationMinutes) || 15)),
    }));
}

function resolveDecomposeModel(lang: DecomposeLang, model?: string): string {
  if (typeof model === 'string' && model.trim()) return model.trim();
  return resolveAiRoute('todo_decompose', lang).model;
}

type TodoDecomposeParams = {
  title: string;
  lang: DecomposeLang;
  model?: string;
  geminiApiKey?: string;
};

function logDeepSeekError(model: string, response: Response, errorText: string): void {
  if (!ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) return;
  console.error('[Todo Decompose] provider.deepseek.error', {
    model,
    status: response.status,
    statusText: response.statusText,
    responsePreview: previewText(errorText),
    responseRaw: errorText,
  });
}

async function requestDeepSeekDecomposition(params: TodoDecomposeParams, model: string): Promise<string> {
  const runtime = resolveDeepSeekRuntime({ model });
  if (!runtime.apiKey) throw new Error('Server configuration error: Missing DEEPSEEK_API_KEY for todo decompose');
  const response = await fetch(getDeepSeekChatCompletionsUrl(runtime.baseURL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${runtime.apiKey}` },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        { role: 'system', content: resolvePrompt(params.lang) },
        { role: 'user', content: params.title.trim() },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 768,
      ...aiChatRequestOptions('deepseek'),
      stream: false,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    logDeepSeekError(runtime.model, response, errorText);
    throw new Error(`DeepSeek todo decompose failed: ${response.status} ${errorText}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content || '';
}

function normalizeGeminiModel(model: string): string {
  const normalized = model.trim().replace(/^models\//, '');
  if (normalized === 'gemini2.0-flash') return 'gemini-2.0-flash';
  if (normalized === 'gemini2.5-flash') return 'gemini-2.5-flash';
  return normalized || DEFAULT_GEMINI_MODEL;
}

function isGeminiModelMissing(status: number, details: string): boolean {
  const normalized = details.toLowerCase();
  return status === 404 && (
    normalized.includes('not_found')
    || normalized.includes('not found')
    || normalized.includes('no longer available')
  );
}

async function requestGeminiOnce(
  params: TodoDecomposeParams,
  baseURL: string,
  apiKey: string,
  model: string,
): Promise<Response> {
  const url = `${baseURL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: resolvePrompt(params.lang) }] },
      contents: [{ role: 'user', parts: [{ text: params.title.trim() }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
}

function logGeminiError(model: string, response: Response, details: string): void {
  if (!ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) return;
  console.error('[Todo Decompose] provider.gemini.error', {
    model,
    status: response.status,
    statusText: response.statusText,
    responsePreview: previewText(details),
    responseRaw: details,
  });
}

async function requestGeminiDecomposition(
  params: TodoDecomposeParams,
  model: string,
): Promise<{ rawContent: string; model: string }> {
  const apiKey = (params.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('Server configuration error: Missing GEMINI_API_KEY for todo decompose');
  const baseURL = (
    process.env.TODO_DECOMPOSE_GEMINI_BASE_URL
    || process.env.GEMINI_BASE_URL
    || DEFAULT_GEMINI_BASE_URL
  ).replace(/\/+$/, '');
  let modelUsed = normalizeGeminiModel(model);
  let response = await requestGeminiOnce(params, baseURL, apiKey, modelUsed);
  if (!response.ok) {
    const details = await response.text();
    const fallback = normalizeGeminiModel(
      process.env.TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_MODEL,
    );
    if (modelUsed !== fallback && isGeminiModelMissing(response.status, details)) {
      modelUsed = fallback;
      response = await requestGeminiOnce(params, baseURL, apiKey, modelUsed);
    } else {
      logGeminiError(modelUsed, response, details);
      throw new Error(`Gemini todo decompose failed: ${response.status} ${details}`);
    }
  }
  if (!response.ok) {
    const details = await response.text();
    logGeminiError(modelUsed, response, details);
    throw new Error(`Gemini todo decompose failed: ${response.status} ${details}`);
  }
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawContent = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  return { rawContent, model: modelUsed };
}

export async function decomposeTodoWithAI(params: TodoDecomposeParams): Promise<TodoDecomposeStep[]> {
  return (await decomposeTodoWithAIDiagnostics(params)).steps;
}

export async function decomposeTodoWithAIDiagnostics(params: TodoDecomposeParams): Promise<TodoDecomposeResult> {
  const model = resolveDecomposeModel(params.lang, params.model);
  const provider = resolveAiRoute('todo_decompose', params.lang).provider === 'gemini' ? 'gemini' : 'deepseek';
  const result = provider === 'deepseek'
    ? { rawContent: await requestDeepSeekDecomposition(params, model), model }
    : await requestGeminiDecomposition(params, model);
  const rawContent = result.rawContent;
  const parsed = parseResponse(rawContent);
  return {
    steps: normalizeSteps(parsed.steps),
    parseStatus: parsed.parseStatus,
    model: result.model,
    provider,
  };
}
