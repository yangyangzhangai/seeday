// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import OpenAI from 'openai';

type DecomposeLang = 'zh' | 'en' | 'it';

export interface TodoDecomposeStep {
  title: string;
  durationMinutes: number;
}

export interface TodoDecomposeResult {
  steps: TodoDecomposeStep[];
  parseStatus: 'ok' | 'parse_failed';
  model: string;
  provider: 'openai';
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
  const result = await decomposeTodoWithAIDiagnostics(params);
  return result.steps;
}

export async function decomposeTodoWithAIDiagnostics(params: {
  title: string;
  lang: DecomposeLang;
  apiKey: string;
  model?: string;
  openai?: OpenAI;
}): Promise<TodoDecomposeResult> {
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
  return {
    steps: normalizeSteps(parsed.steps),
    parseStatus: parsed.parseStatus,
    model,
    provider: 'openai',
  };
}
