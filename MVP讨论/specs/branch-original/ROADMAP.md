# branch-original — ROADMAP

> branch-original 是按原计划 W1-W6 推进的路径: 先搭基础设施, 再调内容质量。

> 本文件描述每个 W 的范围、进入/退出条件、用到的 spec 文件、推迟项的状态。

---

## 路径定义

按 6 个开发窗口顺序推进, 每个窗口产出明确的 deliverables 给下个窗口。基础设施(Neon + Trigger.dev + Upstash + Next.js admin)先搭, 内容质量(prompts + 约束 + humanizer)在中后期窗口调。

---

## 路径假设

- 基础设施搭好后, prompt 直接产出可用质量的文章
- 5 个 intent_type 都有合理生成质量, 不需要细分 sub_pattern
- humanizer 规则 (L1 code + L2 LLM) 能拦截大部分 AI 味
- SerpAPI 抓 top-10 outline 对 gap 分析够用

---

## 路径风险

- **W4 才出第一篇文章**: 如果 W4 出来质量烂, W1-W3 的基础设施工作要回炉调
- **prompts 表 + 版本管理在 W2 建好**: 调 prompt 的成本比 MVP 高
- **5 个 intent 同时做**: 任何一个 intent 出问题就阻塞整个 release

**Fallback**: 如果走到 W3 还没出第一篇文章, 用户/Claude 应该考虑切到 branch-mvp 跑一篇看看, 而不是继续按计划往下。

---

## 路径触发条件 (何时选这条)

- advisor 要求看到完整系统而不是脚本
- 用户已经有把握 prompt 能产出质量(比如之前手写过类似文章)
- 需要早期 demo 给团队/客户看
- 已经把 branch-mvp 跑过一次, 验证过质量, 现在要工程化

---

## 6 个开发窗口

### W0 — 质量收敛 (前置门槛, 不是开发窗口)

> ⚠️ **W0 不是 branch-original 的窗口, 是进入 W1 的前置条件**。它就是 branch-mvp 的质量迭代阶段。

**门槛**: branch-mvp 必须先把文章质量迭代到稳定 — 连续 2-3 篇不同关键词的文章通过 review.md 的 10 个维度。

**为什么是前置**: 整个项目重心是文章质量 (见 README "项目核心")。质量没稳定就进 W1 搭基础设施, 等于把没调好的 prompt/约束固化进工程, W4 出文章发现烂就 W1-W3 回炉。

**W0 完成的标志**:
- branch-mvp 的迭代循环 (DECISIONS_v3 §F) 收敛
- 有连续多篇稳定文章 + 对应的稳定 prompts (`mvp/prompts.ts`) + 稳定约束 (已落 inherited_rules §9)
- 用户**明确决定要规模化** (产量低的话可以一直留在 branch-mvp, 不进 W1)

**没过 W0 不要进 W1**。如果有人 (包括 advisor) 要求跳过质量迭代直接搭系统, 在 README "项目核心" 里有反驳依据。

---

### W1 — Schema + Infrastructure

**Scope**:
- Neon Postgres 建项目 + pgvector extension
- Drizzle ORM 配置 + 写 migrations
- 25 个表全部建好 (不包括已删除的 skeleton_templates 表)
- Trigger.dev v3 cloud free tier 连上
- Upstash Redis free tier 连上
- Next.js 15 App Router 项目搭起来, TypeScript strict
- shadcn/ui 装好
- 基础 admin 空壳: 一个登录页 + 一个空 dashboard

**Entry criteria**:
- ✅ DECISIONS_v3.md 中决策 4 (§9 重构) 已落到 inherited_rules.md
- ✅ 决策 5 (role_in_arc enum 20 值) 已落到 data_shapes.md
- ✅ 决策 6 (skeleton_templates 表删除) 已落到 DATA_MODEL.md
- ✅ 决策 11 (gen_plan fork 点) 已落到 ARCHITECTURE.md
- ✅ `reference/env_vars.md` 写好
- ✅ `windows/W1.md` 写好

**Exit criteria**:
- 所有表在 Neon 上能查到 (`\d` in psql)
- Trigger.dev dashboard 显示项目连接
- Upstash 能 SET/GET (`redis-cli ping`)
- `npm run dev` 启动 Next.js, 浏览器看到空 dashboard
- 所有 migrations 在 `lib/db/migrations/` 下, 可重放

**Spec files used**:
- CLAUDE.md (技术栈表)
- CONSTRAINTS.md (数据库访问限制 + B6 migrations 规则)
- DATA_MODEL.md (建表参考)
- reference/env_vars.md
- windows/W1.md

**Deliverables for W2**:
- 可用的 Drizzle client
- 可用的 Trigger.dev runtime
- 可用的 Upstash 连接
- 表 schema 完整
- 空 admin shell

---

### W2 — Knowledge Base + LLM Gateway

**Scope**:
- LLM Gateway 抽象层: `interface LLMGateway`, 实现 Moonshot adapter + DeepSeek adapter, 留 Anthropic adapter 占位
- prompts 表 + 版本管理 UI
- product_features 表 seed (用户提供的 ZIXEL 功能)
- product_features admin CRUD UI
- feature_steps admin CRUD UI
- competitors admin CRUD UI (初始空)
- forbidden_terms 表 seed (从 inherited_rules.md §11 + §15 抽取)
- content_sources 表 seed (从 inherited_rules.md initial_sources 抽取)

**Entry criteria**:
- W1 deliverables 都能用
- DECISIONS_v3.md J.1 (W1 前必做) 全部完成

**Exit criteria**:
- LLMGateway 能跑通: `await gateway.call("INTENT", { keyword: "test" })` 返回结果
- prompts 表里有 4 个初始 prompts (INTENT / PLAN / SKELETON / SECTION 各一个版本)
- admin 能查看/编辑 product_features
- humanizer_rules.md 至少 rule 1-5 的 L1 代码实现完成

**Spec files used**:
- ARCHITECTURE.md (LLM Gateway 设计)
- reference/llm_gateway.md (写完后)
- reference/model_recipes.md (写完后)
- inherited_rules.md (forbidden_terms / content_sources)

**Deliverables for W3**:
- 可用的 LLM Gateway
- 完整的 product_features
- 基础 humanizer L1 扫描函数

---

### W3 — Keyword main flow (ingest → intent → plan)

**Scope**:
- Keywords admin: import (CSV/paste) + list + detail
- gen_intent worker: keyword → intent_type + scenario
- SerpAPI 集成 + Redis 缓存 (7 天 TTL)
- gen_plan worker (DIRECTOR + ME 两个 fork): keyword + intent + competitor_outlines → suggested_outline
- gen_skeleton worker (全代码): validate_outline 逻辑实现
- 跑端到端: 一个关键词 import → intent 生成 → plan 生成 → skeleton 生成 (但还没生成 sections)

**Entry criteria**:
- W2 deliverables 都能用
- DECISIONS_v3.md J.2 (W3 前必做) 全部完成
  - inherited_rules §18 反贬损
  - inherited_rules §19 title 规则
  - inherited_rules §20 字数表
  - CLAUDE.md Help Don't Sell 第三原则 + anti-patterns
  - CONSTRAINTS.md A16/A17/A18 + A11/A12 修订

**Exit criteria**:
- 输入关键词 "dwg 文件打不开怎么办" → 系统生成 intent + plan + skeleton
- skeleton 通过 validate_outline 验证
- 失败重试逻辑跑通(LLM 选错 role → 重试 1 次 → 成功)
- generation_runs 表有完整 trace

**Spec files used**:
- inherited_rules.md (§4 intent_types, §9 约束表, §13 normalization, §16 EEAT, §18 反贬损, §19 title, §20 字数表)
- ARCHITECTURE.md (流水线设计 + fork 点)
- data_shapes.md (intent / plan / skeleton 的 JSONB shape)
- reference/api_contracts.md (写完后)
- reference/trigger_job_contracts.md (写完后)

**Deliverables for W4**:
- 可用的 gen_intent / gen_plan / gen_skeleton workers
- 一个端到端跑通的 keyword → skeleton 链路

---

### W4 — Article generation (skeleton → section → assemble)

**Scope**:
- gen_section worker (共享代码 + flow_mode overlay): 每个 role 一个 prompt 变体
- INTRO_PAIN prompt 实现 TL;DR 子规则 (DECISIONS_v3 §D)
- BRIDGE_TO_PRODUCT prompt 实现 Help Don't Sell pattern
- DIMENSION_ANALYSIS / LIMITATIONS_OF_CATEGORY prompt 实现 disparagement-free 写法
- FAQ prompt 实现 3 Q-A 结构
- Article assemble: 串联 sections, 生成 markdown
- Article admin: list + detail + section regenerate
- 跑端到端: 一个 skeleton → 完整 markdown 文章

**Entry criteria**:
- W3 deliverables 都能用
- DECISIONS_v3.md J.3 (W4 前必做) 全部完成
  - inherited_rules §21 信息增益
  - inherited_rules §22 Help Don't Sell 写作模式
  - inherited_rules §23 TL;DR 写作规则
  - prompts/section_intro_pain.md
  - prompts/section_bridge_to_product.md

**Exit criteria**:
- 输入 skeleton → 系统生成完整 markdown 文章
- 字数 ≥ 1500
- 含 ZIXEL/子虔 提及 ≥ 1 次
- 含 FAQ section (3 Q-A)
- INTRO_PAIN 首句是 TL;DR 风格
- Article 在 admin 可查看

**Spec files used**:
- inherited_rules.md (§7 ZIXEL features, §17 persona, §21-23)
- prompts/section_*.md
- data_shapes.md (section 的 JSONB shape)

**Deliverables for W5**:
- 可用的 gen_section worker
- 一个端到端跑通的 keyword → article 链路
- 至少 5 篇测试文章 (5 个 intent_type 各 1 篇)

---

### W5 — QC + hot-topic flow + Feishu publish

**Scope**:
- humanizer L1 完整实现 (rule 1-15 + rule 25/26/27/30)
- humanizer L2 实现 (rule 16-24 + rule 28/29)
- humanizer 豁免逻辑实现 (FAQ / DEFINITION / TL;DR)
- quality QC L1 + L2 实现
- Quality admin pages (pending / passed / failed)
- 热点流水线: hot_reports 表 + parse worker + topic select + 直接接 gen_plan
- 飞书 API 集成: push article 到 Storyblok 或飞书 doc

**Entry criteria**:
- W4 deliverables 都能用
- DECISIONS_v3.md J.4 (W5 前必做) 全部完成
  - humanizer_rules.md rule 25-30 + 3 个豁免
  - prompts/qc_humanizer_l2.md
  - prompts/qc_quality_l2.md
  - prompts/parse_hot_report.md

**Exit criteria**:
- Article 通过 QC → status = QC_PASSED
- Article 推送到飞书成功, 飞书 doc URL 回写到 publish_records 表
- Hot topic paste → 流水线跑通 → article 出
- QC failed article 在 admin 可以单段重生成

**Spec files used**:
- humanizer_rules.md (完整)
- inherited_rules.md (§16 EEAT — Schema.org JSON-LD)
- prompts/qc_*.md
- prompts/parse_hot_report.md

**Deliverables for W6**:
- 完整 QC 流水线
- 可推送的 publish 流程
- 跑通的热点流水线

---

### W6 — Admin UI completion + Runs viewer + Settings

**Scope**:
- 完成 IA.md 中所有页面 (10 个顶级 nav + 子页)
- Runs viewer: list + detail + retry + export JSON
- Settings: API keys / Model routing / Quality thresholds / Feishu / Cache / Experimental(隐藏)
- Settings > Experimental: 隐藏 toggle 让 ME mode 出现在 UI 中
- 键盘快捷键: `/` 搜索 / `n` 新建 / `esc` 关闭
- 完整 empty states / disabled tooltips / loading states / confirm dialogs

**Entry criteria**:
- W5 deliverables 都能用

**Exit criteria**:
- IA.md 所有路由都活, 没有死路径
- 完整 dashboard 显示 7 天趋势 + 运行中 jobs + 4 stat cards
- 系统能交付给非技术人(advisor 或编辑)使用

**Spec files used**:
- IA.md (完整)

**Deliverables for W7+**:
- 可上线的 v1 系统

---

## 推迟项状态总览

(对应 DECISIONS_v3.md §J)

### W1 启动前必做 (本窗口锁定方向, 下窗口落地)

| 项 | 状态 | 在 DECISIONS_v3 哪里 |
|---|---|---|
| inherited_rules.md §9 重写 | 🔵 方向锁定, 待落地 | §B |
| data_shapes.md role_in_arc enum 扩展 | 🔵 方向锁定, 待落地 | §C |
| DATA_MODEL.md 删 skeleton_templates 表 | 🔵 方向锁定, 待落地 | §B (代码替代表) |
| ARCHITECTURE.md fork 点文档化 | 🔵 方向锁定, 待落地 | §G |
| reference/env_vars.md | 🟡 完全没写 | (下窗口写) |
| windows/W1.md | 🟡 完全没写 | (下窗口写) |

### W3 启动前必做

| 项 | 状态 | 在 DECISIONS_v3 哪里 |
|---|---|---|
| inherited_rules.md §18 反贬损 | 🔵 方向锁定, 内容已草拟 | §F.2 |
| inherited_rules.md §19 title 规则 | 🔵 方向锁定, 内容已草拟 | §F.1 |
| inherited_rules.md §20 字数表 | 🔵 方向锁定, 内容已草拟 | §B.5 |
| CLAUDE.md Help Don't Sell 第三原则 | 🔵 方向锁定, 文本已草拟 | §H.1 |
| CLAUDE.md anti-patterns 追加 | 🔵 方向锁定 | §H.2 |
| CONSTRAINTS.md A16/A17/A18 新增 | 🔵 方向锁定, 内容已草拟 | §E.1/E.2/E.3 |
| CONSTRAINTS.md A11/A12 修订 | 🔵 方向锁定, 内容已草拟 | §E.4/E.5 |
| inherited_rules.md §16 EEAT 微调 | 🟡 方向描述, 细节未定 | §J.2 |

### W4 启动前必做

| 项 | 状态 | 在 DECISIONS_v3 哪里 |
|---|---|---|
| inherited_rules.md §21 信息增益 | 🔵 方向锁定 | §I.2 |
| inherited_rules.md §22 Help Don't Sell 写作模式 | 🔵 方向锁定 | §H.1 |
| inherited_rules.md §23 TL;DR 写作规则 | 🔵 方向锁定 | §D.2 |
| prompts/section_intro_pain.md | 🔴 全新, 没写 | §D.2 (含示例) |
| prompts/section_bridge_to_product.md | 🔴 全新, 没写 | §H.1 (含 pattern) |

### W5 启动前必做

| 项 | 状态 | 在 DECISIONS_v3 哪里 |
|---|---|---|
| humanizer_rules.md rule 25 (brand mention) | 🔵 方向锁定 | §I.1 |
| humanizer_rules.md rule 26 (external links) | 🔵 方向锁定 | §I.1 |
| humanizer_rules.md rule 27 (contact patterns) | 🔵 方向锁定 | §I.1 |
| humanizer_rules.md rule 28 (disparagement L2) | 🔵 方向锁定 | §F.2 |
| humanizer_rules.md rule 29 (information gain L2) | 🔵 方向锁定 | §I.2 |
| humanizer_rules.md rule 30 (title compliance) | 🔵 方向锁定 | §F.1 |
| humanizer_rules.md 3 个豁免 | 🔵 方向锁定 | §I.3 |
| prompts/qc_humanizer_l2.md | 🔴 全新, 没写 | rule 28/29 嵌入 |

### 推迟到验证后再决定

| 项 | 状态 |
|---|---|
| solve intent 加 sub_pattern (operation vs diagnosis) | ⏸️ 等 W3 验证 |
| typical_middle_roles / discouraged_roles 软引导 | ⏸️ 等 W3 验证 |
| keyword pre-check SOP 自动化 | ⏸️ 推迟到 v2 |

**Legend**:
- 🔵 方向锁定, 待落到 spec 文件
- 🟡 方向描述, 细节未定 / 完全没写
- 🔴 全新文件, 没写
- ⏸️ 推迟到验证后再决定

---

## 风险监控

如果出现以下情况, **立即停下来评估是否切到 branch-mvp**:

1. W2 完成后没法独立调用 LLM Gateway 产出像样的文本
2. W3 完成后 gen_plan 的 outline 验证失败率 > 50% (LLM 选 role 老是错)
3. W3 完成后 SerpAPI gap 分析效果差 (competitor_outlines 没用)
4. W4 完成后第一批文章质量明显不行 (字数烂 / AI 味重 / ZIXEL 提及生硬)

**切换路径**: 暂停 branch-original 当前窗口工作 → 用 branch-mvp 的脚本结构在 1 个窗口内跑出几篇文章 → review → 决定调哪里 → 回 branch-original 继续。

---

**END of ROADMAP (branch-original)**
