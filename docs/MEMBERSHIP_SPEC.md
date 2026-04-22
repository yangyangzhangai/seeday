# Seeday 会员制度现行规格（As-Is）

> DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/profile/README.md
> 最后更新：2026-04-22
> 适用范围：当前主干（Web + Capacitor iOS）
> 文档定位：本文件为会员制度单一事实源（SSOT），以当前代码实现为准，不描述未落地愿景。

---

## 1. 核心结论（先看）

1. 当前会员档位只有 `Free` / `Plus` 两档，`isPlus` 由 metadata + trial 判定，临时全员放开已关闭。
2. 注册后 7 天 trial 仍生效，trial 期间等同 Plus 能力。
3. 普通功能和会员功能已基本分层，但仍有 3 个需要继续对齐的差异：
   - AI 批注日限额当前 Free=3（非 2）
   - 会员卡文案与真实可用范围有偏差（如 daily report）
   - 周/月能力在 UI 侧仍是开发中提示，非正式门控成品

---

## 2. 会员判定规则（代码口径）

### 2.1 判定优先级

`resolveMembershipState()` 按以下顺序判定：

1. metadata 别名字段（`membership_plan/plan/subscription_plan/tier/is_plus/vip` 等，含 `app_metadata` + `user_metadata`）
2. `trial_started_at` 是否在 7 天窗口内
3. 临时全员解锁开关（当前为 `false`）
4. 默认 Free

代码锚点：

- `src/store/useAuthStore.ts:313`
- `src/store/useAuthStore.ts:89`
- `src/store/useAuthStore.ts:704`

### 2.2 Free 自动收口策略

当用户不是 Plus 时，会自动把偏好收口到 Free 能力边界：

- AI 人格强制回退到 `van`
- 批注频率强制为 `low`

代码锚点：

- `src/store/authPreferenceHelpers.ts:79`

### 2.3 批注日限额真实口径

- Plus：`9999`（等同不限制）
- Free：随频率档位，当前低档是 `3/天`
- 但 Free UI 只允许 `low`

代码锚点：

- `src/store/useAuthStore.ts:83`
- `src/store/useAuthStore.ts:371`
- `src/features/profile/components/AIAnnotationDropRate.tsx:43`

---

## 3. 普通功能 vs 会员功能对齐表

说明：`普通功能`=Free 长期可用；`会员功能`=Plus 才可用；trial 期间按 Plus 执行。

| 模块 | 功能 | 普通功能（Free） | 会员功能（Plus） | 对齐结论 | 代码锚点 |
|---|---|---|---|---|---|
| 账号 | 会员态解析 | metadata + trial 生效 | metadata + trial 生效 | 已对齐 | `src/store/useAuthStore.ts:313` |
| 账号 | 7 天试用 | 可获得 Plus 能力 | n/a | 已对齐 | `src/store/useAuthStore.ts:355` |
| Profile | AI 人格 Van | 可选 | 可选 | 已对齐 | `src/constants/aiCompanionVisuals.ts:17` |
| Profile | AI 人格 Agnes/Zep/Momo | 锁定 | 可选 | 已对齐 | `src/constants/aiCompanionVisuals.ts:23` |
| Profile | AI 人格切换门控 | 非 Plus 点选弹升级提示 | 正常切换 | 已对齐 | `src/features/profile/components/AIModeSection.tsx:49` |
| Profile | 批注频率 low | 可选 | 可选 | 已对齐 | `src/features/profile/components/AIAnnotationDropRate.tsx:7` |
| Profile | 批注频率 medium/high | 锁定 | 可选 | 已对齐 | `src/features/profile/components/AIAnnotationDropRate.tsx:61` |
| Profile | 作息编辑（起床/睡觉/三餐） | 可编辑 | 可编辑 | 已对齐 | `src/features/profile/components/RoutineSettingsPanel.tsx:201` |
| Profile | AI 专属记忆开关/编辑 | 锁定并显示升级引导 | 可用（需开关） | 已对齐 | `src/features/profile/ProfilePage.tsx:69` |
| Chat | 魔法笔模式 | 锁定，弹升级弹窗 | 可开启 | 已对齐 | `src/features/chat/ChatPage.tsx:481` |
| Growth | 待办 AI 拆解 | 锁定，提示并跳转升级页 | 可调用 API 拆解 | 已对齐 | `src/features/growth/SubTodoList.tsx:41` |
| Report | 每日报告（统计层） | 可生成/可查看 | 可生成/可查看 | 已对齐（与会员卡文案有差异） | `src/features/report/ReportPage.tsx:84` |
| Report | 观察日记正文 | 仅 teaser + 模糊遮罩 + 升级按钮 | 完整 AI 正文 | 已对齐 | `src/store/useReportStore.ts:291` |
| Report | 日记书页观察区 | teaser + 升级按钮 | 完整正文 | 已对齐 | `src/features/report/DiaryBookViewer.tsx:305` |
| Report | 周/月入口 | UI 显示“开发中”提示 | UI 显示“开发中”提示 | 待产品口径收口 | `src/features/report/ReportPage.tsx:395` |
| Prompt 注入 | 用户画像快照注入 annotation | 不注入 | 开关开启后注入 | 已对齐 | `src/store/useAnnotationStore.ts:411` |
| Prompt 注入 | 周报触发画像提取 | 不触发 | 开关开启后触发 | 已对齐 | `src/store/reportActions.ts:163` |

---

## 4. 支付链路现状（当前已实现）

### 4.1 前端支付适配

- 支付入口统一走 `@payment` 适配层。
- IAP 与 Stripe 均有实现，不再是纯占位。
- 升级页 `UpgradePage` 支持下单与回跳后 finalize。

代码锚点：

- `src/features/profile/UpgradePage.tsx:5`
- `src/services/payment/iap/index.ts:244`
- `src/services/payment/stripe/index.ts:40`

### 4.2 服务端订阅处理

`/api/subscription` 当前支持：

- `iap`: `activate/restore/cancel`
- `stripe`: `stripe_checkout/stripe_finalize/cancel`

并统一写回 `auth.users.user_metadata`：

- `membership_plan`
- `membership_expires_at`
- `membership_source`
- `membership_product_id`
- `membership_transaction_id`

代码锚点：

- `api/subscription.ts:11`
- `api/subscription.ts:323`
- `src/server/stripe-subscription.ts:127`

---

## 5. 已知差异与风险（本轮审查）

1. **批注配额差异**：文档历史口径常写 Free=2/天，代码当前是 Free low=3/天。
2. **权益文案偏差**：会员卡和购买弹窗包含“每日/每周/每月/每年温室报告”等描述，但当前主流程主要落在 daily，周/月入口仍在“开发中”。
3. **Report 页历史状态变量遗留**：`showUpgrade` 在 `ReportPage` 中保留但主流程已跳转 `/upgrade`，建议后续清理。

---

## 6. 建议作为后续任务（按优先级）

1. 统一“会员权益文案”与“真实门控”对照，避免用户认知落差。
2. 明确 weekly/monthly 的会员策略（继续开发中提示，或补全正式门控 + 产出链路）。
3. 把批注日限额作为产品参数显式化（配置化），避免文档和代码再漂移。

---

## 7. 相关文件索引

- 会员状态：`src/store/useAuthStore.ts`
- Free 收口：`src/store/authPreferenceHelpers.ts`
- 个人页门控：`src/features/profile/ProfilePage.tsx`
- 聊天门控：`src/features/chat/ChatPage.tsx`
- Growth 门控：`src/features/growth/SubTodoList.tsx`
- 日记门控：`src/store/useReportStore.ts`
- 升级页：`src/features/profile/UpgradePage.tsx`
- 订阅后端：`api/subscription.ts`
- Stripe 校验：`src/server/stripe-subscription.ts`
