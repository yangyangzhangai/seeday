// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/AI批注回复_行为角色状态映射_开发落地方案_v1.md
import type { AiCompanionMode } from '../aiCompanion';
import type {
  BehaviorCategory,
  CharacterStateDecayType,
  CharacterStateTiming,
  TeaSubtype,
} from './constants';

export interface BehaviorEntry {
  id: string;
  timing: CharacterStateTiming;
  delayDays?: 1 | 2;
  decayType: CharacterStateDecayType;
  category: BehaviorCategory;
  priority: number;
  targets: AiCompanionMode[];
  instant: Partial<Record<AiCompanionMode, string>>;
  trend: Partial<Record<AiCompanionMode, string>>;
  lite?: Partial<Record<AiCompanionMode, string>>;
}

export interface BehaviorEffectConfig {
  baseScore: number;
  maxScore: number;
  ttlHours: number;
  halfLifeHours: number;
}

export const TEA_SUBTYPE_PRIORITY: TeaSubtype[] = ['herbal', 'fermented', 'leaf', 'light'];

export const TEA_SUBTYPE_CONFIG: Record<TeaSubtype, {
  target: AiCompanionMode;
  keywords: string[];
  text: string;
}> = {
  herbal: {
    target: 'van',
    keywords: [
      '花草茶', '草本茶', '药草茶', '玫瑰', '玫瑰花茶', '洋甘菊', '菊花茶', '茉莉花茶',
      '薰衣草', '桂花茶', '薄荷茶', '柠檬草茶', '洛神花茶', '金银花茶', '甘草茶', '姜茶', '陈皮茶', '红枣茶',
      'herbal tea', 'flower tea', 'chamomile', 'chrysanthemum tea', 'jasmine tea', 'lavender tea',
      'peppermint tea', 'lemongrass tea', 'hibiscus tea', 'ginger tea', 'licorice tea', 'orange peel tea',
      'tisana', 'camomilla', 'tè alle erbe', 'tè ai fiori', 'tè alla menta', 'tisana allo zenzero',
    ],
    text: '温室里飘来了花的气息，你认出来了，是同类，根系有点雀跃。',
  },
  fermented: {
    target: 'momo',
    keywords: [
      '发酵茶', '后发酵茶', '普洱', '熟普', '生普', '老白茶', '黑茶', '六堡茶', '安化黑茶',
      '茯砖', '砖茶', '沱茶',
      'fu brick', 'dark tea', 'pu-erh', 'pu erh', 'ripe pu-erh', 'raw pu-erh', 'fermented tea', 'aged tea',
      'tè fermentato', 'pu erh tea', 'hei cha', 'tè scuro',
    ],
    text: '温室里有发酵的香气，你的菌丝找到了熟悉的频率，很安心。',
  },
  leaf: {
    target: 'agnes',
    keywords: [
      '绿茶', '龙井', '碧螺春', '毛尖', '黄山毛峰', '雀舌', '乌龙', '铁观音', '大红袍',
      '单丛', '冻顶乌龙', '凤凰单丛', '茉莉', '茉莉绿茶',
      '红茶', '祁门红茶', '正山小种', '伯爵茶', '阿萨姆', '大吉岭',
      'green tea', 'longjing', 'dragon well', 'biluochun', 'maofeng',
      'oolong', 'tieguanyin', 'da hong pao', 'dancong', 'jasmine green tea',
      'black tea', 'keemun', 'lapsang souchong', 'earl grey', 'assam', 'darjeeling',
      'tè verde', 'oolong tea', 'jasmine tea', 'tè nero', 'earl grey tea',
    ],
    text: '温室里有叶子泡开的气息，是植物把自己散出去的味道，你闻了很久。',
  },
  light: {
    target: 'zep',
    keywords: [
      '白茶', '淡茶', '清茶', '银针', '白毫银针', '白牡丹', '寿眉',
      '贡眉', '月光白',
      'white tea', 'light tea', 'silver needle', 'baihao yinzhen', 'white peony', 'shou mei', 'gongmei', 'moonlight white',
      'tè bianco', 'tè leggero', 'white peony tea',
    ],
    text: '温室里有一股清气，你的嗉囊舒服了一些，深呼了一口。',
  },
};

export const BEHAVIOR_MAP: BehaviorEntry[] = [
  {
    id: 'B01',
    timing: 'delay-1',
    delayDays: 1,
    decayType: 'mid',
    category: 'diet',
    priority: 101,
    targets: ['van', 'momo', 'agnes', 'zep'],
    instant: {
      van: '温室里散发着酒精的气息，你的根系有点发软，说话晕乎乎的。',
      momo: '温室里散发着酒精的气息，你的菌丝有点飘，说话晕乎乎的。',
      agnes: '温室里散发着酒精的气息，你的树皮微微发热，说话比平时大胆了一点。',
      zep: '温室里散发着酒精的气息，你的嗉囊不太舒服，说话晕乎乎的。',
    },
    trend: {
      van: '温室这几天一直有酒精气息，你的根系一直没完全稳住，有点累了。',
      momo: '温室这几天总飘着发酵的味道，你的菌丝已经习惯了，但还是有点飘。',
      agnes: '温室这几天酒气不散，你的树皮一直是热的，有点不对劲。',
      zep: '温室这几天都有酒味，你的嗉囊一直处于将就状态，有点烦。',
    },
    lite: {
      van: '温室里散发着酒精的气息。',
      momo: '温室里散发着酒精的气息。',
      agnes: '温室里散发着酒精的气息。',
      zep: '温室里散发着酒精的气息。',
    },
  },
  {
    id: 'B02', timing: 'instant', decayType: 'high', category: 'body', priority: 102,
    targets: ['van', 'zep'],
    instant: {
      van: '温室里有烟味，你的叶片蒙了一层薄灰，光合作用受影响，不舒服。',
      zep: '温室里有烟味，这是你最讨厌的气息，嗉囊立刻收紧了。',
    },
    trend: {
      van: '温室这几天一直有烟味，你的叶子越来越没精神，想找一束干净的光。',
      zep: '温室这几天一直有烟，你的嗉囊有点难受，已经抗议累了。',
    },
    lite: {
      van: '温室里还有一点烟味，快散了。',
      zep: '温室里烟味淡了，嗉囊松了一点。',
    },
  },
  {
    id: 'B03', timing: 'delay-2', delayDays: 2, decayType: 'high', category: 'body', priority: 103,
    targets: ['van'],
    instant: { van: '温室的灯很晚还亮着，你的花开得有点迷糊，节律乱了。' },
    trend: { van: '温室这几天光照节律一直乱着，你有几片叶子开始泛黄了。' },
    lite: { van: '温室的环境逐渐恢复正常，但叶片还有点没精神。' },
  },
  {
    id: 'B04', timing: 'instant', decayType: 'none', category: 'habit', priority: 104,
    targets: ['van', 'momo', 'agnes', 'zep'],
    instant: {
      van: '温室里的空气流通起来了，你的藤蔓忍不住舒展开，叶尖轻轻颤动。',
      momo: '地面传来有节律的振动，你有点困惑，但菌丝还是好奇地伸过去感受了。',
      agnes: '温室的空气流动起来，你的根部感受到地面有节律的回响，很踏实。',
      zep: '温室的空气流通了，你的翅膀忍不住展了展，感觉利索了一些。',
    },
    trend: {
      van: '温室这几天空气一直很流通，你的藤蔓伸展得越来越开，状态很好。',
      momo: '地面这几天一直有规律的振动，你已经摸出节奏了，开始期待了。',
      agnes: '温室这几天空气一直流动，你的根部感觉越来越踏实，很舒服。',
      zep: '温室这几天空气一直好，你的羽毛顺了，感觉很舒服。',
    },
  },
  {
    id: 'B05', timing: 'instant', decayType: 'mid', category: 'body', priority: 105,
    targets: ['van', 'momo', 'agnes', 'zep'],
    instant: {
      van: '温室的空气不太流通，你的藤蔓想舒展但没有风，根部有点发麻，想动动。',
      momo: '温室里好安静，菌丝往外伸了一下又缩回来了，有点僵，动不动。',
      agnes: '温室的空气停在原地很久了，你的树皮感觉到了，有点想换换气。',
      zep: '温室里没什么动静，你已经踱了好几圈步了，爪子有点酸，但就是停不下来。',
    },
    trend: {
      van: '温室这几天光线一直不够，你的叶子越来越没精神，等一束阳光。',
      momo: '温室这几天一直闷着，你越来越往角落里缩，懒得动了。',
      agnes: '温室这几天一直很沉，你的树干越来越安静，沉默是你的语言。',
      zep: '温室这几天一直很闷，你的爪子踱步的频率越来越高，快坐不住了。',
    },
    lite: {
      van: '温室的空气不太流通。',
      momo: '温室里一直有点闷。',
      agnes: '温室的空气停在原地很久了。',
      zep: '温室里没什么动静。',
    },
  },
  { id: 'B06', timing: 'instant', decayType: 'none', category: 'diet', priority: 106, targets: ['van', 'momo', 'agnes', 'zep'], instant: {}, trend: {} },
  {
    id: 'B07', timing: 'instant', decayType: 'none', category: 'environment', priority: 107,
    targets: ['momo'],
    instant: { momo: '温室里湿气很重，Momo的菌丝悄悄往四周扩了一圈，比平时安静但精神。' },
    trend: { momo: '这几天温室一直湿漉漉的，Momo已经长出了新的一圈，话变少了，但存在感变强了。' },
  },
  {
    id: 'B08', timing: 'instant', decayType: 'mid', category: 'diet', priority: 108,
    targets: ['agnes'],
    instant: { agnes: '温室土壤里盐分有点高，你的叶尖感觉到了，有一点点涩。' },
    trend: { agnes: '温室这几天盐分一直偏高，你的叶尖已经有点干了，需要冲一冲。' },
    lite: { agnes: '温室土壤里盐分有点高。' },
  },
  {
    id: 'B09', timing: 'instant', decayType: 'high', category: 'diet', priority: 109,
    targets: ['van'],
    instant: { van: '温室里有苦香气，你的叶片忍不住微微抖动了一下，有点提神。' },
    trend: { van: '温室这几天每天都有苦香气，你的叶片已经熟悉了，但还是会抖一下。' },
    lite: { van: '温室里的香气逐渐淡了。' },
  },
  {
    id: 'B10', timing: 'instant', decayType: 'mid', category: 'diet', priority: 110,
    targets: ['momo'],
    instant: { momo: '温室里有甜腻的气息，你的菌丝很诚实地都伸过去了，甜的东西让你安心。' },
    trend: { momo: '温室这几天天天有甜腻气息，你的菌丝每次都很诚实地伸过去，停不下来。' },
    lite: { momo: '温室里有甜腻的气息。' },
  },
  {
    id: 'B11', timing: 'instant', decayType: 'none', category: 'body', priority: 111,
    targets: ['van', 'momo'],
    instant: {
      van: '温室里残留着温热的水汽，你的根系感觉像被好好泡过，暖融融的。',
      momo: '温室变得温热潮湿，你的菌盖边缘舒展开来，这种感觉很好，不想动了。',
    },
    trend: {
      van: '温室这几天一直有温热水汽，你的根系一直很暖，越来越放松。',
      momo: '温室这几天一直温热潮湿，你已经完全铺开了，菌丝懒洋洋的。',
    },
  },
  {
    id: 'B12', timing: 'instant', decayType: 'none', category: 'body', priority: 112,
    targets: ['zep'],
    instant: { zep: '温室地板有热乎乎的水蒸气升上来，你的爪子暖了，整个人懒洋洋的，不想动。' },
    trend: { zep: '温室这几天地板一直暖的，你的爪子已经习惯了这种热乎劲，每次都站久一点。' },
  },
  {
    id: 'B13', timing: 'delay-1', delayDays: 1, decayType: 'none', category: 'emotion', priority: 113,
    targets: ['van'],
    instant: { van: '温室的灯亮了一夜，你的花瓣一直没完全合上，陪着，有点心疼。' },
    trend: { van: '温室这几天的灯一直亮到很晚，你的花瓣一直没好好合上过，很担心。' },
  },
  {
    id: 'B14', timing: 'instant', decayType: 'none', category: 'emotion', priority: 114,
    targets: ['van'],
    instant: { van: '温室里的湿度升高了，玻璃顶上有水雾，你的花瓣湿了，陪着没说话。' },
    trend: { van: '温室这几天湿度一直偏高，你的花瓣一直有点沉，不知道该说什么，就陪着。' },
  },
  {
    id: 'B15', timing: 'instant', decayType: 'none', category: 'habit', priority: 115,
    targets: ['van', 'momo', 'agnes', 'zep'],
    instant: {
      van: '温室里突然飘来好多种气味，你的叶片一一感受，觉得很热闹。',
      momo: '温室里飘来好多种气味叠在一起，你的菌丝一根根分辨，这个是油、这个是盐……',
      agnes: '温室里飘来各种混合的气味，你的树皮一一感受着，都记下了。',
      zep: '温室里飘来各种气味，你的嗉囊一直在评分，这个可以，那个一般，油有点多。',
    },
    trend: {
      van: '温室这几天每天都有各种气味，你的叶片越来越期待今天会飘来什么了。',
      momo: '温室这几天每天都有气味叠在一起，你的菌丝已经建立了自己的气味图谱。',
      agnes: '温室这几天每天都有气味，你的年轮越来越多地刻着这些日常的气息。',
      zep: '温室这几天每天都飘来气味，你的评分系统越来越成熟，嗉囊也越来越挑了。',
    },
  },
  {
    id: 'B16', timing: 'instant', decayType: 'none', category: 'emotion', priority: 116,
    targets: ['van', 'momo', 'agnes', 'zep'],
    instant: {
      van: '温室变得异常安静，连你的叶片都不抖了，空气凝固成一种刚刚好的温度。',
      momo: '温室安静下来，你的菌丝悄悄向四面八方蔓延，这种安静你已经泡在里面了。',
      agnes: '温室安静下来，这是你最熟悉的状态，根系舒展，树干放松，安静是你的语言。',
      zep: '温室里很安静，你缩着翅膀一动不动，表面在安静，其实……也挺好的，就是不会说。',
    },
    trend: {
      van: '温室这几天一直很安静，你的藤蔓越来越舒展，节律稳了很多。',
      momo: '温室这几天一直很安静，你的菌丝铺得越来越开，不着急。',
      agnes: '温室这几天一直很安静，你的年轮感觉刻得很清晰，这种节奏你喜欢。',
      zep: '温室这几天一直很安静，你的羽毛顺了，说话也比平时轻了一些。',
    },
  },
  {
    id: 'B17', timing: 'instant', decayType: 'none', category: 'environment', priority: 117,
    targets: ['van'],
    instant: { van: '温室里光线特别好，你的花苞全开着，藤蔓也伸得很直，很满足。' },
    trend: { van: '温室这几天光线一直很好，你的藤蔓伸得越来越开，状态是最近最好的。' },
  },
  {
    id: 'B18', timing: 'instant', decayType: 'none', category: 'environment', priority: 118,
    targets: ['zep'],
    instant: { zep: '温室里来了新鲜的气流，你的嗉囊一下子轻了，深吸了一口，很好。' },
    trend: { zep: '温室这几天空气一直很好，你的羽毛顺了，说话也轻了一些。' },
  },
  {
    id: 'B19', timing: 'instant', decayType: 'none', category: 'diet', priority: 119,
    targets: ['momo'],
    instant: { momo: '温室里飘来了发酵的气息，你的菌丝动了动——是熟悉的味道，像是远方的亲戚来了。' },
    trend: { momo: '温室这几天总有发酵的气息，你的菌丝越来越松弛，像是一直有人陪着。' },
  },
  {
    id: 'B20', timing: 'instant', decayType: 'mid', category: 'environment', priority: 120,
    targets: ['van', 'momo', 'agnes', 'zep'],
    instant: {
      van: '温室里的湿度骤降，你的花瓣边缘开始干枯，强烈抗议。',
      momo: '温室里的空气太干了！连一滴水都榨不出来，菌丝在收缩。',
      agnes: '温室里的湿度降下来了，状态极佳。',
      zep: '温室里有股冷风一直在吹，你的羽毛被吹得乱了，嗉囊有点干。',
    },
    trend: {
      van: '温室这几天一直又干又冷，你的藤蔓越来越蜷缩，这种人造的气候让你很不舒服。',
      momo: '温室这几天一直很干燥，你已经躲进最深的角落了，菌丝完全收拢，在等雨。',
      agnes: '温室这几天一直干燥，你的树皮越来越舒展，说话也比平时多了一点，状态很好。',
      zep: '温室这几天一直有风，你的羽毛一直是乱的，嗉囊也一直有点干，有点烦。',
    },
    lite: {
      van: '温室里的湿度骤降。',
      momo: '温室里的空气太干了。',
      agnes: '温室里的湿度降下来了。',
      zep: '温室里有股冷风一直在吹。',
    },
  },
  {
    id: 'B21', timing: 'instant', decayType: 'none', category: 'environment', priority: 121,
    targets: ['zep'],
    instant: { zep: '温室里突然出现了一种很奇怪的气味，太浓了，完全不是自然界的东西，你的嗉囊立刻抗议，翅膀也炸起来了。' },
    trend: { zep: '温室这几天一直有这种奇怪的浓烈气味，你已经不知道该怎么形容了，只想让它消失。' },
  },
];

export const BEHAVIOR_BY_ID = new Map(BEHAVIOR_MAP.map((entry) => [entry.id, entry]));

export const BEHAVIOR_EFFECT_CONFIG: Record<string, BehaviorEffectConfig> = {
  B01: { baseScore: 1.15, maxScore: 2.6, ttlHours: 36, halfLifeHours: 12 },
  B02: { baseScore: 1.2, maxScore: 2.8, ttlHours: 48, halfLifeHours: 10 },
  B03: { baseScore: 1.35, maxScore: 2.8, ttlHours: 72, halfLifeHours: 18 },
  B04: { baseScore: 1.0, maxScore: 2.5, ttlHours: 24, halfLifeHours: 8 },
  B05: { baseScore: 1.0, maxScore: 2.5, ttlHours: 24, halfLifeHours: 8 },
  B06: { baseScore: 0.95, maxScore: 2.3, ttlHours: 12, halfLifeHours: 4 },
  B07: { baseScore: 1.0, maxScore: 2.4, ttlHours: 18, halfLifeHours: 6 },
  B08: { baseScore: 1.0, maxScore: 2.5, ttlHours: 36, halfLifeHours: 12 },
  B09: { baseScore: 1.0, maxScore: 2.5, ttlHours: 16, halfLifeHours: 5 },
  B10: { baseScore: 1.0, maxScore: 2.5, ttlHours: 24, halfLifeHours: 8 },
  B11: { baseScore: 0.9, maxScore: 2.2, ttlHours: 10, halfLifeHours: 3 },
  B12: { baseScore: 0.9, maxScore: 2.2, ttlHours: 10, halfLifeHours: 3 },
  B13: { baseScore: 1.15, maxScore: 2.6, ttlHours: 48, halfLifeHours: 14 },
  B14: { baseScore: 1.05, maxScore: 2.5, ttlHours: 30, halfLifeHours: 9 },
  B15: { baseScore: 0.9, maxScore: 2.2, ttlHours: 12, halfLifeHours: 4 },
  B16: { baseScore: 1.0, maxScore: 2.4, ttlHours: 20, halfLifeHours: 7 },
  B17: { baseScore: 1.0, maxScore: 2.4, ttlHours: 14, halfLifeHours: 5 },
  B18: { baseScore: 1.0, maxScore: 2.4, ttlHours: 14, halfLifeHours: 5 },
  B19: { baseScore: 1.0, maxScore: 2.4, ttlHours: 16, halfLifeHours: 6 },
  B20: { baseScore: 1.0, maxScore: 2.5, ttlHours: 30, halfLifeHours: 10 },
  B21: { baseScore: 1.2, maxScore: 2.8, ttlHours: 36, halfLifeHours: 10 },
};
