// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/ACTIVITY_LEXICON.md
import { BEHAVIOR_MAP, TEA_SUBTYPE_CONFIG, TEA_SUBTYPE_PRIORITY } from './behavior-map';
import { DURATION_SEDENTARY_MINUTES, type TeaSubtype } from './constants';

export interface MatchedBehavior {
  behaviorId: string;
  position: number;
  teaSubtype?: TeaSubtype;
}

const KEYWORDS: Record<string, string[]> = {
  B01: [
    '喝酒', '饮酒', '酒局', '喝了两杯', '喝多了', '醉了', '微醺', '宿醉',
    '啤酒', '精酿', '红酒', '白葡萄酒', '白酒', '黄酒', '清酒', '米酒', '梅酒',
    '威士忌', '伏特加', '朗姆', '金酒', '龙舌兰', '鸡尾酒', 'highball',
    'drink', 'drinking', 'alcohol', 'booze', 'tipsy', 'drunk', 'hungover', 'hangover',
    'beer', 'craft beer', 'wine', 'red wine', 'white wine', 'sake',
    'whiskey', 'vodka', 'rum', 'gin', 'tequila', 'cocktail',
    'bere', 'bevendo', 'alcol', 'ubriaco', 'sbronza', 'post sbornia',
    'birra', 'vino', 'vino rosso', 'whisky', 'vodka', 'cocktail',
  ],
  B02: [
    '抽烟', '吸烟', '点烟', '抽了根烟', '烟瘾', '二手烟', '电子烟', '尼古丁',
    'cigarette', 'cigarettes', 'smoke', 'smoking', 'chain smoking', 'nicotine', 'secondhand smoke',
    'vape', 'vaping', 'e-cig', 'e cigarette',
    'fumare', 'fumo', 'sigaretta', 'sigarette', 'svapo', 'nicotina',
  ],
  B03: [
    '熬夜', '通宵', '还没睡', '凌晨', '晚睡', '夜里还醒着', '夜猫子', '睡太晚', '又熬到两点',
    'stay up', 'stayed up', 'up late', 'late night', 'all nighter', 'still awake', 'awake at',
    'not asleep', 'slept very late',
    'ho fatto tardi', 'ancora sveglio', 'notte fonda', 'tardi', 'insonne di notte',
  ],
  B04: [
    '运动', '锻炼', '有氧', '无氧', '力量训练', '体能训练', '拉伸', '热身',
    '跑步', '慢跑', '夜跑', '晨跑', '冲刺',
    '健身', '撸铁', '举铁', '深蹲', '硬拉', '卧推', '平板支撑',
    '瑜伽', '普拉提', '冥想瑜伽',
    '游泳', '自由泳', '蛙泳', '蝶泳',
    '骑车', '骑行', '动感单车',
    '打球', '打羽毛球', '羽毛球', '篮球', '踢足球', '足球', '排球', '网球', '乒乓球',
    '跳舞', '街舞', '爵士舞', '芭蕾', '尊巴',
    '爬山', '徒步', '登山', '快走', '散步', '跳绳',
    'run', 'running', 'jog', 'jogging', 'sprint',
    'gym', 'workout', 'exercise', 'cardio', 'strength training', 'weightlifting', 'stretching', 'warm up',
    'yoga', 'pilates',
    'swim', 'swimming', 'cycling', 'spinning',
    'badminton', 'basketball', 'football', 'soccer', 'volleyball', 'tennis', 'table tennis',
    'dance', 'zumba', 'hike', 'hiking', 'climb',
    'sport', 'sports',
    'correre', 'corsa', 'jogging', 'allenamento', 'palestra', 'sport',
    'nuoto', 'ciclismo', 'camminata', 'trekking',
    'badminton', 'basket', 'calcio', 'pallavolo', 'tennis',
    'danza', 'ballo', 'zumba', 'pilates', 'yoga',
  ],
  B07: [
    '下雨', '雨天', '阴天', '潮湿', '梅雨', '回南天', '暴雨', '大雨', '阵雨', '雷雨', '雨声', '阴沉',
    'rain', 'rainy', 'drizzle', 'shower', 'thunderstorm', 'storm', 'cloudy', 'overcast', 'humid', 'damp',
    'pioggia', 'piovoso', 'acquazzone', 'temporale', 'nuvoloso', 'umido', 'giornata grigia',
  ],
  B08: [
    '外卖', '快餐', '炸鸡', '汉堡', '薯条', '披萨', '方便面', '腌制', '培根', '香肠', '咸菜',
    '薯片', '重口', '重盐', '油腻', '高油', '高盐',
    'takeout', 'delivery food', 'fast food', 'fried chicken', 'burger', 'fries', 'pizza', 'instant noodles',
    'processed meat', 'bacon', 'chips', 'salty', 'high sodium', 'greasy', 'oily',
    'cibo da asporto', 'fast food', 'fritto', 'cibo salato', 'troppo sale', 'unto', 'patatine',
  ],
  B09: [
    '咖啡', '美式', '拿铁', '冰美式', '浓缩', '意式浓缩', '卡布奇诺', '摩卡', '馥芮白', '手冲',
    'cold brew', '咖啡因',
    'coffee', 'americano', 'latte', 'espresso', 'double espresso', 'cappuccino', 'mocha', 'flat white',
    'cold brew', 'drip coffee', 'caffeine',
    'caffè', 'espresso', 'americano', 'latte', 'cappuccino', 'moka', 'caffè freddo', 'caffeina',
  ],
  B10: [
    '奶茶', '甜饮', '含糖饮料', '珍珠奶茶', '果茶', '糖水', '甜点', '甜品', '蛋糕', '奶油蛋糕', '冰淇淋', '雪糕',
    'bubble tea', 'milk tea', 'boba', 'sweet drink', 'sugary drink', 'soda', 'dessert', 'cake', 'ice cream',
    'pastry', 'cookie', 'donut', 'chocolate',
    'tè al latte', 'bubble tea', 'bevanda zuccherata', 'dolce', 'dolci', 'torta', 'gelato', 'biscotti', 'cioccolato',
  ],
  B11: [
    '泡澡', '泡了个澡', '洗热水澡', '热水澡', '泡浴缸', '澡堂',
    'bath', 'hot bath', 'warm bath', 'took a bath', 'bathtub soak',
    'bagno', 'bagno caldo', 'vasca', 'mi sono fatto un bagno',
  ],
  B12: [
    '泡脚', '泡了脚', '热水泡脚', '足浴', '脚浴',
    'foot soak', 'foot bath', 'soaked my feet',
    'pediluvio', 'bagno ai piedi', 'ho fatto il pediluvio',
  ],
  B13: [
    '失眠', '睡不着', '难入睡', '半夜醒', '整晚没睡', '翻来覆去',
    'insomnia', "can't sleep", 'could not sleep', 'trouble sleeping', 'sleepless', 'woke up at night',
    'insonnia', 'non dormo', 'non riesco a dormire', 'mi sveglio di notte',
  ],
  B14: [
    '大哭', '哭了', '崩了', '情绪崩溃', '委屈哭了', '泪崩',
    'cry', 'cried', 'crying', 'sobbed', 'broke down', 'emotional breakdown',
    'piangere', 'ho pianto', 'pianto', 'crollo emotivo',
  ],
  B15: [
    '做饭', '下厨', '烹饪', '做菜', '煮饭', '炖汤', '煲汤', '备菜', '切菜', '炒菜', '烘焙',
    'cook', 'cooking', 'made dinner', 'made lunch', 'meal prep', 'boil', 'stir fry', 'bake', 'baking',
    'cucinare', 'ho cucinato', 'fare da mangiare', 'preparare la cena', 'forno',
  ],
  B16: [
    '冥想', '正念', '打坐', '静坐', '呼吸练习', '腹式呼吸', '放空', '放松训练',
    'meditate', 'meditation', 'mindfulness', 'breathing exercise', 'deep breathing', 'body scan', 'grounding',
    'meditare', 'meditazione', 'mindfulness', 'respirazione', 'respiro profondo', 'rilassamento guidato',
  ],
  B17: [
    '晒太阳', '晒日光浴', '阳光好', '天气晴', '今天很晴', '出太阳', '太阳很大',
    'sunshine', 'sunny', 'clear sky', 'bright day', 'good sunlight', 'nice weather',
    'sole', 'soleggiato', 'cielo sereno', 'bel tempo', 'giornata luminosa',
  ],
  B18: [
    '开窗', '通风', '透气', '新鲜空气', '空气很好', '出门透透气', '出去走走',
    'fresh air', 'open window', 'opened the window', 'ventilate', 'air out', 'went out for air',
    'aria fresca', 'aprire la finestra', 'arieggiare', 'sono uscito a prendere aria',
  ],
  B19: [
    '酸奶', '无糖酸奶', '希腊酸奶', '泡菜', 'kimchi', '纳豆', '康普茶', '开菲尔',
    '酵母', '发酵', '酸种面包', '奶酪', '味噌', '豆豉', '腐乳',
    'yogurt', 'greek yogurt', 'fermented', 'fermented food', 'kimchi', 'natto', 'kombucha', 'kefir',
    'sourdough', 'cheese', 'miso',
    'yogurt', 'fermentato', 'cibo fermentato', 'kimchi', 'natto', 'kombucha', 'kefir', 'formaggio', 'miso',
  ],
  B20: [
    '开空调', '吹空调', '暖气', '地暖', '空调房', '冷风直吹', '太干了', '空气干', '暖气片', '除湿',
    'ac', 'air conditioning', 'heater', 'heating', 'radiator', 'dry air', 'air is dry', 'dehumidifier',
    'aria condizionata', 'riscaldamento', 'termosifone', 'aria secca', 'troppo secco',
  ],
  B21: [
    '香水', '香精味', '空气清新剂', '消毒水', '消毒液', '洗衣液', '清洁剂', '漂白水', '甲醛味',
    '樟脑球', '蜡烛香氛', '熏香', '香薰',
    'perfume', 'fragrance', 'strong scent', 'air freshener', 'disinfectant', 'detergent', 'bleach',
    'scented candle', 'incense', 'chemical smell',
    'profumo', 'fragranza', 'odore forte', 'deodorante', 'disinfettante', 'candeggina', 'candelina profumata', 'incenso',
  ],
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[，。！？!?,.;:()\[\]{}"'`~]/g, ' ')
    .trim();
}

function getBehaviorPriority(behaviorId: string): number {
  return BEHAVIOR_MAP.find((entry) => entry.id === behaviorId)?.priority ?? 0;
}

function matchTeaSubtype(text: string): TeaSubtype | null {
  for (const subtype of TEA_SUBTYPE_PRIORITY) {
    const hit = TEA_SUBTYPE_CONFIG[subtype].keywords.some((keyword) => text.includes(keyword.toLowerCase()));
    if (hit) return subtype;
  }
  return null;
}

export function detectBehaviors(rawText: string, durationMinutes?: number): MatchedBehavior[] {
  const text = normalizeText(rawText);
  const found: MatchedBehavior[] = [];

  if (durationMinutes !== undefined && durationMinutes >= DURATION_SEDENTARY_MINUTES) {
    found.push({ behaviorId: 'B05', position: 0 });
  }

  for (const [behaviorId, keywords] of Object.entries(KEYWORDS)) {
    const bestIndex = keywords
      .map((keyword) => text.indexOf(keyword.toLowerCase()))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];

    if (typeof bestIndex === 'number') {
      found.push({ behaviorId, position: bestIndex });
    }
  }

  const teaSubtype = matchTeaSubtype(text);
  if (teaSubtype) {
    const exists = found.find((item) => item.behaviorId === 'B06');
    if (exists) {
      exists.teaSubtype = teaSubtype;
    } else {
      found.push({ behaviorId: 'B06', position: text.length, teaSubtype });
    }
  }

  const unique = new Map<string, MatchedBehavior>();
  for (const item of found) {
    if (!unique.has(item.behaviorId)) {
      unique.set(item.behaviorId, item);
    }
  }

  const sorted = [...unique.values()].sort((a, b) => {
    const pa = getBehaviorPriority(a.behaviorId);
    const pb = getBehaviorPriority(b.behaviorId);
    if (pa !== pb) return pb - pa;
    return a.position - b.position;
  });

  const hasB21 = sorted.some((item) => item.behaviorId === 'B21');
  if (hasB21) {
    return sorted.filter((item) => item.behaviorId !== 'B20');
  }
  return sorted;
}
