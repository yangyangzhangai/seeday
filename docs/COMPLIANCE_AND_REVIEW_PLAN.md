# Seeday iOS 上架合规与代码审查任务进度

> 创建时间：2026-04-30
> 适用范围：Seeday Capacitor 7 + Vercel Serverless + Supabase 项目，以海外区 App Store 上架为目标（中国大陆区暂不上架，原因见 §5.2）。
> 本文件 = 唯一的合规进度跟踪入口。所有"上架前必须做的事"都在此打勾。

---

## 0. 一句话现状

Seeday 是 AI 陪伴日记 + 多 AI 厂商（OpenAI / Qwen / 智谱）+ UGC + 跨境数据传输的应用，对应 App Store 审核高敏感品类。**核心封号风险来源**：私有/隐藏 API 调用、AI 数据共享未取得明示同意、UGC + AI 输出无审核机制、隐私文档不完整、动态下发可执行代码。本文件按这些风险逐项治理。

---

## 1. 权威规范来源（自己点开核对，不要只信本文件）

### 1.1 App Store 审核相关（必读）

| 规范 | 链接 | 用途 |
|------|------|------|
| App Review Guidelines（最新版，唯一裁决依据） | https://developer.apple.com/app-store/review/guidelines/ | 整本完整审核条款 |
| ARG 历史版本与 diff（看变化） | https://www.appstorereviewguidelineshistory.com/ | 跟踪 Apple 每次更新的具体改动 |
| 2025-11-13 ARG 更新公告（5.1.2(i) 第三方 AI、1.2.1(a) 年龄限制） | https://developer.apple.com/news/?id=ey6d8onl | 本次上架最关键的新规 |
| Apple Developer Program License Agreement（PDF） | https://developer.apple.com/support/downloads/terms/apple-developer-program/Apple-Developer-Program-License-Agreement-English.pdf | 法律层；第 3.3.2 条管"动态代码"，是 OTA 热更新的硬约束 |
| Agreements and Guidelines 总入口 | https://developer.apple.com/support/terms/ | 所有协议与历史版本 |
| App Store Connect Help（Submit / Privacy / Encryption） | https://developer.apple.com/help/app-store-connect/ | 提交流程层面操作指引 |

### 1.2 隐私与数据（必读）

| 规范 | 链接 |
|------|------|
| Privacy manifest files 文档 | https://developer.apple.com/documentation/bundleresources/privacy-manifest-files |
| Adding a privacy manifest to your app or third-party SDK | https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk |
| Required Reason API 代码表（CA92.1 等） | https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api |
| Apple "常用第三方 SDK 必须自带 manifest" 列表 | https://developer.apple.com/support/third-party-SDK-requirements |
| App Privacy Details（"营养标签"细则） | https://developer.apple.com/app-store/app-privacy-details/ |
| User Privacy and Data Use（ATT 适用范围） | https://developer.apple.com/app-store/user-privacy-and-data-use/ |
| App Tracking Transparency 文档 | https://developer.apple.com/documentation/apptrackingtransparency |
| Offering account deletion in your app（5.1.1(v)） | https://developer.apple.com/support/offering-account-deletion-in-your-app/ |
| Account deletion requirement starts June 30 公告 | https://developer.apple.com/news/?id=12m75xbj |
| Apple Platform Security Guide（PDF，2026-03） | https://help.apple.com/pdf/security/en_US/apple-platform-security-guide.pdf |

### 1.3 加密 / 安全编码（必读）

| 规范 | 链接 |
|------|------|
| ITSAppUsesNonExemptEncryption 文档 | https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption |
| Complying with Encryption Export Regulations | https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations |
| Secure Coding Guide（Apple 旧版但仍权威） | https://developer.apple.com/library/archive/documentation/Security/Conceptual/SecureCodingGuide/Introduction.html |
| Security Development Checklists（清单） | https://developer.apple.com/library/archive/documentation/Security/Conceptual/SecureCodingGuide/SecurityDevelopmentChecklists/SecurityDevelopmentChecklists.html |
| Security Overview 入口 | https://developer.apple.com/security/ |
| Security framework 文档 | https://developer.apple.com/documentation/security |
| Keychain services 文档 | https://developer.apple.com/documentation/security/keychain-services |
| Protecting user data with App Sandbox | https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox |

### 1.4 设计与人机交互（必读，被拒大头）

| 规范 | 链接 |
|------|------|
| Human Interface Guidelines（HIG） | https://developer.apple.com/design/human-interface-guidelines/ |
| Designing for iOS（HIG iOS 子集） | https://developer.apple.com/design/human-interface-guidelines/designing-for-ios |
| Marketing Resources & Identity Guidelines | https://developer.apple.com/app-store/marketing/guidelines/ |
| Apple Trademark Guidelines | https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html |
| Apple Trademark List | https://www.apple.com/legal/intellectual-property/trademark/appletmlist.html |

### 1.5 工程能力（Capabilities / Entitlements / 后台 / WebView）

| 规范 | 链接 |
|------|------|
| Entitlements 文档 | https://developer.apple.com/documentation/bundleresources/entitlements |
| Adding capabilities to your app | https://developer.apple.com/documentation/xcode/adding-capabilities-to-your-app |
| Supported capabilities (iOS) | https://developer.apple.com/help/account/reference/supported-capabilities-ios |
| Configuring background execution modes | https://developer.apple.com/documentation/xcode/configuring-background-execution-modes |
| Capacitor Privacy Manifest（针对你这种 WebView 套壳） | https://capacitorjs.com/docs/v5/ios/privacy-manifest |
| Fine-tune ATS 公告 | https://developer.apple.com/news/?id=jxky8h89 |
| Technical Note TN2415（Entitlements 排错） | https://developer.apple.com/library/archive/technotes/tn2415/_index.html |
| Technical Note TN2407（Code Signing 排错） | https://developer.apple.com/library/archive/technotes/tn2407/_index.html |

### 1.6 海外 AI 法规（区域性合规）

| 规范 | 链接 |
|------|------|
| EU AI Act 政策入口（欧盟委员会） | https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai |
| EU AI-Generated Content Code of Practice | https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content |
| AI Act 详细网站 | https://artificialintelligenceact.eu/ |
| GDPR 全文 | https://gdpr.eu/ |
| CCPA 加州官方页 | https://oag.ca.gov/privacy/ccpa |
| 中国《人工智能生成合成内容标识办法》 | https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm |
| 中国生成式 AI 服务备案信息（2025） | https://www.cac.gov.cn/2026-01/09/c_1769688009588554.htm |

### 1.7 怎么"获取"这些规范的最新版（流程）

1. **登录 https://developer.apple.com → 右上角 Account** → 在"Membership"下方"Agreements, Tax, and Banking"里查看你账号绑定的协议最新版本（必须勾"已接受"，否则提交失败）
2. **关注 https://developer.apple.com/news/** RSS，Apple 每次改 ARG / 协议都会有 News post，订阅后能第一时间看到（建议邮件订阅或加 RSS）
3. **App Store Connect → My Apps → 你的 App → App Privacy / App Information** 里有当下版本的强制项 checklist
4. **WWDC 每年 6 月**：当年新规几乎都在 What's new in privacy / What's new in App Review 这两个 session 公布
5. **Apple Developer Forums → Tags: "App Review Guidelines"**：被拒案例 + Apple 工程师官方回复

---

## 2. 代码审查计划（自动 + 人工，按风险倒序）

> 目标：在提交前用机械手段把"几乎不可能人工漏审"的死亡红线全部清零，再做人工层面的判断题。
> 所有命令以仓库根目录为工作目录。

### 2.1 私有 / 隐藏 / 已弃用 API 扫描（封号风险最高）

#### 风险机理
Apple ARG 2.5.1 明文："**Apps may only use public APIs and must run on the currently shipping OS.**" Apple Review 会对二进制做静态扫描，发现私有 selector / private framework symbol → 直接 ITMS-90809、90683、90338 类拒签；惯犯会**终止开发者账号**。Capacitor 项目最大风险来自第三方 npm 包间接打入 WebView bundle 的代码或 native plugin 引用了已弃用 API。

#### 检查项清单

| # | 检查目标 | 工具 / 命令 | 预期 |
|---|----------|-----------|------|
| C1 | UIWebView 残留（被拒头号原因 ITMS-90809） | `grep -r "UIWebView" ios/ node_modules/@capacitor*/ios` | 0 命中 |
| C2 | iAd / 已删 framework | `grep -ri "iAd\|Newsstand\|AddressBook\|MediaPlayer.*MPMoviePlayer" ios/` | 0 命中 |
| C3 | Objective-C 私有方法名（下划线开头 / Apple 命名空间） | 提交前用 [otool / nm](https://github.com/nst/iOS-Runtime-Headers) 扫描最终 .ipa 二进制（人工，见 §2.1.2） | 无命中 |
| C4 | JS 端调用未声明的 Capacitor plugin（动态 require） | `grep -rn "Capacitor.Plugins\[" src/` | 0 动态属性访问，全部静态 import |
| C5 | Native plugin 来自不可信源 | 检查 `package.json` 中所有 `@capacitor/*` 与 `@capacitor-community/*` 是否官方维护 | 全官方或可信社区 |
| C6 | Apple 列入"必带 Privacy Manifest"清单的 SDK | 比对 https://developer.apple.com/support/third-party-SDK-requirements 与 `package.json` | 全部对齐 |
| C7 | OTA 热更新 / 远程下发可执行 JS（违反 ARG 4.7 + DPLA 3.3.2） | `grep -rn "eval(\|new Function(\|Function(\"\|capgo\|CodePush\|appflow" src/` | **0 命中**（关键） |
| C8 | 硬编码远程脚本加载 | `grep -rn "<script src=\"http\|fetch.*\.js\b" src/ index.html` | 仅 vite 自身 bundle 资源 |
| C9 | 已弃用的 iOS API（`ITSAppUsesNonExemptEncryption` 之外） | Xcode Build Phases → Run Script 添加 `xcodebuild build CODE_SIGN_IDENTITY="" \| grep -i deprecat` | 无 deprecation warning 进入二进制 |

#### 2.1.2 人工二进制扫描（提交前 1 次）
1. `xcodebuild archive -workspace ios/App/App.xcworkspace -scheme App -archivePath build/App.xcarchive`
2. `cd build/App.xcarchive/Products/Applications/App.app`
3. 用 [otool 命令](https://developer.apple.com/library/archive/technotes/tn2407/_index.html) 列出所有 ObjC 方法：
   - `otool -ov App | grep -E "^\s+name 0x" > /tmp/methods.txt`
4. 把 `/tmp/methods.txt` 与 [iOS-Runtime-Headers](https://github.com/nst/iOS-Runtime-Headers) 中的 `PrivateFrameworks` 目录比对，任何 hit 都必须修掉。

> 这一步如果全自动可写一个 `scripts/check-private-api.sh`，TODO 见 §6。

### 2.2 Privacy Manifest 与 Required Reason API（必查）

| # | 检查目标 | 命令 / 方式 | 预期 |
|---|----------|-----------|------|
| P1 | App 自身 PrivacyInfo.xcprivacy 存在且加入 target | `ls ios/App/App/PrivacyInfo.xcprivacy` + Xcode Build Phases → Copy Bundle Resources 含此文件 | 是 |
| P2 | 第三方 SDK 自带 manifest | `find node_modules/@capacitor* node_modules/@supabase* -name "PrivacyInfo.xcprivacy"` | Capacitor / Supabase / 其余必带列表 SDK 全部 hit |
| P3 | Required Reason API 全部声明 | grep 自己代码用到的 API 是否在 manifest `NSPrivacyAccessedAPITypes` 中（重点：`UserDefaults`、`File Timestamp`、`System Boot Time`、`Disk Space`、`Active Keyboard`） | 全部声明并附 reason code |
| P4 | manifest 与 App Privacy 问卷一致 | 人工对照 App Store Connect → App Privacy 与 manifest 中 `NSPrivacyCollectedDataTypes` | 字段完全一致 |
| P5 | `NSPrivacyTracking = false`（你不做追踪） | 读 manifest | 是 |

### 2.3 Info.plist 与 Entitlements 审查

| # | 检查目标 | 当前状态（已读 `ios/App/App/Info.plist`） | 行动 |
|---|----------|------------------|------|
| I1 | `ITSAppUsesNonExemptEncryption` | **缺失** | 加 `<false/>`（HTTPS 走系统加密属豁免） |
| I2 | `NSUserNotificationsUsageDescription`（非 Apple 标准 key） | **存在但是错的** | 删除；本地通知用 `UNUserNotificationCenter` 运行时申请 |
| I3 | `NSCameraUsageDescription` | 不存在 | 若代码或第三方 SDK 引用了 AVCapture 必须加（即使你不主动调用，stripe 等 SDK 引用即触发） |
| I4 | `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription` | 不存在 | 若有"保存日报到相册"功能必须加 |
| I5 | `NSFaceIDUsageDescription` | 不存在 | 若有生物识别登录加 |
| I6 | `NSMicrophoneUsageDescription` | 不存在 | 若有语音输入加 |
| I7 | `LSApplicationQueriesSchemes` | 不存在 | 若代码用 `canOpenURL` 检测他 App 必须列出 |
| I8 | `NSAppTransportSecurity`（ATS） | 不存在（默认全 HTTPS） | **保持不存在最好**；不要为了方便加 `NSAllowsArbitraryLoads = true`，会直接被拒 |
| I9 | URL Scheme `com.seeday.app` 已声明 | 存在 | OK |
| I10 | Entitlements 文件 | 检查 `ios/App/App/App.entitlements` | 只声明你真的用到的：Apple Sign In、Push Notifications（如有）、Associated Domains（如做 Universal Links） |

### 2.4 密钥与服务端代码审查（防泄漏 + 防侧信道）

| # | 检查目标 | 命令 | 预期 |
|---|----------|------|------|
| S1 | 前端打包后无任何 AI 厂商密钥字符串 | `npm run build && grep -rE "sk-[A-Za-z0-9]{20,}\|OPENAI_API_KEY\|ZHIPU_API_KEY\|QWEN_API_KEY" dist/` | 0 命中 |
| S2 | 前端不直接 import openai SDK | `grep -rn "from ['\"]openai['\"]\|require(['\"]openai" src/` | 0 命中（`package.json` 中 `openai` 应只在 `api/*` 用） |
| S3 | 已运行的 `npm run lint:secrets` 通过 | 见 `scripts/check-secrets.mjs` | 通过 |
| S4 | Supabase 仅 anon key 在前端，service_role 仅在 `api/*` | `grep -rn "service_role\|SUPABASE_SERVICE" src/` | 0 命中 |
| S5 | `import.meta.env` 暴露面 | `grep -rn "VITE_" src/ \| grep -v "VITE_PUBLIC"` | 仅以 `VITE_PUBLIC_` 开头的 key 被打包 |
| S6 | `console.log` 不泄漏用户日记原文 | `grep -rn "console.log" src/ \| grep -i "diary\|message\|content"` | 0 命中或仅在 `import.meta.env.DEV &&` 条件下 |
| S7 | 网络层只走 HTTPS | `grep -rn "http://" src/ api/ ios/App/App/Info.plist` | 仅 localhost / 注释 / 文档 |
| S8 | `api/*` 输入校验 | 每个 `api/*.ts` 入口校验 body schema（zod 或人工） | 全部有 |

### 2.5 UI / UX / 元数据审查（4.x 系列被拒大头）

| # | 检查目标 | 来源条款 | 行动 |
|---|----------|----------|------|
| U1 | App 不只是网页套壳 | ARG 4.2 Minimum Functionality | 已确认有原生通知、本地存储、三栏导航 → 通过；上架描述里强调"AI 人格离线缓存""本地通知""手势触觉反馈"等原生特性 |
| U2 | 截图与实际功能一致 | ARG 2.3.3 / 2.3.7 | 截图全部从 App 真实运行截取，不用合成图；首图要展示主功能（不是 splash） |
| U3 | App 名字 / 副标题不堆砌关键词 | ARG 2.3.7 | 名称 ≤30 字，副标题 ≤30 字，无"#1""best"等夸张词 |
| U4 | 不模仿其他知名 App | ARG 4.1 Copycats | 自己设计 UI 与图标 |
| U5 | 不重复提交相似 App（spam） | ARG 4.3 | 一个开发者账号只此一个日记类 App |
| U6 | 未实现的功能不能在描述里宣传 | ARG 2.3 | 先做完功能再写描述 |
| U7 | 不引用其他平台名 | ARG 2.3.10 | 描述/截图里不能出现"也支持 Android"等 |
| U8 | 反作弊 / 反欺骗 | ARG 4.1 | 不要装作系统弹窗、不要伪造电池/电量警告 |
| U9 | 多语言 UI 一致性 | ARG 2.3.2 | 中/英/意三语在同一页都正确显示，无中文残留出现在英文/意文界面 |
| U10 | HIG 基本对齐 | https://developer.apple.com/design/human-interface-guidelines/ | 安全区/Dynamic Type/暗黑模式/手势冲突自查 |

### 2.6 隐私权限提示语（purpose string）审查

ARG 5.1.1 要求所有 NS*UsageDescription 字符串：
- 用第二人称、说人话
- 解释**为什么**而不是**功能名**
- 反例："使用相机" → 正例："Seeday 需要相机权限以便你拍下今天的心情瞬间附在日记里"
- 不能空、不能放占位符 "TODO"、不能机器翻译歧义

逐项检查 §2.3 表中 I3-I6 涉及的 key 的中/英/意三语版本。

### 2.7 Capacitor 套壳特殊审查

| # | 检查目标 | 行动 |
|---|----------|------|
| W1 | WKWebView（不是 UIWebView） | Capacitor 7 默认 WK，确认无降级配置 |
| W2 | WebView 不加载第三方 URL | 你的 webDir 是本地 `dist/`，不远程加载 → OK |
| W3 | 不通过 WebView 跳转外站做支付 | ARG 3.1.1，必须走 IAP 或纯外链浏览器 |
| W4 | 离线可启动 | 断网启动应至少能看登录页或读取本地缓存日记，不出现白屏 |
| W5 | Capacitor plugin 是官方版本 | 你目前装的：`@capacitor/app/core/haptics/ios/keyboard/local-notifications`、`@capacitor-community/apple-sign-in` → 全部官方 / 可信社区 ✅ |

### 2.8 后台与能力（Background Modes / Capabilities）

ARG 2.5.4：后台模式只能在你确实需要的场景声明（VoIP/audio/location/background-fetch/remote-notification 等）。
- 你目前**不需要任何后台模式**（日记 App 没必要常驻）。在 `App.entitlements` 与 Xcode Capabilities 里**不要**勾任何 Background Modes，否则审核员会问"你为什么需要"，回答不上来即拒。
- Push Notifications：如使用 Apple Push 远程通知，要在 Capabilities 加 Push Notifications 并准备好 token 上报；若仅本地通知（你目前 `@capacitor/local-notifications`）不需要这个 capability。

### 2.9 内容审核与举报（针对 UGC + AI 输出）

| # | 必备机制 | 来源条款 | 状态 | 行动 |
|---|----------|----------|------|------|
| M1 | AI / UGC 内容过滤（事前或事后） | ARG 1.2 / 5.1.2(i) | ❌ 无 | 在 `api/diary.ts`、`api/magic-pen-parse.ts`、`api/plant-generate.ts` 调用 OpenAI Moderation API 兜底（免费） |
| M2 | 用户可举报某条 AI 回应 / 某篇日报 | ARG 1.2.1 | ❌ 无 | UI 加长按菜单 → "举报"；后端落库 + 24h 内人工跟进 |
| M3 | 客服联系方式公开 | ARG 1.5 | ❌ 待加 | App 内 Settings + App Store Connect 元数据都要有支持邮箱 |
| M4 | 年龄分级 ≥ 12+ | ARG 1.3 | 待选 | 推荐 12+ 或 17+ |
| M5 | 1.2.1(a) 内容超出年龄分级时限制访问 | ARG 1.2.1(a)（2025-11 新） | ❌ | 启动时收集声明年龄；AI 输出有触发器时按声明年龄过滤 |

### 2.10 法律 / 元数据 / 商务（5.x 系列）

| # | 检查 | 来源 | 行动 |
|---|------|------|------|
| L1 | 隐私政策 URL 可公网访问 | ARG 5.1.1 | 部署到 GitHub Pages 或独立域名 |
| L2 | EULA：用 Apple 默认还是自定义 | ARG 5.1.1 | AI App 建议自定义（Apple 默认 EULA 没包含 AI 免责） |
| L3 | 用户内容知识产权（用户拥有，你只是处理者） | ARG 5.2 | 服务条款写明 |
| L4 | 不展示与无授权的第三方品牌 | ARG 5.2 | 植物图、人格头像、UI 元素全部自有或开源可商用 |
| L5 | Sign in with Apple 必须提供（如果有任何第三方登录） | ARG 4.8 | 你已装 `@capacitor-community/apple-sign-in` ✅ 验证已上线 |
| L6 | 账号删除 In-App 入口 | ARG 5.1.1(v) | 已有 `api/delete-account.ts` ✅ 验证 UI 是否串接、是否同时 revoke Apple Sign In token |
| L7 | 不做"赌博 / 抽奖（5.3）" | ARG 5.3 | N/A |
| L8 | 不做"医疗诊断（1.4.1）" | ARG 1.4.1 | **App Store 描述与 App 内文案严禁出现"治疗""诊断""治愈""焦虑症"等医疗暗示词**；情绪记录用"心情""感受""陪伴"等中性词 |
| L9 | 跨境数据传输声明（GDPR） | GDPR Art.44-50 | 隐私政策列出每个第三方所在国家、传输机制（SCC） |
| L10 | 不面向 13 岁以下儿童 | COPPA + ARG 5.1.4 | 服务条款显式声明；分级 ≥12+ |

---

## 3. 必须产出的文档清单（与 §2 配套）

| # | 文档 | 形式 | 负责人 | 状态 |
|---|------|------|--------|------|
| D1 | 隐私政策（Privacy Policy）三语版本 | 公网 URL | 待定（建议外包/律师）| ❌ |
| D2 | 服务条款 / EULA 三语版本 | 公网 URL | 同上 | ❌ |
| D3 | AI 数据共享首次同意弹窗文案 | i18n key | 自写 | ❌ |
| D4 | 子处理者列表（Sub-processors） | 隐私政策附录 | 自写 | ❌ |
| D5 | 儿童条款（不面向 <13 岁） | 隐私政策内 | 自写 | ❌ |
| D6 | `ios/App/App/PrivacyInfo.xcprivacy` | 工程文件 | 自写（模板见 §5.1）| ❌ |
| D7 | App Privacy 问卷答复 | App Store Connect 后台填 | 自填 | ❌ |
| D8 | 加密出口合规自评（豁免） | Info.plist 一行 | 自写 | ❌ |
| D9 | 内容审核与举报 SOP（含响应时限） | 内部 + App 内"如何举报"页 | 自写 | ❌ |
| D10 | AI 生成内容标识规则（icon + 水印 + metadata） | UI + 设计文档 | 自写 | ❌ |
| D11 | App Review Information（demo 账号 + 备注） | App Store Connect 提交时填 | 自填 | ❌ |
| D12 | App 内"关于" / "联系我们"页面 | UI | 自写 | ❌ |

### 3.1 隐私政策必须章节（针对 Seeday）

1. 适用范围、生效日期、版本号
2. 控制者身份（公司/个人 + 邮箱）
3. 收集的个人数据类别（日记原文、心情、设备 ID、邮箱、IP……）
4. 使用目的（生成 AI 回应、统计、改进服务）
5. 法律依据（EU 用户：GDPR Art.6 同意；US 用户：CCPA notice at collection）
6. **第三方共享与子处理者列表**（逐家列出：Supabase / OpenAI / Qwen / 智谱 / Vercel / Apple Push 等，写明所在国家）
7. 跨境传输（EU → 美国/中国 必须声明 SCC 或类似机制；提及 PIPL）
8. 用户权利（访问/更正/删除/导出/反对/撤回同意）
9. 数据保留期（账号删除后多久彻底删除）
10. 儿童条款（13/16 岁以下不可用）
11. **AI 训练用途声明**（明确说"我们不会用你的日记训练模型；第三方 AI 提供商的政策见 XXX"）
12. 安全措施（加密传输、加密存储、最小权限）
13. 变更通知机制
14. 联系方式 + DPO（如适用）
15. 管辖法律

---

## 4. iOS 工程层必须改的代码（合并自上一轮调研）

### 4.1 新建 `ios/App/App/PrivacyInfo.xcprivacy`（必做）

最小可用模板（基于你 Capacitor 7 + Supabase）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key><false/>
  <key>NSPrivacyTrackingDomains</key><array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeOtherUserContent</string>
      <key>NSPrivacyCollectedDataTypeLinked</key><true/>
      <key>NSPrivacyCollectedDataTypeTracking</key><false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeEmailAddress</string>
      <key>NSPrivacyCollectedDataTypeLinked</key><true/>
      <key>NSPrivacyCollectedDataTypeTracking</key><false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeUserID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key><true/>
      <key>NSPrivacyCollectedDataTypeTracking</key><false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeCrashData</string>
      <key>NSPrivacyCollectedDataTypeLinked</key><false/>
      <key>NSPrivacyCollectedDataTypeTracking</key><false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key><array><string>C617.1</string></array>
    </dict>
  </array>
</dict>
</plist>
```

⚠️ Xcode 中要把这个文件加进 App target 的 Build Phases → Copy Bundle Resources，否则等于没加。

### 4.2 修补 `ios/App/App/Info.plist`

- 添加 `<key>ITSAppUsesNonExemptEncryption</key><false/>`
- 删除 `NSUserNotificationsUsageDescription`（非标准 key）
- 按需添加 `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` / `NSMicrophoneUsageDescription`，三语都要本地化（用 `InfoPlist.strings`）

### 4.3 App 内合规 UI 任务

- [ ] 首次启动同意页（隐私政策 + 服务条款 + AI 数据共享）
- [ ] 首次使用 AI 时再次明示弹窗（5.1.2(i) 强要求）
- [ ] 设置页：隐私政策 / 服务条款 / 联系我们 / 删除账号 / 撤回 AI 数据共享同意
- [ ] AI 输出标记（消息气泡 icon、生成图片可见水印、metadata 写入服务方）
- [ ] AI 内容举报入口（长按 → 举报）

### 4.4 服务端（`api/*`）改造

- [ ] 在 `api/diary.ts`、`api/magic-pen-parse.ts`、`api/plant-generate.ts` 接入 OpenAI Moderation API（免费），对**输入**和**输出**都过一遍
- [ ] `api/delete-account.ts` 内调用 [Sign in with Apple Token Revoke API](https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens) 撤销凭证
- [ ] 所有 `api/*` 入口加 zod schema 校验
- [ ] 日志层禁止打印日记原文 / 用户消息原文（脱敏后再打）

---

## 5. AI 区域合规

### 5.1 EU AI Act（上架欧盟必看）
- 透明度义务（Article 50）2026-08-02 起强制
- 你必须做：① 用户与 AI 人格交互前明示"这是 AI" ② AI 生成内容打机器可读标 + 用户可见标 ③ 深度伪造/仿真不做
- 同时受 GDPR：DPA / SCC / 数据主体权利响应 SLA

### 5.2 中国大陆 ⚠️ **本期不做**
- 算法备案 + 大模型备案需要中国法人主体 + ICP + 安全评估，门槛极高
- 《人工智能生成合成内容标识办法》2025-09-01 起强制：显式标识 + 隐式标识（metadata 水印）
- **决策**：本次仅在海外区上架，避开此巨坑。后续若进入中国大陆区，单独再立项

### 5.3 美国 / 加州
- CCPA/CPRA："Do Not Sell or Share My Personal Information"（你不卖，但隐私政策要这一节）
- COPPA：年龄分级 ≥12+ 且服务条款显式排除 13 岁以下

---

## 6. 工程脚手架待加（自动化检查）

- [ ] `scripts/check-private-api.sh`：编译产物里扫私有 API 命名（结合 iOS-Runtime-Headers 黑名单）
- [ ] `scripts/check-info-plist.mjs`：必填 key 缺失 / 非标准 key / `NSAllowsArbitraryLoads=true` 检测
- [ ] `scripts/check-privacy-manifest.mjs`：扫描 `node_modules/` 中 Apple 必备清单 SDK 是否带 `PrivacyInfo.xcprivacy`
- [ ] `scripts/check-ota.mjs`：扫 `eval` / `new Function` / 远程 JS 加载
- [ ] CI 把以上 4 个脚本接进 `npm run lint:all`
- [ ] iOS 提交前 checklist 脚本：跑一遍并人工 sign-off

---

## 7. 推荐执行顺序（按风险倒序）

| 周次 | 任务 |
|------|------|
| W1 | 写隐私政策 + 服务条款（三语，建议外包） + 部署到公网 |
| W1 | 创建 `PrivacyInfo.xcprivacy` + 修 `Info.plist` |
| W1 | 跑 §2.1 / §2.4 / §2.7 全部自动化扫描，把 0 命中作为 baseline |
| W2 | 实现首次同意 + AI 二次同意双弹窗 + 设置页 5 个入口 |
| W2 | AI 输出标识 UI + 内容举报入口 |
| W2 | OpenAI Moderation API 兜底接入 `api/*` |
| W3 | 完成 App Privacy 问卷 + App Store Connect 元数据 + demo 账号准备 |
| W3 | 写 §6 自动化扫描脚本接 CI |
| W3 | 提交 TestFlight 内部测试，找几个三语母语者人工跑一遍合规自查表 |
| W4 | 提交正式审核 |

---

## 8. 高风险审核点速查（开发期间不要做的事）

1. ❌ 不要用任何 OTA 热更新（Capgo / CodePush / 自建 JS 下发） → DPLA 3.3.2 死亡红线
2. ❌ 不要在 App Store 描述里出现"治疗""诊断""治愈""焦虑症""抑郁症"等医疗词
3. ❌ 不要把 OpenAI / Zhipu API key 放到前端 / 任何打包产物里
4. ❌ 不要让 4+ / 9+ 用户接触 AI 自由生成内容
5. ❌ 不要在隐私政策没列举的厂商之外发用户数据
6. ❌ 不要做"模仿其他知名日记 App 的 UI/icon/名称"
7. ❌ 不要忽略中文残留出现在英文/意文界面（多语言一致性）
8. ❌ 不要为了方便加 `NSAllowsArbitraryLoads=true`
9. ❌ 不要勾不需要的 Background Modes / Capabilities
10. ❌ 不要把服务条款 / 隐私政策做成"勾选即同意"的默认勾，必须用户主动操作

---

## 9. 进度面板

| 类别 | 项目 | 状态 |
|------|------|------|
| 文档 | D1-D12 | ❌ 0/12 |
| 工程 | §4.1 PrivacyInfo.xcprivacy | ❌ |
| 工程 | §4.2 Info.plist 修补 | ❌ |
| 工程 | §4.3 App 内合规 UI（5 项） | ❌ 0/5 |
| 工程 | §4.4 服务端改造（4 项） | ❌ 0/4 |
| 自动化 | §6 脚手架（5 项） | ❌ 0/5 |
| 审查 | §2.1-§2.10（10 大类） | ❌ 0/10 |

> 每完成一项，把 ❌ 改成 ✅，并在 `docs/CHANGELOG.md` 同步一行。
> 紧急/被拒事件单独在最下方加"事故记录"小节追溯。

---

## 10. 事故记录（如有 App 被拒，写在这里）

（暂无）

---

> 本文件随合规进度持续更新。下次新会话开始时，与 `docs/CURRENT_TASK.md` 一并阅读。
