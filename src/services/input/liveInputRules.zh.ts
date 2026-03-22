// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/ACTIVITY_LEXICON.md -> src/features/chat/README.md
import type { MoodKey } from '../../lib/moodOptions';
import { getLexicon } from './lexicon/getLexicon';

const zhLexicon = getLexicon('zh');
const { activity: zhActivity, mood: zhMood } = zhLexicon;

export const ZH_ACTIVITY_STRONG_PHRASES = [...zhActivity.strongPhrases];

export const ZH_ACTIVITY_VERBS = [...zhActivity.verbs];

export const ZH_ACTIVITY_SINGLE_VERB_PATTERNS = [
  /(起床了?|刚起床|刚睡醒)/,
  /吃[了过]?(饭|早饭|早餐|午饭|晚饭|夜宵)/,
  /复习(?!一下|会)[\u4e00-\u9fa5A-Za-z0-9·]{1,16}/,
  /学(?!会|期|校|历|到|着|过|一下)[\u4e00-\u9fa5A-Za-z0-9·]{1,16}/,
  /学习[\u4e00-\u9fa5A-Za-z0-9·]{1,16}/,
  /看(?!起来|上去|来|法|到|见|开|懂|透|清|一下|会)[\u4e00-\u9fa5A-Za-z0-9·]{1,16}/,
  /练(?!习惯|一下|会)[\u4e00-\u9fa5A-Za-z0-9·]{1,16}/,
  /背(?!锅|景|后|下来)[\u4e00-\u9fa5A-Za-z0-9·]{1,16}/,
  /写(代码|周报|作业|方案|文档|报告|论文)/,
  /做(作业|饭|题|计划|决定|项目)/,
  /开(会|晨会|例会)/,
  /学(习|英语|数学|单词)/,
  /背(单词|课文)/,
  /刷(题|视频)/,
  /跑(步|完步)/,
  /改(代码|文档|方案|报告)/,
  /打(球|电话)/,
  /通(电话|话)/,
  /看(电影|剧)/,
  /看(小说|动漫|动画|番剧)/,
  /(追番|追剧)/,
  /(睡觉了?|午睡了?)/,
  /(刷牙|洗漱|洗脸|护肤|化妆)/,
  /(洗头|洗衣服?|晾衣服?)/,
  /(收拾房间|打扫卫生|做家务|清洁)/,
  /(遛狗|逛超市)/,
  /(买咖啡|喝咖啡|喝水|接水)/,
  /([取拿寄]快递)/,
  /(点外卖|拿外卖)/,
  /(倒垃圾|洗碗)/,
  /(刷手机|看手机|看视频|听歌)/,
  /(打游戏|玩游戏)/,
  /(聊天|闲聊|唠嗑|连麦)/,
  /(约饭|干饭|聚会|聚餐)/,
  /(开黑|组队开黑)/,
  /(面基|逛街|压马路|探店|citywalk)/i,
  /(撸铁)/,
  /(做饭|买菜)/,
  /(坐(地铁|公交)|通勤(上班)?|赶路)/,
  /午休睡(了|得)/,
  /(打车|开车|骑车|骑行)/,
  /(拉伸|瑜伽|跳绳|跳操|游泳)/,
  /(羽毛球|篮球|足球|网球|乒乓球|徒步|爬山|登山)/,
  /(看展|看演出|看直播|刷短视频|听播客)/,
  /(k歌|唱歌|桌游|打牌)/i,
  /(约会|见朋友|探亲|串门|拜访)/,
  /(陪娃|带娃|接娃|送娃|喂猫|喂狗|遛猫|铲屎)/,
  /(泡澡|泡脚)/,
  /去洗个澡/,
  /到公司/,
  /出门了?/,
  /买到.+/,
  /刚把(作业|报告|文档|方案).*(交了|提交了)/,
  /做了(决定|选择|计划)/,
  /和(客户|朋友|家人).*(会开|开会|沟通|通话)/,
  /(在|刚在|正在)搞/,
  /搞定了?$/,
  /去健身房/,
  /(做|写)PPT/,
  /发邮件/,
  /回消息/,
  /写(测试|用例|文章|文档|脚本|总结)/,
  /(听|看)(课|讲座|播客)/,
  /(收|拆)快递/,
  /浇花/,
  /(换|洗)床单/,
  /修(东西|电脑|车|水管)/,
  /接(了)?(个)?(电话|客户电话)/,
  /产出(了)?.*文章/,
  /被老板骂/,
  /汇报通过/,
  /论文改(到)?崩溃/,
];

export const ZH_ACTIVITY_ONGOING_PATTERNS = [/(在|正在|刚在).*(开会|学习|复习|工作|上课|写|做|改|背单词|刷题)/, /(开会|学习|工作|上课|通话|会议|视频通话)中/];

export const ZH_STRONG_COMPLETION_PATTERNS = [
  /(刚|刚刚).*(开完|写完|做完|吃完|忙完|通完|打完).*/,
  /已经.*(开完|写完|做完|吃完|结束|搞定|完成|打完).*/,
  /(开完了|写完了|做完了|吃完了|结束了|搞定了|完成了|下课了|打完了|开完会了|考完了)$/,
  /(刚|刚刚).*(交了|提交了).*/,
  /(done with|finished)/i,
  /finito!?$/i,
];

export const ZH_WEAK_COMPLETION_WORDS = ['终于', '总算', '松口气', '撑过去'];

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
  'PPT',
  '文章',
  '需求',
  '错题',
  '原型',
  '总结',
  '邮件',
  '消息',
  '笔记',
  '课',
  '资料',
  '代码',
  'bug',
  'Bug',
  'BUG',
  '测试',
  '论文',
  '汇报',
  '球',
  '报纸',
  '新闻',
  '日记',
  '账单',
  '笔记',
  '教材',
  '论文',
  '邮件',
  '会议',
  '视频会',
  '医生',
  '牙医',
  '体检',
  '药',
  '娃',
  '鱼',
  '车',
];

export const ZH_PLACE_NOUNS = [
  '公园',
  '博物馆',
  '超市',
  '商场',
  '菜市场',
  '图书馆',
  '公司',
  '学校',
  '医院',
];

export const ZH_MOOD_WORDS = [...zhMood.allMoodWords];

export const ZH_MOOD_PATTERNS = [...zhMood.moodSentencePatterns];

export const ZH_EVALUATION_WORDS = [
  '终于',
  '总算',
  '可算',
  '太难了',
  '好爽',
  '好充实',
  '后悔',
  '不太对',
  '有成就感',
  '很有收获',
  '白忙了',
  '太值了',
  '太亏了',
  '好久没有',
  '上头',
  '踏实',
  '很崩',
];

export const ZH_LAST_ACTIVITY_REFERENCES = [
  '这件事',
  '这件事情',
  '这个',
  '刚才那个',
  '那个会',
  '那个电话',
  '那通电话',
  '那节课',
  '那次训练',
  '那个任务',
  '那份作业',
  '那次沟通',
  '那次会',
  '那通会',
  '那件活',
  '这波训练',
  '刚那节课',
  '刚才',
  '这种感觉',
];

export const ZH_FINISHING_PHRASES = ['做完了', '写完了', '结束了', '搞定了', '完成了', '弄完了', '看完了', '读完了', '上完线', '开完了', '开完会了', '下课'];

export const ZH_NEW_ACTIVITY_SWITCHES = ['然后', '接着', '后来去', '再去', '去'];

export const ZH_FUTURE_OR_PLAN_PATTERNS = [
  /明天.+/,
  /明天要.+/,
  /待会(儿)?(去|要)?/,
  /等下(去|要)?/,
  /一会(儿)?(去|要)?/,
  /晚点(去|要)?/,
  /准备去.+/,
  /要去.+/,
  /打算去.+/,
  /计划去.+/,
];

export const ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS = [
  /什么都不想做/,
  /什么都没做/,
  /(学|看|写|读).{0,3}不下去/,
  /(学|看|读).{0,3}不进去/,
  /(写|做|干).{0,3}不动(了)?/,
  /(做|干).{0,3}不下去/,
  /(学|看|写|做|干|读).{0,3}(提不起劲|提不起精神)/,
  /(学|看|写|做|干|读).{0,3}(没状态|没心情)/,
  /不想(开会|学习|上课|上班|运动|跑步|做|写)/,
  /想去.+但没去/,
  /(没|没有)去(过)?(公园|博物馆|超市|商场|菜市场|图书馆|公司|学校|医院)?/,
  /(今天)?(没有|没)产出/,
  /(今天)?(没有|没)进展/,
];

export const ZH_NON_ACTIVITY_PATTERNS = [
  ...ZH_FUTURE_OR_PLAN_PATTERNS,
  ...ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS,
];

export const ZH_TRAILING_PARTICLES = /[啊呀呢吧嘛哦哈]$/g;

export const ZH_PUNCT_ONLY = /^[\p{P}\p{S}\s]+$/u;

export const ZH_MOOD_KEYWORDS: Array<{ pattern: RegExp; mood: MoodKey }> = [
  ...zhMood.explicitMoodMap,
];

export const ZH_CONTEXT_ACTIVITY_KEYWORDS = [
  ...ZH_ACTIVITY_STRONG_PHRASES,
  ...ZH_ACTIVITY_VERBS,
  ...ZH_ACTIVITY_OBJECTS,
  '开完',
  '写完',
  '做完',
  '吃完',
  '下课',
  '通话',
  '视频通话',
  '聚餐',
  '健身',
  '跑步',
  '周报',
  '报告',
  '作业',
  '会议',
].filter((token) => token.length >= 2);
