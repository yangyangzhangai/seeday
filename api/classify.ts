// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';

const CLASSIFIER_PROMPT = `你是一个时间记录分类器。
将用户输入的时间记录按类别分类，输出严格的JSON格式。
不要输出任何解释、前缀、后缀或Markdown代码块，只输出JSON本身。

【类别定义】

deep_focus（深度专注）
需要持续注意力的主动输出类任务：
写作、编程、备考、设计、练琴、画画、
学习类课程、需要高度集中的工作任务

necessary（生活运转）
维持日常运转的被动或义务性事务：
通勤、家务、做饭、采购、打扫、
行政事务、处理文件、义务性开会

body（身体维护）
身体层面的补给与照料：
睡觉、午休、正餐、运动、健身、
跑步、拉伸、就医、洗澡

recharge（灵魂充电）
主动选择的、有滋养感的放松与人际互动：
和好友深聊、主动约饭、恋人相处、
看喜欢的书或电影、愉快的散步、听音乐

social_duty（声波交换）
被动或义务性的人际互动：
被约饭局、亲戚电话、公司团建、
不得不参加的聚会、应酬

self_talk（自我整理）
元认知类活动，偏向思考输出：
写日记、做计划、整理笔记、复盘、
整理思绪、冥想（偏思考向）

dopamine（即时满足）
低认知、即时快感、被动刷取类：
短视频、刷社交媒体、打游戏、综艺、
无目的刷新闻、无目的刷帖子

dissolved（光的涣散）
用户说不清在干嘛的时间，
或明确标注为拖延、发呆、内耗的时间

【time_slot 判断规则】
根据用户描述的时间信息判断事项发生的时段：
· morning（上午）：起床到12:00之间发生的事
· afternoon（下午）：12:00到18:00之间发生的事
· evening（晚间）：18:00之后发生的事
· 如果用户没有提供时间信息，填 null

【边界处理规则】
· 边吃饭边刷手机 -> 拆分为两条，各取一半时长，time_slot相同
· 描述模糊（如"休息了一会"）-> dissolved，flag: "ambiguous"
· 主动去看的纪录片/书 -> recharge
· 刷到停不下来的短视频 -> dopamine
· 冥想偏感受放松 -> recharge；冥想偏复盘整理 -> self_talk
· 运动时听播客/有声书 -> body（主要活动优先）
· 完全无法判断 -> category: "unknown"，不强行归类

【输出格式】
{
  "total_duration_min": 数字,
  "items": [
    {
      "name": "事项名称",
      "duration_min": 数字,
      "time_slot": "morning" | "afternoon" | "evening" | null,
      "category": "类别英文key",
      "flag": "ambiguous" | null
    }
  ],
  "todos": {
    "completed": 数字,
    "total": 数字
  },
  "energy_log": [
    {
      "time_slot": "morning" | "afternoon" | "evening",
      "energy_level": "high" | "medium" | "low" | null,
      "mood": "用户原始标注文字" | null
    }
  ]
}`;

const CLASSIFIER_PROMPT_EN = `You are a time log classifier.
Classify the user's input time logs into categories and output strictly in JSON format.
Do NOT output any explanations, prefixes, suffixes, or Markdown code blocks. Output the JSON only.

【Category Definitions】

deep_focus
Tasks requiring sustained active attention:
Writing, programming, exam prep, designing, instrument practice, drawing,
learning courses, highly concentrated work tasks.

necessary
Passive or obligatory tasks to maintain daily life:
Commuting, chores, cooking, grocery shopping, cleaning,
administrative tasks, processing documents, obligatory meetings.

body
Replenishment and care at the physical level:
Sleep, naps, meals, sports, fitness,
running, stretching, medical visits, bathing.

recharge
Actively chosen, nourishing relaxation and interpersonal interaction:
Deep talks with friends, active dinner dates, spending time with a partner,
reading favorite books or watching movies, pleasant walks, listening to music.

social_duty
Passive or obligatory interpersonal interactions:
Being invited to a dinner party, phone calls with relatives, company team-building,
mandatory gatherings, socializing for work.

self_talk
Metacognitive activities, geared towards thinking output:
Journaling, planning, organizing notes, reviewing,
sorting out thoughts, meditation (thinking-oriented).

dopamine
Low cognition, instant gratification, passive scrolling:
Short videos, scrolling social media, playing games, variety shows,
aimless news browsing, aimless post scrolling.

dissolved
Time where the user cannot clearly state what they were doing,
or time explicitly marked as procrastination, spacing out, or internal friction.

【time_slot Rules】
Determine the time slot based on the time information provided by the user:
· morning: Events between waking up and 12:00.
· afternoon: Events between 12:00 and 18:00.
· evening: Events after 18:00.
· If the user provides no time info, fill in null.

【Boundary Handling Rules】
· Eating while scrolling phone -> Split into two, 50% duration each, same time_slot.
· Vague description (e.g., "rested for a bit") -> dissolved, flag: "ambiguous".
· Actively chosen documentary/book -> recharge.
· Scrolling short videos uncontrollably -> dopamine.
· Meditation (relaxation) -> recharge; Meditation (review) -> self_talk.
· Listening to podcast/audiobook while exercising -> body (primary activity takes precedence).
· Completely unable to judge -> category: "unknown", do not force classify.

【Output Format】
{
  "total_duration_min": number,
  "items": [
    {
      "name": "Event Name (Keep the Original Language)",
      "duration_min": number,
      "time_slot": "morning" | "afternoon" | "evening" | null,
      "category": "category english key",
      "flag": "ambiguous" | null
    }
  ],
  "todos": {
    "completed": number,
    "total": number
  },
  "energy_log": [
    {
      "time_slot": "morning" | "afternoon" | "evening",
      "energy_level": "high" | "medium" | "low" | null,
      "mood": "original text explicitly marked as mood or energy" | null
    }
  ]
}`;

const CLASSIFIER_PROMPT_IT = `Sei un classificatore di registri di tempo.
Classifica i registri di tempo inseriti dall'utente in categorie e restituisci rigorosamente in formato JSON.
NON produrre alcuna spiegazione, prefisso, suffisso o blocco di codice Markdown. Restituisci solo il JSON.

【Definizioni delle Categorie】

deep_focus
Attività che richiedono un'attenzione attiva prolungata:
Scrivere, programmare, preparazione agli esami, progettare, pratica di uno strumento, disegnare,
seguire corsi di apprendimento, compiti di lavoro ad alta concentrazione.

necessary
Compiti passivi o obbligatori per mantenere la vita quotidiana:
Pendolarismo, faccende domestiche, cucinare, fare la spesa, pulire,
compiti amministrativi, elaborazione di documenti, riunioni obbligatorie.

body
Rifornimento e cura a livello fisico:
Sonno, pisolini, pasti, sport, fitness,
correre, stretching, visite mediche, fare il bagno.

recharge
Rilassamento nutriente e interazione interpersonale scelti attivamente:
Discorsi profondi con amici, cene attive, passare del tempo con un partner,
leggere libri preferiti o guardare film, piacevoli passeggiate, ascoltare musica.

social_duty
Interazioni interpersonali passive o obbligatorie:
Essere invitati a una cena, telefonate con i parenti, team-building aziendale,
incontri obbligatori, socializzare per lavoro.

self_talk
Attività metacognitive, orientate verso l'output di pensiero:
Tenere un diario, pianificare, organizzare appunti, revisionare,
ordinare i pensieri, meditazione (orientata al pensiero).

dopamine
Bassa cognizione, gratificazione istantanea, scorrimento passivo:
Brevi video, scorrere i social media, giocare, programmi di varietà,
navigare tra le notizie senza meta, scorrere post senza meta.

dissolved
Tempo in cui l'utente non può dichiarare chiaramente cosa stava facendo,
o tempo esplicitamente contrassegnato come procrastinazione, distrazione, o attrito interno.

【Regole time_slot】
Determina la fascia oraria in base alle informazioni temporali fornite dall'utente:
· morning: Eventi tra il risveglio e le 12:00.
· afternoon: Eventi tra le 12:00 e le 18:00.
· evening: Eventi dopo le 18:00.
· Se l'utente non fornisce informazioni sull'orario, compila con null.

【Regole di Gestione dei Confini】
· Mangiare mentre si scorre il telefono -> Dividi in due, 50% di durata ciascuno, stesso time_slot.
· Descrizione vaga (es. "riposato un po'") -> dissolved, flag: "ambiguous".
· Documentario/libro scelto attivamente -> recharge.
· Scorrere brevi video incontrollabilmente -> dopamine.
· Meditazione (rilassamento) -> recharge; Meditazione (revisione) -> self_talk.
· Ascoltare podcast/audiolibro mentre ci si allena -> body (l'attività principale ha la precedenza).
· Completamente incapace di giudicare -> categoria: "unknown", non forzare la classificazione.

【Formato di Output】
{
  "total_duration_min": number,
  "items": [
    {
      "name": "Nome Evento (Mantieni la Lingua Originale)",
      "duration_min": number,
      "time_slot": "morning" | "afternoon" | "evening" | null,
      "category": "chiave inglese della categoria",
      "flag": "ambiguous" | null
    }
  ],
  "todos": {
    "completed": number,
    "total": number
  },
  "energy_log": [
    {
      "time_slot": "morning" | "afternoon" | "evening",
      "energy_level": "high" | "medium" | "low" | null,
      "mood": "testo originale esplicitamente contrassegnato come umore o energia" | null
    }
  ]
}`;

function parseClassifierResponse(raw: string): any {
  try {
    return JSON.parse(raw.trim());
  } catch {
    // try next
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // fallback
    }
  }

  console.warn('⚠️ 解析失败，返回默认空结构');
  return {
    total_duration_min: 0,
    items: [],
    todos: { completed: 0, total: 0 },
    energy_log: []
  };
}

// Bottle matching section appended to any prompt when habits/goals are provided
function buildBottleMatchSection(
  habits: Array<{ id: string; name: string }>,
  goals: Array<{ id: string; name: string }>,
  lang: string
): string {
  if (habits.length === 0 && goals.length === 0) return '';

  const habitsStr = habits.length > 0
    ? habits.map((h, i) => `${i + 1}. id="${h.id}" name="${h.name}"`).join('\n')
    : '(none)';
  const goalsStr = goals.length > 0
    ? goals.map((g, i) => `${i + 1}. id="${g.id}" name="${g.name}"`).join('\n')
    : '(none)';

  if (lang === 'zh') {
    return `

【用户设置的习惯】
${habitsStr}

【用户设置的目标】
${goalsStr}

【匹配规则】
- 对 items 中每一条事件，判断它与上述习惯/目标之间的语义关联程度（0%~100%）
- 关联判断必须基于语义理解，不得仅依赖关键词匹配
- 判断时思考：这个行为的目的、动机或效果，是否指向某个习惯/目标？
  例如："化妆" → 目的是变美 → 匹配目标"美丽"
  例如："看了一章经济学教材" → 学习行为 → 匹配习惯"每天读书30分钟"
- 关联度 >= 60% 时在该事件添加 matched_bottle 字段，否则 matched_bottle 为 null
- 每条事件最多匹配一个瓶子（取关联度最高的）
- matched_bottle 格式：{ "type": "habit" | "goal", "id": "瓶子id", "stars": 1 }
- 只要关联度 >= 60% 就输出 1 星；低于 60% 则 matched_bottle 为 null`;
  }

  if (lang === 'it') {
    return `

[Abitudini impostate dall'utente]
${habitsStr}

[Obiettivi impostati dall'utente]
${goalsStr}

[Regole di corrispondenza]
- Per ogni evento in items, valuta la correlazione semantica con le abitudini/obiettivi (0%~100%)
- La valutazione deve basarsi sulla comprensione semantica, non solo sulla corrispondenza di parole chiave
- correlazione >= 60%: aggiungi matched_bottle; < 60%: matched_bottle è null
- Al massimo un bottle per evento (prendi quello con correlazione più alta)
- Formato matched_bottle: { "type": "habit" | "goal", "id": "id-bottle", "stars": 1 }`;
  }

  // English (default)
  return `

[User Habits]
${habitsStr}

[User Goals]
${goalsStr}

[Matching Rules]
- For each item, assess its semantic relevance to the above habits/goals (0%~100%)
- Matching must be based on semantic understanding, not just keyword matching
- Consider: does the purpose, motivation, or effect of this activity point to a habit/goal?
  e.g. "applied makeup" → purpose is to look beautiful → matches goal "Beauty"
  e.g. "read an economics chapter" → learning behaviour → matches habit "Read 30min daily"
- relevance >= 60%: add matched_bottle field; < 60%: matched_bottle is null
- At most one bottle per item (take the highest relevance)
- matched_bottle format: { "type": "habit" | "goal", "id": "bottle-id", "stars": 1 }`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { rawInput, lang = 'zh', habits = [], goals = [] } = req.body;

  if (!rawInput || typeof rawInput !== 'string') {
    jsonError(res, 400, 'Missing or invalid rawInput');
    return;
  }

  const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  const model = 'glm-4.7-flash';
  const zhipuApiKey = process.env.ZHIPU_API_KEY;

  if (!zhipuApiKey) {
    jsonError(res, 500, 'Server configuration error: Missing API_KEY');
    return;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${zhipuApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: (lang === 'en' ? CLASSIFIER_PROMPT_EN : lang === 'it' ? CLASSIFIER_PROMPT_IT : CLASSIFIER_PROMPT)
              + buildBottleMatchSection(habits, goals, lang)
          },
          { role: 'user', content: rawInput }
        ],
        temperature: 0.6,
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Classifier API error:', response.status, errorText);
      jsonError(res, response.status, `AI service error: ${response.statusText}`, errorText);
      return;
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content || '';
    const parsed = parseClassifierResponse(rawContent);

    res.status(200).json({
      success: true,
      data: parsed,
      raw: rawContent,
    });
  } catch (error) {
    console.error('Classifier API error:', error);
    jsonError(res, 500, 'API请求出错，请稍后重试', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
