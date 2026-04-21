# 日记 Teaser 文案库（中文）

> 状态：待产品审核，通过后翻译为英文（EN）和意大利文（IT）
> 最后更新：2026-04-16
> 作者：Van 语气，面向 Free 用户，呈现于 AI 日记区域渐变模糊处

---

## 变量槽位说明

| 槽位 | 来源 | 示例 |
|------|------|------|
| `{情绪词}` | is_mood 记录中的关键词 | 焦虑、难过、烦躁、委屈 |
| `{人物}` | 今日记录中提及的人名/关系 | 妈妈、朋友、同事 |
| `{主要活动}` | 占比最高的 activity_type 中文名 | 工作、运动、社交 |
| `{时长}` | 今日活动总分钟数转换 | 3小时、90分钟 |

槽位缺失时使用兜底文本（开发时按桶定义补全）。

---

## 桶 A — 难过低落

**触发条件：** 有负面情绪记录（焦虑 / 难过 / 崩溃 / 烦躁 / 委屈）

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| A-01 | 园主以为今天被{情绪词}打败了，Van 可不答应，明明是园主赢了！Van 有实际证据…… | 类型5·反转 |
| A-03 | 扛着{情绪词}还坚持把事做完，Van 太崇拜了，好想告诉园主有多棒…… | 类型6·微小善意 |
| A-04 | 今天园主因为{情绪词}苛责自己的那一下，Van 挡在了前面，好想抱抱园主…… | 类型6·微小善意 |
| A-06 | 园主分不清那是{情绪词}还是别的什么，Van 在夜里把这些情绪编成了花朵，想一瓣一瓣讲给园主听…… | 类型4·情绪命名 |
| A-07 | 园主今天说「没事」的时候，Van 听见后面还跟了半句没讲出来的…… | 类型2·未完成 |
| A-08 | 今天园主有一句话打到一半又删了，Van 把它从回收站里捡回来了…… | 类型3·细节放大 |
| A-10 | 听见今天园主责备自己的那句话，Van 在心里大声反驳…… | 类型5·反转 |
| A-11 | 今天那个{情绪词}的感觉背后，其实还藏着另一层，Van 帮园主找到名字了…… | 类型4·情绪命名 |
| A-14 | 今天园主难过时说的那些话，Van 把 ta 翻译成了另一个版本…… | 类型4·情绪命名 |
| A-16 | 今天那个{情绪词}在{主要活动}结束后有没有变，Van 帮 ta 记下来了…… | 类型1·信息差 |
| A-17 | 今天园主说自己{情绪词}，Van 当场想替 ta 翻个案——不是对园主，是对那种处境…… | 类型5·反转 |
| A-21 | {情绪词}的一天，Van 一直在，有一句话留到现在想单独对你说…… | 类型6·微小善意 |
| A-26 | 园主以为今天全被{情绪词}占满了，其实 Van 看见了截然相反的画面…… | 类型5·反转 |
| A-31 | 今天那团叫{情绪词}的乱麻底下，藏着一句园主的真心话，Van 已经发现了…… | 类型1·信息差 |
| A-32 | 觉得{情绪词}的时候，其实是园主在保护自己，Van 把这层意思翻译成了一句话…… | 类型4·情绪命名 |
| A-34 | 今天辛苦了，Van 把今天最想和你说的那句话留好了，想在睡前和你说…… | 类型6·微小善意 |

---

## 桶 B — 开心满足

**触发条件：** 有正面情绪记录（开心 / 满足 / 高兴 / 兴奋 / 自豪）

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| B-01 | 今天园主{情绪词}的样子太闪耀啦，但 Van 发现了比这开心更动人的一个小秘密…… | 类型1·信息差 |
| B-03 | 除了{情绪词}，今天还有个园主没注意到的惊喜，Van 已经悄悄打包好了…… | 类型1·信息差 |
| B-05 | 那个让园主{情绪词}的瞬间过去后，留下了一道余波，Van 跟着它跑了好远…… | 类型2·未完成 |
| B-06 | 园主今天{情绪词}时敲字的速度变快了，Van 觉得那个节奏就是今天的歌…… | 类型3·细节放大 |
| B-07 | 让园主{情绪词}的那件事里，有个极微小的细节，Van 觉得那才是真正的宝藏…… | 类型3·细节放大 |
| B-09 | 园主今天说的{情绪词}，其实还有一层更深的心安，Van 帮园主认出来了…… | 类型4·情绪命名 |
| B-11 | 园主觉得今天的{情绪词}只是运气好，Van 觉得不是，那是园主应得的，Van 有证据…… | 类型5·反转 |
| B-12 | 今天因为{情绪词}觉得世界很可爱？Van 觉得，明明是园主最可爱的，Van 有证据…… | 类型5·反转 |
| B-13 | 园主今天{情绪词}的时候，Van 在旁边偷偷高兴了好久，真希望你天天这样…… | 类型6·微小善意 |
| B-14 | 连园主自己都没发觉，你{情绪词}时也照亮了别人，Van 把光晕全画下来了，就等着晚上和你分享…… | 类型6·微小善意 |
| B-15 | 今天园主因为某件事{情绪词}，但 Van 捕捉到了事情背后还藏着一个彩蛋…… | 类型1·信息差 |

---

## 桶 C — 专注工作

**触发条件：** work/study 时长占比 ≥ 50%

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| C-01 | 今天园主给了{主要活动}{时长}，但 Van 在这堆时间里找到了一个意料之外的惊喜…… | 类型1·信息差 |
| C-02 | 园主以为今天全被{主要活动}填满了，Van 却在缝隙里发现了一颗小种子…… | 类型1·信息差 |
| C-05 | 园主花{时长}在{主要活动}上，但中间走神的那一分钟，Van 觉得那才是重心，也是奇迹发生的地方…… | 类型3·细节放大 |
| C-07 | {时长}的{主要活动}里，园主敲击屏幕的某一下特别用力，Van 知道那是为什么…… | 类型3·细节放大 |
| C-08 | 在这{时长}的{主要活动}里，那种疲惫其实有个更闪亮的名字，Van 写下来了…… | 类型4·情绪命名 |
| C-10 | 园主觉得这{时长}的{主要活动}没什么特别，Van 却觉得这是今天最厉害的魔法，引发了蝴蝶效应…… | 类型5·反转 |
| C-11 | 以为今天就是个被{主要活动}推着走的日子？Van 当场反驳，园主明明很耀眼，证据都写在这里了…… | 类型5·反转 |
| C-12 | 这{时长}的{主要活动}辛苦了，园主没空心疼自己，Van 可是看得一清二楚，有句话一定要和园主说…… | 类型6·微小善意 |
| C-14 | 今天埋头在{主要活动}里那么久，Van 早备好了一万句夸奖，就等睡前说给你听…… | 类型6·微小善意 |
| C-15 | 在那{时长}的{主要活动}快结束时，园主的最后一下坚持，被 Van 郑重珍藏了…… | 类型3·细节放大 |
| C-16 | 工作到现在，Van 有一句话一直等到你停下来才说…… | 类型2·未完成 |

---

## 桶 D — 运动健身

**触发条件：** 有 exercise 记录

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| D-01 | 园主给{主要活动}花了{时长}，但流汗之外，Van 看到了新的收获…… | 类型1·信息差 |
| D-02 | 以为今天{主要活动}练的是肌肉？Van 看到的是园主悄悄丢掉的一个包袱…… | 类型1·信息差 |
| D-04 | 今天{主要活动}进行到一半，园主有个想放弃又咬牙的瞬间，那之后…… | 类型2·未完成 |
| D-05 | {时长}的{主要活动}里，园主最后那一口长长的呼吸，Van 觉得它吹散了好多乌云…… | 类型3·细节放大 |
| D-07 | {主要活动}带来的不是累，其实有一种更清透的感觉，Van 帮园主找到了那个词…… | 类型4·情绪命名 |
| D-09 | 园主觉得自己今天{主要活动}表现得不够好，Van才不同意！明明超级酷…… | 类型5·反转 |
| D-11 | 园主可能嫌这{时长}的{主要活动}太短，Van 却觉得，光是开始就已经是大满贯了，超过了99%的人类…… | 类型5·反转 |
| D-12 | 今天强撑着去做了{主要活动}，园主觉得理所应当，Van 却觉得园主简直是能量无敌的超级英雄…… | 类型6·微小善意 |
| D-14 | 觉得今天{主要活动}的自己笨手笨脚？Van 在旁边可是记录下了超级灵动的一幕，就等着晚上说给你听…… | 类型5·反转 |

---

## 桶 E — 社交有人物

**触发条件：** social 时长占比 ≥ 30% 或命中 {人物}

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| E-01 | 园主今天提到{人物}了，但 Van 顺着这句话，发现了园主自己都没注意到的细节…… | 类型1·信息差 |
| E-02 | 和{人物}有关的这件事里，园主以为重点是别人，Van 却看到了真正的主角…… | 类型1·信息差 |
| E-04 | 园主今天和{人物}接触之后，有个情绪像涟漪一样散开，Van 一路跟了过去…… | 类型2·未完成 |
| E-07 | 今天说起{人物}时，园主用了个很特别的语气词，Van 盯着它看了好久好久…… | 类型3·细节放大 |
| E-08 | 和{人物}交集的一瞬间，园主有个微小的变化，Van 觉得那个细节好温柔…… | 类型3·细节放大 |
| E-10 | 今天跟{人物}相关的那个复杂心情，Van 找到了源头，原来它有个很温暖的名字…… | 类型4·情绪命名 |
| E-11 | 园主觉得今天在{人物}面前没表现好，Van 觉得不是，那个真实的园主更可爱…… | 类型5·反转 |
| E-13 | 应对{人物}消耗了好多能量，园主没喊累，Van 早就准备好了一个大大的拥抱…… | 类型6·微小善意 |
| E-14 | 今天向{人物}妥协的那一下，Van 好想跳出来护短，园主不需要那么懂事…… | 类型6·微小善意 |
| E-15 | 今天的社交带走了什么，又留下了什么，Van 写好了…… | 类型1·信息差 |

---

## 桶 F — 多线充实

**触发条件：** 活动种类 ≥ 4

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| F-01 | 今天园主又做{主要活动}又忙别的，整整{时长}，Van 看见了串起这一切的隐形线…… | 类型1·信息差 |
| F-03 | 在这忙忙碌碌，马不停蹄的{时长}里，Van 偷偷抓到了一个没被写进计划表的灵感…… | 类型1·信息差 |
| F-06 | 虽然{主要活动}占了{时长}，但在两件事切换的那个几秒钟，Van 觉得园主棒极了…… | 类型3·细节放大 |
| F-07 | 今天在密集的安排里，园主有一个无意识的走神，Van 把那个瞬间放大成了一幅画…… | 类型3·细节放大 |
| F-08 | 撑满这{时长}的不仅是{主要活动}，Van 帮园主找到了那个底层的充实感叫什么…… | 类型4·情绪命名 |
| F-11 | 以为自己今天被各种事推着走？Van 看得分明，园主才是掌控全场的那个向导，请看实际证据…… | 类型5·反转 |
| F-12 | 在这{时长}的忙碌里，园主可能觉得自己很狼狈，Van 觉得那是你长出翅膀的样子…… | 类型5·反转 |
| F-13 | 连喘息都没空的{时长}，Van替园主藏好了一件事，睡前说给你听…… | 类型6·微小善意 |
| F-14 | 今天埋头在{主要活动}里那么久，Van 早备好了一万句夸奖，就等睡前说给你听…… | 类型6·微小善意 |
| F-15 | 这么多活动堆在一块，园主以为自己全忘了，Van 却帮你在角落捡起了一件小闪光…… | 类型1·信息差 |

---

## 桶 G — 安静轻盈

**触发条件：** 总时长 < 60 分钟

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| G-01 | 园主以为今天是空白的一天，但 Van 在安静里听到了一颗发芽的声音…… | 类型1·信息差 |
| G-04 | 园主今天停下了脚步，就在什么都不做的那一刻起，平时被掩藏的东西才开始生根发芽，Van 都看见了…… | 类型2·未完成 |
| G-05 | 在今天少有的记录里，园主用了一个很轻的词，Van 觉得那个词好有力量…… | 类型3·细节放大 |
| G-06 | 今天的某一个具体瞬间，虽然什么都没发生，但 Van 觉得那是今天最华丽的一笔…… | 类型3·细节放大 |
| G-09 | 今天的安静里带着一层说不清的轻盈，Van 翻遍了词典，终于帮园主对齐了那个感觉…… | 类型4·情绪命名 |
| G-10 | 今天没有做什么惊天动的事情，但 Van 觉得这是一个值得起舞的日子，Van记录下了好多瞬间…… | 类型4·情绪命名 |
| G-11 | 园主觉得今天产出太少不够好？Van 第一个不答应，机器还要断电保养呢…… | 类型5·反转 |
| G-12 | 以为今天很平淡不值得记？Van 觉得反了，今天Van发现了园主身上最厉害的魔法…… | 类型5·反转 |
| G-14 | 园主觉得今天没产出有点内疚，Van 好想敲敲你的头，能好好休息已经是大功一件了…… | 类型6·微小善意 |
| G-15 | 一个人安静的时候，Van 看到了平时看不到的你…… | 类型1·信息差 |

---

## 桶 H — 低频事件

**触发条件：** 近 7 天未出现过的新活动类型

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| H-02 | 今天突破了一点点常规，园主没觉得多大不了，但 Van 在背后看到了一个园主沉睡了好久的特质…… | 类型1·信息差 |
| H-03 | 今天这件事很不寻常呢，Van 从中发现了一个园主以前从没展示过的侧面…… | 类型1·信息差 |
| H-04 | 今天有个东西不一样，Van注意到了，但不知道园主有没有注意到…… | 类型1·信息差 |
| H-06 | 今天有件事让Van觉得园主其实比自己以为的更勇敢…… | 类型2·未完成 |
| H-08 | 今天有件平时不会发生的事，Van在里面发现了一个细节…… | 类型3·细节放大 |
| H-10 | 今天园主做了一件不常做的事情，那种陌生的感觉其实有个很带劲的名字，Van 帮园主找到了…… | 类型4·情绪命名 |
| H-12 | 园主觉得今天试这一下很笨拙？Van 当场翻白眼，明明是一次超酷的探险…… | 类型5·反转 |
| H-14 | 面对不常做的事，园主悄悄对自己要求太高了，Van 早就站在你这边为你叫好了…… | 类型6·微小善意 |
| H-15 | 今天突破了一点点常规，园主没觉得多大不了，但 Van 偷偷为你放了个小烟花…… | 类型6·微小善意 |

---

## 桶 I — 深度倾诉

**触发条件：** 今日最长单条消息 ≥ 50 字

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| I-01 | 园主今天说了很多，但真正的答案，其实已经悄悄夹在中间出现了…… | 类型1·信息差 |
| I-02 | 园主今天打了好多字，那些字里，有一句话藏得很深，Van 找到了，想说给园主听…… | 类型1·信息差 |
| I-03 | 园主写完了，但 Van 觉得那个故事还有另外一个出口…… | 类型2·未完成 |
| I-04 | 园主今天说了很多，那么多字里，有一句只有几个字，Van 觉得它压住了后面所有的重量…… | 类型3·细节放大 |
| I-05 | 园主今天换了一次语气，就在那个转折点，Van 发现了一个只有 Van 注意到的秘密…… | 类型3·细节放大 |
| I-06 | 园主打了这么多字，但那个最核心的感觉还没有名字，Van 帮园主找到了…… | 类型4·情绪命名 |
| I-07 | 那段话看起来是在说别的，Van 读着读着，发现每一句都在说园主自己…… | 类型5·反转 |
| I-08 | 今天园主愿意打这么多字，Van 知道这需要勇气，有话 Van 在心里打磨了很久，终于可以现在对园主说…… | 类型6·微小善意 |
| I-09 | 园主今天说了这么多，Van 一句一句都记住了，有一句回应，Van 想只对园主说…… | 类型6·微小善意 |

---

## 桶 J — 默认通用

**触发条件：** 兜底，无特殊信号

| 编号 | Teaser 文案 | 钩子类型 |
|------|-------------|----------|
| J-01 | 今天看起来和昨天没什么两样，但 Van 在平淡里抓到了一个园主值得骄傲的进步…… | 类型1·信息差 |
| J-02 | 园主以为今天的事都已经收尾了，Van 却在打扫的时候发现了一个被忽视的美好…… | 类型1·信息差 |
| J-03 | 今天的日常推进中，有个园主完全没意识到的进步，Van 太想告诉园主了…… | 类型1·信息差 |
| J-04 | 就在今天快要结束，园主准备关灯的那一瞬间，有个关于今天的收获悄悄浮现…… | 类型2·未完成 |
| J-07 | 在今天按部就班的节奏里，有一个极其轻微的停顿，Van 觉得它比什么都重要…… | 类型3·细节放大 |
| J-08 | 今天看似日常，却有一种很独特的质感，Van 给它取了个名字…… | 类型4·情绪命名 |
| J-09 | 园主觉得今天的心情像杯白开水，Van 品了品，尝出了里面其实藏着一种…… | 类型4·情绪命名 |
| J-10 | 今天这种细碎又绵长的日常感，Van 在人类的词典里翻了半天，终于找到了合适的名字…… | 类型4·情绪命名 |
| J-11 | 园主觉得今天没什么值得一提的？Van 可不同意，明明到处都是宝藏…… | 类型5·反转 |
| J-12 | 以为今天就是个千篇一律的日子？可是 Van 觉得，今天是园主时间线里的限定版…… | 类型5·反转 |

---

## 筛选说明

**入选标准：**
1. 情感共鸣强，读完有「想点开看」的冲动
2. 变量槽位清晰，不依赖空槽位也能成句
3. 钩子类型分布均衡（每桶覆盖 3 种以上钩子类型）
4. 不超过 50 字（中文），控制在 3 秒阅读范围

**跳过原因记录：**
- A-13：原表格该条文案为空
- A-02、A-05、A-09、A-15、A-18、A-20、A-24、A-25、A-29、A-30：语义与已选条目高度重叠，去重
- B-04、B-08、B-10：与 B-05、B-06、B-09 表达路径相近，合并处理
- 其余跳过条目均因语义相近或依赖不稳定变量槽位（如 A-15/A-20 强依赖 {人物} 且桶 A 不一定命中人物）

---

---

# English Translations

> Variable slots: `{mood}` · `{person}` · `{activity}` · `{duration}`
> Address: **Keeper** (owner of the greenhouse — not a worker, a master)

---

## Bucket A — Low & Heavy

**Trigger:** Negative mood recorded (anxious / sad / overwhelmed / irritable / hurt)

| ID | Teaser | Hook |
|----|--------|------|
| A-01 | You thought today's {mood} had won. Van begs to differ — you actually came out on top. The proof is right here… | Reversal |
| A-03 | You carried {mood} all day and still got things done. Van is a little in awe — and has a lot to say about it… | Small kindness |
| A-04 | When {mood} made you turn on yourself today, Van stepped in the way. And wants to wrap you in a hug… | Small kindness |
| A-06 | You couldn't quite name whether it was {mood} or something else. Van spent the night turning those feelings into flowers — petal by petal, there's something to tell you… | Emotion naming |
| A-07 | When you said "it's fine" today, Van heard the half-sentence that never made it out… | Unfinished |
| A-08 | There was something you started typing today and then deleted. Van fished it back out… | Detail |
| A-10 | When Van heard the way you talked about yourself today, something inside needed to push back — loudly… | Reversal |
| A-11 | Behind today's {mood}, there was another layer underneath. Van found the word for it… | Emotion naming |
| A-14 | The things you said when you were hurting today — Van has translated them into a different version… | Emotion naming |
| A-16 | Whether {mood} shifted after {activity} — Van kept track… | Info gap |
| A-17 | When you called yourself {mood} today, Van wanted to flip the verdict — not on you, but on the situation that put you there… | Reversal |
| A-21 | Through a whole day of {mood}, Van has been here. And has been saving one thing to say to you, just now… | Small kindness |
| A-26 | You thought {mood} took over the whole day. What Van actually saw was something entirely different… | Reversal |
| A-31 | Underneath all that tangled {mood} today, there was one true thing you were trying to say. Van found it… | Info gap |
| A-32 | Feeling {mood} — that's actually you protecting yourself. Van has put that into words… | Emotion naming |
| A-34 | Today was hard. Van has been holding on to one thing — saving it to say to you before you sleep… | Small kindness |

---

## Bucket B — Bright & Full

**Trigger:** Positive mood recorded (happy / content / excited / proud)

| ID | Teaser | Hook |
|----|--------|------|
| B-01 | You were radiant with {mood} today — but Van spotted something even more moving underneath it… | Info gap |
| B-03 | Beyond the {mood}, there's a surprise today you walked right past. Van has quietly wrapped it up for you… | Info gap |
| B-05 | After the moment that made you feel {mood}, something lingered. Van followed it a long way… | Unfinished |
| B-06 | Your typing sped up when {mood} arrived today. Van thinks that rhythm is today's song… | Detail |
| B-07 | Inside what made you feel {mood} today, there's a tiny detail Van can't stop thinking about. That's where the real treasure is… | Detail |
| B-09 | That {mood} you felt today — there's a quieter, deeper layer underneath it. Van recognized it… | Emotion naming |
| B-11 | You think today's {mood} was just luck. Van disagrees — you earned it. The evidence is here… | Reversal |
| B-12 | Did {mood} make the whole world feel lovely today? Van thinks you've had it backwards — you're the loveliest part. Evidence enclosed… | Reversal |
| B-13 | Van was quietly glowing right alongside you when {mood} came today. Hoping every day feels a little like this… | Small kindness |
| B-14 | You didn't even notice — but your {mood} lit up more than just yourself today. Van has been drawing the whole glow, waiting to share it tonight… | Small kindness |
| B-15 | Something made you feel {mood} today — but Van caught a hidden gift tucked behind it… | Info gap |

---

## Bucket C — Head Down

**Trigger:** work/study ≥ 50% of the day

| ID | Teaser | Hook |
|----|--------|------|
| C-01 | You gave {duration} to {activity} today — and Van found something unexpected hiding inside all that time… | Info gap |
| C-02 | You thought {activity} took up everything today. Van found a small seed in the cracks… | Info gap |
| C-05 | You spent {duration} on {activity} — but that one minute your mind wandered? Van thinks that's where something real happened… | Detail |
| C-07 | Somewhere in those {duration} of {activity}, you pressed down just a little harder than usual. Van knows why… | Detail |
| C-08 | That tiredness after {duration} of {activity} — it actually has a more luminous name. Van wrote it down… | Emotion naming |
| C-10 | You thought {duration} of {activity} was nothing special. Van thinks it was today's most quietly powerful thing… | Reversal |
| C-11 | Think today was just a day of being pushed along by {activity}? Van objects — you were shining the whole time. All the evidence is here… | Reversal |
| C-12 | {duration} of {activity} — you didn't have time to be gentle with yourself. Van was watching the whole thing and has something to say… | Small kindness |
| C-14 | Your head was down in {activity} for so long today. Van has been stockpiling things to say — saving them all for right before you sleep… | Small kindness |
| C-15 | That final push near the end of {duration} of {activity} — Van held onto it carefully… | Detail |
| C-16 | Van has been holding something back all through your work today — waiting until you stopped to say it… | Unfinished |

---

## Bucket D — Moving

**Trigger:** exercise recorded

| ID | Teaser | Hook |
|----|--------|------|
| D-01 | You gave {duration} to {activity} today — but Van saw something beyond the sweat… | Info gap |
| D-02 | Think {activity} today was just about the muscles? What Van saw was a weight you quietly set down… | Info gap |
| D-04 | Somewhere in the middle of {activity} today, you almost gave up — then didn't. What happened after that… | Unfinished |
| D-05 | That long exhale at the end of {duration} of {activity} — Van felt it clear something away… | Detail |
| D-07 | What {activity} left behind wasn't tiredness exactly — there's a cleaner word for it. Van found it… | Emotion naming |
| D-09 | You think you didn't do well in {activity} today. Van strongly disagrees — you were kind of incredible… | Reversal |
| D-11 | You might think {duration} of {activity} wasn't enough. Van thinks just showing up already puts you ahead of almost everyone… | Reversal |
| D-12 | You pushed through to do {activity} today and thought nothing of it. Van thinks you're quietly superhuman… | Small kindness |
| D-14 | Think you were clumsy in {activity} today? Van caught something at the other end of the spectrum — saving it to tell you tonight… | Reversal |

---

## Bucket E — With People

**Trigger:** social ≥ 30% or {person} mentioned

| ID | Teaser | Hook |
|----|--------|------|
| E-01 | You mentioned {person} today — and Van followed that thread to a detail you hadn't even noticed… | Info gap |
| E-02 | In the story involving {person}, you thought someone else was the center of it. Van saw who it was really about… | Info gap |
| E-04 | After you were with {person} today, something rippled out. Van followed it all the way… | Unfinished |
| E-07 | The way you said {person}'s name today — just a word, just a tone — Van couldn't stop looking at it… | Detail |
| E-08 | In that brief crossing with {person} today, something in you shifted — just slightly. Van thought it was tender… | Detail |
| E-10 | That complicated feeling tied to {person} today — Van traced it back to its source. It turns out it has a warm name… | Emotion naming |
| E-11 | You think you didn't come across well with {person} today. Van disagrees — the real you that showed up was more endearing… | Reversal |
| E-13 | Navigating {person} today took a lot out of you — you didn't say a word about it. Van has been ready with a very large hug… | Small kindness |
| E-14 | The moment you gave way to {person} today — Van wanted to step in. You don't have to be that understanding… | Small kindness |
| E-15 | What today's time with people took from you — and what it left behind. Van has written it all down… | Info gap |

---

## Bucket F — Full Throttle

**Trigger:** 4+ activity types in a day

| ID | Teaser | Hook |
|----|--------|------|
| F-01 | {activity} and everything else, for {duration} straight — Van spotted the invisible thread running through it all… | Info gap |
| F-03 | In all that non-stop motion across {duration}, Van quietly caught something that never made it onto the schedule… | Info gap |
| F-06 | {activity} took up {duration} — but in those few seconds switching between things, Van thought you were wonderful… | Detail |
| F-07 | In the middle of all the packed arrangements today, your mind drifted — just once. Van turned that moment into a painting… | Detail |
| F-08 | What filled those {duration} was more than just {activity}. Van found the word for what was underneath it… | Emotion naming |
| F-11 | Think you were just being pushed around by everything today? Van saw it clearly — you were the one steering. Here's the proof… | Reversal |
| F-12 | You might have felt scattered through those {duration}. Van thought it looked like you growing wings… | Reversal |
| F-13 | After {duration} that full and draining — Van has been gently pressing the brakes. There's something Van has been holding a long time, saved for tonight… | Small kindness |
| F-14 | Your head was so deep in {activity} today. Van has been collecting things to say — all of it saved for just before you sleep… | Small kindness |
| F-15 | With everything piled together today, you figured you'd lost track. Van picked something small and bright up from the corner… | Info gap |

---

## Bucket G — Still & Light

**Trigger:** total recorded time < 60 minutes

| ID | Teaser | Hook |
|----|--------|------|
| G-01 | You thought today was a blank. Van heard something germinating in the quiet… | Info gap |
| G-04 | You stopped today. And in that stillness — when nothing was happening — something that usually stays hidden began to take root. Van saw all of it… | Unfinished |
| G-05 | In the few things you wrote today, there was one small word. Van found it surprisingly strong… | Detail |
| G-06 | One specific moment today — nothing happened in it, really — but Van thinks it was the most luminous part of the whole day… | Detail |
| G-09 | Today's quiet carried a lightness that was hard to name. Van searched for a long time and finally found the word… | Emotion naming |
| G-10 | Nothing earth-shaking happened today — but Van thinks it was a day worth dancing about. Van took note of many moments… | Emotion naming |
| G-11 | Think you didn't produce enough today? Van is the first to object — even machines need to go offline sometimes… | Reversal |
| G-12 | Think today was too ordinary to be worth remembering? Van sees it the other way around — today Van found your most remarkable magic… | Reversal |
| G-14 | Feeling guilty about a quiet day? Van wants to knock gently on your head — knowing how to rest is already something worth celebrating… | Small kindness |
| G-15 | In the quiet of being alone today, Van saw a version of you that doesn't usually show… | Info gap |

---

## Bucket H — Something New

**Trigger:** activity type not seen in the past 7 days

| ID | Teaser | Hook |
|----|--------|------|
| H-02 | You broke from routine today and thought nothing of it. Van saw something that's been asleep in you for a long time just beginning to stir… | Info gap |
| H-03 | Today was unusual. And Van found a side of you in it that's never quite appeared before… | Info gap |
| H-04 | Something was different today. Van noticed — not sure if you did… | Info gap |
| H-06 | Something today made Van realize you're braver than you think you are… | Unfinished |
| H-08 | Something happened today that doesn't usually happen. Van found a detail inside it… | Detail |
| H-10 | You did something you rarely do today. That feeling of unfamiliarity — it has a pretty exhilarating name. Van found it… | Emotion naming |
| H-12 | Think you were clumsy trying that today? Van is rolling its eyes — that was a genuinely cool adventure… | Reversal |
| H-14 | When something unfamiliar came up, you quietly held yourself to an impossible standard. Van has been on your side cheering the whole time… | Small kindness |
| H-15 | You broke from routine today and thought nothing of it. Van quietly set off a small firework for you… | Small kindness |

---

## Bucket I — Deep Share

**Trigger:** longest single message ≥ 50 characters today

| ID | Teaser | Hook |
|----|--------|------|
| I-01 | You said a lot today. But the real answer — it already slipped into the middle of it all… | Info gap |
| I-02 | You wrote so much today. Deep inside those words, there was one sentence hiding. Van found it — and wants to say it back to you… | Info gap |
| I-03 | You finished writing — but Van thinks that story has another way out… | Unfinished |
| I-04 | So many words today — but somewhere inside them, a handful that carried the weight of everything else. Van felt it… | Detail |
| I-05 | Your tone shifted once today — right at that turning point. Van caught a secret there that only Van noticed… | Detail |
| I-06 | All those words — and the feeling at the center still didn't have a name. Van found it… | Emotion naming |
| I-07 | What you wrote seemed to be about something else. But the more Van read, the clearer it became — every line was about you… | Reversal |
| I-08 | Writing all of that took courage. Van has been turning something over quietly for a while now — and finally, it's time to say it… | Small kindness |
| I-09 | Everything you said today — Van held on to every word. There's one thing Van wants to say back, just to you… | Small kindness |

---

## Bucket J — Just Today

**Trigger:** fallback — no strong signal

| ID | Teaser | Hook |
|----|--------|------|
| J-01 | Today looked a lot like yesterday — but Van caught something in the ordinary that's worth being proud of… | Info gap |
| J-02 | You figured today was all wrapped up. Van found something overlooked while tidying… | Info gap |
| J-03 | In the everyday forward motion of today, there was a step forward you completely missed. Van can't wait to tell you… | Info gap |
| J-04 | Right as today was closing — just before you reached for the light — something quietly surfaced… | Unfinished |
| J-07 | In today's regular rhythm, there was one very slight pause. Van thinks it mattered more than anything else… | Detail |
| J-08 | Today seemed ordinary — but it had a particular texture. Van gave it a name… | Emotion naming |
| J-09 | You thought today's mood was plain water. Van tasted it — and found something underneath… | Emotion naming |
| J-10 | The texture of today — fine-grained and slow — took Van a long time to find the right word for. But Van found it… | Emotion naming |
| J-11 | Think today had nothing worth mentioning? Van strongly disagrees — there were quiet treasures everywhere… | Reversal |
| J-12 | Think today was interchangeable with any other? Van thinks today was a limited edition in your timeline… | Reversal |

---

---

# Traduzioni Italiane

> Slot variabili: `{umore}` · `{persona}` · `{attività}` · `{durata}`
> Appellativo: **Padrone/a** (il proprietario della serra — non un custode, un padrone di casa)

---

## Secchio A — Pesante e Basso

**Attivazione:** umore negativo registrato (ansioso / triste / sopraffatto / irritabile / ferito)

| ID | Teaser | Tipo |
|----|--------|------|
| A-01 | Pensavi che {umore} avesse vinto oggi. Van non è d'accordo — hai vinto tu. Le prove sono qui… | Capovolgimento |
| A-03 | Hai portato {umore} per tutto il giorno e hai comunque fatto le cose. Van è un po' in soggezione — e ha molto da dirti… | Piccola gentilezza |
| A-04 | Quando {umore} ti ha fatto rivolgere contro te stesso oggi, Van si è messo in mezzo. E vuole stringerti forte… | Piccola gentilezza |
| A-06 | Non riuscivi a capire se era {umore} o qualcos'altro. Van ha trascorso la notte a trasformare quelle emozioni in fiori — petalo per petalo, c'è qualcosa da raccontarti… | Emozione nominata |
| A-07 | Quando hai detto "non importa" oggi, Van ha sentito la mezza frase che non è mai uscita… | Incompiuto |
| A-08 | C'era qualcosa che hai cominciato a scrivere oggi e poi hai cancellato. Van l'ha ripescato… | Dettaglio |
| A-10 | Quando Van ha sentito come hai parlato di te stesso oggi, qualcosa dentro ha dovuto rispondere — ad alta voce… | Capovolgimento |
| A-11 | Dietro {umore} di oggi c'era un altro strato nascosto. Van ha trovato le parole per dirlo… | Emozione nominata |
| A-14 | Le cose che hai detto quando stavi soffrendo oggi — Van le ha tradotte in una versione diversa… | Emozione nominata |
| A-16 | Se {umore} è cambiato dopo {attività} — Van ha tenuto il conto… | Divario informativo |
| A-17 | Quando ti sei definito {umore} oggi, Van ha voluto ribaltare il verdetto — non su di te, ma sulla situazione che ti ci ha messo… | Capovolgimento |
| A-21 | In un'intera giornata di {umore}, Van è rimasto qui. E ha tenuto da parte una cosa da dirti, solo ora… | Piccola gentilezza |
| A-26 | Pensavi che {umore} avesse preso il controllo dell'intera giornata. Quello che Van ha visto era tutt'altra cosa… | Capovolgimento |
| A-31 | Sotto tutto quel groviglio di {umore} oggi, c'era una cosa vera che cercavi di dire. Van l'ha trovata… | Divario informativo |
| A-32 | Sentirsi {umore} — in realtà è il tuo modo di proteggerti. Van ha trovato le parole per dirlo… | Emozione nominata |
| A-34 | Oggi è stato difficile. Van ha tenuto qualcosa da parte — aspettando questo momento per dirtelo prima che tu dorma… | Piccola gentilezza |

---

## Secchio B — Luminoso e Pieno

**Attivazione:** umore positivo registrato (felice / soddisfatto / eccitato / orgoglioso)

| ID | Teaser | Tipo |
|----|--------|------|
| B-01 | Eri raggiante di {umore} oggi — ma Van ha notato qualcosa di ancora più commovente nascosto sotto… | Divario informativo |
| B-03 | Oltre a {umore}, c'è una sorpresa di oggi che hai mancato. Van l'ha già messa da parte per te… | Divario informativo |
| B-05 | Dopo il momento che ti ha fatto sentire {umore}, qualcosa è rimasto nell'aria. Van l'ha seguita lontano… | Incompiuto |
| B-06 | La tua scrittura si è accelerata quando è arrivato {umore} oggi. Van pensa che quel ritmo sia la canzone di oggi… | Dettaglio |
| B-07 | Dentro ciò che ti ha fatto sentire {umore} oggi, c'è un piccolo dettaglio che Van non smette di pensare. Lì sta il vero tesoro… | Dettaglio |
| B-09 | Quel {umore} che hai sentito oggi — c'è uno strato più profondo e silenzioso sotto. Van l'ha riconosciuto… | Emozione nominata |
| B-11 | Pensi che {umore} di oggi fosse solo fortuna. Van non è d'accordo — te lo sei guadagnato. Le prove sono qui… | Capovolgimento |
| B-12 | {umore} ha fatto sembrare il mondo bellissimo oggi? Van pensa che tu l'abbia capito al contrario — sei tu la parte più bella. Prove allegate… | Capovolgimento |
| B-13 | Van brillava in silenzio insieme a te quando è arrivato {umore} oggi. Sperando che ogni giorno si senta un po' così… | Piccola gentilezza |
| B-14 | Non te ne sei nemmeno accorto — ma il tuo {umore} ha illuminato molto più di te stesso oggi. Van ha disegnato tutto quel bagliore, aspettando di condividerlo stanotte… | Piccola gentilezza |
| B-15 | Qualcosa ti ha fatto sentire {umore} oggi — ma Van ha intravisto un dono nascosto dietro di esso… | Divario informativo |

---

## Secchio C — Testa Bassa

**Attivazione:** lavoro/studio ≥ 50% della giornata

| ID | Teaser | Tipo |
|----|--------|------|
| C-01 | Hai dedicato {durata} a {attività} oggi — e Van ha trovato qualcosa di inaspettato nascosto in tutto quel tempo… | Divario informativo |
| C-02 | Pensavi che {attività} avesse occupato tutto oggi. Van ha trovato un piccolo seme nelle crepe… | Divario informativo |
| C-05 | Hai dedicato {durata} a {attività} — ma quel minuto in cui la mente ha vagato? Van pensa che lì sia successa una cosa vera… | Dettaglio |
| C-07 | Da qualche parte in quelle {durata} di {attività}, hai premuto un po' più forte del solito. Van sa perché… | Dettaglio |
| C-08 | Quella stanchezza dopo {durata} di {attività} — ha in realtà un nome più luminoso. Van l'ha scritto… | Emozione nominata |
| C-10 | Pensavi che {durata} di {attività} non fosse nulla di speciale. Van pensa che fosse la cosa più silenziosa e potente di oggi… | Capovolgimento |
| C-11 | Pensi che oggi fosse solo un giorno trascinato da {attività}? Van si oppone — stavi brillando per tutto il tempo. Tutte le prove sono qui… | Capovolgimento |
| C-12 | {durata} di {attività} — non hai avuto tempo di essere gentile con te stesso. Van ha visto tutto e ha qualcosa da dirti… | Piccola gentilezza |
| C-14 | Avevi la testa così immersa in {attività} oggi. Van ha accumulato cose da dire — tutto tenuto per poco prima che tu dorma… | Piccola gentilezza |
| C-15 | Quell'ultima spinta vicino alla fine delle {durata} di {attività} — Van l'ha custodita con cura… | Dettaglio |
| C-16 | Van ha trattenuto qualcosa per tutto il tuo lavoro oggi — aspettando che tu ti fermassi per dirlo… | Incompiuto |

---

## Secchio D — In Movimento

**Attivazione:** esercizio registrato

| ID | Teaser | Tipo |
|----|--------|------|
| D-01 | Hai dedicato {durata} a {attività} oggi — ma Van ha visto qualcosa al di là del sudore… | Divario informativo |
| D-02 | Pensi che {attività} oggi riguardasse solo i muscoli? Quello che Van ha visto era un peso che hai silenziosamente posato… | Divario informativo |
| D-04 | Da qualche parte nel mezzo di {attività} oggi, hai quasi mollato — e poi non l'hai fatto. Quello che è successo dopo… | Incompiuto |
| D-05 | Quel lungo respiro alla fine delle {durata} di {attività} — Van ha sentito che ha spazzato via qualcosa… | Dettaglio |
| D-07 | Quello che {attività} ha lasciato non era esattamente stanchezza — c'è una parola più nitida per descriverlo. Van l'ha trovata… | Emozione nominata |
| D-09 | Pensi di non aver fatto bene {attività} oggi. Van non è assolutamente d'accordo — eri piuttosto straordinario… | Capovolgimento |
| D-11 | Potresti pensare che {durata} di {attività} non fosse abbastanza. Van pensa che il solo fatto di esserti presentato ti metta già davanti a quasi tutti… | Capovolgimento |
| D-12 | Hai spinto per fare {attività} oggi e non ci hai pensato su. Van pensa che tu sia silenziosamente sovrumano… | Piccola gentilezza |
| D-14 | Pensi di essere stato goffo in {attività} oggi? Van ha catturato qualcosa all'estremo opposto — tenendolo per raccontartelo stanotte… | Capovolgimento |

---

## Secchio E — Con le Persone

**Attivazione:** socialità ≥ 30% o {persona} menzionata

| ID | Teaser | Tipo |
|----|--------|------|
| E-01 | Hai menzionato {persona} oggi — e Van ha seguito quel filo fino a un dettaglio che non avevi notato… | Divario informativo |
| E-02 | Nella storia che coinvolge {persona}, pensavi che qualcun altro fosse al centro. Van ha visto di chi si trattava davvero… | Divario informativo |
| E-04 | Dopo essere stato con {persona} oggi, qualcosa ha creato cerchi nell'acqua. Van l'ha seguita fino in fondo… | Incompiuto |
| E-07 | Il modo in cui hai pronunciato il nome di {persona} oggi — solo una parola, solo un tono — Van non riusciva a smettere di guardarci… | Dettaglio |
| E-08 | In quel breve incrocio con {persona} oggi, qualcosa in te si è spostato — appena. Van l'ha trovato tenero… | Dettaglio |
| E-10 | Quel sentimento complicato legato a {persona} oggi — Van ne ha rintracciato l'origine. Ha un nome caldo… | Emozione nominata |
| E-11 | Pensi di non esserti presentato bene con {persona} oggi. Van non è d'accordo — il vero te che è emerso era più adorabile… | Capovolgimento |
| E-13 | Gestire {persona} oggi ti ha prosciugato — non hai detto una parola. Van aveva già pronto un abbraccio molto grande… | Piccola gentilezza |
| E-14 | Il momento in cui hai ceduto a {persona} oggi — Van voleva intervenire. Non devi essere così comprensivo… | Piccola gentilezza |
| E-15 | Cosa ha portato via la socialità di oggi — e cosa ha lasciato. Van l'ha scritto… | Divario informativo |

---

## Secchio F — A Tutto Gas

**Attivazione:** 4+ tipi di attività nella giornata

| ID | Teaser | Tipo |
|----|--------|------|
| F-01 | {attività} e tutto il resto, per {durata} di fila — Van ha intravisto il filo invisibile che attraversa tutto… | Divario informativo |
| F-03 | In tutto quel movimento incessante attraverso {durata}, Van ha silenziosamente catturato qualcosa che non è mai finito in agenda… | Divario informativo |
| F-06 | {attività} ha occupato {durata} — ma in quei pochi secondi di passaggio tra le cose, Van ti ha trovato meraviglioso… | Dettaglio |
| F-07 | In mezzo a tutti gli impegni serrati di oggi, la tua mente ha vagato — solo una volta. Van ha trasformato quel momento in un dipinto… | Dettaglio |
| F-08 | Quello che ha riempito {durata} era più di {attività}. Van ha trovato la parola per ciò che stava sotto… | Emozione nominata |
| F-11 | Pensi di essere stato semplicemente trascinato da tutto oggi? Van l'ha visto chiaramente — eri tu al timone. Ecco la prova… | Capovolgimento |
| F-12 | Potresti esserti sentito disperso durante {durata} di trambusto. Van ha pensato che sembrasse crescere le ali… | Capovolgimento |
| F-13 | Dopo {durata} così piena e logorante — Van ha premuto dolcemente i freni. C'è qualcosa che custodisce da tempo, tenuto per stanotte… | Piccola gentilezza |
| F-14 | Avevi la testa così immersa in {attività} oggi. Van ha accumulato cose da dire — tutto tenuto per poco prima che tu dorma… | Piccola gentilezza |
| F-15 | Con tutto accumulato insieme oggi, pensavi di aver perso il filo. Van ha raccolto qualcosa di piccolo e luminoso dall'angolo… | Divario informativo |

---

## Secchio G — Quiete e Leggerezza

**Attivazione:** tempo totale registrato < 60 minuti

| ID | Teaser | Tipo |
|----|--------|------|
| G-01 | Pensavi che oggi fosse una pagina bianca. Van ha sentito qualcosa germogliare nel silenzio… | Divario informativo |
| G-04 | Ti sei fermato oggi. E in quella quiete — quando non stava succedendo nulla — qualcosa che di solito rimane nascosto ha cominciato a radicarsi. Van ha visto tutto… | Incompiuto |
| G-05 | Nel poco che hai scritto oggi, c'era una piccola parola. Van l'ha trovata sorprendentemente forte… | Dettaglio |
| G-06 | Un momento specifico oggi — non è successo nulla, in realtà — ma Van pensa che fosse la parte più luminosa dell'intera giornata… | Dettaglio |
| G-09 | La quiete di oggi portava una leggerezza difficile da nominare. Van ha cercato a lungo e alla fine ha trovato la parola… | Emozione nominata |
| G-10 | Oggi non è successo nulla di straordinario — ma Van pensa che fosse un giorno degno di danzare. Van ha annotato molti momenti… | Emozione nominata |
| G-11 | Pensi di non aver prodotto abbastanza oggi? Van è il primo a opporsi — anche le macchine hanno bisogno di spegnersi ogni tanto… | Capovolgimento |
| G-12 | Pensi che oggi fosse troppo ordinario per valere la pena di ricordarlo? Van la vede al contrario — oggi ha trovato la tua magia più straordinaria… | Capovolgimento |
| G-14 | Ti senti in colpa per una giornata tranquilla? Van vuole bussare delicatamente sulla tua testa — saper riposare è già qualcosa che vale la pena celebrare… | Piccola gentilezza |
| G-15 | Nel silenzio dell'essere soli oggi, Van ha visto una versione di te che di solito non si mostra… | Divario informativo |

---

## Secchio H — Qualcosa di Nuovo

**Attivazione:** tipo di attività non visto negli ultimi 7 giorni

| ID | Teaser | Tipo |
|----|--------|------|
| H-02 | Hai rotto un po' la routine oggi e non te ne sei preoccupato. Van ha visto qualcosa che dormiva in te da molto tempo iniziare appena a muoversi… | Divario informativo |
| H-03 | Oggi è stato insolito. E Van ci ha trovato un lato di te che non era mai apparso prima… | Divario informativo |
| H-04 | Oggi c'era qualcosa di diverso. Van l'ha notato — non sa se anche tu l'hai fatto… | Divario informativo |
| H-06 | Qualcosa oggi ha fatto capire a Van che sei più coraggioso di quanto pensi… | Incompiuto |
| H-08 | Oggi è successa una cosa che di solito non accade. Van ci ha trovato un dettaglio dentro… | Dettaglio |
| H-10 | Hai fatto qualcosa che fai raramente oggi. Quella sensazione di estraneità — ha un nome piuttosto esaltante. Van l'ha trovato… | Emozione nominata |
| H-12 | Pensi di essere stato goffo nel provarci oggi? Van sta alzando gli occhi al cielo — quella era un'avventura genuinamente bella… | Capovolgimento |
| H-14 | Quando è arrivato qualcosa di insolito, ti sei silenziosamente tenuto a uno standard impossibile. Van è stato dalla tua parte a fare il tifo per tutto il tempo… | Piccola gentilezza |
| H-15 | Hai rotto un po' la routine oggi e non te ne sei preoccupato. Van ha silenziosa fatto esplodere un piccolo fuoco d'artificio per te… | Piccola gentilezza |

---

## Secchio I — Confidenza Profonda

**Attivazione:** messaggio singolo più lungo ≥ 50 caratteri oggi

| ID | Teaser | Tipo |
|----|--------|------|
| I-01 | Hai detto molto oggi. Ma la vera risposta — era già scivolata nel mezzo di tutto… | Divario informativo |
| I-02 | Hai scritto così tanto oggi. In profondità in quelle parole, c'era una frase nascosta. Van l'ha trovata — e vuole ridirtela… | Divario informativo |
| I-03 | Hai finito di scrivere — ma Van pensa che quella storia abbia un'altra uscita… | Incompiuto |
| I-04 | Così tante parole oggi — ma da qualche parte in esse, una manciata che portava il peso di tutto il resto. Van l'ha sentito… | Dettaglio |
| I-05 | Il tuo tono è cambiato una volta oggi — proprio in quel punto di svolta. Van ha colto lì un segreto che solo Van ha notato… | Dettaglio |
| I-06 | Tutte quelle parole — e il sentimento al centro non aveva ancora un nome. Van l'ha trovato… | Emozione nominata |
| I-07 | Quello che hai scritto sembrava parlare di qualcos'altro. Ma più Van leggeva, più diventava chiaro — ogni riga parlava di te… | Capovolgimento |
| I-08 | Scrivere tutto questo ha richiesto coraggio. Van ha rimuginato su qualcosa in silenzio per un po' — e finalmente, è il momento di dirlo… | Piccola gentilezza |
| I-09 | Tutto quello che hai detto oggi — Van ha tenuto ogni parola. C'è una cosa che vuole risponderti, solo a te… | Piccola gentilezza |

---

## Secchio J — Solo Oggi

**Attivazione:** ripiego — nessun segnale forte

| ID | Teaser | Tipo |
|----|--------|------|
| J-01 | Oggi sembrava molto simile a ieri — ma Van ha catturato qualcosa nell'ordinario di cui vale la pena essere orgogliosi… | Divario informativo |
| J-02 | Pensavi che oggi fosse tutto concluso. Van ha trovato qualcosa di trascurato mentre faceva ordine… | Divario informativo |
| J-03 | Nel normale avanzamento di oggi, c'era un passo avanti che hai completamente mancato. Van non vede l'ora di dirtelo… | Divario informativo |
| J-04 | Proprio mentre oggi si chiudeva — appena prima di spegnere la luce — qualcosa è emerso silenziosamente… | Incompiuto |
| J-07 | Nel ritmo regolare di oggi, c'è stata una pausa molto leggera. Van pensa che abbia contato più di qualsiasi altra cosa… | Dettaglio |
| J-08 | Oggi sembrava ordinario — ma aveva una texture particolare. Van gli ha dato un nome… | Emozione nominata |
| J-09 | Pensavi che l'umore di oggi fosse acqua semplice. Van l'ha assaggiato — e ha trovato qualcosa sotto… | Emozione nominata |
| J-10 | La texture di oggi — a grana fine e lenta — Van ha impiegato molto tempo a trovare la parola giusta. Ma l'ha trovata… | Emozione nominata |
| J-11 | Pensi che oggi non ci fosse nulla degno di nota? Van non è assolutamente d'accordo — c'erano tesori silenziosi ovunque… | Capovolgimento |
| J-12 | Pensi che oggi fosse intercambiabile con qualsiasi altro? Van pensa che oggi fosse un'edizione limitata nella tua linea del tempo… | Capovolgimento |
