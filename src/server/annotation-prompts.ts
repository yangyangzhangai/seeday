import { buildAiCompanionModePrompt, normalizeAiCompanionLang } from '../lib/aiCompanion.js';

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

export function getSystemPrompt(lang: string, aiMode?: string): string {
  const normalizedLang = normalizeAiCompanionLang(lang);

  if (aiMode) {
    return buildAiCompanionModePrompt(normalizedLang, aiMode, 'annotation');
  }

  return getFallbackSystemPrompt(normalizedLang);
}

export function getDefaultAnnotations(lang: string): AnnotationMap {
  if (lang === 'en') return DEFAULT_ANNOTATIONS_EN;
  if (lang === 'it') return DEFAULT_ANNOTATIONS_IT;
  return DEFAULT_ANNOTATIONS_ZH;
}

export function getModel(_lang: string): string {
  return 'gpt-4.1-mini';
}

export function buildTodayActivitiesText(activities: any[], lang: string): string {
  if (!activities || activities.length === 0) {
    if (lang === 'en') return 'No activities recorded today';
    if (lang === 'it') return 'Nessuna attivita registrata oggi';
    return '今天还没有活动记录';
  }

  const locale = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'it-IT';
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const separator = lang === 'zh' ? '；' : ' | ';

  return activities
    .map((activity: any, index: number) => {
      const completedMark = activity.completed ? ' ✓' : '';
      const timeStr = new Date(activity.timestamp).toLocaleTimeString(locale, timeOptions);
      const typeStr = activity.activityType ? `[${activity.activityType}]` : '';
      const durationStr = activity.duration ? `(${activity.duration}${lang === 'zh' ? '分钟' : 'min'})` : '';

      return `${index + 1}. [${timeStr}] ${typeStr}${activity.content}${durationStr}${completedMark}`;
    })
    .join(separator);
}

export function buildUserPrompt(
  lang: string,
  eventType: string,
  eventSummary: string,
  todayActivitiesText: string,
  recentMoodText: string,
  currentHour?: number,
  currentMinute?: number,
): string {
  const hourText = currentHour !== undefined ? (() => {
    const minuteStr = currentMinute !== undefined ? String(currentMinute).padStart(2, '0') : '00';
    const hour12 = currentHour % 12 || 12;
    const ampm = currentHour < 12 ? 'AM' : 'PM';
    return `${hour12}:${minuteStr} ${ampm}`;
  })() : null;

  if (lang === 'en') {
    return [
      hourText ? `Current time: ${hourText}` : null,
      `Today's timeline: ${todayActivitiesText}`,
      `Recent mood: ${recentMoodText}`,
      `Just happened: [${eventType}] ${eventSummary}`,
      'Write one direct annotation in your current voice.',
      'Use exactly one emoji at the end.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (lang === 'it') {
    return [
      hourText ? `Ora corrente: ${hourText}` : null,
      `Timeline di oggi: ${todayActivitiesText}`,
      `Umore recente: ${recentMoodText}`,
      `Appena successo: [${eventType}] ${eventSummary}`,
      'Scrivi una sola annotazione diretta con la tua voce attuale.',
      'Usa esattamente una emoji alla fine.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    hourText ? `当前时间：${hourText}` : null,
    `今日时间线：${todayActivitiesText}`,
    `最近心情：${recentMoodText}`,
    `刚刚发生：[${eventType}] ${eventSummary}`,
    '请用你当前的人设语气，写一句直接批注。',
    '句末必须只有一个 emoji。',
  ]
    .filter(Boolean)
    .join('\n\n');
}
