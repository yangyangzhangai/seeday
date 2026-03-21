// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// Chinese category lexicon – expands and replaces the sparse KEYWORDS object
// that previously lived in src/lib/activityType.ts.
//
// Design rule: every phrase present in activityLexicon.zh.ts MUST appear in
// at least one category below so that no recognised activity falls through to
// the 'life' default by lack of coverage.

import type { CategoryLexicon } from './types';

export const zhCategoryLexicon: CategoryLexicon = {
  keywords: {

    study: [
      // 核心学习词
      '学习', '复习', '预习', '课程', '上课', '听课', '下课',
      // 作业 / 题目
      '作业', '做作业', '做题', '刷题', '错题',
      // 考试备考
      '考试', '备考', '背单词', '背课文',
      // 阅读材料
      '看教材', '看论文', '读论文', '看书', '阅读文档',
      // 写作学术
      '写论文', '写作业', '写笔记', '做笔记', '查资料',
      // 英文
      'study', 'review', 'learn', 'lesson', 'homework', 'exam', 'quiz',
    ],

    work: [
      // 通用工作
      '工作', '上班', '办公', '开发',
      // 会议沟通
      '开会', '会议', '开组会', '组会', '开站会', '开视频会', '视频会议',
      '电话会议', '语音会议', '通电话', '接电话', '沟通', '复盘', '对齐',
      // 需求 / 项目
      '需求', '项目', '汇报', '做汇报', '准备汇报',
      // 写作输出
      '写周报', '写代码', '写方案', '改方案', '改代码', '写测试', '写用例',
      '写总结', '写文档', '做PPT', '写脚本', '写文章', '产出',
      '周报', '准备周报',
      '写报告', '改报告',
      // 邮件消息
      '发邮件', '查邮件', '回邮件', '回消息',
      // 其他工作动作
      '竞品分析', 'review', '对接', '上线',
      // 英文
      'work', 'meeting', 'project', 'task', 'office', 'code', 'deploy',
      'standup', 'sprint', 'debug', 'coding',
    ],

    social: [
      // 聊天交流
      '聊天', '闲聊', '唠嗑', '连麦',
      // 社交活动
      '约会', '聚会', '聚餐', '约饭', '见朋友', '探亲', '串门', '拜访', '面基',
      // 家庭
      '陪娃', '带娃', '接娃', '送娃', '遛娃',
      // 人际关系词
      '朋友', '家人', '电话',
      // 英文
      'social', 'friend', 'family', 'chat', 'call', 'hangout', 'party', 'date',
    ],

    life: [
      // 饮食
      '吃饭', '吃早饭', '吃早餐', '吃午饭', '吃晚饭', '做饭', '买菜', '干饭',
      '喝咖啡', '喝水', '接水', '点外卖', '拿外卖', '野餐',
      // 睡眠起居
      '睡觉', '午睡', '午休', '补觉', '起床', '洗漱', '刷牙', '洗澡',
      '护肤', '化妆', '洗头', '泡澡', '泡脚',
      // 家务清洁
      '洗衣服', '晾衣服', '换床单', '收拾房间', '打扫卫生', '做家务', '清洁',
      '倒垃圾', '洗碗', '浇花', '浇菜',
      // 出行购物
      '出门', '打车', '开车', '骑车', '坐地铁', '坐公交', '通勤', '赶路',
      '加油', '充电', '洗车',
      '买东西', '买咖啡', '逛超市',
      '取快递', '拿快递', '寄快递', '收快递', '拆快递',
      // 宠物杂事
      '遛狗', '遛猫', '喂猫', '喂狗', '喂鱼', '铲屎',
      // 医疗
      '看医生', '看牙医', '体检', '拿药',
      // 修缮
      '修东西',
      // 记账
      '记账',
      // 英文
      'life', 'meal', 'commute', 'chores', 'clean', 'cook', 'grocery', 'laundry',
      'errand', 'shopping',
    ],

    entertainment: [
      // 游戏
      '打游戏', '玩游戏', '开黑', '聚众开黑', '桌游', '打牌',
      // 影视动漫
      '看电影', '看小说', '看动漫', '追番', '追剧', '看展', '看演出', '看直播',
      // 短视频音乐
      '刷短视频', '听歌', '听播客', '看视频', '刷手机', '看手机',
      // 娱乐活动
      'k歌', '唱歌', '摸鱼',
      // 阅读休闲
      '看报纸', '看新闻', '刷新闻',
      // 英文
      'entertainment', 'game', 'movie', 'music', 'video', 'relax',
      'gaming', 'anime', 'podcast', 'novel', 'series',
    ],

    health: [
      // 跑步 / 步行
      '跑步', '跑完步', '散步', '遛弯', '遛弯儿',
      // 健身
      '运动', '健身', '健身房', '撸铁',
      // 球类
      '打球', '打羽毛球', '打篮球', '踢足球', '打网球', '打乒乓球',
      // 其他体育
      '拉伸', '瑜伽', '跳绳', '跳操', '游泳', '骑行', '爬山', '徒步', '登山', '露营',
      // 医疗保健
      '看医生', '看牙医', '体检', '拿药',
      // 英文
      'health', 'exercise', 'gym', 'run', 'walk', 'yoga', 'swim', 'hike',
      'workout', 'sport', 'fitness', 'stretching', 'cycling', 'pilates',
    ],
  },
};
