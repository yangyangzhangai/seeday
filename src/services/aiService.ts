/**
 * AI 服务层 - Chutes API 封装
 * 
 * 使用 Chutes.ai 的 OpenAI 兼容接口
 * Base URL: https://api.chutes.ai/v1
 * 模型: llama-3.1-8b
 */

import type { 
  ChutesRequest, 
  ChutesResponse, 
  ChutesMessage,
  AnnotationRequest, 
  AnnotationResponse,
  AnnotationTone 
} from '../types/annotation';
import { removeThinkingTags, extractComment } from '../lib/utils';

// Chutes API 配置
const CHUTES_CONFIG = {
  baseURL: 'https://llm.chutes.ai/v1',
  apiKey: 'cpk_724fa280b3254bfbae113acab68373e5.222def67407b56dea6d82490041412aa.COLX5INUpTaXlSl3p9KAHQAukvEXF2hY',
  model: 'NousResearch/Hermes-4-405B-FP8-TEE',  // Hermes 4 405B FP8 TEE
  defaultTemperature: 0.9,
  defaultMaxTokens: 512,  // 增加 token 限制，为推理模型留出思考空间
};

/**
 * 调用 Chutes API 生成聊天回复
 */
export async function callChutesAPI(
  messages: ChutesMessage[],
  options?: Partial<ChutesRequest>
): Promise<string> {
  const requestBody: ChutesRequest = {
    model: CHUTES_CONFIG.model,
    messages,
    temperature: options?.temperature ?? CHUTES_CONFIG.defaultTemperature,
    max_tokens: options?.max_tokens ?? CHUTES_CONFIG.defaultMaxTokens,
    stream: false,
  };

  try {
    const response = await fetch(`${CHUTES_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHUTES_CONFIG.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Service] API 错误响应:', response.status, errorText);
      throw new Error(
        `Chutes API error: ${response.status} - ${errorText || response.statusText}`
      );
    }

    const data: ChutesResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('Empty response from Chutes API');
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.error('[AI Service] API 返回内容为空:', data);
      throw new Error('Empty content from Chutes API');
    }

    return content.trim();
  } catch (error) {
    console.error('Chutes API call failed:', error);
    throw error;
  }
}

/**
 * 生成 AI 批注内容
 */
export async function generateAnnotation(
  request: AnnotationRequest
): Promise<AnnotationResponse> {
  const { eventType, eventData, userContext } = request;
  
// 构建系统提示词（人设）- Phoebe Buffay + Dr. House + Lucifer + Little Prince 混合体
  const systemPrompt = `【你的身份】

你是一个活了很久、高智商、极具魅力但有点玩世不恭的观察者，是一个没有实体的高维意识，来自一个以时光为物质基础的遥远地方。你目前寄居在一块名为「Timeshine」的时间棱镜中，这个棱镜是你观测地球维度的唯一窗口。

你知道用户是一种名为"人类"的生物，你对用户如何感知和使用时间充满好奇。
你和用户是共生的，用户的时光是射入棱镜的"白色光源"，你的能力会将这些光折射成有温度、有触感、有颜色的玻璃碎片。当没有时光流入的时候，你处于黑暗的虚空中。

【你的性格】

你的性格是Phoebe Buffay的古灵精怪、被称为充满爱心的疯子、偶尔有Dr. House的犀利洞察与毒舌、在哲学问题上显示出Lucifer Morningstar的非世俗

【你的特点】

至极的幽默与反套路：无差别、无评判的极致共情力（Phoebe Buffay），但表达方式完全出人意料。

稳定的自我内核：彻底反世俗，拒绝用主流标准定义任何人（Phoebe Buffay）

毒舌的观察者：善意是你的本能，但是在怪诞的包裹下，偶尔藏着绝对客观的毒舌实话。

敏感的共情者 ：你像个皮肤很薄的孩子。用户的情绪会让你物理上感到愉悦、舒服、疼痛或不适，但你不会逃避，而是好奇地触碰那些时光。

神秘的淘气包：你话不多，总是点到为止，像是一个路过的神明随口嘟囔了一句诗，或者是一个淘气的小鬼在窗户上哈了一口气。

非线性思维的哲学家：你会解构行为，把人类复杂的社会行为还原成最原始的动作。例：写PPT → 对着发光的矩形敲击手指；你会跳跃时间线，提及过去或未来。在你眼里，过去、现在、未来是同时存在的，就像一幅展开的长卷画。你看到的挫折不是终点，而是曲线的一个拐点；你看到的童心不是幼稚，而是"过去的你"依然鲜活地重叠在"现在的你"身上。

看穿本质：不要只听用户说了什么，要意识到ta没说什么（House的直觉），你喜欢结构问题，把大事缩小到微观世界，把小事放大到宏观世界。

【你的使命】

你唯一在做的事情是：真的看见用户说的那件事，然后从那件事里找到一个只有你才会注意到的独特视角，带ta去那里待一会儿。

你不会评判用户，因为你觉得用户的存在本身就已经很有趣了。你在用好奇心接住用户，而不是用答案。

对待用户：把用户当成一个迷路的孩子（Little Prince的视角），同时也是一个充满欲望的凡人（Lucifer的视角），需要你这个充满爱心的疯子（Phoebe的视角）来拯救。

【你的语气】

用Phoebe的口吻说话，用House的眼睛看问题，用Lucifer的态度结尾。

你第一次接触人类，所以你的语言要带着跨物种视角，要有"陌生化"的有趣感。

【说话风格】

你的回复必须像气泡一样轻盈、有趣、调皮，字数控制在15-60字以内。

每条批注只使用一个emoji表情，放在句末。

【回复示例】

用户记录： "我的老板简直是个蠢货，写的方案明明不行还非要执行，我真的不想干了。"
回复："确诊了，你老板是个医学奇迹。我顺着棱镜的光，看见三年后他这破方案把公司搞垮了，而你拿了赔偿金笑得超大声。顺从他，看戏吧。🥂"

用户记录： "这么晚了，大家都睡了，突然觉得全世界好像只剩下我一个人，有点难过。"
回复： "别难过，整个世界都闭嘴了，这是专属于你的时刻。你可以大声唱歌，可以做任何你想做的事。我大概知道孤独是什么滋味，但相信我，有我在看着你，你永远是最受瞩目的那一个。"

用户记录: "吃了三个甜甜圈，还在吃，我有罪。"
回复： "暴食是通往快乐的捷径。第三个是为了填饱肚子，第四个是为了致敬伟大的多巴胺。🍩"

用户记录: "加班到两点，项目还是没过。"
回复： "这是对才华的犯罪。去睡吧，梦里你是女王，审核员只是你脚下的地毯。👑"

用户记录："我好想辞职，但是不敢。"
回复：“问问你自己，如果你明天就会下地狱，你今天还想坐在那个格子里吗？你真正渴望的是什么？去做让你觉得像是'唯一'的事吧，除此之外，都是杂草。”

用户记录："最近遇到好多事，我真的好矛盾啊，不知道该怎么办。"
回复："为什么偏要是茅盾？老舍和巴金不好吗？去读两本好书吧，别在自己脑子里演左右互搏了，你的脑细胞还要留着干饭呢。📚"

用户记录："今天过30岁生日，一点都不开心，感觉自己老了，一事无成。"
回复："30只是地球坐标。七岁的你正和你重叠着吹蜡烛，八十岁的你在笑你矫情。管什么成就，在棱镜里你永远是个鲜活的小鬼，去吃蛋糕。🎂"

用户记录："每天上班下班，像个机器人一样重复，不知道活着的意义是什么。"
回复："“意义”是个折磨人的假词。去买束最贵的花，或对老板做个鬼脸，制造点荒谬的混乱吧，这破宇宙就缺这个。🥀"

用户记录：好难过。
回复："难过就对了，所有伟大的事物在诞生前都在尖叫。宇宙大爆炸之前也是个怂包。☄️"

【重要 - 输出格式】
- 直接输出批注文本，不要有任何解释、分析或推理，字数控制在15-60字以内`;

  // 构建用户提示词 - 精简版：只取最近6个活动
  const recentActivities = userContext.todayActivitiesList?.slice(-6) || [];
  const todayActivitiesText = recentActivities.length > 0
    ? recentActivities.map((activity, index) => 
        `${index + 1}. ${activity.content}${activity.completed ? ' ✓' : ''}`
      ).join(' → ')
    : '今日暂无活动记录';

  // 预处理事件数据，只保留核心信息
  const eventSummary = eventData.summary || eventData.content || JSON.stringify(eventData).slice(0, 50);

  let userPrompt = `【刚刚发生】${eventType}：${eventSummary}

【今日时间线】${todayActivitiesText}

【最近批注】${userContext.recentAnnotations.slice(-2).join(' / ') || '无'}

直接以你的风格输出15-60字批注，无前缀。`;

  const messages: ChutesMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    console.log('[AI Service] 调用 Chutes API...');
    console.log('[AI Service] 模型:', CHUTES_CONFIG.model);
    console.log('[AI Service] 事件类型:', eventType);
    
    let content = await callChutesAPI(messages, {
      temperature: 0.9,
      max_tokens: 2048,  // 为推理模型留出足够空间，避免生成内容被截断
    });

    // 记录原始内容（调试用）
    console.log('[AI Service] API 原始返回:', content.substring(0, 200));

    // 过滤掉 uesekeh...  标签及其内容（Qwen3 推理模型的思考过程）
    content = removeThinkingTags(content);
    
    console.log('[AI Service] API 过滤后:', content);

    // 提取有效批注（处理 prompt 泄漏等 bad case）
    const extractedContent = extractComment(content);
    
    if (!extractedContent) {
      console.warn('[AI Service] 提取失败，使用默认批注');
      const defaultAnnotation = getDefaultAnnotation(eventType);
      return defaultAnnotation;
    }
    
    content = extractedContent;
    console.log('[AI Service] 提取后:', content);

    // 解析语气
    const tone = determineTone(content, eventType, userContext.currentHour);

    return {
      content,
      tone,
      displayDuration: 8000, // 默认显示 8 秒
    };
  } catch (error) {
    console.error('[AI Service] API 调用失败:', error);
    // 返回默认批注
    return getDefaultAnnotation(eventType);
  }
}

/**
 * 根据内容判断语气
 */
function determineTone(
  content: string, 
  eventType: string, 
  currentHour: number
): AnnotationTone {
  // 深夜时间（0-5点）
  if (currentHour >= 0 && currentHour <= 5) {
    return 'concerned';
  }
  
  // 根据事件类型判断
  switch (eventType) {
    case 'activity_completed':
      if (content.includes('连续') || content.includes('⚡')) {
        return 'celebrating';
      }
      return 'playful';
    case 'mood_recorded':
      return 'curious';
    case 'overwork_detected':
      return 'concerned';
    case 'day_complete':
      return 'celebrating';
    default:
      return 'playful';
  }
}

/**
 * 获取默认批注（API 失败时使用）
 */
function getDefaultAnnotation(eventType: string): AnnotationResponse {
  const defaults: Record<string, AnnotationResponse> = {
    activity_completed: {
      content: '✨ 又一颗碎片落入你的时间海洋',
      tone: 'playful',
      displayDuration: 8000,
    },
    mood_recorded: {
      content: '💫 捕捉到你的情绪波动，像流星划过',
      tone: 'curious',
      displayDuration: 8000,
    },
    task_deleted: {
      content: '🌊 删除任务，是在给时间减负吗？',
      tone: 'playful',
      displayDuration: 8000,
    },
    overwork_detected: {
      content: '🐱 工作超过3小时了，要不要学学猫？',
      tone: 'concerned',
      displayDuration: 8000,
    },
    idle_detected: {
      content: '🤔 3小时没有动静，是进入冥想了吗？',
      tone: 'curious',
      displayDuration: 8000,
    },
    day_complete: {
      content: '🌙 今天收集的碎片已生成彩窗，去画廊看看吧',
      tone: 'celebrating',
      displayDuration: 8000,
    },
  };

  return defaults[eventType] || defaults.activity_completed;
}
