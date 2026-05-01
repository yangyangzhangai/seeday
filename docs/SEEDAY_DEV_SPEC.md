# Seeday AI 辅助开发规范 v1.2

> 本规范是 AI 每次开发前必读的上下文文件。所有代码生成必须符合以下约束。

---

## 0. 战略路线（三句话版）

1. **现在**：走 Capacitor 套壳路线，目标尽快上 TestFlight
2. **始终**：业务逻辑、数据层、API 层从一开始独立写，不和页面代码绑定（为将来迁移 RN 做准备）
3. **未来**：当产品有用户、有反馈、动画或社交体验出现明显瓶颈时，再评估迁移 React Native

---

## 1. 技术栈

| 层次 | 技术 | 备注 |
|---|---|---|
| UI 框架 | React 18 + TypeScript | 保持现有 |
| 构建工具 | Vite | 保持现有 |
| 样式 | Tailwind CSS | 保持现有；RN 迁移时换 NativeWind |
| 状态管理 | Zustand（含 persist） | 保持现有；RN 兼容 |
| 数据库 | Supabase | 保持现有；两端通用 |
| 后端 | Vercel Serverless（当前） / Supabase Edge Functions（迁移目标） | 当前仓库仍运行在 `api/*.ts`；若后续统一迁移，再收敛到 Edge Functions |
| iOS 打包 | Capacitor 6.x | 核心迁移工具 |
| 原生能力 | Capacitor 官方插件 | 推送/键盘/状态栏/触觉/相机等 |
| 桌面小组件 | SwiftUI + WidgetKit | App Group 与主 App 共享数据 |
| 动画 | Framer Motion + CSS | Canvas/SVG 用于植物生长动画 |

---

## 2. 目录结构规范（分层架构）

```
src/
├── features/          # UI 层（只有 React 组件，不含业务逻辑）
│   ├── chat/
│   ├── todo/
│   ├── report/
│   └── auth/
│
├── services/          # 业务逻辑层（纯 TypeScript，无 React 依赖）
│   ├── chatService.ts      # 聊天业务逻辑
│   ├── todoService.ts      # 待办业务逻辑
│   ├── input/              # 输入分类与词库 (Lexicon)
│   │   └── lexicon/        # 多语言词典数据 (SSOT)
│   ├── reportService.ts    # 日报业务逻辑
│   ├── plantService.ts     # 植物生成逻辑（新功能）
│   └── native/             # 原生能力封装（Capacitor 插件）
│       ├── hapticService.ts
│       ├── pushService.ts
│       └── storageService.ts
│
├── store/             # 状态层（Zustand，只做状态管理，调用 service）
│   ├── useChatStore.ts
│   ├── useTodoStore.ts
│   └── useReportStore.ts
│
├── api/               # 数据访问层（Supabase + Edge Function 调用）
│   ├── supabase.ts         # Supabase 客户端实例
│   ├── client.ts           # Edge Function 调用封装
│   └── repositories/       # 数据仓库（每个实体一个文件）
│       ├── messageRepo.ts
│       ├── todoRepo.ts
│       └── reportRepo.ts
│
├── types/             # 共享类型定义
├── lib/               # 纯函数工具
│   └── platform.ts        # 平台检测工具（isNative / isWeb / isIOS）
├── i18n/              # 国际化
└── components/        # 共享 UI 组件
```

### 分层规则（AI 写代码必须遵守）

| 规则 | 说明 |
|---|---|
| **UI 层不写业务逻辑** | `features/` 里的组件只调用 store，不直接调用 Supabase 或 API |
| **store 不写数据库操作** | store action 调用 `services/` 或 `api/repositories/`，不直接写 SQL |
| **service 不依赖 React** | `services/` 是纯 TypeScript，迁移 RN 时可 100% 复用 |
| **类型定义共享** | 所有接口类型写在 `types/`，UI/service/api 三层共用 |

---

## 3. 移动端 UI 规范（iOS 优先）

### 3.1 布局基础

```css
/* 所有页面容器 */
.page-container {
  position: fixed;
  inset: 0;
  /* 适配 iPhone 安全区域（刘海屏 + 底部横条） */
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### 3.2 触控目标尺寸（Apple HIG 规范）

| 元素 | 最小尺寸 | 说明 |
|---|---|---|
| 可点击按钮 | 44×44pt | Apple HIG 最低要求 |
| 列表行高 | ≥ 44pt | 避免误触 |
| 输入框高度 | ≥ 44pt | |
| 底部导航图标 | 44×44pt | |

### 3.3 禁止在移动端使用的 Web 模式

```
❌ 禁止：hover 效果作为唯一交互反馈（手机没有 hover）
❌ 禁止：fixed 宽度（如 width: 1200px）
❌ 禁止：右键菜单（长按代替）
❌ 禁止：滚动条可见（用 overflow: hidden 或自定义滚动）
❌ 禁止：cursor: pointer 以外的光标样式
❌ 禁止：浏览器默认文字选中（用 user-select: none）
❌ 禁止：键盘快捷键（如 Ctrl+S）作为主要交互
```

### 3.4 iOS 原生交互感模拟

```
✅ 所有列表支持滑动删除（touch 事件模拟或 @capacitor/swipe）
✅ 按压效果用 active:scale-95 + transition（代替 hover）
✅ 页面切换用 Framer Motion slide 动画（模拟原生 push 效果）
✅ 重要操作加触觉反馈（@capacitor/haptics）
✅ 下拉刷新用原生 pull-to-refresh 感觉（touch 事件）
✅ 模态框从底部弹出（Bottom Sheet 模式，符合 iOS 习惯）
```

### 3.5 字体与颜色

```
- 系统字体：-apple-system, BlinkMacSystemFont（Tailwind 默认已包含）
- 最小字号：14px（iOS 可读性最低要求）
- 正文字号：16px（防止 iOS Safari 自动放大）
- 颜色对比度：≥ 4.5:1（WCAG AA 级无障碍标准）
```

---

## 4. App Store 审核风险规避规范

> 根据 Apple App Store Review Guidelines（2025），以下是 Capacitor 套壳 App 的主要拒审风险和规避方法。

### 4.1 核心风险：Guideline 4.2「最低功能性」

**风险**：Apple 会拒绝"仅仅是网站打包"的 App。

**规避方法**：

| 做法 | 说明 |
|---|---|
| **集成至少 3 个原生功能** | 推送通知 + 触觉反馈 + 相机/相册，向审核员证明不是纯网页 |
| **不显示任何 Web 元素** | 禁止显示 URL 栏、进度条、刷新按钮，这些是浏览器标志 |
| **离线基础功能可用** | 断网时显示缓存数据，不能完全白屏（Zustand persist 已有缓存） |
| **首屏加载 < 3 秒** | Capacitor 将 Web 资源打包在本地，理论上无网络加载延迟 |
| **App 内不跳转外部浏览器** | 如需打开链接，用 `@capacitor/browser`（App 内 Safari）而不是系统浏览器 |

### 4.2 隐私合规

```
必须提供：
✅ 隐私政策 URL（提交前必须有，可用 Privacy Policy Generator 生成）
✅ 账号注销功能（Apple 2023 年强制要求：用户可在 App 内删除账号）
✅ 数据收集说明（在 App Store Connect 的隐私标签中如实填写）
✅ AI 功能说明（2025 新要求：告知用户数据是否用于 AI 训练）
```

### 4.3 让 App 看起来像原生的代码规范

**导航模式**：
```
✅ 底部标签导航（已有 BottomNav）
✅ 页面切换用 slide 动画（向左 push，向右 pop）
✅ 模态框从底部弹起（Bottom Sheet）
❌ 不用 BrowserRouter 的默认行为，要用 MemoryRouter 或 HashRouter
```

**加载状态**：
```
✅ Skeleton 骨架屏（不用旋转圈，旋转圈是 Web 风格）
✅ iOS 风格的 Activity Indicator（Capacitor 内置）
✅ 首屏 Splash Screen（@capacitor/splash-screen）
```

**手势**：
```
✅ 支持右滑返回（iOS 系统手势，Capacitor 默认支持）
✅ 模态框支持下滑关闭（touch 事件）
✅ 列表支持惯性滚动（-webkit-overflow-scrolling: touch）
```

### 4.4 AI 功能披露（2025 新要求）

由于 Seeday 使用 AI 生成批注、日报、植物类型判断：
```
App Store Connect 隐私标签中必须说明：
- "使用 AI 生成个性化内容建议"
- "AI 处理的数据不用于模型训练"（需确保 API 服务商也不训练）
- 在 App 内的"关于"或"隐私"页面中说明 AI 使用方式
```

---

## 4.7 🚨 Apple 官方审核指南关键条款（来源：[Apple App Store Review Guidelines](https://developer.apple.com/cn/app-store/review/guidelines/))

### 4.7.1 🔴 Guideline 2.5.1 — 禁止使用私有 API

> **这就是你说的“不能隐藏 API”！**

Apple 原文：“App 仅可使用公共 API，并且必须在当前发布的操作系统上运行。”

**对 Capacitor 的影响**：
- Capacitor 历史上曾因引用非公开的 WKWebView 选择器（如 `applicationNameForUserAgent`）导致拒审
- **解决方案**：始终使用最新版本的 Capacitor（≥ 6.x），团队已修复已知的私有 API 引用
- **第三方插件风险**：安装任何 Capacitor 插件前检查其 GitHub Issue 是否有私有 API 拒审报告

```
AI 规则：
🔴 禁止在原生代码（Swift/ObjC）中直接调用任何以 _ 开头的 Apple API
🔴 禁止使用未在 Apple 官方文档中列出的 API
🔴 安装新的 Capacitor 插件前必须确认其最近更新日期和 App Store 兼容性
```

### 4.7.2 🔴 Guideline 2.5.2 — App 必须自包含，禁止动态下载代码

Apple 原文：“App 应自包含在自己的套装中，不得下载、安装或执行会引入或更改 App 特性或功能的代码。”

**对 Capacitor 的影响**：
- Capacitor 将 Web 资源打包在本地（`dist/` → iOS Bundle），符合此规则 ✅
- **但禁止**：从服务器动态下载 JS 代码并执行（如用 `eval()` 运行服务器返回的 JS）
- **OTA 更新限制**：可以更新 JS/CSS/资产文件，但**不能更改原生代码或核心功能**

```
AI 规则：
🔴 禁止使用 eval() 或 new Function() 执行动态代码
🔴 禁止从服务器动态加载并执行 JS 文件（数据 JSON 可以）
✅ 所有 Web 资源必须在 build 时打包进 App Bundle
```

### 4.7.3 🔴 Guideline 2.3.1(a) — 禁止隐藏/休眠功能

Apple 原文：“请勿在 App 中包含隐藏、休眠或未记录的功能。所有新的特性、功能和产品变更内容都必须在 App Store Connect 的‘审核备注’中予以详细描述。”

**对 Seeday 的影响**：
- 每次提交新版本时，必须在审核备注中详细列出所有功能（包括 AI 功能）
- 不要有“开发员模式”、“调试开关”等生产代码中的隐藏功能

### 4.7.4 🔴 Privacy Manifests（隐私清单，2024 年强制要求）

自 2024 年 5 月 1 日起，所有提交的 App **必须包含 `PrivacyInfo.xcprivacy` 文件**。

```
需要声明的 API 使用理由（与 Seeday 相关）：
- NSPrivacyAccessedAPICategoryUserDefaults（Zustand persist / @capacitor/preferences 使用）
- NSPrivacyAccessedAPICategoryFileTimestamp（如果使用文件系统）
- NSPrivacyAccessedAPICategoryDiskSpace（如果检查磁盘空间）

Capacitor 6.x 已原生支持 Privacy Manifests。
确保 Xcode 项目中的 PrivacyInfo.xcprivacy 与实际 API 使用一致。
```

### 4.7.5 🟡 Guideline 2.1 — 提交审核时必须提供演示账号

Apple 原文：“如果你的 App 需要登录，请提供演示账户信息。”

**对 Seeday 的影响**：
- Seeday 需要登录才能使用→提交审核时必须提供一个测试账号
- 在 Supabase 中创建一个专用审核账号（如 `review@seeday.app` / `Review1234!`）
- 确保该账号已有示例数据（几条消息、待办、日报），让审核员能看到完整功能

### 4.7.6 🟡 Guideline 5.1.1(v) — 账号的登录/注销/数据删除

Apple 原文：“如果 App 支持账户创建，则也必须在 App 内提供账户删除功能。”

**Seeday 需要实现（当前缺失）**：
```
1. App 内“设置”或“账户”页面中添加“删除账号”按钮
2. 点击后显示确认弹窗（“删除后所有数据将无法恢复”）
3. 确认后调用 Supabase Auth deleteUser API 删除账号
4. 同时删除该用户的所有 messages、todos、reports 数据
5. 删除后跳转回登录页
```

### 4.7.7 🟡 Guideline 2.5.5 — IPv6 必须支持

Apple 原文：“App 必须能够在仅支持 IPv6 的网络上完全正常地运作。”

**对 Seeday 的影响**：Supabase SDK 和标准 HTTPS 请求天然支持 IPv6，一般不需要额外处理。但禁止硒编码 IPv4 地址。

### 4.7.8 🟡 提交审核 Checklist

```
提交到 App Store Connect 前的必查清单：

⬜ 1. 审核备注中列出所有功能 + 测试账号
⬜ 2. 隐私政策 URL 已填写且可访问
⬜ 3. App 内可找到隐私政策链接
⬜ 4. 账号删除功能已实现并可正常使用
⬜ 5. App Store Connect 隐私标签已如实填写
⬜ 6. AI 功能已在描述和隐私标签中说明
⬜ 7. 截图展示 App 实际使用画面（不是启动屏或登录页）
⬜ 8. 断网时 App 不白屏，显示缓存数据
⬜ 9. PrivacyInfo.xcprivacy 已包含在 Xcode 项目中
⬜ 10. 无 console.log 裸露在生产代码中
⬜ 11. 使用 Capacitor 6.x 最新版本加构建
⬜ 12. 无任何“调试模式”或“开发员模式”开关残留
```

## 4.5 Supabase Auth 在 Capacitor 中的注意事项

Supabase 的 OAuth/Magic Link 回调在 Capacitor 中**不走浏览器 URL**，需要配置 Deep Link：

```
1. 在 capacitor.config.ts 中配置 App URL Scheme（如 seeday://）
2. Supabase Dashboard → Auth → URL Configuration 中添加 seeday:// 作为 Redirect URL
3. 若只用邮箱+密码登录（当前方案），则无需额外配置
```

---

## 4.6 🔴 WKWebView localStorage 数据丢失风险

> **这是 Capacitor 套壳最常见的严重 Bug！**

**问题**：iOS 的 WKWebView 会在以下情况下**静默清除 localStorage**：
- 用户强制关闭 App
- iOS 系统内存不足时回收
- App 更新时
- Capacitor 版本升级时

**影响**：Zustand 的 `persist` 中间件默认使用 `localStorage`。如果 localStorage 被清除，用户的本地状态（未同步的消息、待办等）会丢失！

**解决方案**：

```typescript
// src/services/native/storageService.ts
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// Zustand persist 的自定义存储适配器
export const capacitorStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key: name });
      return value;
    }
    return localStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: name, value });
    } else {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: name });
    } else {
      localStorage.removeItem(name);
    }
  },
};

// 在 Zustand store 中使用：
import { capacitorStorage } from '@/services/native/storageService';

export const useTodoStore = create(
  persist(storeConfig, {
    name: 'todo-store',
    storage: createJSONStorage(() => capacitorStorage),
  })
);
```

**必须安装**：`@capacitor/preferences`

## 5. React Native 迁移准备规范

> 遵守以下规范，将来迁移 React Native 时，服务层和数据层代码可 100% 复用。

### 5.1 可直接复用的代码

```
✅ src/services/**     → 纯 TypeScript，零修改复用
✅ src/api/**          → Supabase SDK 两端一致，零修改复用  
✅ src/store/**        → Zustand 在 RN 中完全兼容
✅ src/types/**        → 类型定义，零修改复用
✅ src/lib/**          → 纯函数，零修改复用
✅ src/i18n/**         → i18next 在 RN 中完全兼容
```

### 5.2 迁移时需要重写的代码

```
❌ src/features/**     → JSX/HTML 组件全部重写为 RN View/Text
❌ src/components/**   → 同上
❌ index.css           → 换为 StyleSheet.create 或 NativeWind
❌ Tailwind classes    → 换为 StyleSheet 或 NativeWind
❌ Framer Motion       → 换为 react-native-reanimated
❌ GSAP                → 换为 react-native-reanimated
❌ Three.js            → 换为 expo-gl 或 react-native-skia
```

### 5.3 写代码时的 RN 迁移友好规范

```typescript
// ✅ 好的写法：业务逻辑在 service 里
// todoService.ts
export async function completeTodo(id: string, userId: string) {
  await todoRepo.markComplete(id);
  await reportService.updateCompletionStats(userId);
}

// TodoPage.tsx（UI 层只调用 store）
const { completeTodo } = useTodoStore();
<Button onPress={() => completeTodo(todo.id)} />

// ❌ 坏的写法：业务逻辑写在组件里
const handleComplete = async () => {
  await supabase.from('todos').update({ completed: true }).eq('id', todo.id);
  await supabase.from('reports').update({ ... }); // 数据库逻辑泄漏到 UI
};
```

---

## 5.4 平台检测工具

创建统一的平台检测工具，在代码需要区分 Web/Native 行为时使用：

```typescript
// src/lib/platform.ts
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const isWeb = () => !Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isAndroid = () => Capacitor.getPlatform() === 'android';
```

在需要平台差异化行为时使用：
```typescript
// ✅ 正确写法
import { isNative } from '@/lib/platform';
if (isNative()) {
  // 用 Capacitor App 生命周期事件
} else {
  // 用 document.visibilitychange
}

// ❌ 错误写法：直接判断 window/document 是否存在
if (typeof window !== 'undefined') { ... }
```

## 6. Capacitor 原生能力清单

### 已规划集成的插件

| 插件 | 功能 | 优先级 |
|---|---|---|
| `@capacitor/push-notifications` | 推送通知 | P0 |
| `@capacitor/status-bar` | 状态栏颜色控制 | P0 |
| `@capacitor/keyboard` | 键盘弹出处理 | P0 |
| `@capacitor/splash-screen` | 启动屏 | P0 |
| `@capacitor/app` | App 生命周期管理 | P0 |
| `@capacitor/preferences` | 原生本地存储（**替代 localStorage**） | P0 |
| `@capacitor/haptics` | 触觉反馈 | P1 |
| `@capacitor/browser` | App 内打开链接 | P1 |
| `@capacitor/camera` | 头像/图片上传 | P2 |

### 插件使用约定

```typescript
// 所有 Capacitor 插件调用必须封装在 src/services/native/ 目录下
// 不允许在 UI 组件中直接 import Capacitor 插件

// ✅ 正确
// src/services/native/hapticService.ts
import { Haptics, ImpactStyle } from '@capacitor/haptics';
export const triggerImpact = () => Haptics.impact({ style: ImpactStyle.Medium });

// UI 组件中
import { triggerImpact } from '@/services/native/hapticService';
```

### capacitor.config.ts 参考配置

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.seeday.app',
  appName: 'Seeday',
  webDir: 'dist',                       // Vite 构建输出目录
  server: {
    // 开发时可指向 Vite dev server（仅调试用，发布前删除）
    // url: 'http://localhost:5173',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,             // 手动控制隐藏时机
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resize: 'body',                    // 键盘弹出时调整 body 高度
      style: 'dark',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    scheme: 'seeday',                    // Deep Link scheme
    contentInset: 'always',              // 安全区域处理
  },
};

export default config;
```

---

## 6.5 Vercel → Supabase Edge Functions 迁移清单

> 当前 `api/*.ts` 是 Vercel Serverless，现有 Web/Capacitor 客户端仍通过 HTTPS 调用。本节描述的是“如果后续决定统一迁移到 Supabase Edge Functions”时的迁移清单，不代表当前代码已完成迁移。

| Vercel 文件 | Edge Function 名 | 状态 |
|---|---|---|
| `api/annotation.ts` | `annotation` | ⬜ 待迁移 |
| `api/classify.ts` | `classify` | ⬜ 待迁移 |
| `api/diary.ts` | `diary` | ⬜ 待迁移 |
| `api/report.ts` | `report` | ⬜ 待迁移 |
| `api/stardust.ts` | `stardust` | ⬜ 待迁移 |
| `src/server/http.ts` | 工具函数，已从 `api/` 迁移到 `src/server/` | ✅ 已完成 |

迁移步骤：
```bash
# 1. 安装 Supabase CLI
npx supabase init

# 2. 配置密钥
npx supabase secrets set OPENAI_API_KEY=xxx QWEN_API_KEY=xxx ZHIPU_API_KEY=xxx

# 3. 部署仍在使用中的函数

# 6. 更新前端 src/api/client.ts 调用地址
```

---

## 7. 迁移 RN 的评估触发条件

以下任意条件满足时，重新评估 RN 迁移的必要性：

| 条件 | 说明 |
|---|---|
| 用户反馈页面切换"卡顿"或"不流畅" | WebView 过渡动画的天花板 |
| 植物生长 30 秒动画在中低端 iPhone 掉帧 | Canvas 渲染瓶颈 |
| 需要复杂多点触控手势（如地图缩放） | WebView 手势处理弱于原生 |
| 月活 > 5000 且用户留存率低于预期 | 产品验证完毕，值得投入更多工程成本 |
| 需要接入 HealthKit / ARKit 等深度原生能力 | Capacitor 插件无法覆盖 |

---

## 8. 关键禁止事项（AI 写代码红线）

```
🔴 不允许在 features/**  中直接调用 Supabase
🔴 不允许在 features/**  中直接调用 API client
🔴 不允许在 features/**  中直接 import Capacitor 插件（必须通过 services/native/）
🔴 不允许使用 hover: 作为唯一的交互反馈
🔴 不允许固定像素宽度布局（如 w-[1200px]）
🔴 不允许在组件中混入业务逻辑（直接写 if/then 判断生成报告等）
🔴 不允许在 App 内显示任何 URL、地址栏、刷新按钮等 Web 元素
🔴 不允许断网时完全白屏（必须有缓存 fallback）
🔴 不允许新建超过 400 行的单文件（已有 lint 规则）
🔴 不允许 Zustand persist 直接使用 localStorage（iOS 会丢数据，必须用 capacitorStorage 适配器）
🔴 不允许硬编码 API 地址（必须通过环境变量或 src/api/client.ts 统一管理）
🔴 不允许使用 eval() 或 new Function() 执行动态代码（Apple 2.5.2 禁止）
🔴 不允许在生产代码中保留“调试模式”“开发员模式”等隐藏功能（Apple 2.3.1(a) 禁止）
🔴 不允许硬编码 IPv4 地址（Apple 2.5.5 要求 IPv6 兼容）
🔴 不允许使用未经审查的第三方 Capacitor 插件（必须检查私有 API 风险）
```

---

*最后更新：2026-03-07 v1.2 | 下次 AI 开发前必须重读此文件*
