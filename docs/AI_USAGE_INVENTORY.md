<!-- DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md -> src/api/README.md -->

# AI 服务商与调用清单（唯一事实源）

Last verified: 2026-10-28（仓库配置；尚未部署验证）

本文是 Seeday **当前 AI 服务商、模型、调用入口和发送数据范围的唯一事实源（SSOT）**。`api/README.md` 负责端点契约，功能 README 负责业务行为；其他文档只引用本清单，不再维护平行的供应商映射。

## 1. 当前结论

- 默认运行时所有语言、所有 AI 能力均使用 **DeepSeek**。完整日记使用 **`deepseek-v4-pro`**，其余使用 **`deepseek-flash`**，全部显式关闭 thinking。
- 原 Qwen、智谱（Zhipu）调用已迁移到 DeepSeek；旧 Chutes `/api/report` 端点已删除，不再存在运行时调用。
- OpenAI/Gemini 适配器和原端点契约保留，默认不调用。服务端设置 `AI_PROVIDER_MODE=legacy` 并重新部署即可恢复原供应商分工，无需修改代码；对应旧密钥必须仍可用。
- 所有 AI 请求均从前端 `src/api/client.ts` 进入 Vercel `api/*`，再由服务端调用对应服务商；前端不持有 AI 密钥。
- `openai` npm 包既用于 OpenAI 官方接口，也作为部分 DeepSeek OpenAI-compatible 接口的协议客户端；是否调用 OpenAI 以本表的具体路径为准。
- 当前没有跨服务商自动兜底；本地解析或静态文案兜底不属于第二 AI 服务商。
- 第三方 AI 数据发送现要求当前版本的账号级明示同意：前端统一门控，服务端再次读取 `user_account_state` 核验；拒绝/撤回/旧版本同意均不得调用服务商。

## 2. AI 调用矩阵

| 功能 | API / 服务端实现 | 服务商与默认模型 | 发送给服务商的主要数据 | 失败处理 |
| --- | --- | --- | --- | --- |
| AI 批注与建议 | `/api/annotation` → `src/server/annotation-handler.ts` | DeepSeek `deepseek-flash`，中/英/意一致 | 用户事件文本、当天活动摘要、近期情绪/批注、待办摘要、所选 AI 人格；启用长期画像时包含画像摘要 | 返回本地默认批注或不展示无效建议 |
| 会员输入分类 | `/api/classify` | DeepSeek `deepseek-flash` | 当前输入文本、语言、可选习惯/目标候选 | API 返回结构化错误；前端保留本地分类路径 |
| 待办拆解 | `/api/todo-decompose` → `/api/classify` 拆解分支 | DeepSeek `deepseek-flash`，中/英/意一致 | 待办标题、语言；批注建议的预拆解也复用此服务 | 返回结构化错误，不跨服务商切换 |
| 完整日记 | `/api/diary` (`mode=full`) | DeepSeek `deepseek-v4-pro` | 当日日报结构、历史上下文、语言、AI 人格 | 不完整时重试一次；仍失败则不持久化草稿 |
| 报告短洞察 | `/api/diary` (`action=insight`) | DeepSeek `deepseek-flash` | 报告卡片所需的简短上下文、语言 | 失败返回空 insight，不保存不完整结果 |
| 用户画像提取 | `/api/extract-profile` | DeepSeek `deepseek-flash` | 最近消息摘要、语言 | 跳过更新或返回错误 |
| 魔法笔解析 | `/api/magic-pen-parse` | DeepSeek `deepseek-flash` | 完整原文、语言、本地日期时间和时区偏移 | 保留完整原文到 `unparsed`，前端运行本地保守解析 |
| 植物观察日记（卡片短文案） | `/api/plant-generate` → `src/server/plant-diary-service.ts` | DeepSeek `deepseek-flash` | 当天统计、候选植物信息、语言、AI 人格 | 使用既有本地化静态观察文案 |

`/api/diary` 的 Free teaser 模式使用本地确定性模板，不调用 AI。

### 请求参数与 Token 预算

默认请求为 `POST {DEEPSEEK_BASE_URL}/chat/completions`，使用 Bearer 服务端密钥；共有 `model`、`messages`、`max_tokens`、`temperature` 和 `thinking: { type: 'disabled' }`。所有路径非流式（原生 fetch 显式 `stream:false`，SDK 路径省略 stream 即非流式），不启用工具调用。SDK 使用 OpenAI 兼容协议并不代表把数据发送给 OpenAI。

| 功能/分支 | 单次输出上限 `max_tokens` | `temperature` | 输出格式及额外约束 |
| --- | ---: | ---: | --- |
| 普通批注 | 256 | 1.1 | 文本；沿用既有解析与长度规则 |
| 建议批注 | 512 | 0.7 | `response_format: { type: 'json_object' }` |
| 批注相似度重写 | 256 | 1.2 | 仍为 Flash、关闭 thinking |
| 输入分类 | 384 | 0.2 | prompt 约束 JSON |
| 待办拆解（含建议预拆解） | 768 | 0.5 | `response_format: { type: 'json_object' }` |
| 完整日记 | 1600 | 1.0 | 2–4 段软目标；截断/结尾不完整重试一次，第二次仍为 1600；不按字数硬切正文 |
| 报告短洞察 | 128 | 0.6 | 中文最多 20 字；英/意最多 8 个完整单词 |
| 用户画像 | 4096 | 0.2 | `response_format: { type: 'json_object' }` |
| 魔法笔 | 4096 | 0.2 | `response_format: { type: 'json_object' }`；默认 12 秒请求超时（可由 MAGIC_PEN_TIMEOUT_MS 调整） |
| 植物观察短文案 | 256 | 1.0 | prompt 约束 JSON；中文最多 40 字，英/意最多 22 词且 140 字符；6 秒 + 4 秒两次尝试 |

这些数值是应用输出预算，不是模型上下文窗口，也不是输入截断上限。现有输入规则保留：日记 rawInput 最多 800 字符（structuredData/historyContext 未加统一 Token 计数截断）；画像先保留最近 120 条有效消息，prompt 摘要最多 80 条、每条内容 120 字符；魔法笔保留完整原文。仓库未新增统一输入 Token 配额。

2026-10-21 核对[官方模型表](https://api-docs.deepseek.com/quick_start/pricing/)：Flash 与 Pro 均列出 1M 上下文、最高 384K 输出；应用仍采用上表较小预算。官方默认启用 thinking，故代码必须按[Chat Completions 文档](https://api-docs.deepseek.com/api/create-chat-completion/)显式发送 `thinking.type=disabled`。模型别名/平台容量以后可能变化，以官方页面为准。

2026-10-28 参数调优：上表是结合各功能输出结构提出并经用户确认的首轮 DeepSeek 预算，不是官网逐功能指定的最佳值。保留所有原提示词与长度校验，不迁移环境变量。OpenAI/Gemini 回切分支仍保留原温度与输出预算；DeepSeek 路径在两种路由模式中均采用新预算。魔法笔仍受 12 秒超时约束；本地请求契约测试不能替代真实服务延迟和生成质量验证。

## 3. 服务端配置

| 环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `AI_PROVIDER_MODE` | 全局供应商路由；仅 `legacy` 启用旧分工，其余/未设置均为 DeepSeek | `deepseek` |
| `DEEPSEEK_PRO_MODEL` | 完整日记模型 | `deepseek-v4-pro` |
| `DEEPSEEK_FLASH_MODEL` | 除完整日记外的全部 AI 模型 | `deepseek-flash` |
| `DEEPSEEK_API_KEY` | DeepSeek 服务端密钥 | 无，相关生产路径必填 |
| `DEEPSEEK_BASE_URL` | DeepSeek OpenAI-compatible base URL | `https://api.deepseek.com/v1` |
| `OPENAI_API_KEY` | 旧 OpenAI 路径服务端密钥 | 无，仅 legacy 模式相关路径必填 |
| `OPENAI_BASE_URL` | OpenAI base URL（可选覆盖） | OpenAI SDK 默认值 |
| `GEMINI_API_KEY` | 旧 Gemini 路径服务端密钥 | 无，仅 legacy 英/意待办拆解必填 |
| `GEMINI_BASE_URL` | Gemini native API base URL | `https://generativelanguage.googleapis.com/v1beta` |

仅 legacy 模式生效的模型覆盖（默认 DeepSeek 模式忽略旧变量，防止残留部署配置选错模型）：

- `CLASSIFY_MODEL`：默认 `deepseek-flash`
- `TODO_DECOMPOSE_MODEL_ZH`：默认 `deepseek-flash`
- `TODO_DECOMPOSE_MODEL`：默认 `gemini-2.5-flash`
- `PROFILE_EXTRACT_MODEL`：默认 `gpt-4o-mini`
- `MAGIC_PEN_MODEL`：默认 `deepseek-flash`

功能级服务地址/密钥覆盖保留：

- `TODO_DECOMPOSE_GEMINI_BASE_URL`（legacy）
- `TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL`（legacy；仅 Gemini model 404 时使用，不跨供应商）
- `ANNOTATION_DEEPSEEK_BASE_URL`
- `MAGIC_PEN_DEEPSEEK_API_KEY`
- `MAGIC_PEN_DEEPSEEK_BASE_URL`

路由入口为 `src/server/ai-routing.ts`，DeepSeek 密钥/base URL 解析位于 `src/server/deepseek-runtime.ts`。默认只需有效的 DeepSeek 密钥；OpenAI 客户端按请求创建，因此未配置 OpenAI 密钥不会阻塞日记模块加载。自定义 DeepSeek base URL/key 仍有优先级，部署时需确认它们指向预期 DeepSeek 服务。

### 无代码回切

1. 默认部署使用 `.env.example` 的 `AI_PROVIDER_MODE=deepseek`、Pro/Flash 两个模型变量与有效的 `DEEPSEEK_API_KEY`。
2. 回切时设置 `AI_PROVIDER_MODE=legacy`，配置/保留有效的 `OPENAI_API_KEY`、`GEMINI_API_KEY` 和 `DEEPSEEK_API_KEY`，重新部署服务端。
3. legacy 恢复：批注中=DeepSeek、英/意=OpenAI `gpt-4.1-mini`；拆解中=DeepSeek、英/意=Gemini `gemini-2.5-flash`；完整日记=`gpt-4o`；短洞察/画像=`gpt-4o-mini`；植物=`gpt-4.1-mini`；分类/魔法笔仍=DeepSeek。保留 OpenAI `store:false` 和 Gemini `thinkingBudget:0`，不向它们发送 DeepSeek 专属 thinking 参数。DeepSeek 旧路径默认也更新为 Flash，不恢复旧的 `deepseek-chat` 默认名。
4. 再设为 `deepseek` 并重新部署即可全部转回 DeepSeek；修改模型名称也只需改对应 Pro/Flash 环境变量。不存在失败后自动调用 OpenAI/Gemini 的机制。

本次只修改仓库代码与技术文档，已合并远端 UI 提交至 `9a55ec3`；未变更线上环境变量、未提交、未推送、未部署。现有多供应商同意/隐私文案保留以覆盖 legacy 路径；没有新增未经核实的数据留存承诺。若调整用户可见披露，仍须先确认文案存储与人工翻译来源。

## 4. 数据留存与日志边界

- 2026-07-31 控制台证据确认：OpenAI 组织的 model feedback、evaluation/fine-tuning、inputs/outputs 三类主动分享均关闭；API call logging 为 `Enabled per call`，账号未显示 ZDR/MAM 配置。所有 Seeday OpenAI Chat Completions 与 Responses 请求现均显式发送 `store: false`，避免创建供应商侧应用状态；这不影响 OpenAI 默认最多 30 天的 abuse-monitoring 日志边界。
- 2026-07-31 控制台证据确认：Seeday 使用的 Gemini `Tshine` 项目为 Tier 1 Postpay；`GenerateContent API` 存储关闭，仓库仅使用该 API 且未按请求启用存储。`Interactions API` 存储仍开启、保留期 55 天，但当前 Seeday 代码不调用该 API；控制台当前显示 0 条日志，截图未单独展开数据集清单。
- 2026-07-31 控制台证据确认：Supabase 生产项目位于 Free 组织，无 scheduled backups、PITR 或 Log Drains；Free 套餐自身日志保留按官方套餐边界为 1 天。此结论只覆盖客户可见的 Supabase 平台能力，不推定供应商内部灾备处理。
- DeepSeek 仍没有固定留存期限、训练开关或 DPA 的账号级证据；App Store 材料中不得写“零留存”“仅会话期间保存”或“绝不训练”，需以 DeepSeek Open Platform 的书面回复或合同条款为准。
- Vercel 函数日志与 AI 服务商侧留存是两件不同的事，真实期限应在独立的数据留存文档中分别记录。
- `ANNOTATION_VERBOSE_LOGS=true` 会记录事件上下文、完整 prompt、原始模型输出和最终响应，可能包含用户日记信息；生产环境应保持关闭。
- `ANNOTATION_PROMPT_DEBUG` 和 `MAGIC_PEN_DEBUG` 只应用于受控调试，不能作为生产常开设置。
- App 内三语隐私政策已于 2026-07-31 按上述控制台证据更新：披露 OpenAI `store:false` 与共享关闭、Gemini GenerateContent storage 关闭/未使用 Interactions、Supabase Free 能力边界，并保留 DeepSeek 未获书面证据的限定口径。

## 5. 明示同意与撤回边界

- 当前同意版本为 `2026-07-31.v1`；账号状态记录 `ai_consent_status`、版本、同意/更新时间及撤回时间。版本不匹配时必须重新同意。
- `AIConsentGate` 提供未预选的独立勾选框、明确启用按钮和“拒绝并继续非 AI 功能”按钮；不同意不是注册、登录或基础功能的前置条件。
- `src/api/client.ts` 在所有纯 AI 调用前统一检查；`src/server/ai-consent.ts` 在 Vercel 端再次查库核验，防止旧客户端或直接请求绕过。
- `/api/plant-generate` 同时包含确定性植物计算和可选 AI 文案，未同意时继续生成植物但只使用本地化静态文案，不向任何 AI 服务商发送数据。
- 设置页 `AI 数据与同意` 可撤回；撤回会关闭 AI 伴侣并阻止新的第三方 AI 请求。历史服务商安全/滥用监测记录仍按各自期限处理。
- 上线依赖：生产 Supabase 必须先执行最新 `scripts/user_account_state_schema.sql`，再部署服务端与 iOS 新包；查不到 consent 字段时 AI 校验按失败关闭处理。

## 6. 变更规则

任何 AI 服务商、模型、base URL、发送数据范围或日志策略变更，必须同步更新：

1. 本文；
2. `.env.example`；
3. `api/README.md` 与 `src/api/README.md` 的相关端点契约；
4. `docs/CURRENT_TASK.md` 与 `docs/CHANGELOG.md`；
5. App 隐私政策与 App Store Connect 材料（涉及用户可见三语文案时，先按 `AGENTS.md` 完成文案来源确认）。
