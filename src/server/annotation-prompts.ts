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

export function buildTodayActivitiesText(activities: any[], lang: string, timezone?: string): string {
  if (!activities || activities.length === 0) {
    if (lang === 'en') return 'No activities recorded today';
    if (lang === 'it') return 'Nessuna attivita registrata oggi';
    return '今天还没有活动记录';
  }

  const locale = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'it-IT';
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  };
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

/**
 * 构建 overwork 建议模式的 user prompt
 * AI 需要输出 JSON 格式的建议
 */
export function buildSuggestionUserPrompt(
  lang: string,
  todayActivitiesText: string,
  pendingTodos: Array<{ id: string; title: string; category?: string }>,
  currentHour?: number,
  currentMinute?: number,
): string {
  const hourText = currentHour !== undefined ? (() => {
    const minuteStr = currentMinute !== undefined ? String(currentMinute).padStart(2, '0') : '00';
    const hour12 = currentHour % 12 || 12;
    const ampm = currentHour < 12 ? 'AM' : 'PM';
    return `${hour12}:${minuteStr} ${ampm}`;
  })() : null;

  const restCategories = ['health', 'entertainment', 'life'];
  const restTodos = pendingTodos.filter(t => restCategories.includes(t.category || ''));
  const otherTodos = pendingTodos.filter(t => !restCategories.includes(t.category || ''));
  const todoListText = [...restTodos, ...otherTodos]
    .slice(0, 5)
    .map((t, i) => `${i + 1}. [${t.id}] ${t.title}${t.category ? ` (${t.category})` : ''}`)
    .join('\n');

  if (lang === 'en') {
    return [
      hourText ? `Current time: ${hourText}` : null,
      `Today's timeline: ${todayActivitiesText}`,
      'The user has been working/studying for a long time and needs a break suggestion.',
      todoListText
        ? `Pending todos (prefer health/entertainment/life ones for rest):\n${todoListText}`
        : 'No pending todos.',
      'Pick the best break option. Output ONLY a JSON object (no markdown, no explanation):',
      todoListText
        ? '- If recommending a todo: {"message":"<caring 1-sentence>","type":"todo","todoId":"<id>","todoTitle":"<title>","actionLabel":"Go <verb>"}'
        : '',
      '- If suggesting an activity: {"message":"<caring 1-sentence>","type":"activity","activityName":"<name>","actionLabel":"Go <verb>"}',
      'Keep message warm and under 30 words. End message with one emoji.',
    ].filter(Boolean).join('\n\n');
  }

  if (lang === 'it') {
    return [
      hourText ? `Ora corrente: ${hourText}` : null,
      `Timeline di oggi: ${todayActivitiesText}`,
      "L'utente lavora/studia da molto tempo e ha bisogno di una pausa.",
      todoListText
        ? `Todo in sospeso (preferisci salute/intrattenimento/vita per il riposo):\n${todoListText}`
        : 'Nessun todo in sospeso.',
      'Scegli la migliore opzione di pausa. Stampa SOLO un oggetto JSON (no markdown, no spiegazioni):',
      todoListText
        ? '- Per un todo: {"message":"<frase premurosa>","type":"todo","todoId":"<id>","todoTitle":"<titolo>","actionLabel":"Vai a <verbo>"}'
        : '',
      '- Per un\'attivita: {"message":"<frase premurosa>","type":"activity","activityName":"<nome>","actionLabel":"Vai a <verbo>"}',
      'Mantieni il messaggio caldo e sotto 30 parole. Chiudi il messaggio con una emoji.',
    ].filter(Boolean).join('\n\n');
  }

  // zh
  return [
    hourText ? `当前时间：${hourText}` : null,
    `今日时间线：${todayActivitiesText}`,
    '用户已经长时间工作/学习，需要休息建议。',
    todoListText
      ? `未完成待办（优先推荐 health/entertainment/life 类作为休息）：\n${todoListText}`
      : '没有未完成的待办。',
    '请选择最佳休息方案。只输出一个 JSON 对象（不要 markdown、不要解释）：',
    todoListText
      ? '- 推荐待办：{"message":"<关心的一句话>","type":"todo","todoId":"<id>","todoTitle":"<标题>","actionLabel":"去<动词>"}'
      : '',
    '- 建议活动：{"message":"<关心的一句话>","type":"activity","activityName":"<名称>","actionLabel":"去<动词>"}',
    'message 要温暖简短，不超过25个中文字符。message 句末带一个 emoji。',
  ].filter(Boolean).join('\n\n');
}

interface SuggestionAwarePromptInput {
  lang: string;
  eventType: string;
  eventSummary: string;
  todayActivitiesText: string;
  recentMoodText: string;
  statusSummary?: string;
  contextHints?: string[];
  frequentActivities?: string[];
  pendingTodos?: Array<{ id: string; title: string; category?: string; dueAt?: number }>;
  currentHour?: number;
  currentMinute?: number;
  consecutiveTextCount?: number;
  forceSuggestion?: boolean;
}

export function buildSuggestionAwareUserPrompt(input: SuggestionAwarePromptInput): string {
  const {
    lang,
    eventType,
    eventSummary,
    todayActivitiesText,
    recentMoodText,
    statusSummary,
    contextHints = [],
    frequentActivities = [],
    pendingTodos = [],
    currentHour,
    currentMinute,
    consecutiveTextCount = 0,
    forceSuggestion = false,
  } = input;

  const hourText = currentHour !== undefined
    ? `${String(currentHour).padStart(2, '0')}:${String(currentMinute ?? 0).padStart(2, '0')}`
    : null;

  const hintsText = contextHints.length > 0
    ? contextHints.map((hint, index) => `${index + 1}. ${hint}`).join('\n')
    : 'none';

  const freqText = frequentActivities.length > 0 ? frequentActivities.join(', ') : 'none';
  const todoListText = pendingTodos
    .slice(0, 6)
    .map((todo, index) => `${index + 1}. [${todo.id}] ${todo.title}${todo.category ? ` (${todo.category})` : ''}`)
    .join('\n') || 'none';

  if (lang === 'en') {
    const modeRules = forceSuggestion
      ? [
        'User explicitly asked for advice. You MUST output suggestion JSON only.',
        'Never output plain text in this turn.',
      ]
      : [
        'Decide naturally between plain annotation and actionable suggestion.',
        'If plain annotation is better, output plain text only, end with exactly one emoji.',
        'If you include an actionable next step (do/start/try/go), you MUST use suggestion mode JSON instead of plain text.',
      ];
    const sceneRules = [
      'If the user shows physical illness or discomfort, give one concrete rest action with duration and do not recommend work or study tasks.',
      'If the user expresses sadness or low mood, first acknowledge briefly, then suggest one low-effort activity based on frequent activities to help them feel better.',
    ];

    return [
      hourText ? `Current time: ${hourText}` : null,
      `Today's timeline: ${todayActivitiesText}`,
      `Recent mood: ${recentMoodText}`,
      `Just happened: [${eventType}] ${eventSummary}`,
      `Status summary:\n${statusSummary || 'none'}`,
      `Context hints:\n${hintsText}`,
      `Frequent activities: ${freqText}`,
      `Pending todos:\n${todoListText}`,
      `Consecutive text-only outputs: ${consecutiveTextCount}`,
      ...modeRules,
      ...sceneRules,
      'If suggestion is better, output ONLY JSON with this shape:',
      '{"mode":"suggestion","content":"<one sentence with one emoji>","suggestion":{"type":"activity|todo","actionLabel":"<button>","activityName":"<optional>","todoId":"<optional>","todoTitle":"<optional>"}}',
      'For todo suggestion, todoId must come from Pending todos list. Keep content concise and caring.',
    ].filter(Boolean).join('\n\n');
  }

  if (lang === 'it') {
    const modeRules = forceSuggestion
      ? [
        'L\'utente ha chiesto esplicitamente un consiglio. Devi stampare SOLO JSON di suggerimento.',
        'Non stampare testo normale in questo turno.',
      ]
      : [
        'Scegli in modo naturale tra annotazione normale e suggerimento operativo.',
        'Se e meglio una normale annotazione, stampa solo testo con una sola emoji finale.',
        'Se includi un prossimo passo operativo (fare/iniziare/provare/andare), devi usare il JSON di suggerimento invece del testo normale.',
      ];
    const sceneRules = [
      'Se l\'utente mostra malessere fisico, dai un suggerimento di riposo concreto con durata ed evita task di lavoro o studio.',
      'Se l\'utente e triste o giu, fai prima una breve empatia e poi proponi una attivita leggera basata sulle attivita frequenti che puo aiutare il suo umore.',
    ];

    return [
      hourText ? `Ora corrente: ${hourText}` : null,
      `Timeline di oggi: ${todayActivitiesText}`,
      `Umore recente: ${recentMoodText}`,
      `Appena successo: [${eventType}] ${eventSummary}`,
      `Riepilogo stato:\n${statusSummary || 'nessuno'}`,
      `Suggerimenti di contesto:\n${hintsText}`,
      `Attivita frequenti: ${freqText}`,
      `Todo in sospeso:\n${todoListText}`,
      `Numero annotazioni testuali consecutive: ${consecutiveTextCount}`,
      ...modeRules,
      ...sceneRules,
      'Se e meglio un suggerimento, stampa SOLO JSON con questa forma:',
      '{"mode":"suggestion","content":"<frase breve con una emoji>","suggestion":{"type":"activity|todo","actionLabel":"<pulsante>","activityName":"<opzionale>","todoId":"<opzionale>","todoTitle":"<opzionale>"}}',
      'Per i todo, todoId deve essere preso dalla lista Pending todos.',
    ].filter(Boolean).join('\n\n');
  }

  const modeRules = forceSuggestion
    ? [
      '用户本轮明确要求建议：你必须输出建议 JSON，不允许输出普通文本。',
    ]
    : [
      '请自然判断输出普通批注，还是给一个具体可执行的建议。每天最多有3次建议机会。',
      '如果输出普通批注：只输出一句话，句末且仅一个 emoji。',
      '如果你要给出可执行的下一步（如去做、开始、试试、现在就做），必须使用建议模式 JSON，不能输出普通文本。',
    ];
  const sceneRules = [
    '若用户表达身体不适（如生病、头痛、发烧、咳嗽、很难受），请优先给出一个可立即执行的具体休息建议（动作+时长），不要推荐工作或学习任务。',
    '若用户表达难过或低落，请先简短共情，再结合用户常做活动给出一个具体、低负担、可马上开始的小建议。',
  ];

  return [
    hourText ? `当前时间：${hourText}` : null,
    `今日时间线：${todayActivitiesText}`,
    `最近心情：${recentMoodText}`,
    `刚刚发生：[${eventType}] ${eventSummary}`,
    `状态摘要：\n${statusSummary || '无'}`,
    `情境提示：\n${hintsText}`,
    `常做活动：${freqText}`,
    `待办列表：\n${todoListText}`,
    `连续纯文字批注次数：${consecutiveTextCount}`,
    ...modeRules,
    ...sceneRules,
    '如果输出建议：只输出 JSON，格式如下：',
    '{"mode":"suggestion","content":"<一句话+1个emoji>","suggestion":{"type":"activity|todo","actionLabel":"<按钮文案>","activityName":"<可选>","todoId":"<可选>","todoTitle":"<可选>"}}',
    'todo 建议时，todoId 必须来自待办列表。内容要温暖、简短、具体。',
  ].filter(Boolean).join('\n\n');
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
      'Please write one annotation about the activity or mood that just happened, in your current voice.',
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
      "Per favore, scrivi una sola annotazione sull'attivita o l'umore appena accaduto, con la tua voce attuale.",
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
    '请针对刚刚的活动或心情，用你当前的人设语气写一句批注。',
    '句末必须只有一个 emoji。',
  ]
    .filter(Boolean)
    .join('\n\n');
}
