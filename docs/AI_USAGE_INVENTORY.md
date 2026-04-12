# 项目 AI 使用清单（代码运行态）

本文仅统计代码里**实际调用 AI 模型/服务**的位置（不含纯文档描述）。

## 总览

- 前端统一通过 `src/api/client.ts` 调用 `/api/*`。
- 当前共识别到 8 个 AI 运行角色（含植物日记能力）。

## AI 使用明细

| AI角色 | 用到的地方 | 当前模型/供应商 | 具体功能描述 | 对模型能力要求 | 建议参数级别 |
| --- | --- | --- | --- | --- | --- |
| AI 批注（含建议模式） | `api/annotation.ts` -> `src/server/annotation-handler.ts`；触发：`src/store/useAnnotationStore.ts` | `zh=deepseek-chat`（DeepSeek，chat completions）+ `en/it=gemini2.0-flash`（Gemini 原生 `generateContent`） | 针对事件生成短批注；可输出建议 JSON；重写去重（文本相似度/emoji） | 人设稳定、多语言、上下文融合、结构化输出稳定 | 20B-70B（建议主力 30B+） |
| 待办拆解 | `api/todo-decompose.ts` + `src/server/todo-decompose-service.ts`；入口：`src/features/growth/SubTodoList.tsx` | zh 默认 DashScope `qwen-plus`（`TODO_DECOMPOSE_MODEL_ZH`），en/it 默认 Gemini `gemini-2.0-flash`（`TODO_DECOMPOSE_MODEL`） | 将待办拆成 3-6 个可执行步骤并给时长 | 指令遵循、JSON 稳定、轻规划能力 | 7B-20B |
| 日记生成（长文） | `api/diary.ts`；调用：`src/store/reportActions.ts` | OpenAI Chat Completions；`gpt-4o` | 基于结构化日报数据+历史上下文生成 AI 日记 | 长上下文总结、叙事能力、事实约束 | 30B-70B |
| 报告短洞察（短文） | `api/diary.ts`（`action='insight'`）；调用：`src/features/report/ReportDetailModal.tsx` | OpenAI；`gpt-4o-mini` | 生成 todo/habit 的短洞察句（超短） | 极短文本压缩、格式遵循 | 7B-14B |
| 时间记录分类器 | `api/classify.ts`；调用：`src/store/useChatStore.ts`、`src/store/useTodoStore.ts` | DashScope 兼容接口 + Qwen；默认 `qwen-plus` | 将输入分类成结构化数据（类别、时段、能量日志）；并做瓶子语义匹配 | 分类抽取、语义匹配、JSON 稳定 | 14B-32B |
| 魔法笔解析 | `api/magic-pen-parse.ts`；调用：`src/services/input/magicPenParser.ts` | Zhipu `glm-4.7-flash` + Qwen fallback（`qwen-flash`） | 将自然语言拆成 `activity/mood/todo_add/activity_backfill` 等结构 | 非结构文本解析、时间抽取、鲁棒 JSON | 14B-32B（偏低延迟） |
| 报告分析（日报/周报/月报） | `api/report.ts`；调用：`src/store/reportActions.ts` | Chutes；`NousResearch/Hermes-4-405B-FP8-TEE` | 生成周期复盘与改进建议 | 长文综合分析、趋势归因、建议质量 | 30B-70B（当前配置偏重） |
| 植物日记与 plantId 选择 | `api/plant-generate.ts` -> `src/server/plant-diary-service.ts` | OpenAI Chat Completions；`gpt-4.1-mini` | 从候选植物中选 `plantId` 并生成一句观察文案 | 受限集合选择、短文案、多语言 | 7B-20B |

## API 与环境变量映射

- `/api/annotation` -> `DEEPSEEK_API_KEY`（zh）+ `GEMINI_API_KEY`（en/it）；可选 `ANNOTATION_DEEPSEEK_BASE_URL` / `ANNOTATION_GEMINI_BASE_URL`
- `/api/todo-decompose` -> `QWEN_API_KEY`（zh，`TODO_DECOMPOSE_MODEL_ZH`）+ `GEMINI_API_KEY`（en/it，`TODO_DECOMPOSE_MODEL`）；可选 `TODO_DECOMPOSE_GEMINI_BASE_URL`、`TODO_DECOMPOSE_VERBOSE_LOGS`
- `/api/diary` -> `OPENAI_API_KEY`
- `/api/classify` -> `QWEN_API_KEY`（可选 `CLASSIFY_MODEL`、`DASHSCOPE_BASE_URL`）
- `/api/magic-pen-parse` -> `ZHIPU_API_KEY` + `QWEN_API_KEY`（可选 `MAGIC_PEN_FALLBACK_MODEL`）
- `/api/report` -> `CHUTES_API_KEY`
- `src/server/plant-diary-service.ts`（由 `/api/plant-generate` 调用）-> `OPENAI_API_KEY`

## 补充观察

- `api/magic-pen-parse.ts` 中当前调用顺序为：先尝试 Qwen fallback，再尝试 Zhipu 主模型（与“主路/兜底”命名直觉相反）。
- `api/README.md` 提到 `/api/plant-diary`，但仓库中无 `api/plant-diary.ts`；植物日记能力由 `api/plant-generate.ts` + `src/server/plant-diary-service.ts` 组成。

## 主流模型官网定价速查（2026-04-09 抓取）

> 说明：
> - 价格单位默认是“每 1M tokens”（若非 token 计费会单独写明）。
> - 不同官网有“标准/优先/批处理/地区/上下文分档”差异，表中优先放可直接对比的一档价格，并在备注里标注。
> - 部分官网页面强依赖 JS（当前抓取环境无法直接抽取表格），对应项标记为“官网可见但本次抓取未直出数值”。

| 参数规模（约） | 模型名字 | 供应商 | 输入报价 | 缓存报价 | 输出报价 | 价格参考网址 |
| --- | --- | --- | --- | --- | --- | --- |
| 未披露 | GPT-5.4 | OpenAI | $2.50 | $0.25 | $15.00 | https://openai.com/api/pricing |
| 未披露 | Claude Sonnet 4.6 | Anthropic (Claude) | $3.00 | Cache read $0.30（5m write $3.75 / 1h write $6.00） | $15.00 | https://platform.claude.com/docs/en/about-claude/pricing |
| 未披露 | DeepSeek-V3.2（deepseek-chat/reasoner） | DeepSeek | $0.28（cache miss） | $0.028（cache hit） | $0.42 | https://api-docs.deepseek.com/quick_start/pricing |
| 未披露（商业版未公开） | Qwen3-Max（Global, <=32K 档） | Qwen / 阿里云百炼 | $0.359 | 支持 context cache（折扣分档见官网） | $1.434 | https://www.alibabacloud.com/help/en/model-studio/models |
| 1T 总参数 / 32B 激活 | Kimi K2（0905-preview） | Moonshot (Kimi) | CNY 4.00（cache miss） | CNY 1.00（cache hit） | CNY 16.00 | https://platform.kimi.com/docs/pricing/chat-k2 |
| 未披露 | Kimi K2.5 | Moonshot (Kimi) | CNY 4.00（cache miss） | CNY 0.70（cache hit） | CNY 21.00 | https://platform.kimi.com/docs/pricing/chat-k25 |
| 未披露 | MiniMax-M2.7 | MiniMax | CNY 2.10 | cache read CNY 0.42（write CNY 2.625） | CNY 8.40 | https://platform.minimaxi.com/docs/guides/pricing-paygo |
| 未披露 | Gemini 2.5 Pro（Standard, <=200K） | Google (Gemini/Vertex AI) | $1.25 | $0.13 | $10.00 | https://cloud.google.com/vertex-ai/generative-ai/pricing |
| 未披露 | Gemini 2.5 Flash Lite（Standard） | Google (Gemini/Vertex AI) | $0.10 | $0.01 | $0.40 | https://cloud.google.com/vertex-ai/generative-ai/pricing |
| 未披露 | Grok-4.20 reasoning | xAI | $2.00 | $0.20 | $6.00 | https://docs.x.ai/docs/models |
| 70B | Llama 3.3 70B Versatile（托管） | Groq | $0.59 | 未标注 | $0.79 | https://groq.com/pricing/ |
| 8B | Llama 3.1 8B Instant（托管） | Groq | $0.05 | 未标注 | $0.08 | https://groq.com/pricing/ |
| 32B | Aya Expanse 32B | Cohere | $0.50 | 未标注 | $1.50 | https://cohere.com/pricing |
| 30B / 120B（托管） | Qwen3 32B（Bedrock Standard, Sydney） | AWS Bedrock (Qwen) | $0.1545 | 见 Priority/Flex/Batch 分档 | $0.6180 | https://aws.amazon.com/bedrock/pricing/ |
| 13B / 70B（托管） | Llama 2 Chat（Bedrock） | AWS Bedrock (Meta) | $0.75（13B） / $1.95（70B） | 未标注 | $1.00（13B） / $2.56（70B） | https://aws.amazon.com/bedrock/pricing/ |
| 未披露 | GLM 系列（如 GLM-5.1 / GLM-5 / GLM-4.7） | 智谱（GLM / Zhipu） | 官网价格页可见但本次抓取未直出 | 同左 | 同左 | https://open.bigmodel.cn/pricing |
| 未披露 | 豆包（火山方舟） | 字节跳动（Doubao / Volcengine Ark） | 官网价格页可见但本次抓取未直出 | 同左 | 同左 | https://www.volcengine.com/docs/82379/1544106 |

### 备注

- 上表已覆盖你点名的供应商/系列：豆包、智谱、DeepSeek、Qwen、OpenAI、MiniMax、Meta、Lite（Gemini 2.5 Flash Lite）、GLM、Kimi、Gemini、Claude。
- 对于 Zhipu 和 Doubao：官方页面在当前抓取环境下为 JS 渲染，无法像其他站点一样直接抽取明细数字；已保留官网入口，后续可人工二次校对补齐。
