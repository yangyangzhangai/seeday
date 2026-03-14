# LLM Entry

这是 Tshine 仓库的 AI/LLM 唯一入口文档。**每次新会话开始时，必须先读完本文件，再做任何其他事情。**

---

## 🚀 新会话启动 SOP（必须按顺序执行）

### Step 1 — 全局层（L1，必读，每次都要读）

依次读取以下 4 个文件，建立全局上下文：

1. **本文件 `LLM.md`**：权威顺序、硬性约束、禁止事项（正在读）
2. **`docs/CURRENT_TASK.md`**：当前任务焦点与断点恢复锚点
3. **`docs/PROJECT_MAP.md`**：目录结构、边界、核心路径
4. **`docs/TSHINE_DEV_SPEC.md`**：iOS 开发规范（技术栈、分层架构、移动端 UI、App Store 审核规避）

### Step 2 — 模块层（L2，按任务选读）

确认本次任务涉及哪个模块，读对应 README：

| 模块 | README 路径 |
|------|-------------|
| 聊天/记录 | `src/features/chat/README.md` |
| 任务管理 | `src/features/todo/README.md` |
| 报告/日报 | `src/features/report/README.md` |
| 登录/注册 | `src/features/auth/README.md` |
| 前端 API 层 | `src/api/README.md` |

### Step 3 — 文件层（L3，按任务选读）

读目标文件头部 `DOC-DEPS:` 声明，了解依赖关系，再读文件正文。

---

## 📋 文档权威顺序

如果两份文档存在冲突，以下顺序靠前的为准：

1. `LLM.md`（本文件）
2. `docs/CURRENT_TASK.md`
3. `docs/PROJECT_MAP.md`
4. 各模块 `README.md`
5. 各文件 `DOC-DEPS:` 头声明
6. `docs/CODE_CLEANUP_HANDOVER_PLAN.md`（执行看板与交接历史）

---

## ⚙️ 编码规范（必须遵守，不得讨价还价）

### 文件与函数规模

- 文件行数 **≤ 400 行**（警告），**≤ 800 行**（硬限，必须拆分再提交）
- 单函数 **≤ 30 行**（超限提取到 `lib/` 或 `*Actions.ts`）
- 嵌套层数 **≤ 3 层**，`if/else` 分支 **≤ 3 个**

### 架构边界

- 前端 `src/**` **禁止直连第三方 AI 密钥或 SDK**
- AI 请求统一走 `src/api/client.ts` → `api/*` serverless handler
- 密钥只从 `process.env` 读取，任何形式的硬编码都是违规
- 新页面只能放在 `src/features/*`，禁止在其他位置新建

### 代码质量

- 禁止硬编码中文字符串，必须用 `t('key')` 引用 i18n 翻译 key
- 类型安全：禁止新增无必要的 `any`，接口变更必须同步更新类型定义
- 禁止向生产代码新增裸露 `console.log`，必须用 `import.meta.env.DEV && console.log()`
- 优先复用现有 helper 与 i18n key，避免重复逻辑

### 提交规范

- 每次提交只做一个主题（安全 / 文档 / 单模块拆分，不混用）
- PR 描述必须包含：变更范围、风险点、回滚点、验证结果

---

## 🔁 回环检查（每次提交前必须执行）

```powershell
npm run lint:max-lines          # 文件行数检查（>400 警告，>800 报错）
npm run lint:docs-sync          # 文档同构检查（README + DOC-DEPS 存在性）
npm run lint:state-consistency  # 状态一致性检查（代码改动是否同步了文档）
npx tsc --noEmit                # TypeScript 类型检查
npm run build                   # 构建验证（关键改动后执行）
```

**任何一项不通过，不允许提交，先修复再提交。**

---

## 📐 文档同步矩阵（改了代码必须同步改文档）

| 改动类型 | 必须同步更新的文档 |
|----------|------------------|
| 路由 / 页面入口变更 | `docs/PROJECT_MAP.md` + 对应 `src/features/*/README.md` |
| API 请求/响应契约变更 | `src/api/README.md` |
| Store action / state 变更 | 对应模块 README |
| 目录结构 / 边界变更 | `LLM.md` + `docs/PROJECT_MAP.md` |
| 任意 `src/**` 或 `api/**` 代码改动 | `docs/CODE_CLEANUP_HANDOVER_PLAN.md`（看板状态）<br>`docs/CHANGELOG.md`<br>`docs/CURRENT_TASK.md` |

新增关键文件时，必须在文件头 20 行内包含 `DOC-DEPS:` 声明。

---

## 🚫 禁止事项

1. 禁止新建与 `docs/CODE_CLEANUP_HANDOVER_PLAN.md` 平行的"主计划"文档
2. 禁止在 `src/features/*` 之外新建页面组件
3. 禁止在结构或接口变更后跳过 `npm run lint:docs-sync`
4. 禁止硬编码密钥、硬编码中文字符串、硬编码日期格式

---

## 🔗 关联文档快查

| 文档 | 用途 |
|------|------|
| `docs/CURRENT_TASK.md` | 当前任务焦点，新会话从这里恢复断点 |
| `docs/PROJECT_MAP.md` | 目录职责、核心边界、核心路径索引 |
| `docs/TSHINE_DEV_SPEC.md` | **iOS 开发规范**（技术栈、分层架构、移动端 UI、App Store 审核规避）|
| `docs/CODE_CLEANUP_HANDOVER_PLAN.md` | 执行主线看板（Phase A-G）+ 交接历史日志 |
| `docs/CHANGELOG.md` | 变更记录，每 PR 更新一次 |
| `docs/ARCHITECTURE.md` | 架构说明（真实实现，非愿景） |
| `docs/MAGIC_PEN_CAPTURE_SPEC.md` | **魔法笔实施规格**（主输入受控整理模式：AI 提取 + 前端校验 + draft review） |
| `CONTRIBUTING.md` | 贡献规范、包管理、回滚约定 |

