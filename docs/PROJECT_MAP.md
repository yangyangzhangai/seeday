# Seeday 全局地图（唯一版本）

- 版本：v2.4
- 更新：2026-07-16
- 说明：本文件是当前仓库目录、架构边界与文档职责的唯一地图来源，只描述 as-is。
- 权威顺序：`LLM.md / AGENTS.md` > `docs/CURRENT_TASK.md` > 本文件 > 模块 README / DOC-DEPS > `docs/CHANGELOG.md`。

## 1. 仓库顶层

```text
/
├── api/                # Vercel Serverless Functions
├── docs/               # 规范、审计、交接和变更记录
├── public/             # 静态资源
├── scripts/            # 工程校验、数据和 benchmark
├── src/                # React 前端、业务服务、Store、共享 server 代码
├── AGENTS.md            # Codex 会话入口，和 LLM.md 同步
├── LLM.md               # AI/LLM 主入口与仓库硬约束
├── README.md
├── PROJECT_CONTEXT.md
├── FEATURE_STATUS.md
├── DEPLOY.md
└── CONTRIBUTING.md
```

## 2. 前端 src 分工

```text
src/
├── api/                # 前端 API client 与 Supabase client
├── components/         # 跨功能共享 UI
├── features/           # 页面和功能 UI
│   ├── auth/
│   ├── chat/
│   ├── growth/
│   ├── report/
│   ├── profile/
│   └── telemetry/
├── hooks/              # React hooks、同步和前台恢复
├── i18n/               # 国际化初始化与三语词条
├── lib/                # 纯函数与映射工具
├── server/             # serverless 共用 handler、prompt、provider
├── services/           # 输入分类、魔法笔、提醒、支付等业务逻辑
├── store/              # Zustand stores、actions、helpers
├── constants/
├── types/
├── App.tsx
└── main.tsx
```

## 3. Serverless 端点

- `api/report.ts`：报告生成。
- `api/annotation.ts`：AI 批注与建议。
- `api/classify.ts`：会员 AI 分类，并承载 todo decompose 兼容分支。
- `api/diary.ts`：AI 日记。
- `api/magic-pen-parse.ts`：魔法笔结构化解析。
- `api/plant-generate.ts`：植物生成。
- `api/plant-diary.ts`：植物日记。
- `api/plant-history.ts`：植物历史。
- `api/plant-asset-telemetry.ts`：植物资产遥测。
- `api/live-input-telemetry.ts`：实时输入与用户分析遥测。
- `api/subscription.ts`：订阅。

新增能力优先并入现有端点；Vercel Hobby 下默认不新增独立函数文件。

## 4. 共享 server 模块

- `src/server/http.ts`：CORS、method 和错误包装。
- `src/server/annotation-*.ts`：批注 handler、prompt、suggestion 和相似度。
- `src/server/country-resolver.ts`、`holiday-resolver.ts`：国家与节日上下文。
- `src/server/weather-*.ts`、`air-quality-provider.ts`：天气、空气质量和预警。
- `src/server/magic-pen-prompts.ts`：魔法笔 prompt。
- `src/server/todo-decompose-service.ts`：待办拆解共享服务。
- `src/server/plant-*.ts`：植物接口和日记共享逻辑。

## 5. 架构边界

1. `src/**` 不读取第三方 AI 密钥，不直连第三方 AI SDK。
2. 前端 AI 请求统一走 `src/api/client.ts -> api/*`。
3. 密钥只在服务端从 `process.env` 读取。
4. 页面入口只能位于 `src/features/*`。
5. UI 只调用 Store；Store 调用 services 或 API；services 保持纯 TypeScript。
6. 会员升级页为 `src/features/profile/UpgradePage.tsx`，route 为 `/upgrade`。

## 6. 模块入口

| 功能 | 代码入口 | 模块说明 |
|---|---|---|
| Chat / 记录 | `src/features/chat/` | `src/features/chat/README.md` |
| Growth / Todo | `src/features/growth/` | `src/features/growth/README.md` |
| Report / Diary | `src/features/report/` | `src/features/report/README.md` |
| Auth | `src/features/auth/` | `src/features/auth/README.md` |
| Profile / Membership | `src/features/profile/` | `src/features/profile/README.md` |
| 前端 API | `src/api/` | `src/api/README.md` |
| Store | `src/store/` | `src/store/README.md` |
| Serverless API | `api/` | `api/README.md` |
| 输入分类 | `src/services/input/` | 本文第 8 节 |
| 魔法笔 | `src/services/input/magicPenParser.ts` | `docs/MAGIC_PEN_CAPTURE_SPEC.md` |


### ??????????

- `src/features/telemetry`
- `src/i18n/`
## 7. 文档状态说明

- **当前规范**：新实现必须遵守；与历史材料冲突时优先。
- **现状审计**：说明代码今天如何运行，不代表未来愿景。
- **计划/PRD**：描述目标与阶段，需结合 CURRENT_TASK 判断是否已实施。
- **历史讨论**：仅用于理解决策过程，不能直接当实现口径。
- **数据/模板/生成物**：支撑测试、合规或交付，不是架构规范。

## 8. 活动、心情与魔法笔文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` | 当前规范 | 普通输入三分类、证据计分、上下文、写入和 80% 验收 |
| `docs/ACTIVITY_MOOD_CLASSIFICATION_CURRENT_STATE.md` | 现状审计 | 当前代码流程、英语 grammar/history 证据、剩余风险、免费可商用开源项目 |
| `docs/ACTIVITY_LEXICON.md` | 当前规范 | 中英意活动/心情/六分类词库 SSOT，以及英语 linguistic evidence |
| `docs/LEXICON_ARCHITECTURE.md` | 架构补充 | 词库目录和消费者关系 |
| `docs/MAGIC_PEN_CAPTURE_SPEC.md` | 当前规范，顶部 override 优先 | 魔法笔本地快速通道、AI 四类、draft review 和写入 |
| `docs/ACTIVITY_MOOD_AUTO_RECOGNITION_REFACTOR_PROPOSAL.md` | 历史讨论 | 早期重构备选；不能覆盖当前三分类规范 |
| `docs/benchmarks/PR0_BASELINE.md` | 评估基线 | 固定分类集和基准口径 |
| `docs/benchmarks/pr0-baseline.latest.json` | 生成物 | 最近一次 PR0 机器结果 |

## 9. AI、批注与用户画像文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `docs/AI_USAGE_INVENTORY.md` | 现状审计 | AI 调用清单 |
| `docs/AI_AUDIT_CLAUDE.md` | 审计材料 | 外部 AI 审计记录 |
| `docs/AI_USER_PROFILE_完整业务与技术说明.md` | 规范/说明 | AI 用户画像完整链路 |
| `docs/用户画像模块_需求与技术文档_v1.md` | PRD/技术 | 用户画像模块 |
| `docs/AI_SUGGESTION_OPTIMIZATION（用户画像）.md` | 计划 | 基于画像的建议优化 |
| `docs/AI批注回复_行为角色状态映射_开发落地方案_v1.md` | 实施方案 | 批注、行为与角色状态 |
| `docs/SEEDAY_AI活人感系统_天气与季节_实现方案.md` | 实施方案 | 天气和季节上下文 |
| `docs/SUPABASE_SUGGESTION_SQL.md` | 数据脚本说明 | suggestion 表结构 |
| `docs/SUPABASE_TODAY_CONTEXT_SQL.md` | 数据脚本说明 | today context 表结构 |
| `docs/timeshine_*.docx`、`.extracted.txt` | 外部规格/提取物 | 活人感、联想、角色互提等输入材料 |

## 10. 数据、同步与持久化文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `docs/LOCAL_FIRST_STORAGE_SPEC.md` | 当前规范 | local-first、outbox 和恢复原则 |
| `docs/DATA_STORAGE_AUDIT_REPORT.md` | 现状审计 | 数据存储风险 |
| `docs/SUPABASE_PERSISTENCE_AUDIT.md` | 现状审计 | Supabase 持久化审计 |
| `docs/SUPABASE_PERSISTENCE_INVENTORY.md` | 清单 | 表、字段和持久化入口 |
| `docs/MULTI_ACCOUNT_ISOLATION_E2E.md` | 测试规范 | 多账号隔离端到端验收 |
| `src/store/README.md` | 当前规范 | Store ownership、outbox、同步和 action 约定 |

## 11. Membership 文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `docs/MEMBERSHIP_SPEC.md` | 产品规范 | 会员能力 |
| `docs/MEMBERSHIP_PROJECT_STATUS.md` | 状态 | 会员实施进度 |
| `docs/MEMBERSHIP_AI_CLASSIFICATION_PRD.md` | PRD | 写入后的会员 AI 增强分类 |
| `docs/MEMBERSHIP_AI_CLASSIFICATION_TECH_DESIGN.md` | 技术设计 | `/api/classify`、缓存和消费方 |

会员 AI 分类发生在记录写入后，不负责普通输入三分类。

## 12. Report、Diary、Plant 与 Growth 文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `src/features/report/README.md` | 当前模块说明 | Report / Diary 入口和依赖 |
| `docs/DIARY_REBUILD_PLAN.md` | 计划 | 日记重构 |
| `docs/plant_prompt_template.md` | 当前模板 | 植物 prompt |
| `docs/plant_assets_registry.csv` | 数据清单 | 植物资产 |
| `docs/PLANT_P3_PERFORMANCE_SAMPLING_TEMPLATE.md` | QA 模板 | 植物性能采样 |
| `docs/TimeShine_植物生长_*.docx` | 外部规格 | 植物产品与技术输入 |
| `src/features/growth/README.md` | 当前模块说明 | Growth、Bottle、Todo |
| `docs/growth-page-tech-design.docx` | 外部技术稿 | Growth 页面设计 |

## 13. Onboarding、提醒与营销文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `docs/ONBOARDING_SPEC_v1.2.md` | 产品/实施规范 | Onboarding |
| `docs/PROACTIVE_REMINDER_SPEC.md` | 当前规范 | 主动提醒 |
| `docs/TEASER_DIARY_COPY_ZH.md` | 文案稿 | 日记 teaser 中文 |
| `docs/seeday_marketing_copy.md` | 文案稿 | 营销文案 |

## 14. iOS、合规与审核文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `docs/SEEDAY_DEV_SPEC.md` | 当前规范 | iOS 优先开发、分层和审核红线 |
| `docs/COMPLIANCE_AND_REVIEW_PLAN.md` | 计划 | 合规和审核 |
| `docs/IOS_REVIEW_ASR_NR_AUDIT_SPEC.md` | 审计规范 | ASR/NR 审核 |
| `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md` | 状态跟踪 | 审核问题进度 |
| `docs/ASC_SUBMISSION_CODE_BASED_FILL_TEMPLATE.md` | 提交模板 | App Store Connect 填写 |
| `docs/ios review.txt` | 审核材料 | iOS 审核记录 |
| `docs/合规/*` | 外部参考 | Apple 商标和版权规则 |

## 15. QA、遥测与变更文档

| 文档 | 状态 | 负责什么 |
|---|---|---|
| `docs/QA_TEST_PLAN.md` | QA 规范 | 总测试计划 |
| `docs/QA_TEST_CASES.csv` | 测试数据 | 手工/回归用例 |
| `docs/STARDUST_HOTZONE_TEST.md` | 专项测试 | 星尘热点 |
| `docs/Telemetry_Audit_Report_2026-04-29.doc` | 审计产物 | 遥测审计 |
| `docs/CURRENT_TASK.md` | 当前状态 | 新会话恢复锚点 |
| `docs/CHANGELOG.md` | 变更记录 | 已生效改动和验证 |
| `docs/ARCHITECTURE.md` | 现状架构 | 系统整体实现 |
| `FEATURE_STATUS.md` | 功能状态 | 功能是否可用 |

## 16. 文档维护规则

1. 新会话先读 `AGENTS.md`、`CURRENT_TASK.md`、本文件和 `SEEDAY_DEV_SPEC.md`。
2. 功能改动再读对应模块 README 和目标文件 `DOC-DEPS`。
3. 新关键文档要加入本地图，并标注状态。
4. 历史讨论稿必须在顶部写明已被哪份当前规范替代。
5. 代码、接口或 Store 行为改变时，按 `AGENTS.md` 的同步矩阵更新文档。
