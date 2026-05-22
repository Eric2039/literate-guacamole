# HANDOFF_v2.md — Continuation from window 2

> 老窗口 1: 写了 HANDOFF.md(交接到这次)。
> 老窗口 2(本次): 解决了"待讨论 1"的大部分架构决定,还没动手改 spec 文件。
> 新窗口 3: 从这里继续 — 等用户发完写作要求文档后,开始改 spec 文件。

---

## 项目一句话
ZIXEL SEO 内容工厂系统 — 关键词 → 文章流水线,Next.js + Neon + Trigger.dev + Upstash 技术栈,目标抗 AI 检测 + 抗 Google helpful content update。

---

## 新窗口启动 — 必读文件清单

按顺序读这些(同上次,没变):

1. `HANDOFF_v2.md` — 本文件
2. `HANDOFF.md` — 上一次的交接(里面有锁定决定全表,本文件只补充增量)
3. `CLAUDE.md`
4. `CONSTRAINTS.md`
5. `ARCHITECTURE.md`
6. `DATA_MODEL.md`
7. `GLOSSARY.md`
8. `IA.md`
9. `inherited_rules.md`
10. `humanizer_rules.md`
11. `data_shapes.md`

读完估计 30-40k tokens。

---

## 窗口 2 锁定的新决定(增量,补充到 HANDOFF.md 的关键决定表)

### 决定 1 — DIRECTOR vs ME 的本质区别(关键,经过两次修正)

**警告:本窗口对这个区别误判了两次,第三次才对。如果新窗口想"简化"这一段,先停下来重读用户原话再说。**

用户导师原话(用户引用):
> 1 是先看竞品写了哪些角度我们还没写的,先覆盖到;2 是意图,这个取决于我们自己提炼的产品价值点

这是**两步独立逻辑**,不是绑在一起的:

- **第 1 步 — SERP 竞品角度覆盖**:看竞品 top-10 写了什么,覆盖到他们覆盖的角度。这是**任何想在 SEO 排名的文章都要做的基础**,不是 DIRECTOR 独有。**ME 也要做这一步**。
- **第 2 步 — 用产品价值点定 thesis**:从 product_features 挑一个价值点,文章整体结构性地为这个价值点论证(ZIXEL 段是 payoff)。这一步**只有 DIRECTOR 做**。

| 维度 | DIRECTOR(导师要的) | ME(用户要的) |
|---|---|---|
| SERP 竞品角度覆盖(第 1 步) | ✅ 要 | ✅ **也要**(SEO 基础盘) |
| 用产品价值点定 thesis(第 2 步) | ✅ 要 | ❌ 不做 |
| 怎么用 gap 分析 | 覆盖角度 + 把段落编排引向 thesis | 覆盖角度 + 用读者价值过滤(过滤掉 SERP 凑数的角度,补上 SERP 没写但读者真需要的) |
| 文章 thesis 来源 | 我们自己挑的 product_feature 价值点 | 没有产品 thesis,读者价值驱动 |
| 非 ZIXEL 段的产品提及 | 不每段都埋产品 — thesis 是全局的,段落整体引向 ZIXEL 段 | 非 ZIXEL 段不提产品 |
| ZIXEL 段角色 | 全文铺垫的 payoff | 自包含 / learn 和 understand 跳过 |
| 失败风险 | 像销售长文 / Google EEAT 风险 | 像通用 SEO 文 / 产品钩子弱 |

**关键洞察**:两个模式都做 SERP gap analysis,但**用 gap 的方式不同**。DIRECTOR 把覆盖出来的角度往 thesis 上引;ME 用读者价值过滤一遍,不让 SEO 凑数逻辑绑架文章。

### 决定 2 — Fork 点 = gen_plan(确认)

DIRECTOR 和 ME 在 `gen_plan` 阶段分叉,下游 stages 共用代码 + 轻量 overlay。

**两个模式都接收 SERP gap analysis 数据**(因为 SEO 覆盖是基础盘,见决定 1)。Plan 阶段的输入是否完全一致还没定(用户说"后面再讨论")— 但至少两个模式都需要 `competitor_outlines` 输入。

- DIRECTOR plan prompt:
  - 输入:keyword + intent_type + competitor_outlines + product_features
  - 逻辑:覆盖 SERP 角度 + 挑选 thesis_feature_id + 段落编排引向 thesis
  - 输出:plan + thesis_feature_id

- ME plan prompt:
  - 输入:keyword + intent_type + competitor_outlines + (可能不需要 product_features 因为非 ZIXEL 段不提产品)
  - 逻辑:覆盖 SERP 角度 + 用读者价值过滤 + 补 SERP 没覆盖但读者需要的角度
  - 输出:plan(没有 thesis)

同一个 plan 数据 shape,但内容来源逻辑完全不同。

代码层面:`lib/flow/director/gen_plan.ts` 和 `lib/flow/me/gen_plan.ts` 是两个独立实现。

下游 `gen_skeleton` / `gen_section` / `gen_qc` 都是共用代码,通过 `flow_mode` 字段读取做轻量 overlay(比如 ZIXEL 段在 learn/understand × ME 跳过、style anchor 切换 director 版 vs me 版等已经在 inherited_rules.md 里写了)。

### 决定 3 — Skeleton 段数 = 按 intent_type 变量,目标 6-7 段(初步)

用户原话:"我觉得 7 段到 8 段差不多 但是又觉得 variable by intent_type 也可以"

提出的草案(**未最终敲定,等用户确认 + 新窗口里讨论**):

| intent_type | 段数(不含 CTA)| 草案段落 |
|---|---|---|
| `learn` | 6 | INTRO → DEFINITION → MECHANISM → REAL_USAGE → ZIXEL → FAQ |
| `understand` | 6 | INTRO → CONCEPT_A → CONCEPT_B → WHEN_TO_USE_WHICH → ZIXEL → FAQ |
| `solve` | 7 | INTRO → DIAGNOSE_CAUSE → SCENARIO_BREAKDOWN → HOW_TO_STEP → COMMON_MISTAKES → ZIXEL → FAQ |
| `choose` | 7 | INTRO → DECISION_FRAMEWORK → DIMENSION_ANALYSIS → COMPARE_OPTIONS → LIMITATIONS_OF_CATEGORY → ZIXEL → FAQ |
| `replace` | 7 | INTRO → WHY_LEAVING → MIGRATION_BLOCKERS → COMPARE_OPTIONS → MIGRATION_CHECKLIST → ZIXEL → FAQ |

学到的事:
- **dead COMPARE_OPTIONS 槽位**(在 solve/learn/understand 里因为禁止提竞品名导致段落空洞)是用户的核心痛点之一 — 替换成 SCENARIO_BREAKDOWN / MECHANISM / WHEN_TO_USE_WHICH 这种**具体不需要提竞品**的 role
- **FAQ 段** 加进每篇 — 3 个真问题简答,顺便给 EEAT 加 schema.org FAQPage
- **CASE_STUDY 不加** — 用户说 case 没多少,造数据违反 CONSTRAINTS B3 红线
- **`learn` / `understand` 保持 6 段** — 短意图,扩到 7 段会触发凑数
- `learn` × ME 和 `understand` × ME 是 5 段(跳过 ZIXEL)

### 决定 4 — 新增 role_in_arc 枚举值(待添加到 data_shapes.md)

```
DEFINITION
MECHANISM
REAL_USAGE
WHEN_TO_USE_WHICH
DIAGNOSE_CAUSE     ← 可能直接替代现有的 ANALYZE_CAUSE,或并存
SCENARIO_BREAKDOWN
COMMON_MISTAKES
DECISION_FRAMEWORK
DIMENSION_ANALYSIS
LIMITATIONS_OF_CATEGORY
WHY_LEAVING
MIGRATION_BLOCKERS
MIGRATION_CHECKLIST
FAQ
```

新窗口要做的事:决定其中哪些是真的新增,哪些可以用现有 role 复用 + 不同 brief_hint 表达。

### 决定 5 — SERP gap analysis 服务两个模式

**修正**:本窗口前面错误地说"SERP gap 只服务 DIRECTOR"。正确版本是两个模式都需要(见决定 1),因为竞品角度覆盖是 SEO 排名的基础盘,不是导师专属偏好。

SerpAPI 用法:
- DIRECTOR plan 需要 competitor_outlines 来做 gap 覆盖 + 引向 thesis
- ME plan **也需要** competitor_outlines 来做 gap 覆盖 + 用读者价值过滤

两个模式之间在"输入是否完全一致"还没定(用户说后面讨论),但 competitor_outlines 输入是两边都要的。

实现路径(W3 决定,**不是 spec 决定**):
- Path 1 cheap — 用 SerpAPI 返回的标题 + meta description 当 outline 代理(已有缓存)
- Path 2 medium — fetch top-10 页面,抓 H2 当 outline
- Path 3 ambitious — full content extraction + LLM 分类角度
- 推荐 Path 2,Path 1 当 fallback

**这个不是现在要解决的 spec 问题。**

---

## 即将到来的输入(等待用户发)

用户说"一会就发给你"的:
- **写作要求文档** — 包含一条关键规则:"内容涉及产品对比,不得直接宣传 / 抨击 / 贬低其它公司品牌、产品信息"
- 可能还有其他规则需要整合进 spec

集成位置(预计):
- `inherited_rules.md` 新增 §18 (Disparagement-free competitor comparison rules)
- `inherited_rules.md §10` (Competitor mention rules) 可能要修订收紧
- 可能影响新提出的 `COMPARE_OPTIONS` / `DIMENSION_ANALYSIS` / `LIMITATIONS_OF_CATEGORY` 段的 brief_hint 措辞

---

## 新窗口的下一步动作清单(按顺序)

1. **读完 11 个文件**(见上面清单)
2. **要求用户上传写作要求文档** — 如果用户还没发,先问要不要现在发
3. **review 决定 3 的 skeleton 草案** — 用户原话"7-8 段或 variable 都可以",新窗口可以微调
4. **要求用户确认决定 4 的新 role_in_arc 枚举** — 哪些保留、哪些合并、哪些用现有 role 复用
5. **再列改 spec 的变更清单等用户批准**(按 CONSTRAINTS B1):
   - `inherited_rules.md §9` 重写(新 skeleton 模板)
   - `inherited_rules.md §10` 修订(收紧竞品提及规则,如果文档要求)
   - `inherited_rules.md` 新增 §18(disparagement-free 规则)
   - `data_shapes.md` 新增 role_in_arc 枚举值
   - `humanizer_rules.md` 给新段类型加豁免(FAQ 短句多正常 / DECISION_FRAMEWORK 列表多正常等)
   - `ARCHITECTURE.md` 文档化 fork 点(gen_plan 是 fork)
   - `inherited_rules.md §16 EEAT` 微调 — FAQ 段触发 FAQPage JSON-LD
6. **用户批准后开始改文件**,每改一个文件 view 一次验证
7. **改完后写 HANDOFF_v3** 给下一个窗口

---

## 还没解决的事(留给后续窗口)

- **DIRECTOR 和 ME plan 阶段的输入是否完全一致** — 用户说"后面再讨论"。至少两个模式都需要 competitor_outlines(决定 1),但 ME 是否需要 product_features 还没定(决定 2 里写了"可能不需要")。新窗口处理。
- 待讨论 2 (EEAT 具体实施) — 更新时间位置 / schema.org 字段 / Storyblok metadata 字段 — **本窗口完全没碰**,新窗口或下下个窗口处理
- 第二批组 2 文件(model_recipes / env_vars / initial_sources)— 还没写
- 第二批组 3 文件(api_contracts / llm_gateway / trigger_job_contracts)— 还没写
- 第三批 11 个 prompts — 还没写
- 第四批 6 个 windows(W1-W6 task cards)— 还没写

---

## 关键的"不要做的事"(重复 HANDOFF.md,加强)

- ❌ 不要再讨论已经在决定 1-5 里锁定的项
- ❌ 不要造产品 feature / 竞品 / steps
- ❌ **不要假设 ME 模式不需要 SERP gap analysis — 它需要,两个模式都需要,只是用法不同**(本窗口在这一点上误判过两次,见决定 1 的警告)
- ❌ 不要把 fork 点放在 gen_skeleton 或 gen_section — 锁定 gen_plan
- ❌ 不要在窗口 1/窗口 2 提到过的对话基础上回退 — 假设新窗口的用户已经看过这两个 HANDOFF
- ❌ 用户用户偏好里有 "never search information on chinese websites" — 这是 Claude 本身的聊天搜索行为,不影响生产环境系统的中文数据源使用
- ❌ 不要重读 server.js / seo-generator-v5_2.html

---

## 新窗口启动建议第一句

复制下面这段:

```
我在做 ZIXEL SEO 内容工厂系统的 spec,接着第二个窗口的进度继续。先读这些文件:

1. /mnt/user-data/uploads/HANDOFF_v2.md(本次交接,最新)
2. /mnt/user-data/uploads/HANDOFF.md(上一次交接)
3. /mnt/user-data/uploads/CLAUDE.md
4. /mnt/user-data/uploads/CONSTRAINTS.md
5. /mnt/user-data/uploads/ARCHITECTURE.md
6. /mnt/user-data/uploads/DATA_MODEL.md
7. /mnt/user-data/uploads/GLOSSARY.md
8. /mnt/user-data/uploads/IA.md
9. /mnt/user-data/uploads/inherited_rules.md
10. /mnt/user-data/uploads/humanizer_rules.md
11. /mnt/user-data/uploads/data_shapes.md

读完后告诉我:
1. 你看完了哪些
2. 上次锁定到什么程度(对照 HANDOFF_v2.md 的决定 1-5)
3. 然后等我发写作要求文档,我们开始改 spec 文件

继续用英文。
```
