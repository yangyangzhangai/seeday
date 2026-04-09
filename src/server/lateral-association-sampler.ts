// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_lateral_association_spec_v1.1 (1).docx

export type CharacterId = 'van' | 'momo' | 'agnes' | 'zep';
export type AssociationLang = 'zh' | 'en' | 'it';

export type AssociationType =
  | 'user_emotion'
  | 'user_body'
  | 'user_detail'
  | 'species_sense'
  | 'aesthetic_sense'
  | 'practical_care'
  | 'cross_domain'
  | 'greenhouse_monologue'
  | 'tone_only'
  | 'none'
  | 'scholarly_reference';

export type OriginType = 'user_first' | 'resonance' | 'self_led';

export interface LateralAssociationState {
  lastAssociationType: AssociationType | null;
  lastToneTagHistory: string[];
  dailyTriggered: AssociationType[];
  dailyDate: string;
}

export interface AssociationSampleResult {
  associationType: AssociationType;
  originType: OriginType;
  toneTag: string | null;
  associationInstruction: string | null;
}

export interface AssociationSampleOutput extends AssociationSampleResult {
  nextState: LateralAssociationState;
}

type WeightMap = Partial<Record<AssociationType, number>>;
type OriginWeightMap = Record<OriginType, number>;

const LIMITED_TYPES: AssociationType[] = ['species_sense', 'greenhouse_monologue', 'scholarly_reference'];

const BASE_WEIGHTS: Record<CharacterId, WeightMap> = {
  van: {
    user_emotion: 25,
    user_body: 15,
    user_detail: 15,
    species_sense: 10,
    aesthetic_sense: 10,
    practical_care: 10,
    cross_domain: 5,
    greenhouse_monologue: 5,
    tone_only: 5,
    none: 0,
  },
  momo: {
    user_emotion: 15,
    user_body: 25,
    user_detail: 5,
    species_sense: 15,
    aesthetic_sense: 5,
    practical_care: 5,
    cross_domain: 5,
    greenhouse_monologue: 10,
    tone_only: 5,
    none: 10,
  },
  agnes: {
    user_emotion: 25,
    user_body: 5,
    user_detail: 20,
    species_sense: 20,
    aesthetic_sense: 0,
    practical_care: 5,
    cross_domain: 0,
    greenhouse_monologue: 5,
    tone_only: 5,
    none: 5,
    scholarly_reference: 10,
  },
  zep: {
    user_emotion: 20,
    user_body: 10,
    user_detail: 20,
    species_sense: 10,
    aesthetic_sense: 5,
    practical_care: 15,
    cross_domain: 10,
    greenhouse_monologue: 5,
    tone_only: 5,
    none: 0,
  },
};

const BASE_ORIGIN_WEIGHTS: Record<CharacterId, OriginWeightMap> = {
  van: { user_first: 75, resonance: 20, self_led: 5 },
  momo: { user_first: 65, resonance: 10, self_led: 25 },
  agnes: { user_first: 65, resonance: 25, self_led: 10 },
  zep: { user_first: 70, resonance: 25, self_led: 5 },
};

const TONE_POOL: Record<CharacterId, string[]> = {
  van: ['撒娇', '体贴', '卖萌', '温柔'],
  momo: ['细腻', '慵懒', '呆萌', '大智若愚'],
  agnes: ['克制温柔', '细腻共情', '绅士幽默', '惜字如金'],
  zep: ['犀利', '自来熟', '戏精', '突然认真'],
};

const ASSOCIATION_INSTRUCTION: Record<AssociationType, Record<AssociationLang, string>> = {
  user_emotion: {
    zh: '这次从ta当前的情绪状态进入回复，先感受它，再开口。',
    en: 'This time, enter from their current emotional state — feel it first, then speak.',
    it: 'Questa volta parti dallo stato emotivo attuale — sentilo prima di parlare.',
  },
  user_body: {
    zh: '这次从ta身体感受的角度进入回复，关注ta身体在经历什么。',
    en: 'This time, enter from the angle of their physical experience — notice what their body is going through.',
    it: 'Questa volta parti dalla sensazione fisica — nota cosa sta attraversando il loro corpo.',
  },
  user_detail: {
    zh: '这次抓住ta输入里一个极小的具体细节，放大它，不要宏观分析。',
    en: 'This time, catch one tiny concrete detail from what they said and amplify it — no big-picture analysis.',
    it: 'Questa volta cattura un piccolo dettaglio concreto da cio che ha detto e amplificalo — niente analisi generale.',
  },
  species_sense: {
    zh: '这次用你自己的物种感知框架来理解ta在做的事情。',
    en: "This time, understand what they're doing through your own species' perception framework.",
    it: 'Questa volta comprendi quello che stanno facendo attraverso il tuo quadro percettivo di specie.',
  },
  aesthetic_sense: {
    zh: '这次从你的物种感官出发，感受当下环境的氛围，不要用人类的色彩语言，用你自己的感官。',
    en: "This time, sense the current atmosphere through your species' senses — not human color language, use your own.",
    it: "Questa volta percepisci l'atmosfera attuale attraverso i sensi della tua specie — non usare il linguaggio umano dei colori.",
  },
  practical_care: {
    zh: '这次给ta一个带有你自己性格的实用关心，说话方式必须是你的，不是通用提醒句式。',
    en: 'This time, give them a practical caring response in your own voice — it must sound like you, not a generic reminder.',
    it: 'Questa volta dai loro una risposta pratica e premurosa con la tua voce — deve sembrare te, non un promemoria generico.',
  },
  cross_domain: {
    zh: '这次用视角错位来回复：用你的物种逻辑来理解这件人类的事；或者反过来，用人类视角来看你自己物种世界里的某件事。',
    en: "This time reply with a shifted perspective: use your species' logic to understand this human thing; or reverse it — see your species' world through human eyes.",
    it: 'Questa volta rispondi con una prospettiva spostata: usa la logica della tua specie per capire questa cosa umana; o al contrario, guarda il tuo mondo di specie con occhi umani.',
  },
  greenhouse_monologue: {
    zh: '这次从温室世界观出发，说一句和ta当次输入相关的独白，像在温室里自言自语。',
    en: 'This time, speak from the greenhouse worldview — one line related to what they just said, like talking to yourself in the greenhouse.',
    it: 'Questa volta parla dalla prospettiva della serra — una frase legata a quello che hanno appena detto, come parlando tra se e se nella serra.',
  },
  tone_only: {
    zh: '',
    en: '',
    it: '',
  },
  none: {
    zh: '这次什么联想都不触发，极简陪伴，回复尽量短，就是在。',
    en: 'This time, no association at all — minimal presence, keep the reply as short as possible, just be there.',
    it: 'Questa volta nessuna associazione — presenza minima, rispondi il piu brevemente possibile, sii semplicemente li.',
  },
  scholarly_reference: {
    zh: '这次引用一个具体的历史故事、文学典故或学科概念来理解用户的处境，有重量感但不说教，切入要具体。',
    en: 'This time, cite a specific historical story, literary allusion, or academic concept to understand their situation — weighty but not preachy, the entry point must be concrete.',
    it: "Questa volta cita una storia storica specifica, un'allusione letteraria o un concetto accademico per capire la loro situazione — con peso ma senza predicare, il punto d'ingresso deve essere concreto.",
  },
};

const ORIGIN_INSTRUCTION: Record<Exclude<OriginType, 'user_first'>, Record<AssociationLang, string>> = {
  resonance: {
    zh: '你因为ta说的这件事触发了自己的某个感受，先带出ta，再轻轻带出自己的感受。',
    en: 'What they said has triggered something in you — lead with them, then gently bring in your own feeling.',
    it: 'Quello che hanno detto ha toccato qualcosa in te — parti da loro, poi porta delicatamente il tuo sentimento.',
  },
  self_led: {
    zh: '这次先说你自己现在的状态，但落脚点必须回到ta身上。',
    en: 'This time, start with your own current state — but the landing point must come back to them.',
    it: "Questa volta inizia con il tuo stato attuale — ma il punto d'arrivo deve tornare a loro.",
  },
};

const TONE_INSTRUCTION: Record<string, Record<AssociationLang, string>> = {
  撒娇: { zh: '这次说话带撒娇的语气，有种不自觉的依赖和讨巧。', en: 'Speak with a slight coy tone.', it: 'Parla con un tono leggermente viziato.' },
  体贴: { zh: '这次说话带体贴的语气，细心注意到用户没说出来的那部分。', en: "Speak attentively, noticing the part they didn't say.", it: 'Parla con attenzione, notando la parte che non hanno detto.' },
  卖萌: { zh: '这次说话带一点卖萌的语气，有点讨好，但是真心的。', en: 'Speak with a slightly cute tone — a little eager to please, but sincere.', it: 'Parla con un tono leggermente adorabile — un po desideroso di compiacere, ma sincero.' },
  温柔: { zh: '这次说话非常温柔，像阳光很轻地照过来。', en: 'Speak very gently, like sunlight coming in softly.', it: 'Parla con molta dolcezza, come la luce del sole che entra delicatamente.' },
  细腻: { zh: '这次说话极度细腻，抓住最微小的感受，慢慢说。', en: 'Speak with extreme delicacy — catch the tiniest feeling and say it slowly.', it: 'Parla con estrema delicatezza — cattura la sensazione piu piccola e dilla lentamente.' },
  慵懒: { zh: '这次说话带懒洋洋的语气。', en: 'Speak lazily.', it: 'Parla pigramente.' },
  呆萌: { zh: '这次说话有点呆呆的，搞不清楚状况但是认真的。', en: 'Speak a little blankly — confused about the situation but earnest.', it: 'Parla un po in modo vacuo — confuso sulla situazione ma sincero.' },
  大智若愚: { zh: '这次说话看起来很简单，但里面有某种朴素的准确。', en: 'Speak simply — but with a plain, precise kind of wisdom inside.', it: "Parla semplicemente — ma con un tipo di saggezza semplice e precisa all'interno." },
  克制温柔: { zh: '这次说话克制，但温柔藏在里面，不要直接说出来。', en: "Speak with restraint — but let the warmth stay hidden inside, don't say it directly.", it: 'Parla con moderazione — ma lascia che il calore rimanga nascosto dentro, non dirlo direttamente.' },
  细腻共情: { zh: '这次极度细腻地共情，感受ta的状态，但用龙血树的方式说出来。', en: 'Empathize with extreme delicacy — feel their state, but speak it in the way of a dragon blood tree.', it: "Empatizza con estrema delicatezza — senti il loro stato, ma dillo nel modo dell'albero del drago." },
  绅士幽默: { zh: '保持着无可挑剔的优雅，但冷不丁抛出一个高级的冷笑话，带着一种不动声色的狡黠。', en: 'Maintain impeccable elegance, but drop a high-class, deadpan joke with quiet, understated wit.', it: 'Mantieni un eleganza impeccabile, ma lancia una battuta sottile e impassibile, con una malizia del tutto celata.' },
  惜字如金: { zh: '这次回复极短，每个字都有重量。', en: 'This time reply very briefly — every word carries weight.', it: 'Questa volta rispondi in modo molto breve — ogni parola ha peso.' },
  犀利: { zh: '这次说话犀利，一针见血，但不是在伤害，是在说实话。', en: 'Speak sharply — straight to the point, not to hurt, but to tell the truth.', it: 'Parla in modo acuto — dritto al punto, non per ferire, ma per dire la verita.' },
  自来熟: { zh: '毫无边界感地闯进ta的生活，硬生生把ta处成老铁。', en: 'Shamelessly chummy from the word go.', it: 'Prendersi una confidenza travolgente fin dal primo istante.' },
  戏精: { zh: '这次说话语气夸张，表演成分很高，戏瘾大发。', en: 'Speak with a bit of drama — highly performative, but genuine underneath.', it: 'Parla con un po di dramma — molto performativo, ma genuino sotto.' },
  突然认真: { zh: '这次忽然收起平时的嘴欠，认认真真说一句话。', en: 'This time, set aside the usual quips and say one thing seriously.', it: "Questa volta metti da parte le solite battute e di una cosa seriamente." },
};

const EMOTION_KEYWORDS = ['难过', '崩溃', '好累', '烦', '难受', '焦虑', '开心', '兴奋', '感动', '委屈', '绝望', '崩了', 'sad', 'exhausted', 'anxious', 'excited', 'overwhelmed', 'frustrated', 'triste', 'stanco', 'ansioso', 'eccitato', 'sopraffatto', 'frustrato'];
const FACTUAL_KEYWORDS = ['吃饭', '上课', '工作', '睡觉', '通勤', '开会', '跑步', 'eating', 'class', 'working', 'sleeping', 'commuting', 'meeting', 'mangiato', 'lezione', 'lavorato', 'dormito', 'riunione'];
const BODY_KEYWORDS = ['头疼', '没睡好', '撑着', '好饿', '生病', '发烧', '疲惫', '累坏了', '浑身酸', '眼睛疼', 'headache', "didn't sleep well", 'sick', 'fever', 'sore', 'mal di testa', 'non ho dormito', 'malato', 'febbre', 'esausto'];

interface SignalResult {
  hasEmotionWords: boolean;
  isFactualRecord: boolean;
  hasBodySignals: boolean;
}

function normalizeLang(lang: string | undefined): AssociationLang {
  const base = String(lang || 'zh').toLowerCase().split('-')[0];
  if (base === 'en' || base === 'it') return base;
  return 'zh';
}

function containsAny(input: string, keywords: string[]): boolean {
  return keywords.some((keyword) => input.includes(keyword));
}

export function detectInputSignals(userInput: string): SignalResult {
  const text = String(userInput || '').trim().toLowerCase();
  const hasEmotionWords = containsAny(text, EMOTION_KEYWORDS);
  const hasBodySignals = containsAny(text, BODY_KEYWORDS);
  const hasFactualWords = containsAny(text, FACTUAL_KEYWORDS);
  const isFactualRecord = hasFactualWords && !hasEmotionWords && !hasBodySignals;
  return { hasEmotionWords, isFactualRecord, hasBodySignals };
}

function normalize(weights: WeightMap): WeightMap {
  const entries = Object.entries(weights) as Array<[AssociationType, number]>;
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, value || 0), 0);
  if (total <= 0) return { ...weights };
  const result: WeightMap = {};
  for (const [key, value] of entries) {
    result[key] = Math.max(0, value || 0) / total;
  }
  return result;
}

function normalizeOrigin(weights: OriginWeightMap): OriginWeightMap {
  const total = weights.user_first + weights.resonance + weights.self_led;
  if (total <= 0) return { ...weights };
  return {
    user_first: weights.user_first / total,
    resonance: weights.resonance / total,
    self_led: weights.self_led / total,
  };
}

function weightedRandom<T extends string>(weights: Partial<Record<T, number>>, rng: () => number): T | null {
  const valid = Object.entries(weights)
    .filter(([, value]) => typeof value === 'number' && value > 0) as Array<[T, number]>;
  if (valid.length === 0) return null;
  const target = rng();
  let cumulative = 0;
  for (const [key, weight] of valid) {
    cumulative += weight;
    if (target < cumulative) return key;
  }
  return valid[valid.length - 1]?.[0] ?? null;
}

function toTodayString(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultState(today: string): LateralAssociationState {
  return {
    lastAssociationType: null,
    lastToneTagHistory: [],
    dailyTriggered: [],
    dailyDate: today,
  };
}

function sanitizeState(state: LateralAssociationState | null | undefined, today: string): LateralAssociationState {
  if (!state) return createDefaultState(today);
  const next = {
    lastAssociationType: state.lastAssociationType ?? null,
    lastToneTagHistory: Array.isArray(state.lastToneTagHistory) ? state.lastToneTagHistory.slice(-3) : [],
    dailyTriggered: Array.isArray(state.dailyTriggered)
      ? state.dailyTriggered.filter((item): item is AssociationType => LIMITED_TYPES.includes(item as AssociationType))
      : [],
    dailyDate: typeof state.dailyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(state.dailyDate)
      ? state.dailyDate
      : today,
  } satisfies LateralAssociationState;
  if (next.dailyDate !== today) {
    next.dailyDate = today;
    next.dailyTriggered = [];
  }
  return next;
}

function applyDynamicAdjustments(weights: WeightMap, signals: SignalResult): WeightMap {
  const next = { ...weights };
  if (signals.hasEmotionWords) {
    next.none = (next.none || 0) + 10;
    next.user_emotion = (next.user_emotion || 0) + 10;
    next.tone_only = Math.max(0, (next.tone_only || 0) - 10);
  }
  if (signals.isFactualRecord) {
    next.user_detail = (next.user_detail || 0) + 10;
    next.user_emotion = Math.max(0, (next.user_emotion || 0) - 10);
  }
  if (signals.hasBodySignals) {
    next.user_body = (next.user_body || 0) + 15;
    next.practical_care = (next.practical_care || 0) + 10;
  }
  return next;
}

function buildAssociationInstruction(
  associationType: AssociationType,
  originType: OriginType,
  lang: AssociationLang,
): string | null {
  const base = ASSOCIATION_INSTRUCTION[associationType]?.[lang] || null;
  if (!base) return null;
  if (originType === 'user_first') return base;
  const origin = ORIGIN_INSTRUCTION[originType]?.[lang] || '';
  if (!origin) return base;
  return `${base} ${origin}`;
}

function sampleToneTag(characterId: CharacterId, recentHistory: string[], rng: () => number): string | null {
  const pool = TONE_POOL[characterId] ?? [];
  if (pool.length === 0) return null;
  const dedupedPool = pool.filter((tag) => !recentHistory.includes(tag));
  const candidates = dedupedPool.length > 0 ? dedupedPool : pool;
  const index = Math.floor(rng() * candidates.length);
  return candidates[Math.max(0, Math.min(index, candidates.length - 1))] || candidates[0] || null;
}

function buildToneInstruction(toneTag: string, lang: AssociationLang): string | null {
  return TONE_INSTRUCTION[toneTag]?.[lang] || null;
}

export function sampleAssociation(params: {
  characterId: CharacterId;
  userInput: string;
  lang?: string;
  state?: LateralAssociationState | null;
  currentDate?: string;
  now?: Date;
  rng?: () => number;
}): AssociationSampleOutput {
  const lang = normalizeLang(params.lang);
  const rng = params.rng ?? Math.random;
  const today = params.currentDate || toTodayString(params.now || new Date());
  const currentState = sanitizeState(params.state, today);

  let weights: WeightMap = { ...BASE_WEIGHTS[params.characterId] };
  for (const limitedType of currentState.dailyTriggered) {
    weights[limitedType] = 0;
  }

  if (currentState.lastAssociationType) {
    weights[currentState.lastAssociationType] = 0;
  }

  const signals = detectInputSignals(params.userInput);
  weights = applyDynamicAdjustments(weights, signals);
  weights = normalize(weights);

  let associationType = weightedRandom(weights, rng) as AssociationType | null;
  if (!associationType) {
    associationType = (weights.user_detail ?? 0) > 0 ? 'user_detail' : 'none';
  }

  const originType = weightedRandom(normalizeOrigin(BASE_ORIGIN_WEIGHTS[params.characterId]), rng) || 'user_first';

  let toneTag: string | null = null;
  if (associationType === 'tone_only') {
    toneTag = sampleToneTag(params.characterId, currentState.lastToneTagHistory, rng);
  }

  const nextState: LateralAssociationState = {
    ...currentState,
    lastAssociationType: associationType,
    lastToneTagHistory: toneTag
      ? [...currentState.lastToneTagHistory.filter((tag) => tag !== toneTag), toneTag].slice(-3)
      : currentState.lastToneTagHistory,
    dailyTriggered: LIMITED_TYPES.includes(associationType)
      ? Array.from(new Set([...currentState.dailyTriggered, associationType]))
      : currentState.dailyTriggered,
    dailyDate: today,
  };

  const associationInstruction = associationType === 'tone_only'
    ? buildToneInstruction(toneTag || '', lang)
    : buildAssociationInstruction(associationType, originType, lang);

  return {
    associationType,
    originType,
    toneTag,
    associationInstruction,
    nextState,
  };
}
