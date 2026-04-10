// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_doc1_低叙事密度判定规范.docx

import type { CharacterId } from './lateral-association-sampler.js';
import type {
  NarrativeEventType,
  NarrativeTriggeredEvent,
} from './narrative-density-types.js';

type Lang = 'zh' | 'en' | 'it';

type EventRecord = { id: string; zh: string; en: string; it: string };

const NATURAL_EVENTS: Record<CharacterId, EventRecord[]> = {
  van: [
    { id: 'van_n_1', zh: '今天你晒到一点暖暖的阳光，叶尖都亮了一下。', en: 'You caught a warm patch of sunlight today, and your leaf tips lit up.', it: 'Oggi hai preso un raggio di sole caldo e le punte delle foglie si sono illuminate.' },
  ],
  agnes: [
    { id: 'agnes_n_1', zh: '今天温室里有一阵很轻的风，你不知不觉放松了下来。', en: 'A gentle breeze passed through the greenhouse today, and you relaxed without noticing.', it: 'Oggi nel vivaio e passata una brezza leggera e ti sei rilassato senza accorgertene.' },
  ],
  momo: [
    { id: 'momo_n_1', zh: '今天有只小虫子在你旁边打了个转，又慢慢飞走了。', en: 'A tiny bug circled by you today and then drifted away.', it: 'Oggi un piccolo insetto ti ha girato intorno e poi e volato via piano.' },
  ],
  zep: [
    { id: 'zep_n_1', zh: '今天角落里冒出一颗小小的新芽，像在悄悄给你打气。', en: 'A tiny new sprout appeared in the corner today, as if quietly cheering for you.', it: 'Oggi e spuntato un piccolo germoglio in un angolo, come per incoraggiarti piano.' },
  ],
};

const CHARACTER_MENTION_EVENTS: Record<CharacterId, EventRecord[]> = {
  van: [
    { id: 'van_c_1', zh: 'Momo 今天一直在找你，说想听你讲讲今天发生了什么。', en: 'Momo kept looking for you today and said they wanted to hear about your day.', it: 'Oggi Momo ti cercava sempre e diceva che voleva sapere com\'e andata la tua giornata.' },
  ],
  agnes: [
    { id: 'agnes_c_1', zh: 'Van 刚刚提到了你，还说你今天应该被好好夸一下。', en: 'Van mentioned you just now and said you deserve some praise today.', it: 'Van ti ha appena nominato e ha detto che oggi meriti davvero un complimento.' },
  ],
  momo: [
    { id: 'momo_c_1', zh: 'Agnes 今天念叨了你好几次，说你最近很努力。', en: 'Agnes mentioned you several times today and said you have been trying hard lately.', it: 'Oggi Agnes ti ha nominato diverse volte e ha detto che ultimamente ti stai impegnando molto.' },
  ],
  zep: [
    { id: 'zep_c_1', zh: 'Van 今天提到你时笑了一下，说你有在慢慢变好。', en: 'Van smiled when mentioning you today and said you are getting better step by step.', it: 'Van ha sorriso mentre ti nominava oggi e ha detto che stai migliorando passo dopo passo.' },
  ],
};

function pickByType(characterId: CharacterId, eventType: NarrativeEventType): EventRecord[] {
  if (eventType === 'natural_event') return NATURAL_EVENTS[characterId] || [];
  if (eventType === 'character_mention') return CHARACTER_MENTION_EVENTS[characterId] || [];
  return [];
}

export function buildNarrativeEventInstruction(params: {
  characterId: CharacterId;
  eventType: NarrativeEventType;
  lang: Lang;
  random?: () => number;
}): NarrativeTriggeredEvent | null {
  const random = params.random || Math.random;
  const pool = pickByType(params.characterId, params.eventType);
  if (!pool.length) return null;
  const index = Math.max(0, Math.floor(random() * pool.length) % pool.length);
  const selected = pool[index];
  const content = params.lang === 'en' ? selected.en : params.lang === 'it' ? selected.it : selected.zh;
  return {
    eventId: selected.id,
    eventType: params.eventType,
    instruction: `[今日小事] ${content}`,
  };
}
