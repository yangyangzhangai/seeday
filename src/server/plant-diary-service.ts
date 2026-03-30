// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
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

const FALLBACK_TEXT: Record<Lang, string> = {
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
  return [
    '为日常生活应用选择今日植物，并写一句把“用户今天状态”和“这株植物”联系起来的话。',
    '请只输出有效JSON，格式：{"plantId":"xxx","text":"一句话"}',
    '',
    `可选植物（必须从列表中选一个）：\n${plantList}`,
    '',
    '植物选择说明（以下是参考，不是硬规则，你需要自己判断）：',
    '• early（早期）常见于“播种/打基础”、“探索”或者“积累”的一天，或者对应平静的情绪，例如推进长期项目、学习新技能、努力多于即时回报',
    '• late（晚期）常见于“结果更可见”的一天，或者对应情绪激烈（比如充满成就感、高光、喜悦、悲伤、愤怒等）的一天，例如完成关键事项、投入后有明显落地感',
    '• 上述只作示例，你要有自己的判断；请根据今天活动结构、时长与重心自行判断更贴近 early 还是 late',
    '• 同一 stage 可能有多个植物编号；请结合植物在自然界的习性、外观气质与联想意义，选最能映射用户今天状态的一株',
    '',
    '文案要求：',
    '• 1-2句自然语言（20-60字），不必写成诗，语气真诚自然',
    '• 文案要明确体现“今天的用户状态”与“所选植物特性/意象”的对应关系',
    '• JSON字符串内不使用换行符',
    modeSection,
    '今天的数据：',
    `日期：${input.date}`,
    `根系特征：${rootDesc}`,
    `总时长：${input.totalDuration}分钟`,
    '活动记录：',
    activities,
  ].join('\n');
}

function buildPromptEn(input: PlantDiaryServiceInput, modeHint: string): string {
  const rootDesc = ROOT_TYPE_DESC[input.rootType].en;
  const activities = fmtActivities(input, 'en');
  const plantList = fmtPlantList(input.availablePlants, 'en');
  const modeSection = modeHint ? `Companion style: ${modeHint}\n` : '';
  return [
    'Choose today\'s plant and write one line that links the user\'s day with that plant.',
    'Respond with ONLY valid JSON: {"plantId":"xxx","text":"one line"}',
    '',
    `Available plants (choose exactly one):\n${plantList}`,
    '',
    'Selection guide (examples only, not rigid rules):',
    '• "early" often fits a day of seeding, groundwork, exploration, or accumulation, and can also match calmer emotions; e.g. advancing long-term work, learning new skills, and putting in effort before visible payoff',
    '• "late" often fits a day with more visible outcomes, or stronger emotional intensity (such as achievement, highlight moments, joy, sadness, or anger); e.g. finishing key tasks or feeling clear landing after deep effort',
    '• Treat the above as examples, not templates; make your own judgment from today\'s activity structure, duration, and focus',
    '• If multiple plant IDs exist in one stage, choose the one that best maps to the user\'s day by considering the plant\'s real-world traits, appearance, and symbolic associations',
    '',
    'Text rules:',
    '• 1-2 natural sentences (about 18-45 words), warm and grounded; it does not need to be a poem',
    '• Make the link explicit between the selected plant\'s traits/imagery and the user\'s day',
    '• No newline characters inside the JSON string value',
    modeSection,
    "Today's data:",
    `Date: ${input.date}`,
    `Root character: ${rootDesc}`,
    `Total duration: ${input.totalDuration} minutes`,
    'Activities:',
    activities,
  ].join('\n');
}

function buildPromptIt(input: PlantDiaryServiceInput, modeHint: string): string {
  const rootDesc = ROOT_TYPE_DESC[input.rootType].it;
  const activities = fmtActivities(input, 'it');
  const plantList = fmtPlantList(input.availablePlants, 'it');
  const modeSection = modeHint ? `Stile del compagno: ${modeHint}\n` : '';
  return [
    'Scegli la pianta del giorno e scrivi una frase che colleghi la giornata dell\'utente a quella pianta.',
    'Rispondi SOLO con JSON valido: {"plantId":"xxx","text":"frase"}',
    '',
    `Piante disponibili (scegliere esattamente una):\n${plantList}`,
    '',
    'Guida alla scelta (solo esempi, non regole rigide):',
    '• stadio "early" (iniziale): spesso adatto a giornate di semina, basi, esplorazione o accumulo, e può anche rispecchiare emozioni più calme; per esempio avanzare su progetti lunghi, imparare nuove abilità, investire energia prima di vedere risultati',
    '• stadio "late" (avanzato): spesso adatto a giornate con esiti più visibili, oppure con maggiore intensità emotiva (per esempio senso di conquista, momento di picco, gioia, tristezza o rabbia); ad esempio chiudere attività chiave o sentire che lo sforzo si è concretizzato',
    '• Questi punti sono solo riferimenti: valuta tu in autonomia in base alla struttura delle attività di oggi, alla durata e al focus',
    '• Se ci sono più piante nello stesso stadio, scegli quella che meglio rappresenta la giornata considerando tratti naturali, aspetto e associazioni simboliche della pianta',
    '',
    'Regole del testo:',
    '• 1-2 frasi naturali (circa 18-45 parole), tono caldo e concreto; non deve essere per forza poesia',
    '• Rendi esplicito il collegamento tra le caratteristiche/immaginario della pianta scelta e la giornata dell\'utente',
    '• Nessun carattere di nuova riga nella stringa JSON',
    modeSection,
    'Dati di oggi:',
    `Data: ${input.date}`,
    `Carattere delle radici: ${rootDesc}`,
    `Durata totale: ${input.totalDuration} minuti`,
    'Attività:',
    activities,
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

    return { text, chosenPlantId };
  } catch {
    const stripped = raw.replace(/^\s*\{[^}]*"text"\s*:\s*"/, '').replace(/"\s*\}.*$/s, '').trim();
    return { text: stripped || raw.slice(0, 120), chosenPlantId: fallbackPlantId };
  }
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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

    return parseAiResponse(raw, input.availablePlants);
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

  for (const timeoutMs of [5000, 3500]) {
    try {
      const { text, chosenPlantId } = await runRequest(input, timeoutMs);
      return { diaryText: text, chosenPlantId, diaryStatus: 'ready' };
    } catch {
      // next attempt
    }
  }

  return {
    diaryText: FALLBACK_TEXT[lang] ?? FALLBACK_TEXT.zh,
    chosenPlantId: fallbackPlantId,
    diaryStatus: 'fallback',
  };
}
