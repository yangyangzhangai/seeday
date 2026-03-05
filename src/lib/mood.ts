import type { MoodOption } from '../store/useMoodStore';

const options: MoodOption[] = ['happy', 'calm', 'focused', 'satisfied', 'tired', 'anxious', 'bored', 'down'];

const dict: Array<{ k: RegExp; m: MoodOption }> = [
  { k: /(跑步|运动|健身|瑜伽|舞)/i, m: 'happy' },
  { k: /(吃饭|用餐|午饭|午餐|晚饭|晚餐|早饭|早餐|宵夜|聚餐|外卖|点外卖|下馆子)/i, m: 'happy' },
  { k: /(完成|提交|通过|达成|搞定|收尾|交付|上线)/i, m: 'satisfied' },
  { k: /(专注|学习|上课|看书|阅读|写作|写作业|作业|写论文|备考|复习|编码|写代码|开发|设计|研究|办公|工作|上班)/i, m: 'focused' },
  { k: /(加班|疲倦|累|困|熬夜|休息不够|打瞌睡)/i, m: 'tired' },
  { k: /(排队|等候|堵车|发呆|无所事事|刷手机)/i, m: 'bored' },
  { k: /(失误|失败|延期|卡住|崩溃|故障|低落|难过|伤心)/i, m: 'down' },
  { k: /(担心|紧张|焦虑|害怕|压力山大|担忧|不安)/i, m: 'anxious' },
  { k: /(冥想|散心|喝茶|咖啡|散步|泡澡)/i, m: 'calm' },
];

export function autoDetectMood(content: string, durationMin: number): MoodOption {
  for (const r of dict) if (r.k.test(content)) return r.m;
  if (durationMin >= 120) return 'tired';
  if (durationMin >= 60) return 'focused';
  return 'calm';
}

export function allMoodOptions(): MoodOption[] {
  return options;
}
