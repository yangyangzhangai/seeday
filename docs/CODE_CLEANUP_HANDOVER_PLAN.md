# Tshine 代码整理交接计划

- 文档版本: v1.0
- 创建日期: 2026-03-03
- 适用范围: `Tshine2-13-mainc` 全仓
- 目标: 在不重写项目的前提下，完成安全清理、文档同构、结构拆分与可维护性提升

## 1. 项目现状（已确认）

1. 架构可用，不需要重写：Vite + React + Zustand + Supabase + Vercel Serverless。
2. 当前主要问题集中在三类：
   - 大文件/高复杂度（如 chat/report/store 模块）
   - 明文密钥残留
   - 文档与代码不同步
3. `.env.example` 已存在，可直接作为环境变量模板。
4. 本阶段暂不接入 Hook 拦截，后续统一实施。

## 2. 治理目标与边界

### 2.1 目标

1. 从代码中彻底移除明文密钥。
2. 建立可交接的整理流程文档。
3. 分阶段拆分巨型文件，降低维护成本。
4. 每个阶段可独立验收，避免大爆炸式改动。

### 2.2 非目标（本轮不做）

1. 不做 UI 全量重设计。
2. 不做数据库大迁移。
3. 不做一次性全仓重构。

## 3. 分阶段计划（交接主线）

## Phase A: 安全清理（最高优先级）

### A.1 任务

1. 移除明文密钥（仅保留环境变量读取）。
2. 清理或替换包含明文密钥的历史调试文件。
3. 确保前端构建产物中不暴露服务端密钥。

### A.2 重点文件

1. `src/services/aiService.ts`
2. `src/api/qwen.ts`
3. `import requests.py`
4. `scripts/test-annotation.js`
5. `src/store/useStardustStore.ts`（含硬编码 Bearer）

### A.3 验收标准

1. `rg -n "sk-|cpk_" . --glob '!node_modules/**' --glob '!dist/**'` 无命中（或仅文档示例占位符）。
2. `npm run build` 通过。
3. 关键页面手测不回归（`/chat`, `/todo`, `/report`）。

## Phase B: 文档同构（可交接核心）

### B.1 任务

1. 重写根 `README.md`（真实功能、开发/部署、目录结构、已知问题）。
2. 建立全局上下文文档（建议 `PROJECT_CONTEXT.md`）。
3. 建立模块状态文档（建议 `FEATURE_STATUS.md`）。

### B.2 验收标准

1. 新人只读 3 份文档可在 30 分钟内定位核心代码路径。
2. 文档中的功能状态与实际代码一致。

## Phase C: 结构拆分（渐进）

### C.1 执行顺序

1. `src/features/chat/ChatPage.tsx`
2. `src/store/useChatStore.ts`
3. `src/features/report/ReportPage.tsx`
4. `src/store/useReportStore.ts`
5. `src/features/todo/TodoPage.tsx`

### C.2 拆分策略

1. 页面组件拆为：容器组件 + 展示组件 + hooks。
2. store 拆为：state/action 骨架 + 纯业务函数模块。
3. 保证每次只拆一个模块并可单独回滚。

### C.3 阶段阈值

1. 第一阶段：文件 <= 800 行（硬约束）。
2. 第二阶段：文件 <= 500 行（告警目标）。
3. 稳定后再推进到更严格阈值。

## 4. 任务看板（供交接更新）

- [ ] A1: 移除 `aiService.ts` 明文密钥
- [ ] A2: 处理 `qwen.ts`（删除或迁移为服务端调用）
- [x] A3: 清理调试脚本中的明文密钥（部分完成）
- [ ] A4: 清理 `useStardustStore.ts` 中硬编码 Bearer
- [ ] B1: 重写根 `README.md`
- [ ] B2: 新建 `PROJECT_CONTEXT.md`
- [ ] B3: 新建 `FEATURE_STATUS.md`
- [ ] C1: 拆分 `ChatPage.tsx`
- [ ] C2: 拆分 `useChatStore.ts`
- [ ] C3: 拆分 `ReportPage.tsx`
- [ ] C4: 拆分 `useReportStore.ts`
- [ ] C5: 拆分 `TodoPage.tsx`

## 5. 每阶段统一验证清单

1. `npx tsc --noEmit`
2. `npm run build`
3. 手测：
   - `/chat` 发送消息/渲染
   - `/todo` 增删改查
   - `/report` 报告查看与切换

## 6. 交接协议（必须执行）

1. 每次提交只做一个主题（安全清理 / 文档 / 单模块拆分）。
2. 提交说明必须包含：变更范围、风险、回滚点、验证结果。
3. 每次结束必须更新本文件第 7 节“交接日志”。
4. 如发现与本计划冲突的历史改动，先记录再继续，不直接覆盖他人改动。

## 7. 交接日志（持续追加）

### 2026-03-03

- 已完成:
  1. 建立《代码整理交接计划》文档。
  2. 确认 `.env.example` 已存在。
  3. 确认本轮暂不接入 Hook 拦截。
  4. 已将 `import requests.py` 中硬编码 Key 改为读取 `CHUTES_API_KEY`。
  5. 已将 `scripts/test-annotation.js` 中硬编码 Key 改为读取 `CHUTES_API_KEY`。
- 已回滚:
  1. 已回滚 `src/services/aiService.ts`（尝试改为 `/api/chat` 后因编码污染回滚）。
  2. 已回滚 `src/store/useStardustStore.ts`（尝试移除硬编码 Bearer 后因编码污染回滚）。
  3. 已回滚 `src/api/qwen.ts`（尝试改 env 后因编码污染回滚）。
  4. 已回滚 `SECURITY_FIX.md` 到原始状态（避免乱码文档继续传播）。
- 下一步建议执行人:
  1. 以 UTF-8 安全方式重新执行 A1/A2/A4（优先用编辑器原生保存，不走本地代码页转码）。
  2. 再执行一次 `npx tsc --noEmit` 与 `npm run build`。
  3. 推进 Phase B（文档同构）。
- 阻塞项:
  1. 编码风险：含大量中文的大文件若用错误编码读写会被污染。

