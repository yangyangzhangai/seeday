// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type {
  AnnotationCurrentDate,
  AnnotationHolidayContext,
  RecoveryNudgeContext,
  SeasonContextV2,
  TodayContextSnapshot,
  WeatherAlert,
  WeatherContextV2,
} from '../types/annotation.js';
import type { UserProfileSnapshot } from '../types/userProfile.js';

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

export function buildTodayContextText(todayContext: TodayContextSnapshot | undefined, lang: string): string {
  if (!todayContext || todayContext.items.length === 0) {
    if (lang === 'en') return 'none';
    if (lang === 'it') return 'nessuno';
    return '无';
  }

  const lines = todayContext.items.slice(0, 3).map((item, index) => (
    `${index + 1}. [${item.category}] ${item.summary}`
  ));

  return lines.join('\n');
}

function buildCharacterStateText(characterStateText: string | undefined, lang: string): string {
  if (characterStateText && characterStateText.trim()) return characterStateText.trim();
  if (lang === 'en') return 'none';
  if (lang === 'it') return 'nessuno';
  return '无';
}

function buildCurrentDateText(currentDate: AnnotationCurrentDate | undefined, lang: string): string {
  if (!currentDate) {
    if (lang === 'en') return 'unknown';
    if (lang === 'it') return 'sconosciuta';
    return '未知';
  }

  const weekdayFallback = String(currentDate.weekday);
  const weekday = currentDate.weekdayName || weekdayFallback;
  if (lang === 'en') {
    return `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}-${String(currentDate.day).padStart(2, '0')} (${weekday})`;
  }
  if (lang === 'it') {
    return `${String(currentDate.day).padStart(2, '0')}/${String(currentDate.month).padStart(2, '0')}/${currentDate.year} (${weekday})`;
  }
  return `${currentDate.year}年${currentDate.month}月${currentDate.day}日 (${weekday})`;
}

function buildHolidayText(holiday: AnnotationHolidayContext | undefined, lang: string): string {
  if (!holiday?.isHoliday) {
    if (lang === 'en') return 'none';
    if (lang === 'it') return 'nessuna';
    return '无';
  }

  const holidayName = holiday.name
    || (lang === 'en' ? 'Holiday' : lang === 'it' ? 'Festivita' : '节日');
  if (holiday.type === 'legal') {
    if (lang === 'en') return `${holidayName} (Legal Holiday)`;
    if (lang === 'it') return `${holidayName} (Festivita legale)`;
    return `${holidayName}（法定节假日）`;
  }

  return holidayName;
}

function buildHolidayLine(
  holiday: AnnotationHolidayContext | undefined,
  lang: string,
): string | null {
  if (!holiday?.isHoliday) return null;
  if (lang === 'en') return `Current holiday: ${buildHolidayText(holiday, lang)}`;
  if (lang === 'it') return `Festivita di oggi: ${buildHolidayText(holiday, lang)}`;
  return `今日节日：${buildHolidayText(holiday, lang)}`;
}

function buildWeatherAndSeasonLines(
  lang: string,
  weatherContext?: WeatherContextV2,
  seasonContext?: SeasonContextV2,
  weatherAlerts?: WeatherAlert[],
): string[] {
  const season = seasonContext?.season ?? 'unknown';
  const temperatureText = typeof weatherContext?.temperatureC === 'number'
    ? `${weatherContext.temperatureC}C`
    : 'unknown';
  const conditions = weatherContext?.conditions?.length
    ? weatherContext.conditions.join(', ')
    : 'unknown';
  const alerts = weatherAlerts?.length ? weatherAlerts.join(', ') : '';

  if (lang === 'en') {
    return [
      `Season: ${season}`,
      `Weather: ${temperatureText}, ${conditions}`,
      alerts ? `Alerts: ${alerts}` : '',
    ].filter((line): line is string => Boolean(line));
  }

  if (lang === 'it') {
    return [
      `Stagione: ${season}`,
      `Meteo: ${temperatureText}, ${conditions}`,
      alerts ? `Avvisi: ${alerts}` : '',
    ].filter((line): line is string => Boolean(line));
  }

  return [
    `季节：${season}`,
    `天气：${temperatureText}, ${conditions}`,
    alerts ? `预警：${alerts}` : '',
  ].filter((line): line is string => Boolean(line));
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
  todayContextText?: string;
  characterStateText?: string;
  userProfileSnapshot?: UserProfileSnapshot;
  statusSummary?: string;
  contextHints?: string[];
  frequentActivities?: string[];
  pendingTodos?: Array<{ id: string; title: string; category?: string; dueAt?: number }>;
  currentDate?: AnnotationCurrentDate;
  holiday?: AnnotationHolidayContext;
  currentHour?: number;
  currentMinute?: number;
  consecutiveTextCount?: number;
  forceSuggestion?: boolean;
  recoveryNudge?: RecoveryNudgeContext;
  weatherContext?: WeatherContextV2;
  seasonContext?: SeasonContextV2;
  weatherAlerts?: WeatherAlert[];
  associationInstruction?: string;
  narrativeEventInstruction?: string;
}

function buildUserProfileSnapshotText(userProfileSnapshot: UserProfileSnapshot | undefined, lang: string): string {
  const text = userProfileSnapshot?.text?.trim();
  if (text) return text;
  if (lang === 'en') return 'none';
  if (lang === 'it') return 'nessuno';
  return '无';
}

export function buildSuggestionAwareUserPrompt(input: SuggestionAwarePromptInput): string {
  const {
    lang,
    eventType,
    eventSummary,
    todayActivitiesText,
    recentMoodText,
    todayContextText,
    characterStateText,
    userProfileSnapshot,
    statusSummary,
    contextHints = [],
    frequentActivities = [],
    pendingTodos = [],
    currentDate,
    holiday,
    currentHour,
    currentMinute,
    consecutiveTextCount = 0,
    forceSuggestion = false,
    recoveryNudge,
    weatherContext,
    seasonContext,
    weatherAlerts,
    associationInstruction,
    narrativeEventInstruction,
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
    const recoveryRules = recoveryNudge
      ? [
        `Recovery nudge is active: ${JSON.stringify(recoveryNudge)}`,
        'You must return suggestion JSON and include rewardStars=2 and recoveryKey exactly as provided.',
        'Content must clearly contrast normal reward (1 star) vs today\'s recovery reward (2 stars).',
        'Express this naturally in your own voice; do not use rigid template wording.',
      ]
      : [];

    return [
      hourText ? `Current time: ${hourText}` : null,
      `Current date: ${buildCurrentDateText(currentDate, lang)}`,
      buildHolidayLine(holiday, lang),
      ...buildWeatherAndSeasonLines(lang, weatherContext, seasonContext, weatherAlerts),
      `Today's timeline: ${todayActivitiesText}`,
      `Recent mood: ${recentMoodText}`,
      `Today context:\n${todayContextText || 'none'}`,
      `Character current state:\n${buildCharacterStateText(characterStateText, lang)}`,
      `Long-term profile snapshot:\n${buildUserProfileSnapshotText(userProfileSnapshot, lang)}`,
      associationInstruction || null,
      narrativeEventInstruction || null,
      `Just happened: [${eventType}] ${eventSummary}`,
      `Status summary:\n${statusSummary || 'none'}`,
      `Context hints:\n${hintsText}`,
      `Frequent activities: ${freqText}`,
      `Pending todos:\n${todoListText}`,
      `Consecutive text-only outputs: ${consecutiveTextCount}`,
      ...recoveryRules,
      ...modeRules,
      ...sceneRules,
      'If suggestion is better, output ONLY JSON with this shape:',
      '{"mode":"suggestion","content":"<one sentence with one emoji>","suggestion":{"type":"activity|todo","actionLabel":"<button>","activityName":"<optional>","todoId":"<optional>","todoTitle":"<optional>","rewardStars":"<optional number>","rewardBottleId":"<optional>","recoveryKey":"<optional>"}}',
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
    const recoveryRules = recoveryNudge
      ? [
        `Recovery nudge attivo: ${JSON.stringify(recoveryNudge)}`,
        'Devi restituire JSON suggestion con rewardStars=2 e recoveryKey esattamente forniti.',
        'Nel contenuto confronta chiaramente la ricompensa normale (1 stella) con quella di recupero di oggi (2 stelle).',
        'Esprimilo in modo naturale con la tua voce, senza formule rigide.',
      ]
      : [];

    return [
      hourText ? `Ora corrente: ${hourText}` : null,
      `Data corrente: ${buildCurrentDateText(currentDate, lang)}`,
      buildHolidayLine(holiday, lang),
      ...buildWeatherAndSeasonLines(lang, weatherContext, seasonContext, weatherAlerts),
      `Timeline di oggi: ${todayActivitiesText}`,
      `Umore recente: ${recentMoodText}`,
      `Contesto di oggi:\n${todayContextText || 'nessuno'}`,
      `Stato attuale del personaggio:\n${buildCharacterStateText(characterStateText, lang)}`,
      `Snapshot profilo a lungo termine:\n${buildUserProfileSnapshotText(userProfileSnapshot, lang)}`,
      associationInstruction || null,
      narrativeEventInstruction || null,
      `Appena successo: [${eventType}] ${eventSummary}`,
      `Riepilogo stato:\n${statusSummary || 'nessuno'}`,
      `Suggerimenti di contesto:\n${hintsText}`,
      `Attivita frequenti: ${freqText}`,
      `Todo in sospeso:\n${todoListText}`,
      `Numero annotazioni testuali consecutive: ${consecutiveTextCount}`,
      ...recoveryRules,
      ...modeRules,
      ...sceneRules,
      'Se e meglio un suggerimento, stampa SOLO JSON con questa forma:',
      '{"mode":"suggestion","content":"<frase breve con una emoji>","suggestion":{"type":"activity|todo","actionLabel":"<pulsante>","activityName":"<opzionale>","todoId":"<opzionale>","todoTitle":"<opzionale>","rewardStars":"<numero opzionale>","rewardBottleId":"<opzionale>","recoveryKey":"<opzionale>"}}',
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
  const recoveryRules = recoveryNudge
    ? [
      `恢复提醒上下文：${JSON.stringify(recoveryNudge)}`,
      '你必须输出 suggestion JSON，并且 suggestion 内必须包含 rewardStars=2 与 recoveryKey（按上下文原样返回）。',
      'content 里必须明确对比：平时完成是 1 颗星，今天补回完成是 2 颗星。',
      '表达要自然、符合你的人设语气，不要套模板句。',
    ]
    : [];

  return [
    hourText ? `当前时间：${hourText}` : null,
    `当前日期：${buildCurrentDateText(currentDate, lang)}`,
    buildHolidayLine(holiday, lang),
    ...buildWeatherAndSeasonLines(lang, weatherContext, seasonContext, weatherAlerts),
    `今日时间线：${todayActivitiesText}`,
    `最近心情：${recentMoodText}`,
    `今日上下文：\n${todayContextText || '无'}`,
    `角色当前状态：\n${buildCharacterStateText(characterStateText, lang)}`,
    `长期画像快照：\n${buildUserProfileSnapshotText(userProfileSnapshot, lang)}`,
    associationInstruction || null,
    narrativeEventInstruction || null,
    `刚刚发生：[${eventType}] ${eventSummary}`,
    `状态摘要：\n${statusSummary || '无'}`,
    `情境提示：\n${hintsText}`,
    `常做活动：${freqText}`,
    `待办列表：\n${todoListText}`,
    `连续纯文字批注次数：${consecutiveTextCount}`,
    ...recoveryRules,
    ...modeRules,
    ...sceneRules,
    '如果输出建议：只输出 JSON，格式如下：',
    '{"mode":"suggestion","content":"<一句话+1个emoji>","suggestion":{"type":"activity|todo","actionLabel":"<按钮文案>","activityName":"<可选>","todoId":"<可选>","todoTitle":"<可选>","rewardStars":"<可选数字>","rewardBottleId":"<可选>","recoveryKey":"<可选>"}}',
    'todo 建议时，todoId 必须来自待办列表。内容要温暖、简短、具体。',
  ].filter(Boolean).join('\n\n');
}

export function buildUserPrompt(
  lang: string,
  eventType: string,
  eventSummary: string,
  todayActivitiesText: string,
  recentMoodText: string,
  todayContextText?: string,
  characterStateText?: string,
  currentDate?: AnnotationCurrentDate,
  holiday?: AnnotationHolidayContext,
  currentHour?: number,
  currentMinute?: number,
  weatherContext?: WeatherContextV2,
  seasonContext?: SeasonContextV2,
  weatherAlerts?: WeatherAlert[],
  associationInstruction?: string,
  userProfileSnapshot?: UserProfileSnapshot,
  narrativeEventInstruction?: string,
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
      `Current date: ${buildCurrentDateText(currentDate, lang)}`,
      buildHolidayLine(holiday, lang),
      ...buildWeatherAndSeasonLines(lang, weatherContext, seasonContext, weatherAlerts),
      `Today's timeline: ${todayActivitiesText}`,
      `Recent mood: ${recentMoodText}`,
      `Today context:\n${todayContextText || 'none'}`,
      `Character current state:\n${buildCharacterStateText(characterStateText, lang)}`,
      `Long-term profile snapshot:\n${buildUserProfileSnapshotText(userProfileSnapshot, lang)}`,
      associationInstruction || null,
      narrativeEventInstruction || null,
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
      `Data corrente: ${buildCurrentDateText(currentDate, lang)}`,
      buildHolidayLine(holiday, lang),
      ...buildWeatherAndSeasonLines(lang, weatherContext, seasonContext, weatherAlerts),
      `Timeline di oggi: ${todayActivitiesText}`,
      `Umore recente: ${recentMoodText}`,
      `Contesto di oggi:\n${todayContextText || 'nessuno'}`,
      `Stato attuale del personaggio:\n${buildCharacterStateText(characterStateText, lang)}`,
      `Snapshot profilo a lungo termine:\n${buildUserProfileSnapshotText(userProfileSnapshot, lang)}`,
      associationInstruction || null,
      narrativeEventInstruction || null,
      `Appena successo: [${eventType}] ${eventSummary}`,
      "Per favore, scrivi una sola annotazione sull'attivita o l'umore appena accaduto, con la tua voce attuale.",
      'Usa esattamente una emoji alla fine.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    hourText ? `当前时间：${hourText}` : null,
    `当前日期：${buildCurrentDateText(currentDate, lang)}`,
    buildHolidayLine(holiday, lang),
    ...buildWeatherAndSeasonLines(lang, weatherContext, seasonContext, weatherAlerts),
    `今日时间线：${todayActivitiesText}`,
    `最近心情：${recentMoodText}`,
    `今日上下文：\n${todayContextText || '无'}`,
    `角色当前状态：\n${buildCharacterStateText(characterStateText, lang)}`,
    `长期画像快照：\n${buildUserProfileSnapshotText(userProfileSnapshot, lang)}`,
    associationInstruction || null,
    narrativeEventInstruction || null,
    `刚刚发生：[${eventType}] ${eventSummary}`,
    '请针对刚刚的活动或心情，用你当前的人设语气写一句批注。',
    '句末必须只有一个 emoji。',
  ]
    .filter(Boolean)
    .join('\n\n');
}
