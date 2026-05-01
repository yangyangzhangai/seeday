# DOC-DEPS: CLAUDE.md -> docs/PROJECT_MAP.md -> docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md

# App Store Connect 提审填写模板（基于当前代码）

Last Updated: 2026-05-01
Source: codebase snapshot only (no ASC backend state)

## 1) 应用信息（可直接对照填写）

- App 类型：iOS（Capacitor 套壳）
- 核心能力：聊天记录、活动/心情/待办提取、日报与 AI 日记、成长瓶子、提醒与专注、订阅会员
- 登录方式：邮箱密码、Google 登录、Apple 登录
- 账号删除：App 内可达并可执行硬删除

代码证据：
- `src/features/auth/AuthPage.tsx`
- `src/store/authStoreAccountActions.ts`
- `src/features/profile/components/DeleteAccountModal.tsx`
- `api/delete-account.ts`

## 2) 第三方服务与供应商（隐私标签/审核备注需覆盖）

### 2.1 AI 相关供应商

- OpenAI（日报/日记/画像提取/植物日记等）
- DeepSeek（annotation provider 分支）
- Alibaba DashScope / Qwen（分类、待办拆解、Magic Pen fallback）
- Zhipu AI（Magic Pen 主路）
- Google Gemini（待办拆解、annotation provider 分支）

代码证据：
- `api/diary.ts`
- `api/extract-profile.ts`
- `src/server/plant-diary-service.ts`
- `src/server/annotation-provider-runtime.ts`
- `api/classify.ts`
- `src/server/todo-decompose-service.ts`
- `api/magic-pen-parse.ts`

### 2.2 非 AI 第三方服务（iOS 提审口径）

- Supabase（身份认证 + 数据库）
- Apple App Store Server API（IAP 验证）
- Open-Meteo（天气/空气质量上下文）

代码证据：
- `src/server/supabase-request-auth.ts`
- `api/subscription.ts`
- `src/server/weather-provider.ts`
- `src/server/air-quality-provider.ts`

## 3) 隐私政策与隐私标签建议填写口径（按代码事实）

### 3.1 收集的数据类型

- 账号数据：email、display name、avatar
- 用户内容：messages、moods、todos、reports、annotations、stardust、plant records
- 使用与诊断：功能事件、性能与遥测事件
- 设备与上下文：设备类型、系统版本、时区、可选天气上下文
- 支付相关：订阅状态、交易校验所需字段

代码证据：
- `api/delete-account.ts`（可见用户域数据表清单）
- `api/live-input-telemetry.ts`
- `src/features/profile/components/PrivacyPolicyPanel.tsx`

### 3.2 数据用途

- 提供账号登录、会话管理与数据同步
- 生成 AI 回应、智能批注、日报与日记内容
- 会员订阅开通、恢复、取消与状态验证
- 提醒、运营分析与故障诊断

### 3.3 是否用于追踪（Tracking）

- 代码未见广告 SDK / 跨 App 跟踪 SDK
- 建议 ASC 中按实际运营策略填写；若无跨 App 跟踪，通常为 "No Tracking"

### 3.4 是否用于模型训练

- App 内隐私文案当前口径：不用于训练 AI 模型
- 提审填写需确保与供应商合同条款一致

代码证据：
- `src/i18n/locales/en.ts`
- `src/i18n/locales/zh.ts`
- `src/i18n/locales/it.ts`

## 4) 审核员常看能力（提审备注可引用）

- 登录可用：邮箱/Google/Apple 三种登录
- 删除账号可用：设置页可触达，确认后删除用户业务数据与 auth 用户
- 隐私入口可用：设置页可打开隐私政策与联系邮箱
- 路由形态：HashRouter（Capacitor 场景）
- 发布安全：`WKWebView.isInspectable` 仅 DEBUG 开启
- Privacy Manifest：已存在 `PrivacyInfo.xcprivacy`

代码证据：
- `src/App.tsx`
- `ios/App/App/AppDelegate.swift`
- `ios/App/App/PrivacyInfo.xcprivacy`

## 5) 需要在 ASC 后台人工确认（代码仓库无法证明）

- App 分类（Category）与当前功能是否一致
- 年龄分级问卷是否与真实内容一致
- 隐私标签是否覆盖全部第三方供应商与用途
- App Privacy URL / Support URL 是否可访问且内容一致
- 审核备注是否包含测试账号与关键路径说明

## 6) 给提审同事的最小执行清单

1. 先按第 2 节补齐 ASC 的第三方供应商列表
2. 再按第 3 节填写数据类型/用途/是否追踪/是否训练
3. 用第 4 节能力点写 Review Notes（登录、删除账号、隐私入口）
4. 按第 5 节逐项人工核对并截图留档
