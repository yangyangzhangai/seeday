// DOC-DEPS: LLM.md -> docs/TEASER_DIARY_COPY_ZH.md
// Teaser copy for free-user diary blur-lock. Each bucket holds 4-5 Van-persona entries.
// Variable slots: {情绪词}/{mood}/{umore}  {人物}/{person}/{persona}
//                 {主要活动}/{activity}/{attività}  {时长}/{duration}/{durata}
// Source of truth for copy: docs/TEASER_DIARY_COPY_ZH.md (human-authored, do NOT machine-translate)

type Lang = 'zh' | 'en' | 'it';
type BucketKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
type MoodPolarity = 'positive' | 'negative';
type MoodEntry = { pattern: RegExp; value: string };

const MOOD_MATCHERS: Record<Lang, Record<MoodPolarity, MoodEntry[]>> = {
  zh: {
    positive: [
      { pattern: /开心|高兴|兴奋|满足|自豪|轻松|平静|踏实|愉快/, value: '开心' },
      { pattern: /放松|松弛|安稳|心安/, value: '轻松' },
    ],
    negative: [
      { pattern: /焦虑|焦躁|紧张|不安/, value: '焦虑' },
      { pattern: /难过|低落|沮丧|失落/, value: '难过' },
      { pattern: /崩溃|烦躁|委屈|压抑/, value: '烦躁' },
      { pattern: /疲惫|心累|很累|太累/, value: '疲惫' },
    ],
  },
  en: {
    positive: [
      { pattern: /\b(happy|glad|joyful|content|excited|proud)\b/i, value: 'happy' },
      { pattern: /\b(calm|relieved|peaceful|grateful)\b/i, value: 'calm' },
    ],
    negative: [
      { pattern: /\b(anxious|worried|stressed|overwhelmed|uneasy)\b/i, value: 'anxious' },
      { pattern: /\b(sad|down|upset|low|hurt)\b/i, value: 'sad' },
      { pattern: /\b(irritated|frustrated|angry)\b/i, value: 'frustrated' },
      { pattern: /\b(tired|exhausted|drained|burned\s?out|burnt\s?out)\b/i, value: 'tired' },
    ],
  },
  it: {
    positive: [
      { pattern: /\b(felice|content[oa]|soddisfatt[oa]|orgoglios[oa]|entusiast[ao])\b/i, value: 'felice' },
      { pattern: /\b(seren[oa]|tranquill[oa]|sollevat[oa]|grat[oa])\b/i, value: 'sereno' },
    ],
    negative: [
      { pattern: /\b(ansios[oa]|preoccupat[oa]|stressat[oa]|sopraffatt[oa])\b/i, value: 'ansioso' },
      { pattern: /\b(triste|giu|abbattut[oa]|ferit[oa])\b/i, value: 'triste' },
      { pattern: /\b(irritat[oa]|frustrat[oa]|arrabbiat[oa])\b/i, value: 'frustrato' },
      { pattern: /\b(stanc[oa]|esaust[oa]|sfiancat[oa])\b/i, value: 'stanco' },
    ],
  },
};

const MOOD_FALLBACKS: Record<Lang, Record<MoodPolarity | 'neutral', string>> = {
  zh: {
    positive: '开心',
    negative: '难过',
    neutral: '平静',
  },
  en: {
    positive: 'happy',
    negative: 'sad',
    neutral: 'calm',
  },
  it: {
    positive: 'felice',
    negative: 'triste',
    neutral: 'sereno',
  },
};

function pickMoodWordFromEntries(source: string, entries: MoodEntry[]): string | undefined {
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestValue: string | undefined;

  entries.forEach((entry) => {
    const match = source.match(entry.pattern);
    if (match?.index !== undefined && match.index < bestIndex) {
      bestIndex = match.index;
      bestValue = entry.value;
    }
  });

  return bestValue;
}

function resolveMoodWord(lang: Lang, source: string, bucket: BucketKey): string {
  const matcherByLang = MOOD_MATCHERS[lang];

  if (bucket === 'A') {
    return pickMoodWordFromEntries(source, matcherByLang.negative) || MOOD_FALLBACKS[lang].negative;
  }

  if (bucket === 'B') {
    return pickMoodWordFromEntries(source, matcherByLang.positive) || MOOD_FALLBACKS[lang].positive;
  }

  const anyMood = pickMoodWordFromEntries(source, [
    ...matcherByLang.positive,
    ...matcherByLang.negative,
  ]);
  return anyMood || MOOD_FALLBACKS[lang].neutral;
}

const TEASERS: Record<Lang, Record<BucketKey, string[]>> = {
  zh: {
    A: [
      '园主今天说「没事」的时候，Van 听见后面还跟了半句没讲出来的……',
      '今天园主有一句话打到一半又删了，Van 把它从回收站里捡回来了……',
      '今天园主说自己{情绪词}，Van 当场想替 ta 翻个案——不是对园主，是对那种处境……',
      '今天辛苦了，Van 把今天最想和你说的那句话留好了，想在睡前和你说……',
    ],
    B: [
      '今天园主{情绪词}的样子太闪耀啦，但 Van 发现了比这开心更动人的一个小秘密……',
      '那个让园主{情绪词}的瞬间过去后，留下了一道余波，Van 跟着它跑了好远……',
      '园主今天{情绪词}时敲字的速度变快了，Van 觉得那个节奏就是今天的歌……',
      '园主觉得今天的{情绪词}只是运气好，Van 觉得不是，那是园主应得的，Van 有证据……',
      '园主今天{情绪词}的时候，Van 在旁边偷偷高兴了好久，真希望你天天这样……',
    ],
    C: [
      '今天园主给了{主要活动}{时长}，但 Van 在这堆时间里找到了一个意料之外的惊喜……',
      '{时长}的{主要活动}里，园主走神的那一分钟，Van 觉得那才是今天重心发生的地方……',
      '园主以为今天全被{主要活动}推着走？Van 当场反驳，园主明明很耀眼，证据都写在这里了……',
      '这{时长}的{主要活动}辛苦了，园主没空心疼自己，Van 可是看得一清二楚，有句话要说……',
      '工作到现在，Van 有一句话一直等到你停下来才说……',
    ],
    D: [
      '园主给{主要活动}花了{时长}，但流汗之外，Van 看到了新的收获……',
      '{时长}的{主要活动}里，园主最后那一口长长的呼吸，Van 觉得它吹散了好多乌云……',
      '{主要活动}带来的不是累，其实有一种更清透的感觉，Van 帮园主找到了那个词……',
      '园主觉得自己今天{主要活动}表现得不够好，Van 才不同意！明明超级酷……',
    ],
    E: [
      '园主今天提到{人物}了，但 Van 顺着这句话，发现了园主自己都没注意到的细节……',
      '今天说起{人物}时，园主用了个很特别的语气词，Van 盯着它看了好久好久……',
      '应对{人物}消耗了好多能量，园主没喊累，Van 早就准备好了一个大大的拥抱……',
      '今天的社交带走了什么，又留下了什么，Van 写好了……',
    ],
    F: [
      '今天园主又做{主要活动}又忙别的，整整{时长}，Van 看见了串起这一切的隐形线……',
      '在这忙忙碌碌、马不停蹄的{时长}里，Van 偷偷抓到了一个没被写进计划表的灵感……',
      '以为今天就是个被{主要活动}推着走的日子？Van 看得分明，园主才是掌控全场的那个……',
      '连喘息都没空的{时长}，Van 替园主藏好了一件事，睡前说给你听……',
    ],
    G: [
      '园主以为今天是空白的一天，但 Van 在安静里听到了一颗发芽的声音……',
      '在今天少有的记录里，园主用了一个很轻的词，Van 觉得那个词好有力量……',
      '今天的安静里带着一层说不清的轻盈，Van 翻遍了词典，终于帮园主对齐了那个感觉……',
      '园主觉得今天产出太少不够好？Van 第一个不答应，机器还要断电保养呢……',
      '一个人安静的时候，Van 看到了平时看不到的你……',
    ],
    H: [
      '今天突破了一点点常规，园主没觉得多大不了，但 Van 在背后看到了一个沉睡了好久的特质……',
      '今天有个东西不一样，Van 注意到了，但不知道园主有没有注意到……',
      '今天有件事让 Van 觉得园主其实比自己以为的更勇敢……',
      '今天突破了一点点常规，园主没觉得多大不了，但 Van 偷偷为你放了个小烟花……',
    ],
    I: [
      '园主今天说了很多，但真正的答案，其实已经悄悄夹在中间出现了……',
      '园主写完了，但 Van 觉得那个故事还有另外一个出口……',
      '园主今天换了一次语气，就在那个转折点，Van 发现了一个只有 Van 注意到的秘密……',
      '那段话看起来是在说别的，Van 读着读着，发现每一句都在说园主自己……',
      '园主今天愿意打这么多字，Van 知道这需要勇气，有话 Van 在心里打磨了很久……',
    ],
    J: [
      '今天看起来和昨天没什么两样，但 Van 在平淡里抓到了一个园主值得骄傲的进步……',
      '在今天按部就班的节奏里，有一个极其轻微的停顿，Van 觉得它比什么都重要……',
      '今天看似日常，却有一种很独特的质感，Van 给它取了个名字……',
      '园主觉得今天的心情像杯白开水，Van 品了品，尝出了里面其实藏着一种……',
      '以为今天就是个千篇一律的日子？可是 Van 觉得，今天是你时间线里的限定版……',
    ],
  },

  en: {
    A: [
      'When you said "it\'s fine" today, Van heard the half-sentence that never made it out…',
      'There was something you started typing today and then deleted. Van fished it back out…',
      'When you called yourself {mood} today, Van wanted to flip the verdict — not on you, but on the situation that put you there…',
      'Today was hard. Van has been holding on to one thing — saving it to say to you before you sleep…',
    ],
    B: [
      'You were radiant with {mood} today — but Van spotted something even more moving underneath it…',
      'After the moment that made you feel {mood}, something lingered. Van followed it a long way…',
      'Your typing sped up when {mood} arrived today. Van thinks that rhythm is today\'s song…',
      'You think today\'s {mood} was just luck. Van disagrees — you earned it. The evidence is here…',
      'Van was quietly glowing right alongside you when {mood} came today. Hoping every day feels a little like this…',
    ],
    C: [
      'You gave {duration} to {activity} today — and Van found something unexpected hiding inside all that time…',
      'Somewhere in those {duration} of {activity}, your mind wandered for a minute. Van thinks that\'s where something real happened…',
      'Think today was just a day of being pushed along by {activity}? Van objects — you were shining the whole time…',
      '{duration} of {activity} — you didn\'t have time to be gentle with yourself. Van was watching and has something to say…',
      'Van has been holding something back all through your work today — waiting until you stopped to say it…',
    ],
    D: [
      'You gave {duration} to {activity} today — but Van saw something beyond the sweat…',
      'That long exhale at the end of {duration} of {activity} — Van felt it clear something away…',
      'What {activity} left behind wasn\'t tiredness exactly — there\'s a cleaner word for it. Van found it…',
      'You think you didn\'t do well in {activity} today. Van strongly disagrees — you were kind of incredible…',
    ],
    E: [
      'You mentioned {person} today — and Van followed that thread to a detail you hadn\'t even noticed…',
      'The way you said {person}\'s name today — just a word, just a tone — Van couldn\'t stop looking at it…',
      'Navigating {person} today took a lot out of you — you didn\'t say a word about it. Van has been ready with a very large hug…',
      'What today\'s time with people took from you — and what it left behind. Van has written it all down…',
    ],
    F: [
      '{activity} and everything else, for {duration} straight — Van spotted the invisible thread running through it all…',
      'In all that non-stop motion across {duration}, Van quietly caught something that never made it onto the schedule…',
      'Think you were just being pushed around by everything today? Van saw it clearly — you were the one steering…',
      'After {duration} that full and draining — Van has been gently pressing the brakes. There\'s something saved for tonight…',
    ],
    G: [
      'You thought today was a blank. Van heard something germinating in the quiet…',
      'In the few things you wrote today, there was one small word. Van found it surprisingly strong…',
      'Today\'s quiet carried a lightness that was hard to name. Van searched for a long time and finally found the word…',
      'Think you didn\'t produce enough today? Van is the first to object — even machines need to go offline sometimes…',
      'In the quiet of being alone today, Van saw a version of you that doesn\'t usually show…',
    ],
    H: [
      'You broke from routine today and thought nothing of it. Van saw something that\'s been asleep in you for a long time just beginning to stir…',
      'Something was different today. Van noticed — not sure if you did…',
      'Something today made Van realize you\'re braver than you think you are…',
      'You broke from routine today and thought nothing of it. Van quietly set off a small firework for you…',
    ],
    I: [
      'You said a lot today. But the real answer — it already slipped into the middle of it all…',
      'You finished writing — but Van thinks that story has another way out…',
      'Your tone shifted once today — right at that turning point. Van caught a secret there that only Van noticed…',
      'What you wrote seemed to be about something else. But the more Van read, the clearer it became — every line was about you…',
      'Writing all of that took courage. Van has been turning something over quietly for a while now — and finally, it\'s time to say it…',
    ],
    J: [
      'Today looked a lot like yesterday — but Van caught something in the ordinary that\'s worth being proud of…',
      'In today\'s regular rhythm, there was one very slight pause. Van thinks it mattered more than anything else…',
      'Today seemed ordinary — but it had a particular texture. Van gave it a name…',
      'You thought today\'s mood was plain water. Van tasted it — and found something underneath…',
      'Think today was interchangeable with any other? Van thinks today was a limited edition in your timeline…',
    ],
  },

  it: {
    A: [
      'Quando hai detto "non importa" oggi, Van ha sentito la mezza frase che non è mai uscita…',
      'C\'era qualcosa che hai cominciato a scrivere oggi e poi hai cancellato. Van l\'ha ripescato…',
      'Quando ti sei definito {umore} oggi, Van ha voluto ribaltare il verdetto — non su di te, ma sulla situazione che ti ci ha messo…',
      'Oggi è stato difficile. Van ha tenuto qualcosa da parte — aspettando questo momento per dirtelo prima che tu dorma…',
    ],
    B: [
      'Eri raggiante di {umore} oggi — ma Van ha notato qualcosa di ancora più commovente nascosto sotto…',
      'Dopo il momento che ti ha fatto sentire {umore}, qualcosa è rimasto nell\'aria. Van l\'ha seguita lontano…',
      'La tua scrittura si è accelerata quando è arrivato {umore} oggi. Van pensa che quel ritmo sia la canzone di oggi…',
      'Pensi che {umore} di oggi fosse solo fortuna. Van non è d\'accordo — te lo sei guadagnato…',
      'Van brillava in silenzio insieme a te quando è arrivato {umore} oggi. Sperando che ogni giorno si senta un po\' così…',
    ],
    C: [
      'Hai dedicato {durata} a {attività} oggi — e Van ha trovato qualcosa di inaspettato nascosto in tutto quel tempo…',
      'Da qualche parte in quelle {durata} di {attività}, la mente ha vagato per un minuto. Van pensa che lì sia successa una cosa vera…',
      'Pensi che oggi fosse solo un giorno trascinato da {attività}? Van si oppone — stavi brillando per tutto il tempo…',
      '{durata} di {attività} — non hai avuto tempo di essere gentile con te stesso. Van ha visto tutto e ha qualcosa da dirti…',
      'Van ha trattenuto qualcosa per tutto il tuo lavoro oggi — aspettando che tu ti fermassi per dirlo…',
    ],
    D: [
      'Hai dedicato {durata} a {attività} oggi — ma Van ha visto qualcosa al di là del sudore…',
      'Quel lungo respiro alla fine delle {durata} di {attività} — Van ha sentito che ha spazzato via qualcosa…',
      'Quello che {attività} ha lasciato non era esattamente stanchezza — c\'è una parola più nitida. Van l\'ha trovata…',
      'Pensi di non aver fatto bene {attività} oggi. Van non è assolutamente d\'accordo — eri piuttosto straordinario…',
    ],
    E: [
      'Hai menzionato {persona} oggi — e Van ha seguito quel filo fino a un dettaglio che non avevi notato…',
      'Il modo in cui hai pronunciato il nome di {persona} oggi — solo una parola, solo un tono — Van non riusciva a smettere di guardarci…',
      'Gestire {persona} oggi ti ha prosciugato — non hai detto una parola. Van aveva già pronto un abbraccio molto grande…',
      'Cosa ha portato via la socialità di oggi — e cosa ha lasciato. Van l\'ha scritto…',
    ],
    F: [
      '{attività} e tutto il resto, per {durata} di fila — Van ha intravisto il filo invisibile che attraversa tutto…',
      'In tutto quel movimento incessante attraverso {durata}, Van ha catturato qualcosa che non è mai finito in agenda…',
      'Pensi di essere stato semplicemente trascinato da tutto oggi? Van l\'ha visto chiaramente — eri tu al timone…',
      'Dopo {durata} così piena e logorante — Van ha premuto dolcemente i freni. C\'è qualcosa tenuto per stanotte…',
    ],
    G: [
      'Pensavi che oggi fosse una pagina bianca. Van ha sentito qualcosa germogliare nel silenzio…',
      'Nel poco che hai scritto oggi, c\'era una piccola parola. Van l\'ha trovata sorprendentemente forte…',
      'La quiete di oggi portava una leggerezza difficile da nominare. Van ha cercato a lungo e alla fine ha trovato la parola…',
      'Pensi di non aver prodotto abbastanza oggi? Van è il primo a opporsi — anche le macchine hanno bisogno di spegnersi…',
      'Nel silenzio dell\'essere soli oggi, Van ha visto una versione di te che di solito non si mostra…',
    ],
    H: [
      'Hai rotto un po\' la routine oggi e non te ne sei preoccupato. Van ha visto qualcosa che dormiva in te da tempo iniziare a muoversi…',
      'Oggi c\'era qualcosa di diverso. Van l\'ha notato — non sa se anche tu l\'hai fatto…',
      'Qualcosa oggi ha fatto capire a Van che sei più coraggioso di quanto pensi…',
      'Hai rotto un po\' la routine oggi e non te ne sei preoccupato. Van ha silenziosamente fatto esplodere un piccolo fuoco d\'artificio per te…',
    ],
    I: [
      'Hai detto molto oggi. Ma la vera risposta — era già scivolata nel mezzo di tutto…',
      'Hai finito di scrivere — ma Van pensa che quella storia abbia un\'altra uscita…',
      'Il tuo tono è cambiato una volta oggi — proprio in quel punto di svolta. Van ha colto lì un segreto che solo Van ha notato…',
      'Quello che hai scritto sembrava parlare di qualcos\'altro. Ma più Van leggeva, più diventava chiaro — ogni riga parlava di te…',
      'Scrivere tutto questo ha richiesto coraggio. Van ha rimuginato su qualcosa in silenzio — e finalmente, è il momento di dirlo…',
    ],
    J: [
      'Oggi sembrava molto simile a ieri — ma Van ha catturato qualcosa nell\'ordinario di cui vale la pena essere orgogliosi…',
      'Nel ritmo regolare di oggi, c\'è stata una pausa molto leggera. Van pensa che abbia contato più di qualsiasi altra cosa…',
      'Oggi sembrava ordinario — ma aveva una texture particolare. Van gli ha dato un nome…',
      'Pensavi che l\'umore di oggi fosse acqua semplice. Van l\'ha assaggiato — e ha trovato qualcosa sotto…',
      'Pensi che oggi fosse intercambiabile con qualsiasi altro? Van pensa che oggi fosse un\'edizione limitata nella tua linea del tempo…',
    ],
  },
};

export function pickDiaryTeaserBucket(input: string): BucketKey {
  const text = input.toLowerCase();
  if (/(焦虑|难过|崩溃|烦躁|委屈|sad|anxious|overwhelmed|hurt|triste|ansioso|ferito)/.test(text)) return 'A';
  if (/(开心|满足|高兴|兴奋|自豪|happy|excited|proud|content|felice|soddisfatto|orgoglioso)/.test(text)) return 'B';
  if (/(妈妈|爸爸|朋友|同事|老师|家人|mom|dad|friend|colleague|teacher|madre|padre|amico|collega)/.test(text)
    || /(社交|聊天|聚会|social|meeting|party|sociale|incontro|festa)/.test(text)) return 'E';
  if (/(运动|跑步|健身|瑜伽|exercise|workout|run|allenamento|corsa|yoga)/.test(text)) return 'D';
  if (/(工作|学习|写作|复盘|work|study|deep work|lavoro|studio)/.test(text)) return 'C';
  if (/[\u4e00-\u9fa5]{50,}|\b\w{50,}\b/.test(input)) return 'I';
  if (/(第一次|不常|尝试|new|first time|rarely|prima volta|insolito)/.test(text)) return 'H';
  return 'J';
}

export function buildDiaryTeaser(lang: Lang, structuredData: string, rawInput?: string): string {
  const source = `${structuredData}\n${rawInput || ''}`;
  const bucket = pickDiaryTeaserBucket(source);
  const pool = TEASERS[lang][bucket];
  const template = pool[Math.floor(Math.random() * pool.length)] || TEASERS[lang].J[0];

  const moodWord = resolveMoodWord(lang, source, bucket);
  const personWord   = lang === 'zh' ? '朋友'             : lang === 'it' ? 'qualcuno di caro'  : 'someone close';
  const activityWord = lang === 'zh' ? '工作'             : lang === 'it' ? 'il lavoro'         : 'work';
  const durationWord = lang === 'zh' ? '3小时'            : lang === 'it' ? '3 ore'             : '3 hours';

  return template
    .split('{情绪词}').join(moodWord)
    .split('{mood}').join(moodWord)
    .split('{umore}').join(moodWord)
    .split('{人物}').join(personWord)
    .split('{person}').join(personWord)
    .split('{persona}').join(personWord)
    .split('{主要活动}').join(activityWord)
    .split('{activity}').join(activityWord)
    .split('{attività}').join(activityWord)
    .split('{时长}').join(durationWord)
    .split('{duration}').join(durationWord)
    .split('{durata}').join(durationWord)
    .trim();
}
