// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import { buildAiCompanionModePrompt, normalizeAiCompanionLang, normalizeAiCompanionMode } from '../lib/aiCompanion.js';
import { getVanDailyAnnotationPromptZH } from '../lib/aiCompanion/prompts/van.js';
import { getAgnesDailyAnnotationPromptZH } from '../lib/aiCompanion/prompts/agnes.js';
import { getZepDailyAnnotationPromptZH } from '../lib/aiCompanion/prompts/zep.js';
import { getMomoDailyAnnotationPromptZH } from '../lib/aiCompanion/prompts/momo.js';

interface AnnotationTemplate {
  content: string;
  tone: string;
  fallbackEmoji: string;
}

type AnnotationMap = Record<string, AnnotationTemplate>;

const DEFAULT_ANNOTATIONS_ZH: AnnotationMap = {
  activity_completed: {
    content: '又一颗时间碎片落进今天了 ✨',
    tone: 'playful',
    fallbackEmoji: '✨',
  },
  mood_recorded: {
    content: '情绪的波纹被接住了 💭',
    tone: 'curious',
    fallbackEmoji: '💭',
  },
  task_deleted: {
    content: '删掉一件事，空气都轻了一点 🧹',
    tone: 'playful',
    fallbackEmoji: '🧹',
  },
  overwork_detected: {
    content: '已经太久没歇气了，先把自己捞回来一点 🫖',
    tone: 'concerned',
    fallbackEmoji: '🫖',
  },
  idle_detected: {
    content: '这段静默不像空白，更像在缓慢回神 🌿',
    tone: 'curious',
    fallbackEmoji: '🌿',
  },
};

const DEFAULT_ANNOTATIONS_EN: AnnotationMap = {
  activity_completed: {
    content: 'Another shard of today just landed ✨',
    tone: 'playful',
    fallbackEmoji: '✨',
  },
  mood_recorded: {
    content: 'That emotional ripple got caught 💭',
    tone: 'curious',
    fallbackEmoji: '💭',
  },
  task_deleted: {
    content: 'One less thing in the air now 🧹',
    tone: 'playful',
    fallbackEmoji: '🧹',
  },
  overwork_detected: {
    content: 'That has been a long stretch. Come back to yourself a little 🫖',
    tone: 'concerned',
    fallbackEmoji: '🫖',
  },
  idle_detected: {
    content: 'This quiet feels more like recovery than emptiness 🌿',
    tone: 'curious',
    fallbackEmoji: '🌿',
  },
};

const DEFAULT_ANNOTATIONS_IT: AnnotationMap = {
  activity_completed: {
    content: 'Un altro frammento di oggi e atterrato ✨',
    tone: 'playful',
    fallbackEmoji: '✨',
  },
  mood_recorded: {
    content: "L'onda emotiva e stata raccolta 💭",
    tone: 'curious',
    fallbackEmoji: '💭',
  },
  task_deleted: {
    content: "Una cosa in meno nell'aria adesso 🧹",
    tone: 'playful',
    fallbackEmoji: '🧹',
  },
  overwork_detected: {
    content: 'Tirare cosi a lungo pesa. Torna un poco verso di te 🫖',
    tone: 'concerned',
    fallbackEmoji: '🫖',
  },
  idle_detected: {
    content: 'Questo silenzio sembra piu recupero che vuoto 🌿',
    tone: 'curious',
    fallbackEmoji: '🌿',
  },
};

const FALLBACK_SYSTEM_PROMPT_ZH = `你在生成一条 Timeshine 批注。
- 只输出批注正文，不要解释、分析、标签或前缀。
- 长度保持精炼，约 15-55 个中文字符。
- 句末必须且只能有一个 emoji。`;

const FALLBACK_SYSTEM_PROMPT_EN = `You are generating a Timeshine annotation.
- Output only the annotation itself. No explanation, labels, prefixes, or analysis.
- Keep it tight: roughly 10-35 words.
- End with exactly one emoji.`;

const FALLBACK_SYSTEM_PROMPT_IT = `Stai generando un'annotazione Timeshine.
- Stampa solo l'annotazione. Niente prefissi, etichette, spiegazioni o analisi.
- Mantienila concisa: circa 10-35 parole.
- Chiudi con esattamente una emoji.`;

function getFallbackSystemPrompt(lang: string): string {
  if (lang === 'en') return FALLBACK_SYSTEM_PROMPT_EN;
  if (lang === 'it') return FALLBACK_SYSTEM_PROMPT_IT;
  return FALLBACK_SYSTEM_PROMPT_ZH;
}

const RANDOM_MODES = ['van', 'agnes', 'zep', 'momo'] as const;

function getRandomMode(): typeof RANDOM_MODES[number] {
  return RANDOM_MODES[Math.floor(Math.random() * RANDOM_MODES.length)];
}

export function getSystemPrompt(lang: string, aiMode?: string): string {
  const normalizedLang = normalizeAiCompanionLang(lang);
  const resolvedMode = aiMode ?? getRandomMode();
  const normalizedMode = normalizeAiCompanionMode(resolvedMode);

  if (normalizedMode === 'van' && normalizedLang === 'zh') {
    return getVanDailyAnnotationPromptZH();
  }
  if (normalizedMode === 'agnes' && normalizedLang === 'zh') {
    return getAgnesDailyAnnotationPromptZH();
  }
  if (normalizedMode === 'zep' && normalizedLang === 'zh') {
    return getZepDailyAnnotationPromptZH();
  }
  if (normalizedMode === 'momo' && normalizedLang === 'zh') {
    return getMomoDailyAnnotationPromptZH();
  }
  return buildAiCompanionModePrompt(normalizedLang, resolvedMode, 'annotation');
}

export function getDefaultAnnotations(lang: string): AnnotationMap {
  if (lang === 'en') return DEFAULT_ANNOTATIONS_EN;
  if (lang === 'it') return DEFAULT_ANNOTATIONS_IT;
  return DEFAULT_ANNOTATIONS_ZH;
}

export function getModel(lang: string): string {
  if (lang === 'en' || lang === 'it') return 'gemini2.0-flash';
  return 'deepseek-chat';
}
