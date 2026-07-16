# DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/ACTIVITY_LEXICON.md
# 活动 / 心情分类当前实现审计与开源方案调研

> 审计日期：2026-07-16  
> 本文描述当前代码真实行为。产品规范以 `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` 为准。

## 1. 小白版结论

普通聊天输入现在只做三选一：

1. 这是一个新活动。
2. 这是一个独立心情。
3. 这是上一条活动过程中产生的心情。

系统没有“未识别”出口，也没有普通输入的“活动附带心情”第四类。一句话里即使同时有活动和心情，活动词与心情词只是分别加分，最后仍选三类中的一个。

魔法笔不同。它负责把复杂句拆开，所以 AI 仍保留 `activity / mood / todo_add / activity_backfill` 四类。魔法笔可以把拆出的心情段附到活动草稿，但这不需要普通分类器的第四种类型。

英语 `get up` 误判已在本次改动中修复：项目接入 MIT 许可证的 `compromise`，用英语短语动词结构作为活动证据，而不是只给词库补一个固定短语。

## 2. 项目里其实有三种“分类”

| 层次 | 输入 | 输出 | 作用 |
|---|---|---|---|
| 实时输入意图 | 用户刚输入的一句话 | 普通输入三个 `internalKind` | 决定写活动还是心情 |
| 活动六分类 | 已经确定是活动的文本 | study/work/social/life/entertainment/health | 卡片颜色、统计和报告 |
| 心情标签 | 心情文字或活动文字 | happy/calm/down 等 `MoodKey` | 心情标签和报告 |

`get up` 的问题发生在第一层。后面的活动六分类或 AI 增强不会把一条已经错误写成心情的消息重新变成活动。

## 3. 普通输入的端到端流程

```mermaid
flowchart TD
  A["ChatPage 发送"] --> B["useChatStore.sendAutoRecognizedInput"]
  B --> C["chatActions 组装最近活动上下文"]
  C --> D["classifyLiveInput"]
  D --> E["中文或英/意信号提取"]
  E --> F["未来/否定优先拦截"]
  F --> G["上一活动关联判断"]
  G --> H["resolver 累加活动分和心情分"]
  H --> I["三种 internalKind 之一"]
  I --> J["sendMessage 或 sendMood"]
  J --> K["记录分类原因与纠错遥测"]
```

主要代码：

- `src/services/input/liveInputClassifier.ts`：总入口、语言路由、上下文优先规则。
- `src/services/input/signals/zhSignalExtractor.ts`：中文证据。
- `src/services/input/signals/latinSignalExtractor.ts`：英语和意大利语证据。
- `src/services/input/signals/englishLinguisticAdapter.ts`：`compromise` 短语动词证据。
- `src/services/input/resolver/liveInputResolver.ts`：统一计分和最终二选路由。
- `src/store/chatActions.ts`：把分类结果写成活动或心情。
- `src/features/chat/chatPageActions.ts`：魔法笔本地快速通道与 AI 分流。

## 4. 当前三种结果

### new_activity

条件：没有先被上下文规则截走，并且最终活动分严格大于心情分。

写入：调用 `sendMessage(..., { skipMoodDetection: false })`。普通活动写入仍会运行已有的自动心情标签检测，因此“写周报写得很烦”可以是活动，同时活动卡片得到 `down` 标签，但它的分类仍只是 `new_activity`。

### standalone_mood

条件：纯心情、计划或否定输入，或者最终心情分大于等于活动分。

写入：调用 `sendMood()`。无证据或平分时也落到这里，因为产品要求每条输入必须有结果。

### mood_about_last_activity

条件：存在最近活动，输入明确指代或可靠重合该活动，同时包含评价/心情，而且没有足够强的新活动信号。

写入：调用 `sendMood()` 并传入 `relatedActivityId`，把关系定向写回上一条活动。

## 5. 当前证据和分数

| 证据 | 活动分 | 心情分 | 说明 |
|---|---:|---:|---|
| 词库或活动句式 | +3 | 0 | 中英意活动词和结构 |
| 英语短语动词 | +3 | 0 | `compromise` 输出 |
| 去地点 | +3 | 0 | at the park、去了公园 |
| 正在进行 | +2 | 0 | 正在、在做 |
| 强完成 | +2 | 0 | 做完、finished |
| 普通心情 | 0 | +2 | 累、开心、relieved |
| 弱完成/评价 | 0 | +2 | 更接近状态描述 |
| 未来/计划 | 0 | +3 | 优先返回独立心情 |
| 否定/未发生 | 0 | +3 | 优先返回独立心情 |
| 上一活动偏置 | 0 | +3 | 用于关联上一活动 |

置信度取两边分差：3 分以上为高，1 至 2 分为中，0 分为低。低置信度不创建第四个结果。

## 6. 语言识别过程

### 中文

1. 标准化输入。
2. 检查未来、计划、否定和“事情没有发生”。
3. 检查正在进行、完成、去地点、活动词和心情词。
4. 检查是否在评价最近活动。
5. 对很短且没有心情的动作外壳做活动回落。
6. 进入统一 resolver 计分。

### 英语

1. 用词库和正则识别活动、心情、未来、否定、完成与地点。
2. 用 `compromise` 识别 `#Verb #Particle` 短语动词。
3. 将短语动词记录为独立的 `linguistic` 活动证据。
4. 证据一起进入上下文规则和统一计分。

已固定回归：`get up / got up / getting up / gets up / wake up / woke up` 都是 `new_activity`。

### 意大利语

使用意大利语词库、动词变形生成器、正则句式、完成和地点结构。当前没有套用英语 NLP 模型。

## 7. 魔法笔现在怎么分流

魔法笔先调用普通分类器，但只把它当作“是否可以本地快速写入”的判断工具。

以下情况不能走本地快速通道，必须调用魔法笔 AI：

- 同时有活动和心情证据。
- 有多个动作。
- 有待办清单信号。
- 有明确日期、时段或时间范围。
- 有列表分隔符或复杂标点。
- 普通分类器置信度不足。
- 命中提醒、计划、补录等魔法笔优先信号。

因此“吃饭”可以快速写入；“吃饭好开心”即使很短，也交给魔法笔拆分。

魔法笔 AI 四类不变：

- `activity`
- `mood`
- `todo_add`
- `activity_backfill`

若 AI 返回相邻的活动和心情，前端 draft builder 可以通过 `linkedMoodContent` 把心情附到活动草稿。普通分类器已经完全删除旧的专用混合类型。

## 8. 原问题为什么会发生，现如何修复

旧英语规则主要依赖人工词库、少量正则和短句模板。`get up`：

1. 不在活动词库。
2. 不命中原活动正则。
3. 没有心情词。
4. 没有可靠活动证据。
5. 最终 0:0 平分，按规则回落心情。

现在 `compromise` 会把它识别为“动词 + 小品词”的短语动词，产生 +3 活动证据，所以结果变为活动。这个修复同时覆盖词形变化，不需要分别硬编码六个短语。

## 9. 仍然存在的风险

1. `compromise` 只覆盖英语结构，不懂产品语义；“give up”在某些上下文可能是行为，也可能是状态表达。
2. 规则和词库对网络新词、极短口语仍会漏。
3. 平分归心情会继续让零证据的真实活动偏向心情。
4. 中文短动作外壳和英语短语动词都可能带来活动误报，必须靠 gold set 控制。
5. 用户纠错已经有遥测，但还没有稳定形成按语言分桶的训练闭环。
6. 当前 80% 目标必须由固定评估集证明，不能靠少量示例判断。

## 10. 已调研的免费可商用 GitHub 项目

“可商用”指仓库许可证允许商业使用；接入时仍须保留许可证声明，并单独核对数据集和模型许可证。

| 项目 | 许可证 | 能力 | 可放在产品哪个环节 | 结论 |
|---|---|---|---|---|
| [compromise](https://github.com/spencermountain/compromise) | MIT | 浏览器端英语词性、动词短语、词形和规则匹配 | 实时英语信号提取 | **已采用**，当前识别短语动词 |
| [winkNLP](https://github.com/winkjs/wink-nlp) | MIT | token、POS、lemma、negation、sentiment | 替代或增强英语 linguistic adapter | 备选，不与 compromise 同时常驻 |
| [Open English WordNet](https://github.com/globalwordnet/english-wordnet) | CC-BY 4.0 | 词性、同义词、上下位关系 | 构建期扩活动词候选和检查漏词 | 推荐离线使用，必须署名 |
| [Natural](https://github.com/NaturalNode/natural) | 代码 MIT | tokenizer、stemmer、分类器、WordNet | Node 侧评估和词库生成 | 可用；内含数据需单独保留声明 |
| [WordPOS](https://github.com/moos/wordpos) | MIT | 基于 WordNet 的词性查询 | 构建期判断候选词是否可能是动词 | 可用，但不作为首选 runtime |
| [wink Naive Bayes Text Classifier](https://github.com/winkjs/wink-naive-bayes-text-classifier) | MIT | 轻量文本分类、交叉验证、混淆矩阵 | 有纠错样本后做三分类概率补充 | P1，先积累标注数据 |
| [NLP.js](https://github.com/axa-group/nlp.js) | MIT | 多语言 intent、实体、情感和语言识别 | 中英意统一的学习型分类实验 | P2，能力与现有规则重叠较多 |
| [fastText](https://github.com/facebookresearch/fastText) | MIT | 字符 n-gram、OOV 泛化、监督分类和量化 | 离线训练短文本三分类器 | P2，适合数据量更大后 |
| [spaCy](https://github.com/explosion/spaCy) | MIT | POS、lemma、dependency、textcat | 离线误判分析和 gold set 生成 | P2，不适合当前前端主链路 |
| [Transformers.js](https://github.com/huggingface/transformers.js) | Apache-2.0 | 浏览器/Node 模型推理 | 低置信样本二次判断 | P2/P3；模型许可证和体积需逐个审查 |
| [wink-sentiment](https://github.com/winkjs/wink-sentiment) | MIT | 情绪极性、强度和否定 | 只增强“有无心情”证据 | 辅助工具，不能单独区分活动 |
| [VADER](https://github.com/cjhutto/vaderSentiment) | MIT | 英语情绪强度 | 离线校验心情证据 | 辅助工具，Python 链路 |

明确不直接使用：

- NRC Emotion Lexicon 的免费条件不等于商业免费，商业产品需要另行确认授权。
- 没有 LICENSE 的 GitHub 词表不能因为“公开可下载”就进入商业产品。
- 开源推理框架的许可证不自动覆盖任意下载模型或训练数据。

## 11. 推荐的后续优化顺序

### P0：把 80% 变成可验证指标

1. 建立中英意固定 gold set，先达到每种语言 300 至 500 条。
2. 分桶统计纯活动、纯心情、混合证据、上一活动关联、未来、否定、极短输入和短语动词。
3. 每次线上纠错先进入回归集，再改规则。
4. 报告整体准确率、三类召回率和混淆矩阵。

### P1：离线扩词与轻量学习

1. 用 Open English WordNet 生成候选，不把整库打进 iOS。
2. 人工审核候选后再进入 `ACTIVITY_LEXICON`。
3. 用纠错样本训练 wink Naive Bayes 或 NLP.js 三分类基线。
4. 学习模型只提供分数，不绕过未来、否定和上下文硬规则。

### P2：数据足够后比较模型

比较 fastText、小型 Transformer 与当前规则组合。模型必须输出三类概率，仍由统一 resolver 合并；不能重新创造第四个普通输入类型。

## 12. 本次改动后的验证锚点

- 分类器单元测试：`src/services/input/liveInputClassifier.test.ts`
- 英语/意大利语回归：`src/services/input/liveInputClassifier.i18n.test.ts`
- Store 路由：`src/store/chatActions.test.ts`
- Store 集成：`src/store/useChatStore.integration.test.ts`
- 魔法笔分流：`src/features/chat/chatPageActions.test.ts`
- 固定意图集：`src/services/input/__fixtures__/liveInput.intent.fixture.json`
- PR0 评估：`npm run eval:classification:pr0`
