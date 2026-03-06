# Contributing

本文档约定 Tshine 仓库的最小贡献规范，目标是让每个改动可审阅、可回滚、可交接。

## 1. 提交流程

1. 每次提交只做一个主题（例如：安全清理 / 文档同构 / 单模块拆分）。
2. 先阅读 `docs/CODE_CLEANUP_HANDOVER_PLAN.md` 当前看板状态，避免重复施工。
3. 改动完成后，至少执行：
   - `npx tsc --noEmit`
   - `npm run build`
4. 在 PR 描述中写清楚：变更范围、风险点、回滚点、验证结果。

## 2. 包管理与命令

- 统一使用 `npm`。
- 主锁文件为 `package-lock.json`。
- 不再新增或提交 `pnpm-lock.yaml`。

Windows PowerShell 环境示例：

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

## 3. 目录与边界

1. 页面与业务代码优先放在 `src/features/*`。
2. 前端 API 调用统一走 `src/api/client.ts`。
3. 服务端能力统一放在根目录 `api/*`（Vercel Serverless Functions）。
4. 前端 `src/**` 禁止直连第三方 AI Key/SDK。

目录分工以 `docs/PROJECT_MAP.md` 为准。

## 4. 命名与代码风格

1. TypeScript 保持严格类型，避免新增无必要的 `any`。
2. 优先复用现有 helper 与 i18n key，避免重复逻辑和硬编码文案。
3. 新增组件命名采用 PascalCase，hooks 采用 `useXxx`。
4. 函数优先单一职责；复杂逻辑优先提取到 `lib` 或 `store/*Actions`。

## 5. 文档与看板同步

1. 涉及 cleanup 主线任务时，必须同步更新：
   - `docs/CODE_CLEANUP_HANDOVER_PLAN.md`（任务状态 + 交接日志）
   - `docs/CHANGELOG.md`
2. 若有历史文档过时，优先迁移到 `docs/archive/`，不要直接覆盖事实记录。

### 5.1 代码变更 -> 必改文档矩阵

1. 路由/页面入口变更：更新 `docs/PROJECT_MAP.md` + 对应 `src/features/*/README.md`。
2. API 请求/响应契约变更：更新 `src/api/README.md` + `api/README.md`。
3. Store 对外状态或 action 变更：更新对应模块 README（auth/chat/todo/report）。
4. 目录结构或边界变更：更新 `LLM.md` + `docs/PROJECT_MAP.md`。

### 5.2 文档同构执行要求

1. 涉及结构或接口变更时，必须执行 `npm run lint:docs-sync`。
2. `lint:docs-sync` 未通过，不应提交或合并。
3. 新增关键文件时，需在文件头 20 行内包含 `DOC-DEPS:` 声明。

### 5.3 会话断点恢复 SOP（新会话必读）

1. 新会话开工前，按顺序读取：`LLM.md` -> `docs/CURRENT_TASK.md` -> `docs/CODE_CLEANUP_HANDOVER_PLAN.md`（第 4 节看板 + 第 8 节最新日志）。
2. 任何 `src/**` 或 `api/**` 代码改动，必须同步更新：
   - `docs/CODE_CLEANUP_HANDOVER_PLAN.md`
   - `docs/CHANGELOG.md`
   - `docs/CURRENT_TASK.md`
   - 受影响模块 README（如 `src/features/*/README.md`、`src/api/README.md`）
3. 提交前执行 `npm run lint:state-consistency`；未通过则先补齐状态文件再提交。
4. `docs/CURRENT_TASK.md` 只保留一个当前焦点和一个下一步动作，避免并行待办失真。
5. 若任务中断，必须先写完 `docs/CURRENT_TASK.md` 的 Validation/Next Step，再结束当前会话。

## 6. 回滚约定

1. 每个 PR 应可独立回退。
2. 不把多个高风险改动混在同一提交。
3. 若上线后出现回归，优先 `git revert` 对应 PR，再做前向修复。
