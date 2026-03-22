// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> docs/ACTIVITY_LEXICON.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import {
  zhActivityLexicon,
} from './lexicon/activityLexicon.zh';

export const ZH_MAGIC_PEN_PUNCT_SPLITTER = /[，。；、\n]/;

export const ZH_MAGIC_PEN_CONNECTORS = ['然后', '后来', '顺便', '以及', '还要', '记得'];

export const ZH_MAGIC_PEN_ACTIVITY_EVIDENCE_WORDS = [
  '今天',
  '今早',
  '早上',
  '上午',
  '中午',
  '下午',
  '晚上',
  '刚刚',
  '刚才',
];

export const ZH_MAGIC_PEN_ACTIVITY_VERBS = Array.from(
  new Set([
    ...zhActivityLexicon.verbs,
    ...zhActivityLexicon.strongPhrases,
    '写方案',
    '改方案',
    '买菜',
    '通勤',
    '做家务',
  ]),
);

export const ZH_MAGIC_PEN_TODO_FUTURE_WORDS = [
  '待会',
  '一会',
  '稍后',
  '晚点',
  '今晚',
  '今夜',
  '之后',
  '明天',
  '这周',
  '本周',
  '本月',
];

export const ZH_MAGIC_PEN_TODO_RELATIVE_DATE_WORDS = ['今天', '明天', '后天'];

export const ZH_MAGIC_PEN_TODO_SAME_DAY_WORDS = [
  '待会',
  '等会',
  '一会',
  '稍后',
  '晚点',
  '马上',
  '今晚',
  '今夜',
  '晚上',
];

export const ZH_MAGIC_PEN_TODO_WEEKDAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

export const ZH_MAGIC_PEN_TODO_DATE_ANCHOR_PATTERN =
  '(?<![:：\\d])(明天|后天|今天|下周[一二三四五六日天]|\\d{1,2}[.-]\\d{1,2}(?!\\s*(?:点|时|分))|\\d{1,2}月\\d{1,2}(?:日|号)?)(?![:：\\d])';

export const ZH_MAGIC_PEN_TODO_DUTY_WORDS = ['记得', '提醒我', '要', '得', '需要', '别忘了', '还要'];

export const ZH_MAGIC_PEN_CROSS_DAY_WORDS = ['昨天', '前天', '上周', '上个月', '去年'];

export const ZH_MAGIC_PEN_UNPARSED_HINT_WORDS = ['心情', '烦', '开心', '低落', '不错', '很多事'];

export const ZH_MAGIC_PEN_PERIOD_WINDOWS: Record<string, { startHour: number; endHour: number }> = {
  今早: { startHour: 9, endHour: 11 },
  早上: { startHour: 9, endHour: 11 },
  上午: { startHour: 9, endHour: 11 },
  中午: { startHour: 12, endHour: 13 },
  下午: { startHour: 15, endHour: 17 },
  晚上: { startHour: 20, endHour: 21 },
};
