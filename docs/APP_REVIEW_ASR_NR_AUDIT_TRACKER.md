# DOC-DEPS: CLAUDE.md -> docs/CURRENT_TASK.md -> docs/SEEDAY_DEV_SPEC.md

# App Review ASR/NR 审核追踪表（Seeday）

- 创建时间：2026-05-01
- 审核范围：仅审核 Apple Guidelines 中标注 `ASR & NR` 的条款（Notarization Review 相关）
- 审核方法：仅基于当前仓库实际代码逐条记录「条款编号 / 要求 / 项目现状 / 是否符合 / 风险与调整建议 / 证据路径」
- 状态标记：`符合` | `部分符合` | `不符合` | `不适用` | `待审`

## 进度看板

- ASR/NR 条款总数（本轮清单）：52
- 已完成审核：26
- 待审核：30
- 当前结论：高风险项已从“删除账号主链路/Apple 登录占位 URI”收敛到“隐藏功能与提审完整性”，主要集中在 `2.1(a)`、`2.3.1(a)`、`2.5.1`、`5.1.1(i)` 与 `PrivacyInfo.xcprivacy` 缺失

## 已审核条目（代码审计 Round 1）

| 条款 | 要求 | 项目现状 | 结论 | 风险/需调整 | 证据 |
|---|---|---|---|---|---|
| 1.5 | App 与 Support URL 需提供可联系开发者方式 | App 内 About 与隐私面板提供 `hello@seedayapp.com`（可点 `mailto:`） | 部分符合 | 仍需确认 App Store Connect 的 Support URL 已配置且有效 | `src/features/profile/components/AboutPanel.tsx`, `src/features/profile/components/PrivacyPolicyPanel.tsx` |
| 1.6 | 需采取合理数据安全措施 | 架构要求密钥仅在 `api/*.ts` 使用、前端不直连密钥；有文档红线 | 部分符合 | 需补充“传输/存储加密、权限最小化、审计日志”可验证证据 | `CLAUDE.md`, `docs/PROJECT_MAP.md` |
| 2.1(a) | 提审包需完整、可用、无占位内容；登录 app 需 demo 账号/完整 demo 模式 | Apple 登录占位 URI 已移除，原生回调由环境变量/合法 fallback 生成；但仓库内无法证明 ASC 侧 demo 账号与审核备注已填写 | 部分符合 | 中高风险：提审前需补齐 demo 账号、审核备注、功能可达性清单 | `src/store/authStoreAccountActions.ts:77`, `src/store/authStoreRuntimeHelpers.ts:41` |
| 2.3 | 元数据需准确反映核心体验 | 代码含通知、订阅、删除账号、AI 处理等能力；仓库未见 metadata 与代码的一致性校验 | 部分符合 | 高风险：提审前需人工逐项对照 App Store Connect（描述/截图/隐私标签） | `src/services/notifications/localNotificationService.ts`, `src/features/profile/components/DeleteAccountModal.tsx`, `src/api/client.ts` |
| 2.3.1(a) | 禁止隐藏/休眠/未文档化功能；Review Notes 需具体描述新功能 | 已移除 `forceOnboarding` 覆盖入口；onboarding 路由恢复为仅真实新用户可达 | 部分符合 | 中风险：仍需确保提审 Notes 覆盖所有新功能，并继续排查其他潜在隐藏开关 | `src/App.tsx:83` |
| 2.4.4 | 不得建议用户重启设备或改无关系统设置 | 暂未发现相关文案或流程 | 符合 | 继续在新功能文案 review 中保持检查 | 代码检索（本轮） |
| 2.5.1 | 仅使用 public API；运行在当前 OS；避免过时框架 | 依赖为 Capacitor 7 + StoreKit2 + Supabase，未见私有 API 调用；但 iOS 原生层在 16.4+ 无条件开启 `isInspectable` | 部分符合 | 高风险：生产构建应关闭 `isInspectable`，仅 DEV/TestFlight 内测开启；并保留私有 API 扫描记录 | `package.json:27`, `ios/App/App/AppDelegate.swift:64` |
| 2.5.2 | App 自包含；不得动态下载并执行改变功能的代码 | 在 `src/**` 代码中未发现 `eval(` 或 `new Function(` 动态执行路径 | 符合 | 建议补 CI 扫描防回归 | 代码检索（`src/**/*.ts*`） |
| 2.5.14 | 录音/录屏/摄像等需显式同意并有清晰提示 | 通知权限已通过 `checkPermissions/requestPermissions` 显式请求；本轮未发现录音/录屏代码路径 | 部分符合 | 若后续启用相机/麦克风入口，需补充权限提示与 consent 流程 | `src/services/notifications/localNotificationService.ts` |
| 4.8 | 若使用第三方登录，需提供等价登录选项（典型为 Sign in with Apple 规范） | 已同时提供 Apple + Google + 邮箱登录 | 符合 | 需在 iOS 实机验证 Apple 登录全链路 | `src/features/auth/AuthPage.tsx`, `src/store/authStoreAccountActions.ts` |
| 5.1.1(i) | 隐私政策需在 App Store Connect 与 App 内可访问，且内容完整 | App 内已提供隐私政策面板，删除口径已改为立即删除；已新增 iOS `PrivacyInfo.xcprivacy` 基础清单 | 部分符合 | 仍需确认“公网隐私政策 URL + ASC 字段”已上线，并继续核对清单条目与 SDK 实际访问 API 一致 | `src/features/profile/components/PrivacyPolicyPanel.tsx`, `src/i18n/locales/en.ts:1293`, `ios/App/App/PrivacyInfo.xcprivacy` |
| 5.1.1(v) | 支持账号创建则必须支持 App 内账号删除 | 设置页可直达删除弹窗，用户确认后直接调用 `/api/delete-account`；服务端删除用户业务数据并删除 auth 用户 | 符合 | 低风险：补充失败态监控与手测脚本（弱网/重复点击/会话失效） | `src/features/profile/components/DeleteAccountModal.tsx:26`, `src/api/client.ts:740`, `api/delete-account.ts:45` |
| 2.4.2 | 不得导致设备过热/过度耗电/无关后台进程 | 未见加密挖矿、无关常驻后台任务；前台轮询与本地通知属于核心功能链路 | 部分符合 | 中风险：补一轮 iOS 能耗实测（Xcode Instruments）并形成提审附件 | `src/App.tsx:292`, `src/services/notifications/localNotificationService.ts:293` |
| 2.5.3 | 禁止传输可破坏系统/硬件正常工作的代码 | 未发现病毒传播、破坏系统能力、Push/GameCenter 滥用代码路径 | 符合 | 持续保持依赖审计与 SCA 扫描 | 代码检索（本轮） |
| 2.5.4 | 后台能力必须用于声明用途 | 当前仅使用本地通知、前后台刷新、重试同步，无越权后台模式实现 | 部分符合 | 需对 iOS Capability 配置做发布前复核（Background Modes 勾选项） | `src/hooks/useAppForegroundRefresh.ts`, `src/services/notifications/localNotificationService.ts` |
| 2.5.6 | 浏览网页必须使用 WebKit 框架 | App 基于 Capacitor（WKWebView）承载，符合 WebKit 要求 | 符合 | 保持 Capacitor 主版本更新与回归 | `package.json:30`, `ios/App/App/capacitor.config.json` |
| 2.5.9 | 不得篡改系统标准开关/UI 行为 | 未发现修改系统音量/静音开关、劫持系统行为代码路径 | 符合 | 继续禁止新增此类能力 | 代码检索（本轮） |
| 2.5.11 | SiriKit/Shortcuts 仅可注册可处理意图 | 仓库未接入 SiriKit/Shortcuts | 不适用 | 若后续接入需新增意图清单审计 | 代码检索（本轮） |
| 2.5.12 | CallKit/SMS 拦截仅用于已确认垃圾号码 | 仓库未接入 CallKit/SMS/MMS 拦截能力 | 不适用 | 若后续接入需补充拦截规则透明说明 | 代码检索（本轮） |
| 2.5.13 | 人脸识别登录应优先 LocalAuthentication 并提供替代方式 | 仓库未接入本地生物识别登录 | 不适用 | 若后续接入需补齐 <13 岁替代鉴权 | 代码检索（本轮） |
| 2.5.16 | Widgets/Extensions/Notifications 应与主功能相关 | 当前使用本地通知仅用于记录/日报/提醒主链路 | 符合 | 保持通知文案与业务一致 | `src/services/notifications/localNotificationService.ts:79`, `src/services/notifications/localNotificationService.ts:293` |
| 2.5.17 | Matter 支持需使用 Apple 框架与认证组件 | 仓库未接入 Matter | 不适用 | 若后续接入需单列认证检查 | 代码检索（本轮） |
| 2.5.18 | 广告展示范围与方式需合规 | 未接入广告 SDK，未见插屏/行为定向广告路径 | 符合 | 若接入广告需先补年龄分级与可关闭机制 | `package.json`, 代码检索（本轮） |

## 代码层新增风险（Round 1）

| 风险ID | 描述 | 严重度 | 建议 |
|---|---|---|---|
| R-ASR-001 | Apple 登录原生路径使用占位 `redirectURI` | 高 | 改为真实 URI，并在 iOS 真机验证登录/回跳 |
| R-ASR-002 | 删除账号 UI 流程未直接调用硬删除 API | 高 | 用户确认后直接调用 `callDeleteAccountAPI()`，明确成功/失败反馈 |
| R-ASR-003 | `checkAndHandlePendingDeletion` 在未到删除时间时清空 `pending_deletion_at`，语义冲突 | 高 | 修正条件分支并补单测覆盖“未到期/到期”路径 |
| R-ASR-004 | `forceOnboarding=1` 在非 DEV 环境可触发强制引导 | 已修复 | 已移除该覆盖逻辑（不再支持 query/env 强制 onboarding） |
| R-ASR-005 | iOS 原生层无条件开启 `webView.isInspectable` | 高 | 仅 `#if DEBUG` 或运行时 DEV 标记开启，发布包默认关闭 |
| R-ASR-006 | 未检索到 `PrivacyInfo.xcprivacy` | 已修复 | 已新增 `ios/App/App/PrivacyInfo.xcprivacy` 并加入 iOS Target Resources，后续持续对齐访问 API 分类与 reason code |
| R-ASR-007 | 生产路径存在未受 DEV 保护的 `console.log` | 修复中 | 已完成前端主链路日志收口（auth/report/annotation/stardust/sync/parser），剩余 server 侧日志按服务端观测策略保留 |

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
| 2.4.2 | 已审 | Round 1.2 |
| 2.4.4 | 已审 | Round 1 |
| 2.5.1 | 已审 | Round 1 |
| 2.5.2 | 已审 | Round 1 |
| 2.5.3 | 已审 | Round 1.2 |
| 2.5.4 | 已审 | Round 1.2 |
| 2.5.6 | 已审 | Round 1.2 |
| 2.5.9 | 已审 | Round 1.2 |
| 2.5.11 | 已审 | Round 1.2 |
| 2.5.12 | 已审 | Round 1.2 |
| 2.5.13 | 已审 | Round 1.2 |
| 2.5.14 | 已审 | Round 1 |
| 2.5.16 | 已审 | Round 1.2 |
| 2.5.17 | 已审 | Round 1.2 |
| 2.5.18 | 已审 | Round 1.2 |
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
- 2026-05-01 Round 1.2：补审 `2.4.2`、`2.5.3/2.5.4/2.5.6/2.5.9/2.5.11/2.5.12/2.5.13/2.5.16/2.5.17/2.5.18`；同步确认 Apple 登录占位 URI 与删除账号主链路已修复，新增 4 个风险项（隐藏开关、isInspectable、隐私清单缺失、生产 console 日志）。
- 2026-05-01 Round 1.3：按产品决策移除 `forceOnboarding` 覆盖逻辑，`R-ASR-004` 标记为已修复。
- 2026-05-01 Round 1.4：统一删除账号文案为“立即删除”，并新增 `PrivacyInfo.xcprivacy`（已加入 iOS target resources），`R-ASR-006` 标记为已修复。
- 2026-05-01 Round 1.5：按产品决策保留 `isInspectable` 现状，先清理前端可见 `console.log`（统一 DEV 保护）；`R-ASR-007` 更新为修复中。
