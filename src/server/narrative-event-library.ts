// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_doc1_低叙事密度判定规范.docx -> docs/timeshine_角色互提系统规范_v3.docx

import type { CharacterId } from './lateral-association-sampler.js';
import type {
  NarrativeEventType,
  NarrativeTriggeredEvent,
} from './narrative-density-types.js';
import { buildCharacterMentionPrompt } from './character-mention-spec.js';

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

function pickByType(characterId: CharacterId, eventType: NarrativeEventType): EventRecord[] {
  if (eventType === 'natural_event') return NATURAL_EVENTS[characterId] || [];
  return [];
}

export function buildNarrativeEventInstruction(params: {
  characterId: CharacterId;
  eventType: NarrativeEventType;
  lang: Lang;
  random?: () => number;
}): NarrativeTriggeredEvent | null {
  const random = params.random || Math.random;
  if (params.eventType === 'character_mention') {
    const mentionPrompt = buildCharacterMentionPrompt({
      characterId: params.characterId,
      lang: params.lang,
      random,
    });
    return {
      eventId: mentionPrompt.promptId,
      eventType: params.eventType,
      instruction: mentionPrompt.instruction,
    };
  }

  const pool = pickByType(params.characterId, params.eventType);
  if (!pool.length) return null;
  const index = Math.max(0, Math.floor(random() * pool.length) % pool.length);
  const selected = pool[index];
  const content = params.lang === 'en' ? selected.en : params.lang === 'it' ? selected.it : selected.zh;
  return {
    eventId: selected.id,
    eventType: params.eventType,
    instruction: content,
  };
}
