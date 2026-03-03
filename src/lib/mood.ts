import type { MoodOption } from '../store/useMoodStore';

const options: MoodOption[] = ['开心', '平静', '专注', '满足', '疲惫', '焦虑', '无聊', '低落'];

const dict: Array<{ k: RegExp; m: MoodOption }> = [
  { k: /(跑步|运动|健身|瑜伽|舞)/i, m: '开心' },
  { k: /(吃饭|用餐|午饭|午餐|晚饭|晚餐|早饭|早餐|宵夜|聚餐|外卖|点外卖|下馆子)/i, m: '开心' },
  { k: /(完成|提交|通过|达成|搞定|收尾|交付|上线)/i, m: '满足' },
  { k: /(专注|学习|上课|看书|阅读|写作|写作业|作业|写论文|备考|复习|编码|写代码|开发|设计|研究|办公|工作|上班)/i, m: '专注' },
  { k: /(加班|疲倦|累|困|熬夜|休息不够|打瞌睡)/i, m: '疲惫' },
  { k: /(排队|等候|堵车|发呆|无所事事|刷手机)/i, m: '无聊' },
  { k: /(失误|失败|延期|卡住|崩溃|故障|低落|难过|伤心)/i, m: '低落' },
  { k: /(担心|紧张|焦虑|害怕|压力山大|担忧|不安)/i, m: '焦虑' },
  { k: /(冥想|散心|喝茶|咖啡|散步|泡澡)/i, m: '平静' },
];

export function autoDetectMood(content: string, durationMin: number): MoodOption {
  for (const r of dict) if (r.k.test(content)) return r.m;
  if (durationMin >= 120) return '疲惫';
  if (durationMin >= 60) return '专注';
  return '平静';
}

export function allMoodOptions(): MoodOption[] {
  return options;
}
