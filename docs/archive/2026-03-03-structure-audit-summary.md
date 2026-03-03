# Tshine 结构审计归档（2026-03-03）

- 来源：项目结构分析与整改建议（外部审计报告）
- 归档日期：2026-03-03
- 目的：保留审计上下文，不替代主执行计划
- 主执行文档：`docs/CODE_CLEANUP_HANDOVER_PLAN.md`

## 1. 审计范围

1. 全仓目录结构（`api/`, `docs/`, `scripts/`, `src/`）。
2. 安全风险（前端明文密钥、直连外部 API 路径）。
3. 可维护性风险（巨型文件、职责混乱、文档失真、临时文件残留）。

## 2. 审计核心结论（7 大问题）

### P0 安全隐患：明文密钥暴露

1. `src/services/aiService.ts` 存在明文 `cpk_`。
2. `src/api/qwen.ts` 存在明文 `sk-`。
3. 若前端打包泄露，密钥可被滥用。

### P1 双重 API 层混乱

1. 正确路径：`src/api/client.ts -> /api/* (serverless) -> 外部 AI`。
2. 遗留路径：`src/services/aiService.ts` / `src/api/qwen.ts` 直连外部 AI。
3. 需统一到服务端中转路径。

### P2 巨型文件

1. `src/features/chat/ChatPage.tsx`（约 799 行）。
2. `src/store/useChatStore.ts`（约 675 行）。
3. 其余相关大文件：`ReportPage.tsx`, `useReportStore.ts`, `qwen.ts`, `aiService.ts`。

### P3 目录职责混乱

1. `lib/` 与 `utils/` 职责重叠。
2. `pages/` 与 `features/` 标准不统一。
3. `src/api/` 混合客户端、遗留直连、数据库客户端。
4. `src/services/` 仅遗留文件，职责不清。

### P4 空目录与残留文件

1. `src/assets`, `src/styles`, `src/layouts` 存在空/占位情况。
2. `src/i18n/locales/en.ts.temp` 为临时文件。
3. 根目录残留待评估：`TO-DO.json`, `YOUWARE.md`, `SECURITY_FIX.md`, `scripts/test-minmax.ts`。

### P5 文档与代码不同构

1. `docs/ARCHITECTURE.md` 中含大量未实现模块（如 Fragment/Gallery/Shadow Diary/Event Bus 等）。
2. 新人易被错误架构信息误导。

### P6 README 噪音

1. `src` 多目录下 README 多为占位内容，导航价值低。

## 3. 审计建议路线（归档）

1. 安全优先：先引用审计，再删除遗留直连文件。
2. 低风险清理：临时文件、空目录、占位 README、残留文件分批处理。
3. 目录归一：`pages -> features`、`utils -> lib`，但 `lib/utils.ts` 需先职责拆分再命名。
4. 文档同构：重写 `README.md` / `ARCHITECTURE.md`，新增 `FEATURE_STATUS.md`。
5. 持续规范：补 `CONTRIBUTING.md` 与规模约束（如 `max-lines`）。

## 4. 与主计划关系

1. 本归档文件仅保存审计依据与结论。
2. 一切执行与状态更新以 `docs/CODE_CLEANUP_HANDOVER_PLAN.md` 为准。
3. 如主计划与本归档冲突，以主计划中最新“决策结论”为准。
