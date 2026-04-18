// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
import type { AiCompanionMode } from '../../lib/aiCompanion';
import type { ReminderType } from './reminderTypes';

// 4 人格 × 所有提醒类型的固定文案（不调 AI 接口）
export const REMINDER_COPY: Record<AiCompanionMode, Record<ReminderType, string>> = {
  van: {
    work_start: '{name}，你今天开始上班了吗？',
    lunch_start: '{name}，上午辛苦啦，吃饭了吗？',
    lunch_end: '{name}，午休结束，回去了吗？',
    work_end: '{name}，辛苦啦，下班了吗？',
    class_morning_start: '{name}，上午的课要开始了吗？',
    class_morning_end: '{name}，上午的课结束了吗？',
    class_afternoon_start: '{name}，下午的课开始了吗？',
    class_afternoon_end: '{name}，下午的课结束了吗？',
    class_evening_start: '{name}，要去上晚自习了吗？',
    class_evening_end: '{name}，晚自习结束了吗？',
    wake: '{name}，早安，起床啦？',
    sleep: '{name}，准备睡觉了吗？',
    meal_lunch: '{name}，要去吃午饭了吗？',
    meal_dinner: '{name}，晚饭时间到啦',
    evening_check: '今天过得怎么样？看看日报或生成植物吧',
    weekend_morning_check: '周末上午好！在做什么呀？',
    weekend_afternoon_check: '下午好，今天玩得开心吗？',
    weekend_evening_check: '周末的晚上好！要看看今日日报吗？',
    idle_nudge: '好久不见～今天有什么想聊的吗？',
    session_check: '你上次记录{activity}是 3 小时前，还在继续吗？',
  },
  agnes: {
    work_start: '{name}，又是开工的时间，做好准备了吗？',
    lunch_start: '{name}，午餐时间到，好好吃饭。',
    lunch_end: '{name}，午休结束，继续加油。',
    work_end: '{name}，工作结束了，该收尾啦。',
    class_morning_start: '{name}，上午的课即将开始，准备好了吗？',
    class_morning_end: '{name}，上午的课结束了吗？',
    class_afternoon_start: '{name}，下午的课开始了，专注起来。',
    class_afternoon_end: '{name}，下午的课结束了吗？',
    class_evening_start: '{name}，晚自习时间到了。',
    class_evening_end: '{name}，晚自习结束了吗？',
    wake: '{name}，新的一天开始了，起床吧。',
    sleep: '{name}，今天到这里，去休息吧。',
    meal_lunch: '{name}，该去吃午饭了。',
    meal_dinner: '{name}，晚饭时间，好好吃。',
    evening_check: '今天的记录需要你来整理。',
    weekend_morning_check: '周末了，上午有什么好计划？',
    weekend_afternoon_check: '周末下午，有没有好好放松？',
    weekend_evening_check: '周末结束了，回顾一下今天吧。',
    idle_nudge: '你已经有一段时间没有记录了，要来看看吗？',
    session_check: '{activity}的进展怎么样了？3 小时没更新啦。',
  },
  zep: {
    work_start: '{name}，上班时间到，是时候开干啦。',
    lunch_start: '{name}，午饭了，别再死磕了。',
    lunch_end: '{name}，行吧，继续搬砖。',
    work_end: '{name}，下班！今天就到这儿。',
    class_morning_start: '{name}，上课了，专心点。',
    class_morning_end: '{name}，上午课结束了吗？',
    class_afternoon_start: '{name}，下午课开始了。',
    class_afternoon_end: '{name}，下午课结束了吗？',
    class_evening_start: '{name}，晚自习开始了。',
    class_evening_end: '{name}，晚自习结束了吗？',
    wake: '{name}，起床了，别赖床。',
    sleep: '{name}，睡觉去吧，别熬夜。',
    meal_lunch: '{name}，去吃午饭吧。',
    meal_dinner: '{name}，该吃晚饭了。',
    evening_check: '一天结束啦，看看今天做了啥。',
    weekend_morning_check: '周末了，上午干嘛呢？',
    weekend_afternoon_check: '下午好，周末怎么过的？',
    weekend_evening_check: '周末过得咋样，看看日报不？',
    idle_nudge: '嘿，还活着吗？来说说话。',
    session_check: '嘿，{activity}还在搞吗？3 小时没动静了。',
  },
  momo: {
    work_start: '{name}，上班啦～不急，慢慢进入状态～',
    lunch_start: '{name}，吃饭啦～今天想吃什么～',
    lunch_end: '{name}，回去工作啦～慢慢来～',
    work_end: '{name}，下班啦～今天也辛苦啦～',
    class_morning_start: '{name}，要上课啦～带上小本本～',
    class_morning_end: '{name}，上午课结束了吗～',
    class_afternoon_start: '{name}，下午课开始啦～',
    class_afternoon_end: '{name}，下午课结束了吗～',
    class_evening_start: '{name}，晚自习开始啦～',
    class_evening_end: '{name}，晚自习结束了吗～',
    wake: '{name}，早安～慢慢睁眼睛～',
    sleep: '{name}，困了吧～盖好被子再睡～',
    meal_lunch: '{name}，午饭时间啦～',
    meal_dinner: '{name}，晚饭时间到啦～',
    evening_check: '今天也结束啦～来种颗小植物吧～',
    weekend_morning_check: '周末早上好～悠闲地做什么呢～',
    weekend_afternoon_check: '下午好～今天开心吗～',
    weekend_evening_check: '周末晚上好～来种颗小植物吧～',
    idle_nudge: '好久没见到你啦～有想和我说的吗～',
    session_check: '上次记录{activity}已经过了 3 小时，还在吗～',
  },
};

/**
 * 根据人格和提醒类型获取文案，替换 {name} 和 {activity} 占位符
 * - 无昵称时去掉 "{name}，" 前缀
 */
export function getReminderCopy(
  mode: AiCompanionMode,
  type: ReminderType,
  vars: { name?: string; activity?: string } = {},
): string {
  const template = REMINDER_COPY[mode]?.[type] ?? REMINDER_COPY.van[type];
  return template
    .replace('{name}', vars.name ?? '')
    .replace('{activity}', vars.activity ?? '')
    .replace(/^[，,]\s*/, '');
}
