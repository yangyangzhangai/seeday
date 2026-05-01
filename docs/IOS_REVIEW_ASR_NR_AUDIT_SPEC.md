# iOS Review ASR/NR 审计规范（执行模板）

Last Updated: 2026-05-01 (Round 1.7 handoff)
Owner: current working session

## 1) 项目背景

- Seeday 是 iOS 优先的 AI 陪伴日记应用：用户通过聊天记录日常，系统提取活动/心情/待办，生成日报，并由 4 个 AI 人格反馈。
- 技术栈：React 18 + TypeScript + Vite + Zustand + Supabase + Vercel Serverless + Capacitor（iOS 套壳）。
- 目标：确保应用满足 Apple App Review（尤其 ASR/NR 条款）并稳定通过审核。

## 2) 权威规则来源（必须）

- Apple 审核规则原文来源：`docs/ios review.txt`
- 说明：该文件为从 Apple 官网复制的审核条款集合，本规范仅定义“如何在项目内执行审计”，不替代规则原文。
- 审核范围：仅处理带 `ASR & NR` 标签的条款。

## 3) 会话启动上下文（必读）

每次新会话执行审计前，按顺序阅读：

1. `CLAUDE.md`
2. `docs/PROJECT_MAP.md`
3. `docs/SEEDAY_DEV_SPEC.md`
4. 按需补读模块 README（`auth/profile/store/api` 等）

## 4) 审核方法（代码证据驱动）

### 4.1 只看 ASR/NR 条款

- 从 `docs/ios review.txt` 抽取带 `ASR & NR` 的条款。
- 不做泛审，不扩展到非 ASR/NR 条款。

### 4.2 必须逐条看真实代码

每条至少验证以下一项真实行为（按条款相关性）：

- 登录与鉴权（含 Apple 登录回跳）
- 账号删除（App 内可达、执行链路、文案一致性）
- 隐私入口与政策呈现
- 权限申请与用途一致性
- 动态代码执行风险（`eval` / `new Function` 等）
- 调试/隐藏开关、生产日志、Review 可见行为

### 4.3 条款记录格式（每条都要填）

在 `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md` 记录：

- 条款编号
- 条款要求
- 项目现状（基于代码）
- 结论（符合 / 部分符合 / 不符合 / 不适用）
- 风险等级（高 / 中 / 低）
- 是否需要改动
- 证据路径（精确到文件，必要时到行号）

### 4.4 高风险优先修复

- 先修高风险，再补中低风险。
- 修复完成后必须回填审计台账与变更记录。

## 5) 文档同步规范

审核与修复完成后，至少同步以下文档：

1. 主审计台账：`docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`
2. 会话进展：`docs/CURRENT_TASK.md`
3. 变更记录：`docs/CHANGELOG.md`

## 6) 本项目当前已知进展（交接基线）

- 已建立并使用 `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md` 做逐条追踪。
- 审核口径已从“文档推断”切换为“代码证据驱动”。
- 已优先处理并落地：
  - Apple 登录回调不再使用 placeholder，改为读取真实配置。
  - 删除账号改为直接触发服务端硬删除。
  - 删除逻辑状态分支已修正。
  - 删除弹窗与“立即删除”策略对齐（去除宽限期提示）。
  - 新增 `ios/App/App/PrivacyInfo.xcprivacy` 并加入 iOS target resources。
  - 前端可见日志已执行 DEV 保护收口（持续清理中）。

### 6.1 当前风险状态（以台账为准）

- 已修复：`R-ASR-004`（`forceOnboarding` 覆盖逻辑移除）、`R-ASR-005`（`isInspectable` 仅 DEBUG 开启）、`R-ASR-006`（`PrivacyInfo.xcprivacy` 已补齐并入 target）。
- 修复中：`R-ASR-007`（生产路径 `console.log` 收口进行中；前端主链路已收口，`/api/subscription` 详细日志已改为 `SUBSCRIPTION_VERBOSE_LOGS` 受控开关，仍需继续复核其余 server 路径）。
- 新增审计结论（Round 1.6）：`4.5.4`、`5.1.2` 已补审并回填台账；`5.1.2` 仍需提审前人工对齐 ASC 隐私标签。
- Round 1.7：已完成高风险 `R-ASR-005` 修复，发布包默认关闭 `WKWebView.isInspectable`（证据：`ios/App/App/AppDelegate.swift:64`）。
- Round 1.8：继续收敛 `R-ASR-007`，`api/subscription.ts` 详细日志改为受控开关，生产默认关闭。

### 6.2 下一个会话接手清单（必须按顺序）

1. 先读 `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md` 的「代码层新增风险（Round 1）」与最新 Round 记录。
2. 复核 `R-ASR-007`：仅保留必要 server 观测日志，前端路径保持 `import.meta.env.DEV` 保护。
3. 按 `ASR & NR` 条款继续补审待审项，并逐条写证据路径（必要时到行号）。
4. 提审前执行一轮 ASC 人工对照：隐私标签（收集项/用途/共享/追踪）与当前代码行为一致。
5. 完成后回填三份文档：`docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`、`docs/CURRENT_TASK.md`、`docs/CHANGELOG.md`。

## 7) 审计结论输出模板（复用）

可直接用于每轮汇报：

```md
### iOS Review (ASR/NR) 审计结论（Round X.Y）

- 审核范围：仅 `ASR & NR` 条款
- 审核方式：代码证据驱动（非文档推断）

#### 合格项
- <条款编号>：<结论一句话>（证据：`path/to/file`）

#### 风险项
- <风险ID/条款编号>：<风险描述>
  - 影响：<审核/功能/合规影响>
  - 修复建议：<最小可执行改动>
  - 证据：`path/to/file[:line]`

#### 文档回填
- 已更新：`docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`
- 已更新：`docs/CURRENT_TASK.md`
- 已更新：`docs/CHANGELOG.md`
```

## 8) 执行红线

- 禁止以“文档声称已实现”替代代码核验。
- 禁止跳过证据路径登记。
- 禁止在高风险未收敛时宣称“可稳定过审”。
- `docs/ios review.txt` 作为规则基准，若与历史台账冲突，以规则原文 + 当前代码行为为准，重新定结论。
