# Store Layer Guide

`src/store/*` 是 Zustand 状态层，负责页面状态、数据同步编排、以及本地持久化策略。

## 当前 store 列表

| Store | Responsibility | Persist |
| --- | --- | --- |
| `useAuthStore.ts` | 登录/注册/会话初始化 | No |
| `useChatStore.ts` | 消息流、记录模式、活动编辑 | Yes |
| `useTodoStore.ts` | Todo CRUD、计时、分类 | Yes |
| `useReportStore.ts` | 报告生成、报告列表、观察手记 | Yes |
| `useMoodStore.ts` | 心情映射、自定义标签（含裁剪） | Yes |
| `useAnnotationStore.ts` | AI 批注触发与展示 | Yes |
| `useStardustStore.ts` | 星尘生成与同步 | Yes |

## 组织约定

1. `useXxxStore.ts`: state 与 action 的主入口。
2. `xxxActions.ts`: 多步骤副作用逻辑（例如 API 调用 + 写库 + 状态回写）。
3. `xxxHelpers.ts`: 可复用纯函数，避免在 store 内堆叠长函数。

## 代码约束

1. 前端 AI 能力统一走 `src/api/client.ts`，不要在 store 里直连第三方 Key。
2. 保持 action 单一职责；复杂流程优先下沉到 `*Actions`。
3. 新增持久化字段要考虑清理策略，避免 localStorage 无限增长。
4. 跨 store 调用优先使用 `useXxxStore.getState()`，避免循环依赖。

## 变更自检

```bash
npx tsc --noEmit
npm run build
```
