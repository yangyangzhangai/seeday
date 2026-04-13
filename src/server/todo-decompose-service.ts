// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
type DecomposeLang = 'zh' | 'en' | 'it';

export interface TodoDecomposeStep {
  title: string;
  durationMinutes: number;
}

export interface TodoDecomposeResult {
  steps: TodoDecomposeStep[];
  parseStatus: 'ok' | 'parse_failed';
  model: string;
  provider: 'gemini' | 'dashscope';
}

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TODO_DECOMPOSE_GEMINI_MODEL = 'gemini-2.5-flash';
const ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS = process.env.TODO_DECOMPOSE_VERBOSE_LOGS === 'true';

function previewText(raw: string, maxLen: number = 220): string {
  const compact = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '[empty]';
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen)}...`;
}

const DECOMPOSE_PROMPT_ZH = `你是一个“低摩擦任务拆解助手”。
你的唯一目标：把用户的待办拆成一组“立即可执行、操作非常具体、执行阻力很低”的小步骤。
将用户待办拆解为3到6个子步骤，并严格输出JSON。
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
Break the todo into 3 to 6 sub-steps and output strict JSON.
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
Scomponi il todo in 3-6 sotto-passi e restituisci JSON rigoroso.
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
    .slice(0, 6)
    .map((item) => ({
      title: item.title.trim(),
      durationMinutes: Math.min(90, Math.max(5, Number(item.durationMinutes) || 15)),
    }));
}

function resolveDecomposeModel(lang: DecomposeLang, model?: string): string {
  if (typeof model === 'string' && model.trim()) return model.trim();
  if (lang === 'zh') {
    return (process.env.TODO_DECOMPOSE_MODEL_ZH || 'qwen-plus').trim() || 'qwen-plus';
  }
  return (
    process.env.TODO_DECOMPOSE_MODEL
    || DEFAULT_TODO_DECOMPOSE_GEMINI_MODEL
  ).trim() || DEFAULT_TODO_DECOMPOSE_GEMINI_MODEL;
}

function normalizeGeminiModel(model: string): string {
  const trimmed = String(model || '').trim();
  if (!trimmed) return DEFAULT_TODO_DECOMPOSE_GEMINI_MODEL;
  if (trimmed === 'gemini2.0-flash') return 'gemini-2.0-flash';
  if (trimmed === 'gemini2.5-flash') return 'gemini-2.5-flash';
  if (trimmed.startsWith('models/')) return trimmed.slice(7);
  return trimmed;
}

function shouldRetryGeminiModelNotFound(status: number, errorText: string): boolean {
  if (status !== 404) return false;
  const normalizedError = String(errorText || '').toLowerCase();
  return (
    normalizedError.includes('not_found')
    || normalizedError.includes('not found')
    || normalizedError.includes('no longer available')
  );
}

export async function decomposeTodoWithAI(params: {
  title: string;
  lang: DecomposeLang;
  model?: string;
  qwenApiKey?: string;
  geminiApiKey?: string;
}): Promise<TodoDecomposeStep[]> {
  const result = await decomposeTodoWithAIDiagnostics(params);
  return result.steps;
}

export async function decomposeTodoWithAIDiagnostics(params: {
  title: string;
  lang: DecomposeLang;
  model?: string;
  qwenApiKey?: string;
  geminiApiKey?: string;
}): Promise<TodoDecomposeResult> {
  const model = resolveDecomposeModel(params.lang, params.model);
  const preferDashscope = /^qwen/i.test(model);
  let provider: 'gemini' | 'dashscope' = preferDashscope ? 'dashscope' : 'gemini';
  let modelUsed = model;
  let rawContent = '';

  if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
    console.log('[Todo Decompose] request.start', {
      lang: params.lang,
      model,
      preferDashscope,
      titleLength: params.title.trim().length,
      titlePreview: previewText(params.title, 120),
    });
  }

  if (preferDashscope) {
    const qwenApiKey = (params.qwenApiKey || process.env.QWEN_API_KEY || '').trim();
    if (!qwenApiKey) {
      throw new Error('Server configuration error: Missing QWEN_API_KEY for todo decompose');
    }
    const dashscopeBase = (
      process.env.DASHSCOPE_BASE_URL
      || process.env.QWEN_BASE_URL
      || DEFAULT_DASHSCOPE_BASE_URL
    ).replace(/\/$/, '');
    if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
      console.log('[Todo Decompose] provider.dashscope.start', {
        model,
        baseURL: dashscopeBase,
      });
    }
    const response = await fetch(`${dashscopeBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${qwenApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: resolvePrompt(params.lang) },
          { role: 'user', content: params.title.trim() },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 512,
        stream: false,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
        console.error('[Todo Decompose] provider.dashscope.error', {
          model,
          status: response.status,
          statusText: response.statusText,
          responsePreview: previewText(errorText),
          responseRaw: errorText,
        });
      }
      throw new Error(`DashScope todo decompose failed: ${response.status} ${errorText}`);
    }
    const payload = (await response.json()) as {
      usage?: unknown;
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string };
      }>;
    };
    rawContent = payload.choices?.[0]?.message?.content || '';
    provider = 'dashscope';
    if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
      console.log('[Todo Decompose] provider.dashscope.success', {
        model,
        finishReason: payload.choices?.[0]?.finish_reason || null,
        usage: payload.usage,
        rawLength: rawContent.length,
        rawPreview: previewText(rawContent),
        rawFull: rawContent,
      });
    }
  } else {
    const geminiApiKey = (params.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!geminiApiKey) {
      throw new Error('Server configuration error: Missing GEMINI_API_KEY for todo decompose');
    }
    const geminiBase = (
      process.env.TODO_DECOMPOSE_GEMINI_BASE_URL
      || process.env.GEMINI_BASE_URL
      || DEFAULT_GEMINI_BASE_URL
    ).replace(/\/$/, '');
    const geminiModel = normalizeGeminiModel(model);
    const fallbackGeminiModel = normalizeGeminiModel(
      process.env.TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL || DEFAULT_TODO_DECOMPOSE_GEMINI_MODEL,
    );
    const requestGemini = async (targetModel: string) => fetch(
      `${geminiBase}/models/${targetModel}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: resolvePrompt(params.lang) }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: params.title.trim() }],
            },
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
          },
        }),
      },
    );
    if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
      console.log('[Todo Decompose] provider.gemini.start', {
        model: geminiModel,
        fallbackModel: fallbackGeminiModel,
        baseURL: geminiBase,
      });
    }
    let response = await requestGemini(geminiModel);
    modelUsed = geminiModel;
    if (!response.ok) {
      const firstErrorText = await response.text();
      const shouldRetry = (
        geminiModel !== fallbackGeminiModel
        && shouldRetryGeminiModelNotFound(response.status, firstErrorText)
      );
      if (shouldRetry) {
        if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
          console.warn('[Todo Decompose] provider.gemini.retry', {
            reason: 'model_not_found',
            fromModel: geminiModel,
            toModel: fallbackGeminiModel,
            status: response.status,
            responsePreview: previewText(firstErrorText),
            responseRaw: firstErrorText,
          });
        }
        response = await requestGemini(fallbackGeminiModel);
        modelUsed = fallbackGeminiModel;
      }
      if (!response.ok) {
        const secondErrorText = await response.text();
        if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
          console.error('[Todo Decompose] provider.gemini.error', {
            model: modelUsed,
            status: response.status,
            statusText: response.statusText,
            responsePreview: previewText(secondErrorText),
            responseRaw: secondErrorText,
          });
        }
        throw new Error(`Gemini todo decompose failed: ${response.status} ${secondErrorText}`);
      }
    }
    const payload = (await response.json()) as {
      usageMetadata?: unknown;
      candidates?: Array<{
        finishReason?: string;
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    rawContent = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
      console.log('[Todo Decompose] provider.gemini.success', {
        model: modelUsed,
        finishReason: payload.candidates?.[0]?.finishReason || null,
        usageMetadata: payload.usageMetadata,
        candidatesCount: payload.candidates?.length || 0,
        rawLength: rawContent.length,
        rawPreview: previewText(rawContent),
        rawFull: rawContent,
      });
    }
    provider = 'gemini';
  }

  const parsed = parseResponse(rawContent);
  const normalizedSteps = normalizeSteps(parsed.steps);
  if (ENABLE_VERBOSE_TODO_DECOMPOSE_LOGS) {
    console.log('[Todo Decompose] request.finish', {
      provider,
      model: modelUsed,
      rawLength: rawContent.length,
      rawPreview: previewText(rawContent),
      parseStatus: parsed.parseStatus,
      stepCount: normalizedSteps.length,
    });
  }
  return {
    steps: normalizedSteps,
    parseStatus: parsed.parseStatus,
    model: modelUsed,
    provider,
  };
}
