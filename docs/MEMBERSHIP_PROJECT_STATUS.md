# Membership 项目现状（开发接手版）

> DOC-DEPS: LLM.md -> docs/MEMBERSHIP_SPEC.md -> docs/CURRENT_TASK.md
> 更新时间：2026-04-17
> 适用范围：Web + Capacitor iOS 当前主干实现（as-is）

---

## 1. 先看这三条（新同学快速上手）

1. **会员判定以 `useAuthStore.resolveMembershipState()` 为准**，优先读 `auth.users.user_metadata.membership_plan`，无 metadata 时走 7 天 trial。
2. **支付链路目前仅 iOS IAP 可闭环**（`/api/subscription` + Apple 校验）；Stripe 仍是占位返回 `stripe_not_ready`。
3. **“作息”已从 AI 专属记忆拆出并免费开放**；“AI 专属记忆”现在是 Plus 功能，且服务端注入链路有门控。

---

## 2. 会员状态判定（代码真相）

### 2.1 判定优先级

1. `membership_plan`/`plan`/`tier`/`is_plus` 等 metadata 别名（`app_metadata` + `user_metadata`）
2. `trial_started_at` 是否在 7 天窗口内
3. 临时全员 Plus 开关（当前默认关闭）
4. 默认 Free

代码锚点：

- `src/store/useAuthStore.ts`（`resolveMembershipState`）
- `src/store/useAuthStore.ts`（`MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED = false`）

### 2.2 批注配额实际口径

- Plus：`dailyLimit = 9999`
- Free：按 dropRate 走 `low=3 / medium=5 / high=8`
- 但 UI 已把 Free 限制为只能选 `low`

代码锚点：

- `src/store/useAuthStore.ts`（`ANNOTATION_DAILY_LIMIT_BY_DROP_RATE` + `getAnnotationConfigFromPreferences`）
- `src/features/profile/components/AIAnnotationDropRate.tsx`（Free 锁 `medium/high`）

---

## 3. Free / Plus 功能对照（规格 vs 当前实现）

说明：本表以 `docs/MEMBERSHIP_SPEC.md` 为目标规格，同时标记当前代码落地状态。

| 功能项 | Free（当前） | Plus（当前） | 规格一致性 | 代码锚点 |
|---|---|---|---|---|
| 会员判定（metadata + trial） | ✅ | ✅ | ✅ | `src/store/useAuthStore.ts` |
| AI 人格（Van） | ✅ | ✅ | ✅ | `src/constants/aiCompanionVisuals.ts` |
| AI 人格（Agnes/Zep/Momo） | 🔒 | ✅ | ✅ | `src/features/profile/components/AIModeSection.tsx` |
| AI 批注频率 low | ✅ | ✅ | ✅ | `src/features/profile/components/AIAnnotationDropRate.tsx` |
| AI 批注频率 medium/high | 🔒 | ✅ | ✅ | `src/features/profile/components/AIAnnotationDropRate.tsx` |
| AI 批注日限额 | low 下 3 条 | 高配额（近似无限） | ⚠️（规格写 2 条/天） | `src/store/useAuthStore.ts` |
| 魔法笔模式 | 🔒 | ✅ | ✅ | `src/features/chat/ChatPage.tsx` |
| 待办 AI 拆解 | 🔒 | ✅ | ✅ | `src/features/growth/SubTodoList.tsx` |
| 作息编辑（起床/睡觉/三餐） | ✅ | ✅ | ✅（新决策） | `src/features/profile/components/RoutineSettingsPanel.tsx` |
| AI 专属记忆开关与编辑 | 🔒（显示升级引导） | ✅ | ✅（新决策） | `src/features/profile/ProfilePage.tsx` / `src/features/profile/components/UserProfilePanel.tsx` |
| AI 专属记忆 prompt 注入 | 🔒 | ✅（需开关） | ✅ | `src/store/useAnnotationStore.ts` |
| 周报触发画像提取 | 🔒 | ✅（需开关） | ✅ | `src/store/reportActions.ts` |
| 每日报告（统计层） | ✅（可生成 daily） | ✅ | ⚠️（会员卡文案显示为 Plus） | `src/features/report/ReportPage.tsx` |
| AI 日记正文 | 🔒（teaser） | ✅（full） | ✅ | `src/store/useReportStore.ts` |
| 升级页与恢复购买入口 | ✅（可见） | ✅ | ✅ | `src/features/profile/UpgradePage.tsx` |
| iOS IAP 支付闭环 | 可购买 | 已生效 | ✅ | `src/services/payment/iap/index.ts` + `api/subscription.ts` |
| Stripe 支付 | 占位，不可用 | 占位，不可用 | ⚠️（待实现） | `src/services/payment/stripe/index.ts` |
| 周/月/年报会员分层 | 暂无显式门控（当前主流程仅 daily） | 暂无显式门控（当前主流程仅 daily） | ⚠️（规格待补齐） | `src/features/report/ReportPage.tsx` |

---

## 4. 支付与环境现状

### 4.1 前端支付适配层

- `@payment` alias 构建时切换：IAP / Stripe
- IAP：通过 Capacitor 插件桥拿交易凭证，再调用 `/api/subscription`
- Stripe：当前仅占位返回错误码（未接 checkout）

代码锚点：

- `src/services/payment/iap/index.ts`
- `src/services/payment/stripe/index.ts`
- `src/features/profile/UpgradePage.tsx`

### 4.2 服务端订阅写回

- 入口：`POST /api/subscription`
- 支持动作：`activate` / `restore` / `cancel`
- 当前 source：`iap`（`stripe` 请求会返回未启用）
- 写回 metadata：`membership_plan`, `membership_expires_at`, `membership_source`, `membership_product_id`, `membership_transaction_id` 等

代码锚点：

- `api/subscription.ts`

---

## 5. 手测清单（Free / Plus 双账号）

> 目标：重点验证“我的页展示、升级引导、注入门控是否生效”。

### 5.1 准备

1. 准备两个账号：
   - A：Free（`membership_plan` 缺省或 `free`，且 trial 过期）
   - B：Plus（`membership_plan=plus`）
2. 同一设备同一构建，分别登录 A/B 执行下面步骤。

### 5.2 Free 账号检查

1. 进入 `/profile`：应看到“我的作息”面板；应看到“AI 专属记忆（Plus）”升级引导卡。
2. 编辑并保存作息时间：刷新后仍保留。
3. 点击 AI 专属记忆引导卡按钮：应跳转 `/upgrade`。
4. AI 人格：Van 可选；Agnes/Zep/Momo 置灰并提示升级。
5. 批注频率：仅可选 low；点 medium/high 弹升级提示。
6. 聊天页开启魔法笔：弹升级提示并跳转 `/upgrade`。
7. Growth 子待办“分步完成”：弹升级提示并跳转 `/upgrade`。
8. 报告页生成日记：应走升级弹窗/teaser，不应拿到 full diary。

### 5.3 Plus 账号检查

1. 进入 `/profile`：应看到“我的作息”+“专属记忆开关”+“AI 专属记忆编辑区”。
2. 打开专属记忆开关，填写并保存 AI 专属记忆文本。
3. 关闭后再打开：状态与内容应正确回显。
4. AI 人格：四个都可选。
5. 批注频率：low/medium/high 都可选。
6. 聊天页魔法笔可正常开启。
7. Growth 待办拆解可调用并返回步骤。
8. 报告页生成日记应返回 full diary（非 teaser）。

### 5.4 注入门控专项（关键）

1. Free 账号触发批注请求，检查 `/api/annotation` 请求体：`userContext.userProfileSnapshot` 应为 `undefined`。
2. Plus 账号 + 开关开启，再触发批注：`userContext.userProfileSnapshot` 应存在。
3. Plus 账号 + 开关关闭：再次触发批注，应回到 `undefined`。
4. 周报提取链路：
   - Free：`triggerWeeklyProfileExtraction` 不应触发 `/api/extract-profile`
   - Plus+开关开启：应触发 `/api/extract-profile`

---

## 6. 当前已知差异（建议新同学先认领）

1. **批注日限额与规格不一致**：规格写 Free 2 条/天，当前代码 low 为 3 条/天。
2. **会员卡权益文案与真实门控有偏差**：会员卡包含“每日温室报告”等条目，但当前 daily report 统计层对 Free 可用。
3. **Stripe 仍是占位**：若要 web 付费上线，需要补 checkout + webhook + `/api/subscription` 的 stripe source。
4. **周/月/年报会员分层尚未收口**：规格有定义，但当前主流程仅 daily 使用最完整，缺统一门控策略。

---

## 7. 相关文档

- 规格主文档：`docs/MEMBERSHIP_SPEC.md`
- 当前任务锚点：`docs/CURRENT_TASK.md`
- 个人页模块：`src/features/profile/README.md`
- Store 说明：`src/store/README.md`
- API 说明：`api/README.md` / `src/api/README.md`
