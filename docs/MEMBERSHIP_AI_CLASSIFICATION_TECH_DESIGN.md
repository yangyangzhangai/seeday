<!-- DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md -> src/api/README.md -> api/README.md -->

# 会员 AI 分类分层策略 技术实现文档

## 1. 技术目标

围绕 PRD 的分层策略，实现以下硬目标：
- Free 用户：0 次 AI 调用。
- Plus 用户：每条记录 1 次 AI 调用（不重复）。
- classify 接口服务端强鉴权，防绕过。
- AI 失败可降级，主链路不中断。

---

## 2. 当前代码基线（与本次改造相关）

- 前端 classify 调用入口：`src/api/client.ts` -> `callClassifierAPI`
- 聊天主逻辑：`src/store/useChatStore.ts`
  - 活动分类精修调用点（低置信度）
  - 星星语义匹配调用点（兜底）
- 待办分类调用点：`src/store/useTodoStore.ts`
- classify 服务端：`api/classify.ts`
- 会员状态来源：`src/store/useAuthStore.ts` (`isPlus`)

问题：调用点分散且 classify 未强制鉴权，导致策略难收敛。

---

## 3. 目标架构

## 3.1 分层路径
- **Free**：`local classifier` + `keyword/todo link bottle match`
- **Plus**：`unified ai classifier`（单次调用，返回多字段）

### 3.2 单次 AI 输出结构（建议）

```ts
type UnifiedClassifyResult = {
  kind: 'activity' | 'mood' | 'unknown';
  activity_type: 'study' | 'work' | 'social' | 'life' | 'entertainment' | 'health' | null;
  mood_type: string | null; // 映射到现有 mood 枚举
  matched_bottle: { type: 'habit' | 'goal'; id: string; stars: number } | null;
  confidence: number;
};
```

说明：`kind` 用于决定记录归类；`matched_bottle` 用于星星判定；活动/心情分类一次返回。

---

## 4. 详细改造方案

## 4.1 前端 API 层（`src/api/client.ts`）

改造点：
1. `callClassifierAPI` 调用时携带 `Authorization`（复用 `getAuthHeaders`）。
2. 处理后端 `403 membership_required`，回传可识别错误码。

预期：
- 前端与后端都能识别会员权限。

## 4.2 服务端 classify（`api/classify.ts`）

改造点：
1. 接入 `requireSupabaseRequestAuth`（参考 `api/subscription.ts` 等现有实现）。
2. 获取用户 metadata / app_metadata，判定是否 Plus。
3. 非 Plus：直接 `403`，返回 `{ error: 'membership_required' }`。
4. Plus：继续原有分类逻辑。

注意：
- 这是成本防线，不能仅依赖前端分支。

## 4.3 Store 分流（`src/store/useChatStore.ts`）

改造策略：
1. 读取 `useAuthStore.getState().isPlus`。
2. Free 分支：
   - 跳过 classify API 调用。
   - 活动/心情/星星均走本地规则。
3. Plus 分支：
   - 每条记录统一触发一次 classify。
   - 将结果缓存到消息上下文（内存/状态）避免重复请求。
4. 删除或重构重复调用路径（例如 sendMessage 与 endActivity 同时调）。

## 4.4 星星判定（`useChatStore` + `useGrowthStore`）

- Free：仅 todo 链接 + 关键词。
- Plus：优先使用 AI `matched_bottle`；未命中可按产品决定是否允许关键词兜底。

推荐：Plus 保留关键词兜底，提升容错。

## 4.5 待办分类（`src/store/useTodoStore.ts`）

- 对齐同一策略：Free 不调 AI；Plus 可调 AI。
- 若产品只要求“活动记录”使用会员 AI，可先不动 todo，避免扩大改动面。

---

## 5. 数据落地与兼容

建议最小变更：
- 不新增数据库表；优先复用现有消息结构字段。
- 若需存 AI 结果，新增可选字段（如 `classificationMeta`）并保证旧数据兼容。

兼容原则：
- 旧消息无新字段时，不影响展示与报表。

---

## 6. 异常与降级

Plus 用户 AI 异常处理顺序：
1. 网络/超时/403 异常捕获。
2. 回退本地规则分类。
3. 记录日志与埋点：`classification_path=ai_fallback_local`。
4. 不阻断消息落库与 UI 反馈。

---

## 7. 测试方案

### 7.1 单元测试
- `isPlus` 分支正确路由。
- Free 分支不触发 classify 调用。
- Plus 分支仅一次调用。

### 7.2 集成测试
- Free 连续 50 条消息：classify 调用计数为 0。
- Plus 连续 50 条消息：调用计数为 50。
- 非 Plus 直调 `/api/classify` 返回 403。
- Plus AI 失败时成功走本地降级。

### 7.3 回归点
- 聊天记录创建/编辑/结束流程
- 星星动画触发链路
- 报表读取分类字段

---

## 8. 风险与对策

1. **风险：重复 AI 调用未完全收敛**
   - 对策：统一 classify 入口函数，其他分支仅消费结果。

2. **风险：会员判定口径不一致**
   - 对策：复用 `useAuthStore` + 服务端同口径 metadata 判定。

3. **风险：AI 失败导致体验抖动**
   - 对策：严格降级到本地规则，保障主流程稳定。

---

## 9. 开发任务规划（工程拆分，可持续打勾）

- [x] **API Client 任务**
  - [x] `callClassifierAPI` 支持鉴权头。
  - [ ] 标准化 `membership_required` 错误处理（业务层可识别错误对象/错误码）。

- [x] **Serverless 任务**
  - [x] `api/classify.ts` 接入 `requireSupabaseRequestAuth`。
  - [x] 新增 Plus 权限校验与 403（`membership_required`）分支。

- [x] **Chat Store 任务（第一阶段）**
  - [x] 按 `isPlus` 分流 classify 策略（Free 不调 AI，Plus 走 AI）。
  - [x] 合并重复调用点，改为同 messageId 复用同一 classify promise（单条记录单次 AI）。
  - [x] unified classify 结果接入活动类型修正 + 瓶子匹配消费。

- [x] **Growth 星星任务（第一阶段）**
  - [x] Free：仅 todo 关联 + 关键词命中。
  - [x] Plus：优先 AI `matched_bottle`，未命中再关键词兜底。

- [ ] **Fallback 与日志任务（第二阶段）**
  - [x] 实现 AI 失败降级（`ai_fallback_local` 路径已在 store 内落地）。
  - [ ] 增加最小埋点字段（`user_plan/path/ai_called/ai_result_kind/bottle_match_source`）。

- [ ] **Todo 分类对齐任务（可选范围）**
  - [x] `useTodoStore.refineTodoCategoryWithAI` 增加 Plus 门控（Free 不再触发该 AI 精修）。
  - [ ] 评估是否升级为“Plus 每条 todo 新建都走 AI”（当前仍是低置信度触发）。

- [ ] **测试任务**
  - [ ] 单元测试：Free/Plus 分流、单条仅一次 AI、降级分支。
  - [ ] 集成测试：Free 0 调用、Plus 全量调用、403 防绕过。

- [x] **文档同步任务（第一阶段）**
  - [x] 更新 `api/README.md` classify 权限说明。
  - [x] 更新 `src/api/README.md` 与 `src/store/README.md` 的分层策略说明。
