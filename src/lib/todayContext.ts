// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/annotation.ts
import type { AnnotationEvent, TodayContextCategory, TodayContextItem, TodayContextSnapshot } from '../types/annotation';

const TODAY_CONTEXT_MAX_ITEMS = 5;

interface TodayContextRule {
  category: TodayContextCategory;
  summaryKey: string;
  patterns: RegExp[];
  excludes?: RegExp[];
}

const HEALTH_NEGATION_PATTERNS: RegExp[] = [
  /(没|没有|并没有|不是|无|未).{0,4}(感冒|发烧|发热|头痛|头疼|咳嗽|生病|不舒服|难受|喉咙痛|流鼻涕|恶心|腹泻|拉肚子|住院|手术|痛经|例假|月经|姨妈痛|牙疼|牙痛|溃疡|口腔溃疡)/i,
  /\b(not|no|never|isn't|wasn't|don't|didn't|haven't|without)\b.{0,20}\b(sick|ill|fever|cold|flu|cough|headache|migraine|nausea|vomit|diarrhea|hospitalized|surgery|period|menstrual|pms|cramps?|toothache|mouth\s+ulcers?|canker\s+sores?)\b/i,
  /\b(non|nessun|nessuna|mai)\b.{0,20}\b(malato|malata|sto\s+male|febbre|raffreddore|influenza|tosse|mal\s+di\s+testa|nausea|vomito|diarrea|ricoverat[oa]|intervento|ciclo|mestruazioni|dolori\s+mestruali|mal\s+di\s+denti|afte?)\b/i,
  /\b(sto\s+meglio|feeling\s+better|recovered|guarito|guarita)\b/i,
];

const HEALTH_NEGATION_OVERRIDE_PATTERNS: RegExp[] = [
  /(但是|但|不过|可|只是).{0,12}(发烧|发热|头痛|咳嗽|喉咙痛|恶心|腹泻|拉肚子|生病|痛经|例假|月经|姨妈痛|牙疼|牙痛|溃疡|口腔溃疡)/i,
  /\b(but|however)\b.{0,24}\b(sick|ill|fever|cold|flu|cough|headache|nausea|diarrhea|period|menstrual|pms|cramps?|toothache|mouth\s+ulcers?|canker\s+sores?)\b/i,
  /\b(ma|pero)\b.{0,24}\b(malato|malata|febbre|raffreddore|influenza|tosse|mal\s+di\s+testa|nausea|diarrea|ciclo|mestruazioni|dolori\s+mestruali|mal\s+di\s+denti|afte?)\b/i,
];

const TODAY_CONTEXT_RULES: TodayContextRule[] = [
  {
    category: 'health',
    summaryKey: 'menstrual_cycle',
    patterns: [
      /(来例假|来大姨妈|来月经|生理期|经期|痛经|姨妈痛|姨妈来了|月经来了|经痛|经量大|姨妈第一天)/i,
      /\b(on\s+my\s+period|my\s+period\s+started|period\s+pain|period\s+cramps?|menstrual\s+cramps?|menstruation|pms)\b/i,
      /\b(ho\s+il\s+ciclo|mi\s+[eè]\s+venuto\s+il\s+ciclo|mestruazioni|dolori\s+mestruali|crampi\s+mestruali|sindrome\s+premestruale)\b/i,
    ],
  },
  {
    category: 'health',
    summaryKey: 'illness',
    patterns: [
      /(感冒|发烧|发热|流感|头痛|头疼|偏头痛|咳嗽|喉咙痛|咽喉痛|流鼻涕|鼻塞|生病|不舒服|难受|恶心|呕吐|腹泻|拉肚子|食物中毒|过敏|发炎|扁桃体发炎|胃疼|肚子疼|乏力|浑身酸痛|牙疼|牙痛|智齿发炎|口腔溃疡|嘴里起泡|上火了|嗓子哑了|肠胃炎|反酸|烧心|落枕|鼻炎犯了)/i,
      /\b(cold|flu|fever|sick|ill|unwell|headache|migraine|cough|sore\s+throat|runny\s+nose|stuffy\s+nose|nausea|vomit(?:ing)?|diarrhea|stomach\s+bug|food\s+poisoning|inflammation|tonsillitis|stomach\s+ache|fatigue|body\s+aches?|toothache|tooth\s+pain|my\s+tooth\s+is\s+killing\s+me|wisdom\s+tooth\s+flare-?up|mouth\s+ulcers?|canker\s+sores?|cold\s+sores?|acid\s+reflux|heartburn|upset\s+stomach|stiff\s+neck)\b/i,
      /\b(raffreddore|influenza|febbre|sto\s+male|malato|malata|mal\s+di\s+testa|emicrania|tosse|mal\s+di\s+gola|naso\s+chiuso|nausea|vomito|diarrea|infiammazione|tonsillite|mal\s+di\s+stomaco|stanchezza|mal\s+di\s+denti|dente\s+del\s+giudizio\s+infiammato|afte?|ulcera\s+in\s+bocca|reflusso|bruciore\s+di\s+stomaco|torcicollo)\b/i,
    ],
    excludes: [
      /\b(cold\s+plunge|cold\s+shower|ice\s+bath)\b/i,
    ],
  },
  {
    category: 'health',
    summaryKey: 'medical_visit',
    patterns: [
      /(看医生|去医院|挂号|复诊|拿药|吃药|打针|输液|病假|请病假|住院|手术|急诊|门诊|化验|拍片|住院观察|看牙医|补牙|拔牙|根管)/i,
      /\b(doctor\s+appointment|dentist\s+appointment|went\s+to\s+(the\s+)?(doctor|dentist|hospital|clinic|urgent\s+care|er)|on\s+sick\s+leave|called\s+in\s+sick|took\s+(my\s+)?(medicine|medication|antibiotics|painkillers?)|hospitalized|had\s+surgery|blood\s+test|x-?ray|checkup|root\s+canal|tooth\s+extraction|filled\s+a\s+cavity)\b/i,
      /\b(visita\s+medica|dal\s+dentista|ospedale|clinica|farmacia|malattia|congedo\s+per\s+malattia|ho\s+preso\s+le\s+medicine|ricoverat[oa]|intervento\s+chirurgico|pronto\s+soccorso|analisi\s+del\s+sangue|controllo|devitalizzazione|estrazione\s+del\s+dente)\b/i,
    ],
  },
  {
    category: 'special_day',
    summaryKey: 'birthday',
    patterns: [
      /(生日|过生日|生快)/i,
      /\b(birthday|my\s+birthday|birthday\s+today|turning\s+\d+)\b/i,
      /\b(compleanno|oggi\s+[eè]\s+il\s+mio\s+compleanno)\b/i,
    ],
  },
  {
    category: 'special_day',
    summaryKey: 'anniversary',
    patterns: [
      /(纪念日|结婚纪念日|恋爱纪念日)/i,
      /\b(anniversary|wedding\s+anniversary|dating\s+anniversary)\b/i,
      /\b(anniversario|anniversario\s+di\s+matrimonio)\b/i,
    ],
  },
  {
    category: 'special_day',
    summaryKey: 'graduation_day',
    patterns: [
      /(毕业典礼|毕业日|今天毕业)/i,
      /\b(graduation\s+day|commencement|graduated\s+today|graduation\s+ceremony)\b/i,
      /\b(cerimonia\s+di\s+laurea|mi\s+sono\s+laureat[oa]\s+oggi|giorno\s+della\s+laurea)\b/i,
    ],
  },
  {
    category: 'major_event',
    summaryKey: 'relationship_change',
    patterns: [
      /(分手|离婚|结束关系)/i,
      /\b(breakup|broke\s+up|divorce|divorced|heartbroken)\b/i,
      /\b(rottura|ci\s+siamo\s+lasciati|divorzio|cuore\s+spezzato)\b/i,
    ],
  },
  {
    category: 'major_event',
    summaryKey: 'marriage_or_engagement',
    patterns: [
      /(结婚了|领证了|订婚了|求婚成功)/i,
      /\b(got\s+married|we\s+got\s+married|engaged|got\s+engaged|proposal\s+accepted)\b/i,
      /\b(ci\s+siamo\s+sposati|mi\s+sono\s+sposat[oa]|fidanzat[oi]|proposta\s+accettata)\b/i,
    ],
  },
  {
    category: 'major_event',
    summaryKey: 'career_offer_or_admission',
    patterns: [
      /(拿到offer|收到offer|offer到手|被录取|录取通知|通过面试|上岸了)/i,
      /\b(got\s+an\s+offer|received\s+an\s+offer|offer\s+came\s+through|accepted\s+into|got\s+admitted|admitted\s+to)\b/i,
      /\b(offerta\s+di\s+lavoro|ho\s+ricevuto\s+un\s+offerta|ammess[oa]|sono\s+stat[oa]\s+ammess[oa])\b/i,
    ],
  },
  {
    category: 'major_event',
    summaryKey: 'job_change',
    patterns: [
      /(入职|离职|辞职|被裁|裁员|失业|待业|转岗|换工作|最后一天上班)/i,
      /\b(start(ed)?\s+(a\s+)?new\s+job|joined\s+(a\s+)?new\s+team|resigned|quit\s+my\s+job|laid\s+off|fired|lost\s+my\s+job|unemployed|last\s+day\s+at\s+work|switched\s+jobs?)\b/i,
      /\b(nuovo\s+lavoro|ho\s+iniziato\s+un\s+nuovo\s+lavoro|dimissioni|mi\s+sono\s+dimess[oa]|licenziat[oa]|disoccupat[oa]|ultimo\s+giorno\s+di\s+lavoro)\b/i,
    ],
  },
  {
    category: 'major_event',
    summaryKey: 'relocation',
    patterns: [
      /(搬家|乔迁|搬到新家|迁居|搬宿舍)/i,
      /\b(moving\s+house|moved\s+to\s+a\s+new\s+place|relocated|moved\s+apartments?)\b/i,
      /\b(trasloco|mi\s+sono\s+trasferit[oa]|cambio\s+casa)\b/i,
    ],
  },
  {
    category: 'major_event',
    summaryKey: 'pregnancy_or_birth',
    patterns: [
      /(怀孕|有宝宝了|生宝宝|生孩子|当爸了|当妈了|产检)/i,
      /\b(pregnant|expecting\s+a\s+baby|had\s+a\s+baby|gave\s+birth|became\s+a\s+parent|prenatal\s+checkup)\b/i,
      /\b(incint[ao]|aspettiamo\s+un\s+bambino|ho\s+partorito|[eè]\s+nat[oa]\s+il\s+bambino|visita\s+prenatale)\b/i,
    ],
  },
  {
    category: 'major_event',
    summaryKey: 'bereavement',
    patterns: [
      /(去世|离世|过世|丧礼|葬礼|家里有人去世|亲人去世)/i,
      /\b(passed\s+away|died|funeral|bereavement|lost\s+a\s+family\s+member)\b/i,
      /\b([eè]\s+mort[oa]|decedut[oa]|funerale|lutto|ho\s+perso\s+un\s+familiare)\b/i,
    ],
  },
];

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEndOfLocalDayTimestamp(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();
}

function buildItemId(category: TodayContextCategory, summary: string, detectedAt: number): string {
  const normalized = summary.toLowerCase().replace(/\s+/g, '-').slice(0, 24);
  return `${category}-${normalized}-${detectedAt}`;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function makeSummary(category: TodayContextCategory, summaryKey: string): string {
  if (category === 'health') return `Health signal: ${summaryKey}`;
  if (category === 'special_day') return `Special day: ${summaryKey}`;
  return `Major event: ${summaryKey}`;
}

function hasRegexMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isNegatedHealthText(text: string): boolean {
  return hasRegexMatch(text, HEALTH_NEGATION_PATTERNS)
    && !hasRegexMatch(text, HEALTH_NEGATION_OVERRIDE_PATTERNS);
}

export function extractTodayContextSourceText(event: AnnotationEvent): string {
  const content = String(event.data?.content || '').trim();
  const mood = String(event.data?.mood || '').trim();
  const summary = String(event.data?.summary || '').trim();
  return [content, mood, summary].filter(Boolean).join(' ');
}

export function detectTodayContextItems(sourceText: string, now: Date): TodayContextItem[] {
  const normalizedText = normalizeText(sourceText);
  if (!normalizedText) return [];

  const detectedAt = now.getTime();
  const expiresAt = getEndOfLocalDayTimestamp(now);
  const items: TodayContextItem[] = [];
  const matchedCategories = new Set<TodayContextCategory>();

  for (const rule of TODAY_CONTEXT_RULES) {
    if (matchedCategories.has(rule.category)) continue;
    if (rule.category === 'health' && isNegatedHealthText(normalizedText)) continue;
    if (rule.excludes && hasRegexMatch(normalizedText, rule.excludes)) continue;
    if (!hasRegexMatch(normalizedText, rule.patterns)) continue;

    const summary = makeSummary(rule.category, rule.summaryKey);
    items.push({
      id: buildItemId(rule.category, summary, detectedAt),
      category: rule.category,
      summary,
      sourceText: sourceText.slice(0, 120),
      confidence: 0.86,
      detectedAt,
      expiresAt,
    });
    matchedCategories.add(rule.category);
  }

  return items;
}

function dedupeItems(items: TodayContextItem[]): TodayContextItem[] {
  const seen = new Set<string>();
  const output: TodayContextItem[] = [];

  for (const item of items) {
    const key = `${item.category}:${normalizeText(item.summary)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

export function createEmptyTodayContextSnapshot(now: Date): TodayContextSnapshot {
  return {
    date: getLocalDateString(now),
    items: [],
    version: 'v1',
  };
}

export function mergeTodayContextSnapshot(
  current: TodayContextSnapshot | undefined,
  incoming: TodayContextItem[],
  now: Date,
): TodayContextSnapshot {
  const today = getLocalDateString(now);
  const base = current?.date === today ? current : createEmptyTodayContextSnapshot(now);
  const unexpired = base.items.filter((item) => item.expiresAt >= now.getTime());
  const merged = dedupeItems([...incoming, ...unexpired])
    .sort((a, b) => b.detectedAt - a.detectedAt)
    .slice(0, TODAY_CONTEXT_MAX_ITEMS);

  return {
    date: today,
    items: merged,
    version: 'v1',
  };
}
