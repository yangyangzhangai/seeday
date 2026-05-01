# DOC-DEPS: CLAUDE.md -> docs/CURRENT_TASK.md -> docs/SEEDAY_DEV_SPEC.md

# App Review ASR/NR 审核追踪表（Seeday）

- 创建时间：2026-05-01
- 审核范围：仅审核 Apple Guidelines 中标注 `ASR & NR` 的条款（Notarization Review 相关）
- 审核方法：仅基于当前仓库实际代码逐条记录「条款编号 / 要求 / 项目现状 / 是否符合 / 风险与调整建议 / 证据路径」
- 状态标记：`符合` | `部分符合` | `不符合` | `不适用` | `待审`

## 进度看板

- ASR/NR 条款总数（本轮清单）：52
- 已完成审核：52
- 待审核：0
- 当前结论：ASR/NR 条款已完成代码证据审计；代码层高风险聚焦为 `R-ASR-007`（生产日志收口未完成）与多项 ASC 提审侧人工对齐项（metadata/年龄分级/隐私标签）

## 已审核条目（代码审计 Round 1）

| 条款 | 要求 | 项目现状 | 结论 | 风险/需调整 | 证据 |
|---|---|---|---|---|---|
| 1.5 | App 与 Support URL 需提供可联系开发者方式 | App 内 About 与隐私面板提供 `hello@seedayapp.com`（可点 `mailto:`） | 部分符合 | 仍需确认 App Store Connect 的 Support URL 已配置且有效 | `src/features/profile/components/AboutPanel.tsx`, `src/features/profile/components/PrivacyPolicyPanel.tsx` |
| 1.6 | 需采取合理数据安全措施 | 架构要求密钥仅在 `api/*.ts` 使用、前端不直连密钥；有文档红线 | 部分符合 | 需补充“传输/存储加密、权限最小化、审计日志”可验证证据 | `CLAUDE.md`, `docs/PROJECT_MAP.md` |
| 2.1(a) | 提审包需完整、可用、无占位内容；登录 app 需 demo 账号/完整 demo 模式 | Apple 登录占位 URI 已移除，原生回调由环境变量/合法 fallback 生成；但仓库内无法证明 ASC 侧 demo 账号与审核备注已填写 | 部分符合 | 中高风险：提审前需补齐 demo 账号、审核备注、功能可达性清单 | `src/store/authStoreAccountActions.ts:77`, `src/store/authStoreRuntimeHelpers.ts:41` |
| 2.3 | 元数据需准确反映核心体验 | 代码含通知、订阅、删除账号、AI 处理等能力；仓库未见 metadata 与代码的一致性校验 | 部分符合 | 高风险：提审前需人工逐项对照 App Store Connect（描述/截图/隐私标签） | `src/services/notifications/localNotificationService.ts`, `src/features/profile/components/DeleteAccountModal.tsx`, `src/api/client.ts` |
| 2.3.1(a) | 禁止隐藏/休眠/未文档化功能；Review Notes 需具体描述新功能 | 已移除 `forceOnboarding` 覆盖入口；onboarding 路由恢复为仅真实新用户可达 | 部分符合 | 中风险：仍需确保提审 Notes 覆盖所有新功能，并继续排查其他潜在隐藏开关 | `src/App.tsx:83` |
| 2.4.4 | 不得建议用户重启设备或改无关系统设置 | 暂未发现相关文案或流程 | 符合 | 继续在新功能文案 review 中保持检查 | 代码检索（本轮） |
| 2.5.1 | 仅使用 public API；运行在当前 OS；避免过时框架 | 依赖为 Capacitor 7 + StoreKit2 + Supabase，未见私有 API 调用；iOS 原生层 `isInspectable` 已改为仅 DEBUG 构建开启 | 符合 | 低风险：持续保留私有 API 扫描记录与版本回归 | `package.json:27`, `ios/App/App/AppDelegate.swift:64` |
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
| 4.5.4 | Push 不得作为功能必需；营销推送需显式同意且可退订 | 提醒入口提供独立开关，主功能链路不依赖通知权限；权限请求由用户触发，拒绝权限仅停用提醒能力 | 部分符合 | 中风险：若后续引入远程 Push 营销内容，需补“营销同意 + App 内退订”独立开关与审计记录 | `src/features/profile/components/RoutineSettingsPanel.tsx:581`, `src/features/profile/components/RoutineSettingsPanel.tsx:591`, `src/services/notifications/localNotificationService.ts:56` |
| 5.1.2 | 数据使用/共享需与声明一致且用途受限 | 当前以 Supabase 鉴权 + 自有 serverless API 为主，未接入广告 SDK；隐私面板可在 App 内访问 | 部分符合 | 中风险：仓库无法直接证明 App Store Connect 隐私标签与第三方处理方披露完全一致，提审前需人工逐项比对 | `src/api/client.ts:171`, `api/README.md:8`, `src/features/profile/components/PrivacyPolicyPanel.tsx:27` |

## 已审核条目（代码审计 Round 1.9）

| 条款 | 要求 | 项目现状 | 结论 | 风险/需调整 | 证据 |
|---|---|---|---|---|---|
| 1.1.6 | 禁止虚假功能/伪设备数据/恶作剧追踪能力 | 未发现伪定位、伪追踪、匿名恶作剧呼叫等实现；核心能力为记录/日报/待办 | 符合 | 低风险：新功能评审继续禁止“娱乐型假能力” | 代码检索（`src/**`, `api/**`, `ios/**`） |
| 1.2.1(a) | Creator 内容超龄识别与年龄限制机制 | 当前无 creator 内容市场、无 UGC 分发型内容池与年龄闸 | 不适用 | 若未来上线 UGC/creator 分发，需补年龄分级与 underage 限制 | `docs/PROJECT_MAP.md`, 代码检索（本轮） |
| 1.4 | 不得引导造成身体伤害 | 代码未见危险挑战/押注/驾驶诱导类文案或流程 | 符合 | 低风险：保持文案审查 | 代码检索（`src/i18n/**`, `src/features/**`） |
| 1.4.1 | 医疗声明需可验证，不能提供不实诊断 | 产品未声明医疗诊断能力，定位为陪伴日记与提醒 | 符合 | 若新增健康测量，需补合规声明与监管资质 | `src/i18n/locales/en.ts:1291`, `src/features/profile/components/PrivacyPolicyPanel.tsx:27` |
| 1.4.2 | 药物剂量计算器需合规主体 | 仓库无药物剂量计算功能 | 不适用 | 后续若接入医疗工具需独立合规审计 | 代码检索（本轮） |
| 1.4.4 | DUI 相关信息必须来源官方且不鼓励危险驾驶 | 仓库无 DUI checkpoint 能力 | 不适用 | 无 | 代码检索（本轮） |
| 1.4.5 | 不得鼓励危险活动或高风险挑战 | 未发现挑战任务、赌注驱动、危险行为鼓励逻辑 | 符合 | 保持增长玩法边界 | `src/features/growth/**`, `src/i18n/locales/**` |
| 2.3.5 | App 分类需准确 | 代码侧可见功能为效率/日记/AI 伴随，不是游戏/工具市场类；但 ASC 分类字段仓库不可见 | 部分符合 | 提审前人工核对 ASC Category 与当前功能一致 | `docs/PROJECT_MAP.md`, `src/App.tsx` |
| 2.3.6 | 年龄分级问卷需真实 | 代码含 AI 文本、账号、通知、订阅；但 ASC 年龄分级问卷仓库不可见 | 部分符合 | 中风险：提审前人工复核年龄分级答案 | `src/features/auth/AuthPage.tsx`, `src/features/profile/UpgradePage.tsx` |
| 2.3.7 | 名称/关键词/元数据不得误导或蹭词 | 仓库仅能看到应用内文案，无法直接证明 ASC 关键词/副标题合规 | 部分符合 | 提审前人工核对 App 名/关键词/副标题 | `src/i18n/locales/en.ts`, 代码检索（本轮） |
| 2.3.8 | 元数据需适配全年龄展示 | 应用内未见血腥/成人视觉素材；但截图/预览在 ASC 侧不可见 | 部分符合 | 提审前人工审查截图与预览素材 | `public/assets/**`, `src/features/**` |
| 4.1(b) | 禁止冒充他人应用/服务 | 包名与品牌为 Seeday，自有 UI 与文案，未发现冒充第三方路径 | 符合 | 低风险：持续避免相似命名素材 | `ios/App/App/Info.plist`, `src/features/auth/AuthPage.tsx` |
| 4.3(a) | 禁止同款 app 多 BundleID 灌店 | 仓库仅见单 iOS 工程与单 app bundle | 符合 | 低风险：发布流程维持单包策略 | `ios/App/App.xcodeproj`, `ios/App/App/Info.plist` |
| 4.4 | 扩展需按规范且元数据准确 | 当前未实现 iOS app extension/safari extension/keyboard extension | 不适用 | 若新增扩展需补专门审计 | `ios/App/App/**/*`（仅 App 主体） |
| 4.4.1 | 键盘扩展合规 | 未实现键盘扩展 | 不适用 | 无 | 代码检索（`ios/**`） |
| 4.4.2 | Safari 扩展合规 | 未实现 Safari 扩展 | 不适用 | 无 | 代码检索（`ios/**`） |
| 4.5 | Apple 服务使用合规 | 当前使用 Sign in with Apple、IAP、本地通知；未发现滥用 Apple 服务 | 部分符合 | 持续控制通知与订阅日志暴露 | `src/store/authStoreAccountActions.ts:73`, `api/subscription.ts`, `src/services/notifications/localNotificationService.ts` |
| 4.5.1 | 不得抓取 Apple 站点/排行 | 未发现对 Apple 站点爬取逻辑 | 符合 | 低风险 | 代码检索（`api/**`, `src/**`） |
| 4.5.2 | Apple Music 使用限制 | 未接入 MusicKit/Apple Music API | 不适用 | 无 | 代码检索（本轮） |
| 4.5.3 | 不得用 Apple 服务做骚扰/垃圾消息 | 通知为用户可关闭提醒，未见 push 营销批量发送代码 | 部分符合 | 若后续上线远程 push 营销，需补显式订阅/退订 | `src/features/profile/components/RoutineSettingsPanel.tsx:581`, `src/services/notifications/localNotificationService.ts:131` |
| 4.5.5 | Game Center Player ID 合规使用 | 未接入 Game Center | 不适用 | 无 | 代码检索（本轮） |
| 4.5.6 | Apple emoji 使用边界 | 文案中可出现 unicode emoji，未见将 Apple emoji 资源嵌入二进制 | 符合 | 低风险 | `src/i18n/locales/**`, 代码检索（本轮） |
| 4.7.2 | 不得向 mini-app/chatbot 暴露原生 API | 当前未实现 mini-app 容器/插件市场/嵌入式第三方软件分发 | 不适用 | 若新增该形态需先过架构评审 | `docs/PROJECT_MAP.md`, 代码检索（本轮） |
| 4.7.3 | mini-app 单体数据权限需逐次同意 | 当前无 4.7 范畴能力 | 不适用 | 无 | 代码检索（本轮） |
| 4.7.5 | 超龄软件识别与未成年人限制 | 当前无 4.7 范畴软件索引/分发能力 | 不适用 | 无 | 代码检索（本轮） |
| 4.9 | Apple Pay 信息披露与 UI 合规 | 当前订阅支付主链路是 Apple IAP/StoreKit，未接入 Apple Pay 支付按钮流 | 不适用 | 若未来接入 Apple Pay 需补周期扣费披露文案 | `src/features/profile/UpgradePage.tsx`, `api/subscription.ts` |
| 4.10 | 禁止将系统内建能力单独收费 | 当前付费点为会员能力（AI 配额/体验增强），非“通知权限/相机权限”收费 | 符合 | 低风险：保持付费点与业务价值绑定 | `src/features/profile/UpgradePage.tsx`, `api/subscription.ts` |
| 5.1 | 隐私总则（采集/处理/告知/撤回） | App 内有隐私政策入口，账号删除可达；但同意管理与 ASC 披露需人工对照 | 部分符合 | 中风险：提审前核对隐私标签、追踪披露、第三方共享 | `src/features/profile/components/PrivacyPolicyPanel.tsx`, `api/delete-account.ts` |
| 5.1.1 | 数据采集与存储总要求 | 已声明收集与删除，提供应用内删除；但 ASC 隐私字段与外部 URL 仍需人工校验 | 部分符合 | 中风险：补齐提审 checklist 证据 | `src/i18n/locales/en.ts:1291`, `src/features/profile/components/DeleteAccountModal.tsx:21` |
| 5.1.1(ii) | 收集数据需同意且可撤回 | 通知权限通过系统弹窗请求，非主流程强依赖；社交登录可退出并清 token | 部分符合 | 需补“第三方 AI 数据共享同意”与撤回路径的提审说明 | `src/services/notifications/localNotificationService.ts:131`, `src/store/authStoreAccountActions.ts:150` |
| 5.1.3 | 健康数据特殊限制 | 未接入 HealthKit/临床数据/运动健康 API | 不适用 | 无 | 代码检索（本轮） |
| 5.1.4(a) | 儿童数据合规 | 应用声明非 13 岁以下用户，未见 Kids Category 特化能力 | 部分符合 | 提审前人工确认年龄分级与元数据无“for kids”表述 | `src/i18n/locales/en.ts:1304`, `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md` |
| 5.1.5 | Location 使用需直接相关并告知用途 | 仅提供用户手动地理编码设置地区，无系统定位权限请求 | 符合 | 若引入 GPS 定位需补 purpose string+同意流程 | `src/features/profile/components/RegionSettingsPanel.tsx`, `src/services/location/geocode.ts` |
| 5.2.4(a) | 不得暗示 Apple 背书 | 代码未见“Apple endorsed”类文案 | 符合 | 低风险：继续在市场文案复核 | `src/i18n/locales/**`, 代码检索（本轮） |
| 5.2.5 | 不得伪装成 Apple 产品/界面 | UI 为自有视觉语言，未仿 App Store/Messages/Finder | 符合 | 低风险 | `src/features/**`, `src/components/**` |
| 5.4 | VPN 应用要求 | 未接入 VPN/NEVPNManager | 不适用 | 无 | 代码检索（`ios/**`, `src/**`） |
| 5.5 | MDM 应用要求 | 未接入 MDM/profile 配置管理 | 不适用 | 无 | 代码检索（`ios/**`, `src/**`） |
| 5.6 | 开发者行为规范 | 代码层未见欺诈/诱导付费行为；但客服回复与 ASC 沟通过程不在仓库 | 部分符合 | 需在提审流程侧保证沟通与声明一致 | `src/features/profile/UpgradePage.tsx`, `docs/CURRENT_TASK.md` |
| 5.6.2 | 开发者身份信息真实可验证 | App 内提供联系邮箱；ASC 主体信息仓库不可见 | 部分符合 | 提审前人工核对开发者主体、支持 URL、联系信息一致性 | `src/features/profile/components/AboutPanel.tsx`, `src/features/profile/components/PrivacyPolicyPanel.tsx` |

## 代码层新增风险（Round 1）

| 风险ID | 描述 | 严重度 | 建议 |
|---|---|---|---|
| R-ASR-001 | Apple 登录原生路径使用占位 `redirectURI` | 高 | 改为真实 URI，并在 iOS 真机验证登录/回跳 |
| R-ASR-002 | 删除账号 UI 流程未直接调用硬删除 API | 高 | 用户确认后直接调用 `callDeleteAccountAPI()`，明确成功/失败反馈 |
| R-ASR-003 | `checkAndHandlePendingDeletion` 在未到删除时间时清空 `pending_deletion_at`，语义冲突 | 高 | 修正条件分支并补单测覆盖“未到期/到期”路径 |
| R-ASR-004 | `forceOnboarding=1` 在非 DEV 环境可触发强制引导 | 已修复 | 已移除该覆盖逻辑（不再支持 query/env 强制 onboarding） |
| R-ASR-005 | iOS 原生层无条件开启 `webView.isInspectable` | 已修复 | 已改为仅 `#if DEBUG` 开启，发布包默认关闭 |
| R-ASR-006 | 未检索到 `PrivacyInfo.xcprivacy` | 已修复 | 已新增 `ios/App/App/PrivacyInfo.xcprivacy` 并加入 iOS Target Resources，后续持续对齐访问 API 分类与 reason code |
| R-ASR-007 | 生产路径存在未受 DEV 保护的 `console.log` | 修复中 | 已完成前端与 `src/server/**` 非必要 `console.log` 收口（当前 `src/**` 已无 `console.log`）；`/api/subscription` 详细日志仅在 `SUBSCRIPTION_VERBOSE_LOGS=true` 开启，默认关闭；已将 `useChatStore/useTodoStore/reportActions/authStoreRuntimeHelpers/useReportStore/useAnnotationStore/useStardustStore/authDataSyncHelpers/authPreferenceHelpers` 生产路径错误输出改为 DEV-only，并将 `api/report.ts`、`api/classify.ts`、`api/diary.ts`、`api/magic-pen-parse.ts` 错误日志收敛为状态码/长度摘要，避免原文泄露 |

## ASR/NR 全量条款清单（待持续打勾）

> 说明：以下仅列 `ASR & NR` 标签条款。每完成一条，在“状态”列更新并补充证据。

| 条款 | 状态 | 备注 |
|---|---|---|
| 1.1.6 | 已审 | Round 1.9 |
| 1.2.1(a) | 已审 | Round 1.9 |
| 1.4 | 已审 | Round 1.9 |
| 1.4.1 | 已审 | Round 1.9 |
| 1.4.2 | 已审 | Round 1.9 |
| 1.4.4 | 已审 | Round 1.9 |
| 1.4.5 | 已审 | Round 1.9 |
| 1.5 | 已审 | Round 1 |
| 1.6 | 已审 | Round 1 |
| 2.1(a) | 已审 | Round 1 |
| 2.3 | 已审 | Round 1 |
| 2.3.1(a) | 已审 | Round 1 |
| 2.3.5 | 已审 | Round 1.9 |
| 2.3.6 | 已审 | Round 1.9 |
| 2.3.7 | 已审 | Round 1.9 |
| 2.3.8 | 已审 | Round 1.9 |
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
| 4.1(b) | 已审 | Round 1.9 |
| 4.3(a) | 已审 | Round 1.9 |
| 4.4 | 已审 | Round 1.9 |
| 4.4.1 | 已审 | Round 1.9 |
| 4.4.2 | 已审 | Round 1.9 |
| 4.5 | 已审 | Round 1.9 |
| 4.5.1 | 已审 | Round 1.9 |
| 4.5.2 | 已审 | Round 1.9 |
| 4.5.3 | 已审 | Round 1.9 |
| 4.5.4 | 已审 | Round 1.6 |
| 4.5.5 | 已审 | Round 1.9 |
| 4.5.6 | 已审 | Round 1.9 |
| 4.7.2 | 已审 | Round 1.9 |
| 4.7.3 | 已审 | Round 1.9 |
| 4.7.5 | 已审 | Round 1.9 |
| 4.8 | 已审 | Round 1 |
| 4.9 | 已审 | Round 1.9 |
| 4.10 | 已审 | Round 1.9 |
| 5.1 | 已审 | Round 1.9 |
| 5.1.1 | 已审 | Round 1.9 |
| 5.1.1(i) | 已审 | Round 1 |
| 5.1.1(ii) | 已审 | Round 1.9 |
| 5.1.1(v) | 已审 | Round 1 |
| 5.1.2 | 已审 | Round 1.6 |
| 5.1.3 | 已审 | Round 1.9 |
| 5.1.4(a) | 已审 | Round 1.9 |
| 5.1.5 | 已审 | Round 1.9 |
| 5.2.4(a) | 已审 | Round 1.9 |
| 5.2.5 | 已审 | Round 1.9 |
| 5.4 | 已审 | Round 1.9 |
| 5.5 | 已审 | Round 1.9 |
| 5.6 | 已审 | Round 1.9 |
| 5.6.2 | 已审 | Round 1.9 |

## 审核日志

- 2026-05-01 Round 1：已建立追踪文档并完成 12 条初审（偏文档视角）。
- 2026-05-01 Round 1.1：改为代码审计口径，完成 16 条代码核查，新增 3 个高风险实现项（Apple 登录占位 URI、删除账号主链路、pending 删除逻辑）。
- 2026-05-01 Round 1.2：补审 `2.4.2`、`2.5.3/2.5.4/2.5.6/2.5.9/2.5.11/2.5.12/2.5.13/2.5.16/2.5.17/2.5.18`；同步确认 Apple 登录占位 URI 与删除账号主链路已修复，新增 4 个风险项（隐藏开关、isInspectable、隐私清单缺失、生产 console 日志）。
- 2026-05-01 Round 1.3：按产品决策移除 `forceOnboarding` 覆盖逻辑，`R-ASR-004` 标记为已修复。
- 2026-05-01 Round 1.4：统一删除账号文案为“立即删除”，并新增 `PrivacyInfo.xcprivacy`（已加入 iOS target resources），`R-ASR-006` 标记为已修复。
- 2026-05-01 Round 1.5：按产品决策保留 `isInspectable` 现状，先清理前端可见 `console.log`（统一 DEV 保护）；`R-ASR-007` 更新为修复中。
- 2026-05-01 Round 1.6：补审 `4.5.4` 与 `5.1.2`（代码证据驱动）。确认通知权限非功能强依赖、权限请求由用户触发；新增提审前人工核对项（ASC 隐私标签与第三方共享披露一致性）。
- 2026-05-01 Round 1.7：修复 `R-ASR-005`。`ios/App/App/AppDelegate.swift` 中 `webView.isInspectable` 已收口为仅 DEBUG 构建开启，发布包默认关闭；`2.5.1` 结论更新为符合。
- 2026-05-01 Round 1.8：继续收敛 `R-ASR-007`。`api/subscription.ts` 新增 `SUBSCRIPTION_VERBOSE_LOGS` 观测开关并将详细 `console.log` 收口到受控 debug 日志，生产默认不输出详细 IAP 请求轨迹。
- 2026-05-01 Round 1.9：完成剩余 `ASR & NR` 条款逐条代码审计（28 条），全量清单由“待审”清零；新增多项 ASC 人工核对项（分类/年龄分级/元数据/开发者身份），并将代码层剩余高风险聚焦为 `R-ASR-007`（生产日志继续收口）。
- 2026-05-01 Round 1.10：继续收口 `R-ASR-007`。移除 `src/server/annotation-handler.ts`、`src/server/annotation-handler-utils.ts`、`src/server/todo-decompose-service.ts` 非必要 `console.log`；当前 `src/**` 已无 `console.log`，后续聚焦 `api/**` 诊断日志最小化与提审可解释性。
- 2026-05-01 Round 1.11：继续收口 `R-ASR-007`。前端 `src/store/useChatStore.ts`、`src/store/useTodoStore.ts` 的生产路径 `console.error` / `catch(console.error)` 改为 DEV-only；服务端 `api/report.ts`、`api/classify.ts`、`api/diary.ts`、`api/magic-pen-parse.ts` 日志改为结构化摘要（`status/errorLength`），移除原始文本预览输出。
- 2026-05-01 Round 1.12：继续收口 `R-ASR-007`。前端 store 补充收口：`src/store/reportActions.ts`、`src/store/authStoreRuntimeHelpers.ts`、`src/store/useReportStore.ts`、`src/store/useAnnotationStore.ts`、`src/store/useStardustStore.ts`、`src/store/authDataSyncHelpers.ts`、`src/store/authPreferenceHelpers.ts` 生产路径 `console.warn/error` 改为 DEV-only；`npm run lint:all` 通过。
