// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import type { MoodKey } from '../../lib/moodOptions';

export const ZH_ACTIVITY_STRONG_PHRASES = [
  '开会',
  '学习',
  '复习',
  '写周报',
  '做作业',
  '运动',
  '散步',
  '洗澡',
  '吃饭',
  '去洗澡',
  '去吃饭',
  '开始学习',
  '摸鱼',
  '健身',
  '健身房',
  '上课',
  '上班',
  '工作',
  '背单词',
  '刷题',
  '跑完步',
];

export const ZH_ACTIVITY_VERBS = [
  '开会',
  '学习',
  '复习',
  '运动',
  '散步',
  '洗澡',
  '跑步',
  '整理',
  '开发',
  '阅读',
  '看书',
  '复盘',
  '沟通',
  '摸鱼',
  '健身',
  '上课',
  '上班',
  '工作',
  '刷题',
  '背单词',
];

export const ZH_ACTIVITY_SINGLE_VERB_PATTERNS = [
  /吃[了过]?(饭|早餐|午饭|晚饭)/,
  /写(代码|周报|作业|方案|文档|报告|论文)/,
  /做(作业|饭|题|计划|决定|项目)/,
  /开(会|晨会|例会)/,
  /学(习|英语|数学|单词)/,
  /背(单词|课文)/,
  /刷(题|视频)/,
  /跑(步|完步)/,
  /(在|刚在|正在)搞/,
  /搞定了?$/,
  /去健身房/,
];

export const ZH_ACTIVITY_OBJECTS = [
  '周报',
  '代码',
  '作业',
  '客户',
  '文档',
  '会议',
  '会',
  '方案',
  '项目',
  '报告',
  '饭',
];

export const ZH_MOOD_WORDS = [
  '开心',
  '烦',
  '焦虑',
  '累',
  '疲惫',
  '低落',
  '平静',
  '难受',
  '紧张',
  '满足',
  '崩溃',
  '无语',
  '糟糕',
  '压抑',
  '舒服',
  '放松',
  '没精神',
  '头疼',
  '后悔',
  '充实',
  '爽',
  '难',
  '状态差',
];

export const ZH_MOOD_PATTERNS = [
  /^好.+/,
  /^很.+/,
  /^有点.+/,
  /^今天状态.+/,
  /真.+/,
  /心情.+/,
];

export const ZH_EVALUATION_WORDS = ['终于', '总算', '可算', '太难了', '好爽', '好充实', '后悔'];

export const ZH_LAST_ACTIVITY_REFERENCES = ['这件事', '这件事情', '这个', '刚才那个', '那个会', '刚才', '这种感觉'];

export const ZH_FINISHING_PHRASES = ['做完了', '写完了', '结束了', '搞定了', '完成了'];

export const ZH_NEW_ACTIVITY_SWITCHES = ['然后', '接着', '后来去', '再去', '去'];

export const ZH_NON_ACTIVITY_PATTERNS = [
  /什么都不想做/,
  /什么都没做/,
  /不想(开会|学习|上课|上班|运动|跑步|做|写)/,
  /想去.+但没去/,
  /明天要.+/,
  /待会(儿)?(去|要)?/,
];

export const ZH_TRAILING_PARTICLES = /[啊呀呢吧嘛哦哈]$/g;

export const ZH_PUNCT_ONLY = /^[\p{P}\p{S}\s]+$/u;

export const ZH_MOOD_KEYWORDS: Array<{ pattern: RegExp; mood: MoodKey }> = [
  { pattern: /(开心|高兴|愉快|兴奋)/, mood: 'happy' },
  { pattern: /(平静|放松|安稳|松弛)/, mood: 'calm' },
  { pattern: /(专注|投入|高效)/, mood: 'focused' },
  { pattern: /(满足|踏实|有成就)/, mood: 'satisfied' },
  { pattern: /(累|疲惫|困|没精神)/, mood: 'tired' },
  { pattern: /(焦虑|紧张|不安|压力)/, mood: 'anxious' },
  { pattern: /(无聊|没劲)/, mood: 'bored' },
  { pattern: /(低落|难受|崩溃|糟糕|烦)/, mood: 'down' },
];
