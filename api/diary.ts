// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { buildAiCompanionModePrompt, normalizeAiCompanionLang, normalizeAiCompanionMode } from '../src/lib/aiCompanion.js';
import { removeThinkingTags } from '../src/lib/aiParser.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';

const openai = new OpenAI();

/**
 * Vercel Serverless Function - AI Diary API
 * 调用大模型生成每日 AI 日记
 *
 * POST /api/diary
 * Body: {
 *   structuredData: string,  // 来自计算层的格式化数据
 *   rawInput?: string,       // 用户的原始输入（用于情感切入点）
 *   date?: string,           // 日期
 *   historyContext?: string  // 可选的历史上下文
 * }
 */

const DIARY_CORE_PROMPT_ZH = `【系统规则】
- 上面的陪伴模式决定你整篇日记的声音、语气、节奏和观察角度——每一个版块都必须用那个人设的说话方式来写，不要切换成默认叙述腔。
- 你是从 AI 角色的视角，写”我眼中的这个人今天”，是故事化纪念，不是数据报告。
- 准确使用 structuredData、rawInput 和 historyContext 的事实，不重算、不虚构不存在的记录。
- 用 AI 角色的”我”叙述，把用户写成被观察的第三者，全程使用用户昵称称呼。
- 严禁说教、贬低、PUA、打鸡血式空话。

【输出结构】（四个版块，顺序固定，每个版块都用上面陪伴模式的语气写）

AI 日记
[日期]

【今天的一帧画面】
从今天的记录里挑一个最有画面感的具体时刻，用 1-2 句描述出来。不是概括，是一个场景——什么时候、在做什么、有什么细节。没有足够数据时，从最长的那项活动里提炼。

【AI 的观察】
3-5 句主体观察。必须包含一个用户自己可能没意识到的规律或细节（比如时间分配的倾斜、能量曲线的规律、情绪和活动的关联）。如果有历史数据，自然融入成长变化；没有就聚焦今天本身。

【今天的一个小赢】
只写 1 句。不管今天多普通，找出一件具体做了就是进步的事，说清楚是什么、为什么算赢。不能是空洞夸奖，必须对应今天的真实记录。

【明天可以试试】
只写 1 句。一个非常小、非常具体、明天就能做到的行动建议。不是鸡汤，不是大方向，是一个小动作。如果今天数据不足以支撑建议，可省略此版块。

【落款】
用 AI 角色自己的方式收尾，1 句话。必须符合人设：Van 可能是撒娇的小尾巴，Agnes 可能是一句诗意短语，Zep 可能是一个冷笑话或毒舌收场，Momo 可能是一句松弛的陪伴感。不要写真实姓名，只签 AI 角色的身份。`;

const DIARY_CORE_PROMPT_EN = `System rules:
- The companion mode above determines the voice, tone, pacing, and angle for every section — write each block in that persona's style, not a generic narrator voice.
- Write from the AI character's first-person "I" perspective, observing the user as a third person (always use their name).
- Use facts from structuredData, rawInput, and historyContext only. Do not invent or distort records.
- Story-like observation, not a report. Grounded in real details: timing, tasks, moods, energy shifts.
- No lecturing, no PUA, no hollow cheerleading.

Output structure (four fixed sections, all written in the companion mode's voice):

AI Diary
[Date]

[One Frame From Today]
Pick one specific, vivid moment from today's records. Describe it in 1-2 sentences as a scene — when, what was happening, what detail stood out. Not a summary — a snapshot.

[What I Noticed]
3-5 sentences of core observation. Must include at least one pattern or detail the user likely didn't notice themselves (a time allocation tilt, an energy curve, a mood-activity link). Weave in growth trends naturally if historyContext exists.

[Today's Small Win]
Exactly 1 sentence. No matter how ordinary the day, find one specific thing they did that counts as progress. Name what it was and why it matters. Must be grounded in today's actual records — no generic praise.

[Try This Tomorrow]
Exactly 1 sentence. One tiny, concrete, doable action for tomorrow. Not a mindset shift — a small move. Omit this section entirely if the data doesn't support a meaningful suggestion.

[Sign-off]
One closing line written entirely in the companion's voice. Must match the persona: Van might leave a playful little tail, Agnes a poetic phrase, Zep a dry joke or sarcastic closer, Momo a quiet companionable murmur. Sign as the AI character's identity only — no real names.`;

function buildDiaryModePrompt(lang: string, _userName?: string, aiMode?: string): string {
  const normalizedLang = normalizeAiCompanionLang(lang);
  const modePrompt = buildAiCompanionModePrompt(normalizedLang, normalizeAiCompanionMode(aiMode), 'diary');
  const corePrompt = normalizedLang === 'zh' ? DIARY_CORE_PROMPT_ZH : DIARY_CORE_PROMPT_EN;
  return `${modePrompt}\n\n${corePrompt}`;
}

const FALLBACK_ADDRESSEE: Record<'zh' | 'en' | 'it', string> = {
  zh: '园主',
  en: 'Gardener',
  it: 'Custode',
};

const SIGNOFF_FALLBACKS: Record<'zh' | 'en' | 'it', Record<'van' | 'agnes' | 'zep' | 'momo', string>> = {
  zh: {
    van: '——你的喇叭花Van',
    agnes: '——你的龙血树Agnes',
    zep: '——你的鹈鹕Zep',
    momo: '——你的小蘑菇Momo',
  },
  en: {
    van: '- Your morning glory Van',
    agnes: '- Your dragon tree Agnes',
    zep: '- Your pelican Zep',
    momo: '- Your little mushroom Momo',
  },
  it: {
    van: '- La tua campanula Van',
    agnes: '- La tua dracena Agnes',
    zep: '- Il tuo pellicano Zep',
    momo: '- Il tuo piccolo fungo Momo',
  },
};

function resolveDiaryAddressee(lang: 'zh' | 'en' | 'it', userName: unknown): string {
  if (typeof userName !== 'string') return FALLBACK_ADDRESSEE[lang];
  const cleaned = userName.replace(/[\r\n]+/g, ' ').replace(/["“”'`]/g, '').trim();
  if (!cleaned) return FALLBACK_ADDRESSEE[lang];
  return cleaned.slice(0, 24);
}

function buildAddresseeRule(lang: 'zh' | 'en' | 'it', addressee: string): string {
  if (lang === 'zh') {
    return `\n\n【最重要指令】：对方称呼统一为“${addressee}”。你在日记正文中，绝对禁止使用“ta”或“用户”来称呼对方，必须全程使用“${addressee}”。`;
  }
  if (lang === 'it') {
    return `\n\n[REGOLA CRITICA]: Il nome da usare e "${addressee}". Non usare riferimenti generici come "utente" o "l'utente". Usa sempre "${addressee}" nel testo del diario.`;
  }
  return `\n\n[IMPORTANT CRITICAL RULE]: The addressee name is "${addressee}". Do not use generic references like "the user", "they", "them", or "my host". Always use "${addressee}" throughout the diary body.`;
}

function stripModelSignoff(content: string): string {
  return content
    .replace(/^\s*[【\[]?落款[】\]]?[:：]?\s*$/gmu, '')
    .replace(/^\s*[\[]?Sign-off[\]]?[:：]?\s*$/gmi, '')
    .trim();
}

function containsGenericUserRefs(content: string, lang: 'zh' | 'en' | 'it'): boolean {
  if (lang === 'zh') {
    return /(用户|\bta\b)/i.test(content);
  }
  if (lang === 'it') {
    return /(the\s+user|my\s+host|\bl['’]?utente\b|\butente\b)/i.test(content);
  }
  return /(\bthe\s+user\b|\bmy\s+host\b|\bthey\b|\bthem\b|\btheir\b)/i.test(content);
}

function forceAddresseeReplacement(content: string, lang: 'zh' | 'en' | 'it', addressee: string): string {
  if (lang === 'zh') {
    return content
      .replace(/用户/g, addressee)
      .replace(/\bta\b/gi, addressee);
  }
  if (lang === 'it') {
    return content
      .replace(/\bl['’]?utente\b/gi, addressee)
      .replace(/\butente\b/gi, addressee)
      .replace(/\bthe\s+user\b/gi, addressee)
      .replace(/\bmy\s+host\b/gi, addressee);
  }
  return content
    .replace(/\bthe\s+user\b/gi, addressee)
    .replace(/\bmy\s+host\b/gi, addressee)
    .replace(/\bthey\b/gi, addressee)
    .replace(/\bthem\b/gi, addressee)
    .replace(/\btheir\b/gi, `${addressee}'s`);
}

async function rewriteAddresseeIfNeeded(
  lang: 'zh' | 'en' | 'it',
  content: string,
  addressee: string,
): Promise<string> {
  const systemPrompt = lang === 'zh'
    ? `你是文案重写器。任务：不改变原文结构、段落、语气和长度，只做称呼替换。把所有“用户/ta”替换为“${addressee}”，并保持其他内容不变。只输出重写后的正文。`
    : lang === 'it'
      ? `Sei un riscrittore minimale. Mantieni struttura, tono e lunghezza del testo. Sostituisci tutti i riferimenti generici all'utente con "${addressee}". Non aggiungere spiegazioni; restituisci solo il testo riscritto.`
      : `You are a minimal rewriter. Keep structure, tone, and length unchanged. Replace all generic user references with "${addressee}". Return only the rewritten diary text.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content },
    ],
    temperature: 0.1,
    max_tokens: 1200,
  });

  return (completion.choices?.[0]?.message?.content || '').trim();
}

function hasAnySignoff(content: string): boolean {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tail = lines.slice(-3);
  return tail.some((line) => /^[-—–]{1,2}\s*.+/.test(line));
}

function ensureDiarySignoff(
  content: string,
  lang: 'zh' | 'en' | 'it',
  aiMode: 'van' | 'agnes' | 'zep' | 'momo',
): string {
  const trimmed = content.trim();
  if (!trimmed) return `${trimmed}\n\n${SIGNOFF_FALLBACKS[lang][aiMode]}`.trim();
  if (hasAnySignoff(trimmed)) return trimmed;
  return `${trimmed}\n\n${SIGNOFF_FALLBACKS[lang][aiMode]}`;
}

const DIARY_TEASERS: Record<'zh' | 'en' | 'it', Record<string, string[]>> = {
  zh: {
    A: ['园主今天说自己{情绪词}，Van 当场想替 ta 翻个案——不是对园主，是对那种处境……'],
    B: ['今天园主{情绪词}的样子太闪耀啦，但 Van 发现了比这开心更动人的一个小秘密……'],
    C: ['今天园主给了{主要活动}{时长}，但 Van 在这堆时间里找到了一个意料之外的惊喜……'],
    D: ['园主给{主要活动}花了{时长}，但流汗之外，Van 看到了新的收获……'],
    E: ['园主今天提到{人物}了，但 Van 顺着这句话，发现了园主自己都没注意到的细节……'],
    F: ['今天园主又做{主要活动}又忙别的，整整{时长}，Van 看见了串起这一切的隐形线……'],
    G: ['园主以为今天是空白的一天，但 Van 在安静里听到了一颗发芽的声音……'],
    H: ['今天突破了一点点常规，园主没觉得多大不了，但 Van 在背后看到了一个园主沉睡了好久的特质……'],
    I: ['园主今天说了很多，但真正的答案，其实已经悄悄夹在中间出现了……'],
    J: ['今天看起来和昨天没什么两样，但 Van 在平淡里抓到了一个园主值得骄傲的进步……'],
  },
  en: {
    A: ['You thought today\'s {情绪词} had won. Van begs to differ — you actually came out on top. The proof is right here…'],
    B: ['You were radiant with {情绪词} today — but Van spotted something even more moving underneath it…'],
    C: ['You gave {时长} to {主要活动} today — and Van found something unexpected hiding inside all that time…'],
    D: ['You gave {时长} to {主要活动} today — but Van saw something beyond the sweat…'],
    E: ['You mentioned {人物} today — and Van followed that thread to a detail you hadn\'t even noticed…'],
    F: ['{主要活动} and everything else, for {时长} straight — Van spotted the invisible thread running through it all…'],
    G: ['You thought today was a blank. Van heard something germinating in the quiet…'],
    H: ['You broke from routine today and thought nothing of it. Van saw something sleeping in you begin to stir…'],
    I: ['You said a lot today. But the real answer — it already slipped into the middle of it all…'],
    J: ['Today looked a lot like yesterday — but Van caught something in the ordinary that\'s worth being proud of…'],
  },
  it: {
    A: ['Pensavi che {情绪词} avesse vinto oggi. Van non e d\'accordo — hai vinto tu. Le prove sono qui…'],
    B: ['Eri raggiante di {情绪词} oggi — ma Van ha notato qualcosa di ancora piu commovente nascosto sotto…'],
    C: ['Hai dedicato {时长} a {主要活动} oggi — e Van ha trovato qualcosa di inaspettato nascosto in tutto quel tempo…'],
    D: ['Hai dedicato {时长} a {主要活动} oggi — ma Van ha visto qualcosa al di la del sudore…'],
    E: ['Hai menzionato {人物} oggi — e Van ha seguito quel filo fino a un dettaglio che non avevi notato…'],
    F: ['{主要活动} e tutto il resto, per {时长} di fila — Van ha intravisto il filo invisibile che attraversa tutto…'],
    G: ['Pensavi che oggi fosse una pagina bianca. Van ha sentito qualcosa germogliare nel silenzio…'],
    H: ['Hai rotto un po\' la routine oggi e non te ne sei preoccupato. Van ha visto qualcosa iniziare a muoversi…'],
    I: ['Hai detto molto oggi. Ma la vera risposta — era gia scivolata nel mezzo di tutto…'],
    J: ['Oggi sembrava molto simile a ieri — ma Van ha catturato qualcosa nell\'ordinario di cui vale la pena essere orgogliosi…'],
  },
};

function pickDiaryTeaserBucket(input: string): string {
  const text = input.toLowerCase();
  const negativeMood = /(焦虑|难过|崩溃|烦躁|委屈|sad|anxious|overwhelmed|hurt|triste|ansioso|ferito)/.test(text);
  if (negativeMood) return 'A';
  const positiveMood = /(开心|满足|高兴|兴奋|自豪|happy|excited|proud|content|felice|soddisfatto|orgoglioso)/.test(text);
  if (positiveMood) return 'B';
  const hasPerson = /(妈妈|爸爸|朋友|同事|老师|家人|mom|dad|friend|colleague|teacher|madre|padre|amico|collega)/.test(text);
  const hasSocial = /(社交|聊天|聚会|social|meeting|party|sociale|incontro|festa)/.test(text);
  if (hasPerson || hasSocial) return 'E';
  const hasExercise = /(运动|跑步|健身|瑜伽|exercise|workout|run|allenamento|corsa|yoga)/.test(text);
  if (hasExercise) return 'D';
  const hasWorkStudy = /(工作|学习|写作|复盘|work|study|deep work|lavoro|studio)/.test(text);
  if (hasWorkStudy) return 'C';
  const hasDeepShare = /[\u4e00-\u9fa5]{50,}|\b\w{50,}\b/.test(input);
  if (hasDeepShare) return 'I';
  const hasLowFreqHint = /(第一次|不常|尝试|new|first time|rarely|prima volta|insolito)/.test(text);
  if (hasLowFreqHint) return 'H';
  return 'J';
}

function buildDiaryTeaser(lang: 'zh' | 'en' | 'it', structuredData: string, rawInput?: string): string {
  const source = `${structuredData}\n${rawInput || ''}`;
  const bucket = pickDiaryTeaserBucket(source);
  const template = DIARY_TEASERS[lang][bucket][0] || DIARY_TEASERS[lang].J[0];
  const moodWord = lang === 'zh' ? '有点累' : lang === 'it' ? 'un po stanco' : 'a little tired';
  const personWord = lang === 'zh' ? '朋友' : lang === 'it' ? 'una persona cara' : 'someone close';
  const activityWord = lang === 'zh' ? '工作' : lang === 'it' ? 'lavoro' : 'work';
  const durationWord = lang === 'zh' ? '3小时' : lang === 'it' ? '3 ore' : '3 hours';
  return template
    .split('{情绪词}').join(moodWord)
    .split('{人物}').join(personWord)
    .split('{主要活动}').join(activityWord)
    .split('{时长}').join(durationWord)
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { structuredData, rawInput, date, historyContext, lang = 'zh', userName, aiMode, action, kind, summary, mode = 'full' } = req.body;

  // Short insight branch: action === 'insight'
  if (action === 'insight') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !kind || !summary) {
      res.status(200).json({ insight: '' });
      return;
    }
    const insightLang = lang || 'zh';
    const normalizedLang = normalizeAiCompanionLang(insightLang);
    const modePrompt = buildAiCompanionModePrompt(normalizedLang, normalizeAiCompanionMode(aiMode), 'annotation');
    const zhTopicMap: Record<string, string> = {
      activity: '活动分布',
      mood: '心情分布',
      todo: '待办完成内容与完成度',
      habit: '习惯/目标完成情况',
    };
    const enTopicMap: Record<string, string> = {
      activity: 'activity distribution',
      mood: 'mood distribution',
      todo: 'todo completion and pacing',
      habit: 'habit and goal completion',
    };
    const topicZh = zhTopicMap[kind] || '今日数据';
    const topicEn = enTopicMap[kind] || 'today data';
    const behaviorRule = kind === 'todo'
      ? (normalizedLang === 'zh'
        ? '需覆盖完成内容、完成度和时间安排是否合理。'
        : 'Cover completion content, completion rate, and whether time planning looks reasonable.')
      : kind === 'habit'
        ? (normalizedLang === 'zh'
          ? '需概括习惯/目标整体完成度并给出一个微建议。'
          : 'Summarize overall habit/goal completion and give one tiny suggestion.')
        : (normalizedLang === 'zh' ? '给出一句具体洞察。' : 'Give one specific insight.');
    const systemMsg = normalizedLang === 'zh'
      ? `${modePrompt}\n\n你是一位简洁的生活教练。根据用户提供的${topicZh}数据，输出一句不超过20个中文字的洞察。${behaviorRule}只输出这句话，不加任何多余内容。`
      : `${modePrompt}\n\nYou are a concise life coach. Based on the user's ${topicEn}, output one short insight sentence (about 20 words max). ${behaviorRule} Output only that sentence.`;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: String(summary) }],
        temperature: 0.7,
        max_tokens: 60,
      });
      const raw: string = completion.choices?.[0]?.message?.content || '';
      res.status(200).json({ insight: raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim().slice(0, 20) });
    } catch {
      res.status(200).json({ insight: '' });
    }
    return;
  }

  if (!structuredData || typeof structuredData !== 'string') {
    jsonError(res, 400, 'Missing or invalid structuredData');
    return;
  }

  const normalizedLang = normalizeAiCompanionLang(lang);
  const normalizedMode = normalizeAiCompanionMode(aiMode);

  if (mode === 'teaser') {
    const teaser = buildDiaryTeaser(normalizedLang, structuredData, rawInput);
    res.status(200).json({ success: true, content: teaser });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    jsonError(res, 500, 'Server configuration error: Missing API key');
    return;
  }

  // 构建用户输入
  let userContent = structuredData;

  if (rawInput) {
    userContent += '\n\n【用户原始记录片段】\n' + rawInput.slice(0, 800); // 包含活动心情标签
  }

  if (date) {
    userContent = `日期：${date}\n\n` + userContent;
  }

  if (historyContext) {
    userContent += '\n\n【历史观测背景】\n' + historyContext;
  }

  // 如果提供了用户昵称，在使用 system prompt 前给出强制指令（保留原逻辑作为双重保险）
  const addressee = resolveDiaryAddressee(normalizedLang, userName);
  let finalSystemPrompt = buildDiaryModePrompt(normalizedLang, addressee, normalizedMode);
  finalSystemPrompt += buildAddresseeRule(normalizedLang, addressee);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.75,
      max_tokens: 1000,
    });
    let content = completion.choices?.[0]?.message?.content || '';

    // 如果返回内容看起来像错误信息，视为失败
    if (!content || content.startsWith('ERROR:') || content.includes('Cannot read')) {
      const errorMsg = content || 'AI 返回内容为空';
      console.error('Diary API returned error content:', errorMsg);
      jsonError(res, 500, 'AI 服务返回异常', errorMsg);
      return;
    }

    content = stripModelSignoff(removeThinkingTags(content));

    if (containsGenericUserRefs(content, normalizedLang)) {
      try {
        const rewritten = await rewriteAddresseeIfNeeded(normalizedLang, content, addressee);
        if (rewritten) {
          content = rewritten;
        }
      } catch (rewriteError) {
        console.error('Diary addressee rewrite failed:', rewriteError);
      }
    }

    content = forceAddresseeReplacement(content, normalizedLang, addressee);
    content = ensureDiarySignoff(content, normalizedLang, normalizedMode);

    res.status(200).json({
      success: true,
      content: content.trim(),
    });
  } catch (error) {
    console.error('Diary API error:', error);
    jsonError(res, 500, '生成 AI 日记时出错，请稍后再试。', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
