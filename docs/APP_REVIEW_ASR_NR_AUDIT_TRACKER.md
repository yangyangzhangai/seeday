# DOC-DEPS: CLAUDE.md -> docs/CURRENT_TASK.md -> docs/SEEDAY_DEV_SPEC.md

# App Review ASR/NR 审核追踪表（Seeday）

- 创建时间：2026-05-01
- 审核范围：仅审核 Apple Guidelines 中标注 `ASR & NR` 的条款（Notarization Review 相关）
- 审核方法：仅基于当前仓库实际代码逐条记录「条款编号 / 要求 / 项目现状 / 是否符合 / 风险与调整建议 / 证据路径」
- 状态标记：`符合` | `部分符合` | `不符合` | `不适用` | `待审`

## 进度看板

- ASR/NR 条款总数（本轮清单）：52
- 已完成审核：16
- 待审核：40
- 当前结论：存在中高风险项，主要集中在 `2.1(a)`、`2.3.*`、`5.1.1(i)`、`5.1.1(v)` 与删除账号执行逻辑

## 已审核条目（代码审计 Round 1）

| 条款 | 要求 | 项目现状 | 结论 | 风险/需调整 | 证据 |
|---|---|---|---|---|---|
| 1.5 | App 与 Support URL 需提供可联系开发者方式 | App 内 About 与隐私面板提供 `hello@seedayapp.com`（可点 `mailto:`） | 部分符合 | 仍需确认 App Store Connect 的 Support URL 已配置且有效 | `src/features/profile/components/AboutPanel.tsx`, `src/features/profile/components/PrivacyPolicyPanel.tsx` |
| 1.6 | 需采取合理数据安全措施 | 架构要求密钥仅在 `api/*.ts` 使用、前端不直连密钥；有文档红线 | 部分符合 | 需补充“传输/存储加密、权限最小化、审计日志”可验证证据 | `CLAUDE.md`, `docs/PROJECT_MAP.md` |
| 2.1(a) | 提审包需完整、可用、无占位内容；登录 app 需 demo 账号/完整 demo 模式 | 登录功能完整，但 Apple 原生登录包含 `redirectURI: 'https://placeholder.seeday.app'` 占位值 | 不符合 | 高风险：占位 URI 可能导致审核环境登录异常；需替换为真实回调并回归验证 | `src/store/authStoreAccountActions.ts:80` |
| 2.3 | 元数据需准确反映核心体验 | 代码含通知、订阅、删除账号、AI 处理等能力；仓库未见 metadata 与代码的一致性校验 | 部分符合 | 高风险：提审前需人工逐项对照 App Store Connect（描述/截图/隐私标签） | `src/services/notifications/localNotificationService.ts`, `src/features/profile/components/DeleteAccountModal.tsx`, `src/api/client.ts` |
| 2.3.1(a) | 禁止隐藏/休眠/未文档化功能；Review Notes 需具体描述新功能 | 项目规范明确禁止隐藏功能 | 部分符合 | 需确认生产构建无残留“调试开关”，并形成提审 Notes 模板 | `docs/SEEDAY_DEV_SPEC.md:245` |
| 2.4.4 | 不得建议用户重启设备或改无关系统设置 | 暂未发现相关文案或流程 | 符合 | 继续在新功能文案 review 中保持检查 | 代码检索（本轮） |
| 2.5.1 | 仅使用 public API；运行在当前 OS；避免过时框架 | 实际代码使用 Capacitor/Supabase 公共接口，未见私有 API 调用代码 | 部分符合 | 仍需对 iOS 构建产物做私有 API 扫描留档 | `src/store/authStoreAccountActions.ts`, `src/services/notifications/localNotificationService.ts` |
| 2.5.2 | App 自包含；不得动态下载并执行改变功能的代码 | 在 `src/**` 代码中未发现 `eval(` 或 `new Function(` 动态执行路径 | 符合 | 建议补 CI 扫描防回归 | 代码检索（`src/**/*.ts*`） |
| 2.5.14 | 录音/录屏/摄像等需显式同意并有清晰提示 | 通知权限已通过 `checkPermissions/requestPermissions` 显式请求；本轮未发现录音/录屏代码路径 | 部分符合 | 若后续启用相机/麦克风入口，需补充权限提示与 consent 流程 | `src/services/notifications/localNotificationService.ts` |
| 4.8 | 若使用第三方登录，需提供等价登录选项（典型为 Sign in with Apple 规范） | 已同时提供 Apple + Google + 邮箱登录 | 符合 | 需在 iOS 实机验证 Apple 登录全链路 | `src/features/auth/AuthPage.tsx`, `src/store/authStoreAccountActions.ts` |
| 5.1.1(i) | 隐私政策需在 App Store Connect 与 App 内可访问，且内容完整 | App 内已提供隐私政策面板，含数据用途/第三方/删除方式/联系方式 | 部分符合 | 高风险：尚未确认“公网隐私政策 URL + ASC 字段”已上线 | `src/features/profile/components/PrivacyPolicyPanel.tsx`, `src/i18n/locales/en.ts:1255` |
| 5.1.1(v) | 支持账号创建则必须支持 App 内账号删除 | 设置页有删除入口，但前端主流程只写 `pending_deletion_at`；真正硬删除在 `/api/delete-account`，且 pending 检查逻辑存在疑似反向条件 | 部分符合 | 中高风险：需把删除入口直接串到硬删除 API；修复 pending 逻辑并补测试 | `src/features/profile/components/DeleteAccountModal.tsx`, `src/store/useAuthStore.ts:70`, `api/delete-account.ts`, `src/api/client.ts:740` |

## 代码层新增风险（Round 1）

| 风险ID | 描述 | 严重度 | 建议 |
|---|---|---|---|
| R-ASR-001 | Apple 登录原生路径使用占位 `redirectURI` | 高 | 改为真实 URI，并在 iOS 真机验证登录/回跳 |
| R-ASR-002 | 删除账号 UI 流程未直接调用硬删除 API | 高 | 用户确认后直接调用 `callDeleteAccountAPI()`，明确成功/失败反馈 |
| R-ASR-003 | `checkAndHandlePendingDeletion` 在未到删除时间时清空 `pending_deletion_at`，语义冲突 | 高 | 修正条件分支并补单测覆盖“未到期/到期”路径 |

## ASR/NR 全量条款清单（待持续打勾）

> 说明：以下仅列 `ASR & NR` 标签条款。每完成一条，在“状态”列更新并补充证据。

| 条款 | 状态 | 备注 |
|---|---|---|
| 1.1.6 | 待审 | |
| 1.2.1(a) | 待审 | |
| 1.4 | 待审 | |
| 1.4.1 | 待审 | |
| 1.4.2 | 待审 | |
| 1.4.4 | 待审 | |
| 1.4.5 | 待审 | |
| 1.5 | 已审 | Round 1 |
| 1.6 | 已审 | Round 1 |
| 2.1(a) | 已审 | Round 1 |
| 2.3 | 已审 | Round 1 |
| 2.3.1(a) | 已审 | Round 1 |
| 2.3.5 | 待审 | |
| 2.3.6 | 待审 | |
| 2.3.7 | 待审 | |
| 2.3.8 | 待审 | |
| 2.4.2 | 待审 | |
| 2.4.4 | 已审 | Round 1 |
| 2.5.1 | 已审 | Round 1 |
| 2.5.2 | 已审 | Round 1 |
| 2.5.3 | 待审 | |
| 2.5.4 | 待审 | |
| 2.5.6 | 待审 | |
| 2.5.9 | 待审 | |
| 2.5.11 | 待审 | |
| 2.5.12 | 待审 | |
| 2.5.13 | 待审 | |
| 2.5.14 | 已审 | Round 1 |
| 2.5.16 | 待审 | |
| 2.5.17 | 待审 | |
| 2.5.18 | 待审 | |
| 4.1(b) | 待审 | |
| 4.3(a) | 待审 | |
| 4.4 | 待审 | |
| 4.4.1 | 待审 | |
| 4.4.2 | 待审 | |
| 4.5 | 待审 | |
| 4.5.1 | 待审 | |
| 4.5.2 | 待审 | |
| 4.5.3 | 待审 | |
| 4.5.4 | 待审 | |
| 4.5.5 | 待审 | |
| 4.5.6 | 待审 | |
| 4.7.2 | 待审 | |
| 4.7.3 | 待审 | |
| 4.7.5 | 待审 | |
| 4.8 | 已审 | Round 1 |
| 4.9 | 待审 | |
| 4.10 | 待审 | |
| 5.1 | 待审 | |
| 5.1.1 | 待审 | |
| 5.1.1(i) | 已审 | Round 1 |
| 5.1.1(ii) | 待审 | |
| 5.1.1(v) | 已审 | Round 1 |
| 5.1.2 | 待审 | |
| 5.1.3 | 待审 | |
| 5.1.4(a) | 待审 | |
| 5.1.5 | 待审 | |
| 5.2.4(a) | 待审 | |
| 5.2.5 | 待审 | |
| 5.4 | 待审 | |
| 5.5 | 待审 | |
| 5.6 | 待审 | |
| 5.6.2 | 待审 | |

## 审核日志

- 2026-05-01 Round 1：已建立追踪文档并完成 12 条初审（偏文档视角）。
- 2026-05-01 Round 1.1：改为代码审计口径，完成 16 条代码核查，新增 3 个高风险实现项（Apple 登录占位 URI、删除账号主链路、pending 删除逻辑）。
