// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/Seeday_植物生长_技术实现文档_v1.7.docx
import { buildAiCompanionModePrompt, normalizeAiCompanionLang, type AiCompanionMode } from '../lib/aiCompanion.js';
import { removeThinkingTags } from '../lib/aiParser.js';
import type { PlantEntry } from '../lib/plantRegistry.js';
import type { PlantCategoryKey, PlantDiaryRequest, RootType } from '../types/plant.js';

export interface PlantDiaryServiceInput extends PlantDiaryRequest {
  aiMode?: AiCompanionMode;
  userName?: string;
  /** 该根系下可供 AI 选择的植物列表 */
  availablePlants: PlantEntry[];
}

export interface PlantDiaryServiceResult {
  diaryText: string;
  /** AI 选择的 plantId；解析失败时为 availablePlants[0] */
  chosenPlantId: string;
  diaryStatus: 'ready' | 'fallback';
}

// ─── 本地化标签 ────────────────────────────────────────────────────────────────

type Lang = 'zh' | 'en' | 'it';

const CATEGORY_LABELS: Record<PlantCategoryKey, Record<Lang, string>> = {
  entertainment: { zh: '娱乐',      en: 'entertainment', it: 'intrattenimento' },
  social:        { zh: '社交',      en: 'social',        it: 'socialità'       },
  work_study:    { zh: '工作/学习', en: 'work & study',  it: 'lavoro e studio' },
  exercise:      { zh: '运动健身',  en: 'exercise',      it: 'attività fisica' },
  life:          { zh: '日常生活',  en: 'daily life',    it: 'vita quotidiana' },
};

const ROOT_TYPE_DESC: Record<RootType, Record<Lang, string>> = {
  tap: {
    zh: '今天专注于某一类活动，较为单线',
    en: 'focused on one main type of activity',
    it: 'concentrato su un\'attività principale',
  },
  fib: {
    zh: '今天活动均衡多样，多线并行',
    en: 'balanced across multiple activity types',
    it: 'equilibrato tra vari tipi di attività',
  },
  sha: {
    zh: '今天活动较少，节奏轻缓',
    en: 'light, restful day with few activities',
    it: 'giornata leggera con poche attività',
  },
  bra: {
    zh: '今天有主线活动，同时兼顾多个方向',
    en: 'one main activity with varied support',
    it: 'attività principale con supporto vario',
  },
  bul: {
    zh: '今天深度投入某类活动，时间长且专注',
    en: 'deeply immersed in one activity for a long time',
    it: 'profondamente immerso in un\'attività per molto tempo',
  },
};

export const FREE_FALLBACK_TEXT: Record<Lang, string> = {
  zh: '今天的植物悄悄记录了你的每一步，根在土里稳稳延伸。',
  en: 'Your plant quietly noted each step today. Roots held steady beneath the surface.',
  it: 'La tua pianta ha custodito ogni passo di oggi. Le radici hanno tenuto saldo il terreno.',
};

// ─── Prompt 构建（三语言完全独立）──────────────────────────────────────────────

function fmtActivities(input: PlantDiaryServiceInput, lang: Lang): string {
  const result = [...input.activities]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5)
    .map(a => `- ${CATEGORY_LABELS[a.category][lang]}: ${a.duration}min, focus=${a.focus}`)
    .join('\n');
  const empty = { zh: '- 无记录', en: '- none recorded', it: '- nessuna attività' };
  return result || empty[lang];
}

function fmtPlantList(plants: PlantEntry[], lang: Lang): string {
  return plants.map(p => {
    const name = lang === 'zh' ? p.nameCN : lang === 'it' ? p.nameIT : p.nameEN;
    const stageLabel =
      p.stage === 'late'
        ? (lang === 'zh' ? '晚期' : lang === 'it' ? 'avanzato' : 'late')
        : (lang === 'zh' ? '早期' : lang === 'it' ? 'iniziale' : 'early');
    return name ? `${p.id} (${name}, ${stageLabel})` : p.id;
  }).join('\n');
}

function buildPromptZh(input: PlantDiaryServiceInput, modeHint: string): string {
  const rootDesc = ROOT_TYPE_DESC[input.rootType].zh;
  const activities = fmtActivities(input, 'zh');
  const plantList = fmtPlantList(input.availablePlants, 'zh');
  const modeSection = modeHint ? `陪伴风格提示：${modeHint}\n` : '';
  const summary = [
    `日期：${input.date}`,
    `根系特征：${rootDesc}`,
    `总时长：${input.totalDuration}分钟`,
    '活动记录：',
    activities,
  ].join('\n');
  return [
    '你是一位博物学气质的诗人，熟悉植物的生长习性、外观形态与文化意象，擅长用植物作隐喻，写出让人心里一动的短句。',
    '',
    `今日状态摘要：\n${summary}`,
    `候选植物：\n${plantList}`,
    '',
    '请按以下顺序思考，只输出最终JSON，不输出思考过程：',
    '1. 从候选植物中选一株，说明选它的理由，理由必须基于这株植物的花语、外观形态、生长习性、生长环境之一。',
    '2. 找出“植物的这个特性”和“今天这个人最值得被看见的那一层”之间最准确的交叉点。这一层可以是某个细节、今天整体的节奏感、某种贯穿全天的状态，也可以是这个人一贯品质在今天的体现。选其中和这株植物最意外或最准确的那个交叉点，只说那一处。',
    '3. 用第二人称“你”落笔，20到60字，语气自然诗意。',
    '',
    '硬性规则：',
    '• plantId 必须来自候选植物列表，不得自造。',
    '• 文案必须包含至少一个植物可辨认特征，不能只写“美丽”“坚韧”这类泛称。',
    '• 文案不堆砌情绪词，要能让人看出说的是哪株植物、今天是怎样的一天。',
    '• 只输出JSON：{"plantId":"xxx","text":"xxx"}。',
    '• 不输出 markdown，不输出任何额外说明。',
    modeSection,
  ].join('\n');
}

function buildPromptEn(input: PlantDiaryServiceInput, modeHint: string): string {
  const rootDesc = ROOT_TYPE_DESC[input.rootType].en;
  const activities = fmtActivities(input, 'en');
  const plantList = fmtPlantList(input.availablePlants, 'en');
  const modeSection = modeHint ? `Companion style: ${modeHint}\n` : '';
  const summary = [
    `Date: ${input.date}`,
    `Root character: ${rootDesc}`,
    `Total duration: ${input.totalDuration} minutes`,
    'Activities:',
    activities,
  ].join('\n');
  return [
    'You are a naturalist poet. You understand plant growth habits, visible form, and cultural symbolism, and you write short lines that quietly move people.',
    '',
    `Today\'s state summary:\n${summary}`,
    `Candidate plants:\n${plantList}`,
    '',
    'Think in this order. Output final JSON only. Do not output your reasoning:',
    '1. Choose one plant from the candidate list. Your reason must be based on at least one of: floriography/symbolism, visible morphology, growth habit, or habitat.',
    '2. Find the most accurate intersection between that plant trait and the most worth-seeing layer of today\'s person: a specific detail, the day\'s overall rhythm, a state that ran through the whole day, or a long-term trait revealed today. Pick only one intersection, the most precise or unexpectedly fitting one.',
    '3. Write in second person ("you"), 20-60 words, natural and poetic.',
    '',
    'Hard rules:',
    '• plantId must come from the candidate list; do not invent IDs.',
    '• The line must include at least one recognizable plant feature, not only broad labels like "beautiful" or "resilient".',
    '• Avoid emotional word stacking; the reader should recognize both the plant and what kind of day it was.',
    '• Output JSON only: {"plantId":"xxx","text":"xxx"}.',
    '• No markdown. No extra explanation.',
    modeSection,
  ].join('\n');
}

function buildPromptIt(input: PlantDiaryServiceInput, modeHint: string): string {
  const rootDesc = ROOT_TYPE_DESC[input.rootType].it;
  const activities = fmtActivities(input, 'it');
  const plantList = fmtPlantList(input.availablePlants, 'it');
  const modeSection = modeHint ? `Stile del compagno: ${modeHint}\n` : '';
  const summary = [
    `Data: ${input.date}`,
    `Carattere delle radici: ${rootDesc}`,
    `Durata totale: ${input.totalDuration} minuti`,
    'Attivita:',
    activities,
  ].join('\n');
  return [
    'Sei un poeta con spirito da naturalista. Conosci abitudini di crescita, forma visibile e immaginario culturale delle piante, e sai usare la pianta come metafora in frasi brevi che toccano davvero.',
    '',
    `Sintesi dello stato di oggi:\n${summary}`,
    `Piante candidate:\n${plantList}`,
    '',
    'Pensa in questo ordine. Restituisci solo JSON finale, senza il ragionamento:',
    '1. Scegli una pianta dalla lista candidata. Il motivo deve basarsi su almeno uno tra: linguaggio dei fiori/simbolismo, morfologia visibile, abitudine di crescita o habitat.',
    '2. Trova il punto di incrocio più preciso tra quel tratto della pianta e lo strato più degno di essere visto nella persona di oggi: un dettaglio, il ritmo complessivo della giornata, uno stato trasversale, oppure una qualità abituale emersa oggi. Scegline uno solo, il più accurato o sorprendentemente adatto.',
    '3. Scrivi in seconda persona ("tu"), 20-60 parole, tono naturale e poetico.',
    '',
    'Regole vincolanti:',
    '• plantId deve provenire dalla lista candidata; non inventare ID.',
    '• Il testo deve includere almeno un tratto riconoscibile della pianta, non solo etichette generiche come "bella" o "resiliente".',
    '• Evita accumuli di parole emotive: deve essere chiaro sia quale pianta sia che tipo di giornata e stata.',
    '• Output solo JSON: {"plantId":"xxx","text":"xxx"}.',
    '• Nessun markdown. Nessuna spiegazione extra.',
    modeSection,
  ].join('\n');
}

const SYSTEM_PROMPTS: Record<Lang, string> = {
  zh: '你只输出有效JSON，不包含任何前言、解释或markdown格式。',
  en: 'You output only valid JSON. No preamble, no explanation, no markdown.',
  it: 'Rispondi solo con JSON valido. Nessuna premessa, spiegazione o markdown.',
};

function buildMessages(input: PlantDiaryServiceInput): Array<{ role: string; content: string }> {
  const lang = normalizeAiCompanionLang(input.lang);
  const modeHint = buildAiCompanionModePrompt(lang, input.aiMode, 'plant_diary');
  const userPrompt =
    lang === 'zh' ? buildPromptZh(input, modeHint) :
    lang === 'it' ? buildPromptIt(input, modeHint) :
                    buildPromptEn(input, modeHint);
  return [
    { role: 'system', content: SYSTEM_PROMPTS[lang] },
    { role: 'user',   content: userPrompt },
  ];
}

// ─── 响应解析 ──────────────────────────────────────────────────────────────────

function parseAiResponse(
  raw: string,
  availablePlants: PlantEntry[],
  lang: Lang,
): { text: string; chosenPlantId: string } {
  const fallbackPlantId = availablePlants[0]?.id ?? 'sha_early_0001';
  const validIds = availablePlants.map(p => p.id);
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(clean) as { plantId?: unknown; text?: unknown };

    const text = typeof parsed.text === 'string' && parsed.text.trim()
      ? parsed.text.trim() : '';
    if (!text) throw new Error('empty text');

    // Validate AI-chosen plantId is in the allowed list; default to first if not
    const rawPlantId = typeof parsed.plantId === 'string' ? parsed.plantId.trim() : '';
    const chosenPlantId = validIds.includes(rawPlantId) ? rawPlantId : fallbackPlantId;

    return { text: normalizePlantDiaryAddressee(text, lang), chosenPlantId };
  } catch {
    const stripped = raw.replace(/^\s*\{[^}]*"text"\s*:\s*"/, '').replace(/"\s*\}.*$/s, '').trim();
    return {
      text: normalizePlantDiaryAddressee(stripped || raw.slice(0, 120), lang),
      chosenPlantId: fallbackPlantId,
    };
  }
}

function containsGenericUserRefs(content: string, lang: Lang): boolean {
  if (lang === 'zh') return /(用户|\bta\b|对方)/i.test(content);
  if (lang === 'it') return /(the\s+user|my\s+host|\bl['’]?utente\b|\butente\b)/i.test(content);
  return /(\bthe\s+user\b|\bmy\s+host\b|\bthey\b|\bthem\b|\btheir\b)/i.test(content);
}

function forceAddresseeReplacement(content: string, lang: Lang): string {
  if (lang === 'zh') {
    return content
      .replace(/用户/g, '你')
      .replace(/对方/g, '你')
      .replace(/\bta\b/gi, '你');
  }
  if (lang === 'it') {
    return content
      .replace(/\bl['’]?utente\b/gi, 'tu')
      .replace(/\butente\b/gi, 'tu')
      .replace(/\bthe\s+user\b/gi, 'tu')
      .replace(/\bmy\s+host\b/gi, 'tu');
  }
  return content
    .replace(/\bthe\s+user\b/gi, 'you')
    .replace(/\bmy\s+host\b/gi, 'you')
    .replace(/\bthey\b/gi, 'you')
    .replace(/\bthem\b/gi, 'you')
    .replace(/\btheir\b/gi, 'your');
}

function normalizePlantDiaryAddressee(content: string, lang: Lang): string {
  if (!containsGenericUserRefs(content, lang)) return content;
  return forceAddresseeReplacement(content, lang);
}

// ─── API 调用 ──────────────────────────────────────────────────────────────────

async function runRequest(
  input: PlantDiaryServiceInput,
  timeoutMs: number,
): Promise<{ text: string; chosenPlantId: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const lang = normalizeAiCompanionLang(input.lang) as Lang;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: buildMessages(input),
        temperature: 0.80,
        max_tokens: 280,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);

    const payload = await response.json();
    const raw = removeThinkingTags(payload.choices?.[0]?.message?.content ?? '').trim();
    if (!raw) throw new Error('empty response');

    return parseAiResponse(raw, input.availablePlants, lang);
  } finally {
    clearTimeout(timer);
  }
}

// ─── 对外接口 ──────────────────────────────────────────────────────────────────

export async function generatePlantDiaryWithFallback(
  input: PlantDiaryServiceInput,
): Promise<PlantDiaryServiceResult> {
  const lang = normalizeAiCompanionLang(input.lang) as Lang;
  const fallbackPlantId = input.availablePlants[0]?.id ?? 'sha_early_0001';

  for (const timeoutMs of [6000, 4000]) {
    try {
      const { text, chosenPlantId } = await runRequest(input, timeoutMs);
      return { diaryText: text, chosenPlantId, diaryStatus: 'ready' };
    } catch {
      // next attempt
    }
  }

  return {
    diaryText: FREE_FALLBACK_TEXT[lang] ?? FREE_FALLBACK_TEXT.zh,
    chosenPlantId: fallbackPlantId,
    diaryStatus: 'fallback',
  };
}
