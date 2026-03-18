# Tshine 功能状态（Feature Status）

- 更新时间: 2026-03-12
- 状态等级:
  - `stable`: 主流程可用，已纳入当前架构主线
  - `beta`: 可用但仍有已知限制
  - `planned`: 规划中/未落地

## 1. Auth（`/auth`）

- 状态: `stable`
- 入口: `src/features/auth/AuthPage.tsx`
- 数据/状态: `src/store/useAuthStore.ts`
- 说明:
  - 支持登录/注册/登出与会话恢复。
  - 登录态参与 App 层跨天日报逻辑触发条件。

## 2. Chat（`/chat`）

- 状态: `stable`
- 入口: `src/features/chat/ChatPage.tsx`
- 数据/状态:
  - `src/store/useChatStore.ts`
  - `src/store/chatActions.ts`
  - `src/store/chatHelpers.ts`
- 说明:
  - 支持记录模式与聊天模式。
  - 支持消息插入、编辑、删除、时长计算、历史加载。
  - 已完成 sendMessage 拆分（C7），可维护性较审计初期明显改善。
  - 已完成 F17 映射收口，消息 DB 映射由 `src/lib/dbMappers.ts` 统一维护。
  - Magic Pen Mode-B 已落地：wand 模式开关 + 发送触发解析 + `MagicPenSheet` 草稿确认写入（不自动提交）。

## 3. Todo（`/todo`）

- 状态: `stable`
- 入口: `src/features/growth/GrowthPage.tsx`
- 数据/状态: `src/store/useTodoStore.ts`
- 说明:
  - 支持新增、编辑、删除、完成状态与优先级。
  - 已完成页面拆分与工具函数提取（C5/C10/C15）。

## 4. Report（`/report`）

- 状态: `beta`
- 入口: `src/features/report/ReportPage.tsx`
- 数据/状态:
  - `src/store/useReportStore.ts`
  - `src/store/reportActions.ts`
  - `src/store/reportHelpers.ts`
- 说明:
  - 支持按日/周/月/自定义区间生成报告。
  - 支持观察手记生成（Timeshine Diary 三步流程）。
  - 已完成页面与 store 大体量拆分（C3/C4/C6）。
  - 已修复报告详情标题语言不一致问题（动态 i18n 标题）。

## 5. Annotation Bubble（全局）

- 状态: `beta`
- 入口/组件: `src/components/feedback/AIAnnotationBubble.tsx`
- 数据/状态:
  - `src/store/useAnnotationStore.ts`
  - `src/store/annotationHelpers.ts`
  - `api/annotation.ts`
- 说明:
  - C12 已停止执行，当前保持联调阶段触发策略；后续由用户自行切换到概率+冷却方案。

## 6. Stardust（星尘）

- 状态: `beta`
- 组件: `src/components/feedback/Stardust*.tsx`
- 数据/状态: `src/store/useStardustStore.ts`
- 服务端: `api/stardust.ts`
- 说明:
  - 前端明文密钥直连已下线，统一改 serverless 转发。

## 7. i18n

- 状态: `stable`
- 入口: `src/i18n/index.ts`
- 词条: `src/i18n/locales/zh.ts`, `src/i18n/locales/en.ts`, `src/i18n/locales/it.ts`
- 说明:
  - 核心页面已完成一轮硬编码收口（C9）。
  - 报告标题已改为运行时按语言生成，避免历史中文 title 泄漏。
  - 已完成 F18，Mood 领域内部值切换为英文 key，展示统一走 i18n。

## 8. API 与安全边界

- 状态: `stable`
- 前端调用层: `src/api/client.ts`
- 服务端入口: `api/*.ts`
- 说明:
  - 主要 AI 能力均通过 serverless 中转。
  - 安全清理阶段已移除已审计的前端明文密钥直连实现。

## 9. 待办重点（来自 cleanup 看板）

1. C12: 批注概率策略恢复（已停止执行，后续由用户自行执行）。
2. C13: 调试日志清理（已停止执行，后续由用户自行执行）。

## 10. Magic Pen（聊天侧流）

- 状态: `stable`
- 入口: `src/features/chat/ChatInputBar.tsx`（wand mode toggle）+ `src/features/chat/MagicPenSheet.tsx`
- 解析链:
  - `src/services/input/magicPenParser.ts`（AI-first + local fallback）
  - `api/magic-pen-parse.ts`
- 说明:
  - 仅在 mode-on 时由发送触发解析，sheet 直接展示已解析草稿。
  - 草稿确认前不写库，提交经 `src/store/magicPenActions.ts` 执行。
