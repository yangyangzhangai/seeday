# Tshine 代码审计报告（对照 TSHINE_DEV_SPEC.md）

> 审计时间：2026-03-07 | 审计范围：`src/` 全目录

---

## 审计摘要

| 类别 | 问题数 | 严重 | 中等 | 低 |
|---|---|---|---|---|
| 分层架构违规 | 3 | 🔴 2 | 🟡 1 | - |
| 移动端 UI 违规 | 4 | 🔴 1 | 🟡 2 | 🟢 1 |
| App Store 审核风险 | 4 | 🔴 2 | 🟡 2 | - |
| Capacitor 就绪度 | 2 | 🟡 1 | 🟡 1 | - |
| 代码质量 | 3 | 🟡 1 | 🟡 1 | 🟢 1 |
| Web-only API 使用 | 3 | 🟡 2 | 🟢 1 | - |
| **总计** | **19** | **5** | **10** | **4** |

---

## 1. 🔴 分层架构违规

### 1.1 🔴 `services/` 目录为空 — 业务逻辑层不存在

**规范要求**：业务逻辑写在 `src/services/`，UI 层和 Store 层不写业务逻辑。

**实际情况**：`src/services/` 目录为空。所有业务逻辑直接写在 Store 文件中。

**涉及文件**：
- `store/useTodoStore.ts` — 完成待办的时长计算、状态更新逻辑
- `store/useChatStore.ts` — 消息分组、跨日刷新逻辑
- `store/useReportStore.ts` — 报告生成、日期范围计算
- `store/useAnnotationStore.ts` — 批注触发策略
- `store/useStardustStore.ts` — 星尘创建/同步逻辑

**修复**：逐步将业务逻辑提取到 `services/*.ts`，Store 只做状态读写。

---

### 1.2 🔴 `api/repositories/` 不存在 — Store 直接调用 Supabase

**规范要求**：数据库操作封装在 `api/repositories/`。

**实际情况**：共 **50+ 处** 直接 `import { supabase }` 调用，分布在所有 7 个 Store 文件中。

**涉及文件**：
| Store 文件 | 直接 Supabase 调用数 |
|---|---|
| `useChatStore.ts` | 8 |
| `useTodoStore.ts` | 5 |
| `useReportStore.ts` | 3 |
| `useStardustStore.ts` | 7 |
| `useAnnotationStore.ts` | 3 |
| `useAuthStore.ts` | 8 |
| `chatActions.ts` | 5 |
| `reportActions.ts` | 2 |

**修复**：创建 `api/repositories/{messageRepo, todoRepo, reportRepo, stardustRepo, annotationRepo}.ts`，将 Supabase 调用封装其中。

---

### 1.3 🟡 Store 文件过大

| 文件 | 大小 | 预估行数 | 状态 |
|---|---|---|---|
| `useChatStore.ts` | 15.5KB | ~430行 | ⚠️ 超 400 行警告线 |
| `useAnnotationStore.ts` | 12.3KB | ~370行 | 接近警告线 |
| `useStardustStore.ts` | 11.1KB | ~310行 | OK |
| `reportActions.ts` | 11.4KB | ~310行 | OK |

---

## 2. 🔴 移动端 UI 违规

### 2.1 🔴 `hover:` 无配套 `active:` 触控反馈

**规范要求**：禁止 `hover:` 作为唯一交互反馈，必须搭配 `active:` 状态。

**实际情况**：全项目 **46 处** `hover:` 样式，仅 **1 处** 有配套 `active:`（TodoPage 的加号按钮）。

**涉及文件**（按严重程度）：
| 文件 | hover 数量 | active 数量 |
|---|---|---|
| `TodoItem.tsx` | 7 | 0 |
| `AuthPage.tsx` | 6 | 0 |
| `Header.tsx` | 5 | 0 |
| `AIAnnotationBubble.tsx` | 3 | 0 |
| `StardustCard.tsx` | 4 | 0 |
| `ReportPage.tsx` | 4 | 0 |
| `ReportDetailModal.tsx` | 4 | 0 |
| `BottomNav.tsx` | 3 | 0 |
| 其他 | 10 | 0 |

**修复**：每个 `hover:xxx` 必须搭配 `active:xxx`（如 `hover:bg-blue-700 active:bg-blue-800 active:scale-95`）。

---

### 2.2 🟡 安全区域适配不完整

**规范要求**：Header、BottomNav、所有全屏容器必须有 `safe-area-inset` 适配。

**实际情况**：
- ✅ `index.css` 有 `padding-bottom: env(safe-area-inset-bottom)`
- ✅ `TodoPage.tsx` 有底部按钮定位适配
- ❌ `Header.tsx` 无 `safe-area-inset-top`
- ❌ `BottomNav.tsx` 无 `safe-area-inset-bottom`
- ❌ `App.tsx` 主容器无安全区域适配

---

### 2.3 🟡 无 `user-select: none` 全局设置

**规范要求**：移动端应禁止文字选中（防止意外长按选中干扰交互）。

**实际情况**：全项目无任何 `user-select: none` 设置。

**修复**：在 `index.css` 全局添加 `* { -webkit-user-select: none; user-select: none; }` 并对输入框例外。

---

### 2.4 🟢 `group-hover:` 用于 tooltip

**位置**：`ReportStatsView.tsx` 第 96 行
```
hidden group-hover:block
```
这是一个 hover-only 的 tooltip，在移动端完全不可见。需改为 touch/click 触发。

---

## 3. 🔴 App Store 审核风险

### 3.1 🔴 无离线 Fallback

**规范要求**：断网时不能白屏，必须有缓存 fallback。

**实际情况**：
- Zustand `persist` 有本地缓存 ✅
- 但无任何离线检测逻辑、离线提示 UI、或 Service Worker ❌
- 断网时 API 调用会直接报错，用户无感知 ❌

**修复**：添加网络状态检测 + 离线提示横幅 + 确保 persist 缓存在断网时正常渲染。

---

### 3.2 🔴 无隐私政策页面、无账号注销功能

**规范要求**：App Store 强制要求隐私政策 URL + App 内账号注销。

**实际情况**：
- 无隐私政策页面 ❌
- 无账号注销功能 ❌（只有登出，不是删除账号）
- 无 AI 功能说明页面 ❌

---

### 3.3 🟡 `BrowserRouter` 需替换

**规范要求**：Capacitor 中使用 `MemoryRouter` 或 `HashRouter`。

**实际情况**：`App.tsx` 第 132 行使用 `BrowserRouter`。

**修复**：
```diff
- import { BrowserRouter } from 'react-router-dom';
+ import { MemoryRouter } from 'react-router-dom';
```

---

### 3.4 🟡 无 Splash Screen / App Icon 资源

**规范要求**：Capacitor App 必须有启动屏和应用图标。

**实际情况**：尚未准备。这些在 Capacitor 集成阶段处理即可。

---

## 4. 🟡 Capacitor 就绪度

### 4.1 🟡 Web-only 事件需要替换

| Web API | 位置 | Capacitor 替代 |
|---|---|---|
| `document.visibilitychange` | `App.tsx:92` | `@capacitor/app` 的 `appStateChange` 事件 |
| `window.dispatchEvent(CustomEvent)` | `App.tsx:63` | 改为 Zustand 事件或直接调用 store |
| `window.addEventListener('resize')` | `TodoItem.tsx:44` | ResizeObserver 或响应式 CSS |

### 4.2 🟡 无骨架屏加载状态

**规范要求**：使用 Skeleton 骨架屏，不用旋转圈。

**实际情况**：全项目未找到任何 `skeleton`、`spinner` 或 loading 组件。数据加载时无视觉反馈。

---

## 5. 🟡 代码质量

### 5.1 🟡 ~50 处裸露 `console.log/error`

**规范要求**：禁止生产代码中裸露 console.log，必须用 `import.meta.env.DEV &&` 保护。

**实际情况**：50+ 处裸露调用，其中 `useTodoStore.ts` 含 **10 处 `[DEBUG]` 日志** 未清理。

**高优先级清理**：
- `useTodoStore.ts` — 10 处 `[DEBUG]` 开头的调试日志
- `useStardustStore.ts` — 10 处 `[Stardust]` 日志
- `useAnnotationStore.ts` — 5 处 `[AI Annotator]` 日志

---

### 5.2 🟡 Store 内跨 Store 调用

`useTodoStore.ts` 和 `useChatStore.ts` 均直接调用 `useAnnotationStore.getState().triggerAnnotation()`。这种跨 Store 直接调用会在迁 RN 时造成循环依赖风险。应该通过 `services/` 层协调。

---

### 5.3 🟢 i18n 硬编码中文

需进一步检查（本次未深入扫描），但之前审计已确认存在少量硬编码中文。

---

## 6. 修复优先级建议

| 优先级 | 工作项 | 预估工时 | 说明 |
|---|---|---|---|
| **P0** | 创建 `api/repositories/`，将 Supabase 调用从 Store 移出 | 1-2 天 | 分层架构核心，RN 迁移前提 |
| **P0** | 所有 `hover:` 添加配套 `active:` 状态 | 2-3 小时 | 移动端基本交互 |
| **P0** | `BrowserRouter` → `MemoryRouter` | 10 分钟 | Capacitor 必须 |
| **P1** | 创建 `services/` 业务逻辑层 | 2-3 天 | 可与功能大改同步进行 |
| **P1** | 清理所有裸露 `console.log` | 1 小时 | 生产代码质量 |
| **P1** | 安全区域适配 Header/BottomNav | 30 分钟 | iOS 刘海屏适配 |
| **P1** | 添加离线检测 + 提示 UI | 3-4 小时 | App Store 审核要求 |
| **P1** | 全局 `user-select: none` | 10 分钟 | |
| **P2** | 添加隐私政策 + 账号注销 | 0.5-1 天 | App Store 必须但不影响开发 |
| **P2** | 骨架屏加载状态 | 0.5 天 | UX 提升 |
| **P2** | Web-only API 替换 | 2-3 小时 | Capacitor 集成时处理 |
| **P2** | `group-hover:` tooltip 改为 touch | 30 分钟 | |

---

## 7. 额外建议

1. **功能大改时顺便重构**：你说 1/3 代码要删/大改，建议改待办和日报时直接按新的分层架构写，而不是先改功能再重构。一步到位。

2. **先做 P0 中的 `api/repositories/`**：这是所有后续工作的基础。一旦 Supabase 调用被封装在 Repository 里，Store 就变薄了，迁 RN 时 Store 可以 100% 复用。

3. **UI 美化和 `hover:` → `active:` 同步做**：既然要整体美化 UI，那在美化过程中自然会重写样式，顺便把 `active:` 加上即可，不需要单独做一遍。
