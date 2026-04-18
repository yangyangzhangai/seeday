# LLM Entry

这是 Tshine 仓库的 AI/LLM 唯一入口文档。**每次新会话开始时，必须先读完本文件，再做任何其他事情。**

> 本文件同时维护了一份 `CLAUDE.md`（Claude Code 专用副本，内容与本文件保持同步）。

---

## 🧭 项目一句话简介

**Tshine** 是一款 iOS 优先的 AI 陪伴日记应用，用户通过聊天输入日常记录，AI 自动提取活动/心情/待办，生成日报，并以 4 个个性化 AI 人格（`van`、`agnes`、`zep`、`momo`）提供回应。技术栈：React 18 + TypeScript + Vite + Zustand + Supabase + Vercel Serverless + Capacitor（iOS 套壳）。

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
| 成长/任务 | `src/features/growth/README.md` |
| 报告/日报 | `src/features/report/README.md` |
| 登录/注册 | `src/features/auth/README.md` |
| 个人设置 | `src/features/profile/README.md` |
| 前端 API 层 | `src/api/README.md` |
| Store 层 | `src/store/README.md` |
| Serverless API | `api/README.md` |
| 输入分类/词库 | `src/services/input/` 目录 + `docs/ACTIVITY_LEXICON.md` |
| 魔法笔 | `src/services/input/magicPenParser.ts` + `docs/MAGIC_PEN_CAPTURE_SPEC.md` |

### Step 3 — 文件层（L3，按任务选读）

读目标文件头部 `DOC-DEPS:` 声明，了解依赖关系，再读文件正文。

---

## 📋 文档权威顺序

如果两份文档存在冲突，以下顺序靠前的为准：

1. `LLM.md`（本文件）
2. `docs/CURRENT_TASK.md`
3. `docs/PROJECT_MAP.md`
4. 各模块 `README.md` / `DOC-DEPS:` 头声明
5. `docs/CHANGELOG.md`

---

## ⚙️ 编码规范（必须遵守，不得讨价还价）

### 文件与函数规模

- 文件行数 **≤ 400 行**（警告），**≤ 1000 行**（硬限，必须拆分再提交）
- 单函数 **≤ 30 行**（超限提取到 `lib/` 或 `*Actions.ts`）
- 嵌套层数 **≤ 3 层**，`if/else` 分支 **≤ 3 个**

### 架构分层规则（4 层，不可跨层调用）

| 层 | 目录 | 规则 |
|----|------|------|
| UI 层 | `src/features/` | 只调用 store，不直接调用 Supabase / API / service |
| 状态层 | `src/store/` | 调用 `services/` 或 `api/`，不直接写 SQL |
| 业务逻辑层 | `src/services/` | 纯 TypeScript，不依赖 React（为 RN 迁移保留） |
| 数据访问层 | `src/api/` + `api/` | 前端统一走 `src/api/client.ts`，密钥只在 `api/*.ts` 中读取 |

### 架构边界（红线）

- 前端 `src/**` **禁止直连第三方 AI 密钥或 SDK**（OPENAI_API_KEY、CHUTES_API_KEY、QWEN_API_KEY、ZHIPU_API_KEY 均只能在 `api/*.ts` 中读取）
- AI 请求统一走 `src/api/client.ts` → `api/*` serverless handler
- 密钥只从 `process.env` 读取，任何形式的硬编码都是违规
- 新页面只能放在 `src/features/*`，禁止在其他位置新建
- Vercel Hobby 部署红线：Serverless Functions 总数上限 12。**默认禁止新增独立 `api/*.ts` 函数文件**；如需新能力，优先并入现有端点查询/路由分支，或先删除/合并旧函数后再新增（除非用户明确要求迁移 Team Pro）

### 代码质量

- 禁止硬编码中文字符串，必须用 `t('key')` 引用 i18n 翻译 key
- 类型安全：禁止新增无必要的 `any`，接口变更必须同步更新类型定义
- 禁止向生产代码新增裸露 `console.log`，必须用 `import.meta.env.DEV && console.log()`
- 优先复用现有 helper 与 i18n key，避免重复逻辑
- 包管理器统一使用 **npm**，锁文件为 `package-lock.json`，禁止提交 `pnpm-lock.yaml`

### 文案规范（⚠️ 涉及用户可见文字必须先确认）

**任何面向用户的文案**（通知文案、Teaser 文案、UI 提示文字、AI 人格台词等）在新增或修改前，**必须先与用户确认以下两点，确认后才可动代码**：

1. **存储方式**：走 `i18n` key（前端/后端 i18n 文件统一管理）还是服务端硬编码（`api/*.ts` 中的 string 常量）？
2. **翻译来源**：三语版本（中/英/意）是**人工写作**（用户或专人提供）还是**机器翻译**？——默认要求人工写作，禁止直接机器翻译用户可见文案。

> 违反此规范的典型错误：在 `api/diary.ts` 的英文/意大利文模板中保留中文变量名（`{情绪词}`），或未经确认自行将中文文案机器翻译成英文/意大利文。

### 提交规范

- 每次提交只做一个主题（安全 / 文档 / 单模块拆分，不混用）
- PR 描述必须包含：变更范围、风险点、回滚点、验证结果

---

## 🔁 回环检查（每次提交前必须执行）

**快捷方式**（推荐，包含 secrets + max-lines + docs-sync + tsc）：
```bash
npm run lint:all
```

**逐项执行**：
```bash
npm run lint:secrets            # 密钥泄露检查
npm run lint:max-lines          # 文件行数检查（>400 警告，>1000 报错）
npm run lint:docs-sync          # 文档同构检查（DOC-DEPS 存在性）
npm run lint:state-consistency  # 状态一致性检查（代码改动是否同步了文档）
npx tsc --noEmit                # TypeScript 类型检查
npm run test:unit               # 单元测试（修改 services/ 或 lib/ 时必跑）
npm run build                   # 构建验证（关键改动后执行）
```

**任何一项不通过，不允许提交，先修复再提交。**

---

## 📐 文档同步矩阵（改了代码必须同步改文档）

| 改动类型 | 必须同步更新的文档 |
|----------|------------------|
| 路由 / 页面入口变更 | `docs/PROJECT_MAP.md` + 对应 `src/features/*/README.md`（如已存在）|
| API 请求/响应契约变更 | `api/README.md` + `src/api/README.md`（如已存在）|
| Store action / state 变更 | `src/store/README.md` |
| 目录结构 / 边界变更 | `LLM.md` + `CLAUDE.md` + `docs/PROJECT_MAP.md` |
| 任意 `src/**` 或 `api/**` 代码改动 | `docs/CHANGELOG.md`<br>`docs/CURRENT_TASK.md` |

新增关键文件时，必须在文件头 20 行内包含 `DOC-DEPS:` 声明。

> **注意**：`LLM.md` 与 `CLAUDE.md` 内容必须保持同步，改动 `LLM.md` 后同步覆盖 `CLAUDE.md`。

---

## 🚫 禁止事项

1. 禁止新建平行的"主计划"文档
2. 禁止在 `src/features/*` 之外新建页面组件
3. 禁止在结构或接口变更后跳过 `npm run lint:docs-sync`
4. 禁止硬编码密钥、硬编码中文字符串、硬编码日期格式
5. 禁止在 `LLM.md` 或 `CLAUDE.md` 中写入线上服务的完整 URL（敏感信息走内部渠道）

---

## 🔗 关联文档快查

| 文档 | 用途 |
|------|------|
| `docs/CURRENT_TASK.md` | 当前任务焦点，新会话从这里恢复断点 |
| `docs/PROJECT_MAP.md` | 目录职责、核心边界、核心路径索引 |
| `docs/TSHINE_DEV_SPEC.md` | **iOS 开发规范**（技术栈、分层架构、移动端 UI、App Store 审核规避）|
| `docs/CHANGELOG.md` | 变更记录，每 PR 更新一次 |
| `docs/ARCHITECTURE.md` | 架构说明（真实实现，非愿景） |
| `docs/MAGIC_PEN_CAPTURE_SPEC.md` | **魔法笔实施规格**（AI 提取 + 前端校验 + draft review） |
| `docs/ACTIVITY_LEXICON.md` | 活动/心情多语言词库（Lexicon SSOT） |
| `CONTRIBUTING.md` | 贡献规范、包管理、回滚约定 |

