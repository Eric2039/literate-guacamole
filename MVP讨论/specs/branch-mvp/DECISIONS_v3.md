# DECISIONS_v3 — branch-mvp

> ⚠️ **下窗口必读**: 在改任何 spec 文件或写任何 MVP 脚本前, 你必须**完整读完本文件 + branch-original/DECISIONS_v3.md**。两者都不能跳。本文件只列 MVP 路径**与 branch-original 的差异**, 共享决策直接引用 branch-original/DECISIONS_v3.md。读完后向用户确认 "我已读完两份 DECISIONS_v3, 即将 [具体动作], 方向是 [一句话总结]" 才能动手。

> **本文件适用于 branch-mvp**(本地脚本路径, 跑 1 篇文章验证质量, 不搭基础设施)。如果走 branch-original, 看 `branch-original/DECISIONS_v3.md`。

---

## TL;DR — MVP 路径精简(30 秒看懂)

| 项 | MVP 怎么做 |
|---|---|
| 输入 | 1 个关键词 (用户指定) |
| 输出 | 1 个 markdown 文件 + 1 个 trace.json |
| 形态 | 本地 TypeScript 脚本 (`pnpm tsx mvp/run.ts`) |
| 不用 | Neon / Trigger.dev / Upstash / Next.js admin / Drizzle / Storyblok |
| 数据存储 | 文件系统 (markdown 出 + JSON 中间产物), **不连任何数据库** |
| LLM 调用 | 4 个 (classify_intent / gen_plan / gen_section × N / 可选 humanizer_l2) |
| Mode | 只 DIRECTOR (advisor 见的版本先) |
| Intent | 只支持 1 个 (默认 `solve`, 见 §C.1 理由) |
| 推迟到聚类阶段(§F.5) | keyword 聚类 + 跨文章差异化 |
| 推迟到工程化阶段(§F.6) | publish 检查 / humanizer 自动 QC / 5 个 intent 全做 / ME mode / Feishu 推送 / admin UI |

**MVP 的核心 = 质量迭代的起点**: 跑出文章 → 用户 review → 调 prompt/约束/字数 → 再跑, **反复迭代直到文章质量稳定** (见 §F)。MVP 不是"验证一次就工程化", 是围绕它持续迭代升级。工程化 (转 branch-original) 是质量收敛**之后**的可选下游, 不是迭代的目的。

---

## A. 继承 branch-original 的决策 (不重复)

以下 sections 在 `branch-original/DECISIONS_v3.md` 已定义, **完整继承**:

| Branch-original Section | 内容 | MVP 是否实施 |
|---|---|---|
| §A 写作要求 + 3 Conflict 解决 | 1500 字 floor, 软读 brand placement, 预选 SOP manual | **实施** |
| §B §9 重构 (核心 + 约束表 + 字数表 + gen_plan shape + validate 逻辑) | enum 是 role 库, 代码驱动结构 | **实施**(脚本里直接用约束表逻辑) |
| §C role_in_arc enum 20 值 + 复用决定 | 8 现有 + 12 新 | **实施**(脚本里 enum 当 string literal union) |
| §D TL;DR 是 INTRO_PAIN 子规则 | 首句陈述, prompt 子指令 | **实施**(prompt 写) |
| §G fork 点 = gen_plan, 两个 mode 都消费 SERP | competitor_outlines 两个 mode 都用 | **简化** — MVP 只跑 DIRECTOR, ME 暂不实施; competitor_outlines 用最简形态(SerpAPI 标题 + meta) |
| §H.1 Help Don't Sell 第三原则 | BRIDGE_TO_PRODUCT 写作 pattern | **实施**(prompt 写) |

---

## B. MVP 不实施的决策 (跑通后再回来)

| Branch-original Section | 不实施理由 |
|---|---|
| §E CONSTRAINTS A16/A17/A18 | MVP 输出是本地 markdown 文件, 不走 publish 流程, 无需 publish 检查。MVP 跑通后人工 review 文章是否合规, 通过后再写自动检查 |
| §F.1 A19 title 规则 | MVP 阶段 LLM 自由生成标题, 人工 review 标题质量; 自动检查推到 W5 |
| §F.2 A20 disparagement | MVP 阶段不做自动检测, 人工 review 段落是否贬损; humanizer rule 28 推到 W5 |
| §H.2 CLAUDE.md anti-patterns 追加 | 本来就是给 Claude Code 写代码用的, MVP 脚本一个文件, 不需要 |
| §I 全部 humanizer 新规则 25-30 | MVP 不做自动 QC, 全部人眼 review |
| §I.3 humanizer 豁免 | 跟规则 25-30 一起推 |
| §J.2-J.4 推迟项 (W3/W4/W5 前必做的项) | MVP 不走 W3/W4/W5, 这些项等 MVP 跑通后再考虑 |

---

## C. MVP 简化的决策

### C.1 只做 1 个 intent_type

**推荐选 `solve`**, 理由:

1. `solve` 是 ZIXEL 业务最直接相关的 intent (用户碰到 CAD 问题来搜)
2. `solve` 文章有明确的 HOW_TO_STEP 段, 可验证 LLM 写步骤段质量
3. `solve` 也是用户在窗口讨论中暴露设计缺口的 intent (operation vs diagnosis sub_pattern), MVP 跑出来后正好可以判断是否需要 sub_pattern

**备选 keyword (用户挑一个)**:
- "STP 文件是什么意思" → learn 类, 简单, 易验证 prompt 跑通
- "dwg 文件打不开怎么办" → solve operation 类
- "CAD 卡顿是什么原因" → solve diagnosis 类
- "AutoCAD 替代品" → replace 类, 反贬损要求最敏感, 适合验证 disparagement
- "DWG 和 DXF 的区别" → understand 类

**默认推荐 "dwg 文件打不开怎么办"** — solve operation 类, 是 ZIXEL 业务最相关的 intent + 文章结构对 LLM 挑战最大(要写真实的操作步骤)。

### C.2 prompts 写在脚本里, 不用 prompts 表

- branch-original 设计: prompts 进 DB 表, 有版本管理
- MVP: prompts 直接写成 TypeScript 常量, 单文件, 改完就 re-run

**理由**: prompts 表是 prompt 版本管理工具, MVP 阶段每个 prompt 只有 1 个版本(初版), 不需要表。

**违反 CONSTRAINTS B11 (no hardcoded prompts in code)?** 是的, **MVP 阶段明确豁免**。脚本顶部加注释:

```typescript
// ⚠️ MVP-ONLY: Prompts hardcoded here. Violates CONSTRAINTS B11.
// Once MVP passes quality validation, prompts move to DB per branch-original spec.
```

### C.3 ZIXEL 功能列表写在脚本顶部 const, 不连 DB

- branch-original 设计: product_features 表, 用户在 admin 维护
- MVP: TypeScript 常量数组, 从用户提供的 `Function 功能 产品介绍.md` 抽取

**理由**: 同 C.2 — 表是管理工具, MVP 阶段不需要管理。

### C.4 intent 约束表只用 forbidden + required

(继承 branch-original §B.4 决定)

不加 typical_middle_roles / discouraged_roles。LLM 在 gen_plan 阶段自由发挥, MVP 跑出来再看。

### C.5 SerpAPI 调用走最简路径

- branch-original 设计: Redis 缓存, 7 天 TTL
- MVP: 直接调 SerpAPI, 结果存本地 JSON 文件作为缓存, 同 keyword 24 小时内不重复调

**理由**: Redis 是工程化优化, MVP 阶段单次跑用本地文件够了。

### C.6 humanizer L1 只做最基本扫描

- branch-original 设计: humanizer_rules.md 完整规则 1-15 (L1 code)
- MVP: 脚本里加一个 `quickHumanizerScan()` 函数, 只扫 6 项:
  - 字数 (≥ 1500)
  - 含 ZIXEL/子虔 (rule 25 简化版)
  - 不含 emoji (rule 5)
  - 不含 forbidden_terms (rule 16-ish, 简化的 hardcoded 黑名单)
  - **不含 Kazik 禁用词清单** (新增, 引用 `reference/kazik_adaptation.md §1.1`)
  - 段落数 (5-9)

不做完整 15 条 L1 规则。**人眼 review 是主要 QC 手段**, MVP humanizer 是必须的最低底线, 不是完整自检。

---

## D. MVP 输出 spec

### D.1 文件输出

```
mvp/
├── run.ts                          # 主脚本
├── prompts.ts                      # 4 个 prompt (hardcoded)
├── constants.ts                    # ZIXEL features, forbidden terms, role constraints
├── output/
│   ├── {keyword-slug}-{timestamp}/
│   │   ├── article.md              # 最终产物, 给用户眼睛看
│   │   ├── trace.json              # 每个 LLM 调用的 input/output/tokens/cost
│   │   ├── plan.json               # gen_plan 输出, 单独保存方便 review
│   │   ├── review.md               # 空模板, 用户手填 review 结果
│   │   └── humanizer_scan.json     # quickHumanizerScan 结果
```

### D.2 trace.json shape

```typescript
type TraceEntry = {
  stage: "classify_intent" | "gen_plan" | "gen_section" | "humanizer_l2";
  role?: string;                    // gen_section 时记录哪个 role
  input: object;                    // prompt vars
  prompt_template_name: string;
  rendered_prompt: string;          // 完整 rendered prompt
  output_raw: string;               // LLM raw response
  output_parsed: object;            // JSON parsed
  model: string;
  provider: "moonshot" | "deepseek";
  tokens: { prompt: number; completion: number; total: number };
  cost_usd: number;
  duration_ms: number;
  timestamp: string;
};

type Trace = TraceEntry[];
```

### D.3 review.md 模板

```markdown
# Article Review — {keyword}

Generated: {timestamp}
Model used: {model}

## Quality dimensions

**基础维度 (现有 10 项)**:

- [ ] 字数达标 (1500+): {actual}
- [ ] 关键词自然嵌入 (无堆砌): _____ (eye check)
- [ ] ZIXEL/子虔提及 ≥ 1 次: {count}
- [ ] 无明显 AI 味: _____ (eye check)
- [ ] 段落逻辑通顺: _____
- [ ] 信息增益(一手经验/独家数据/整合性洞察): _____
- [ ] Help Don't Sell pattern in BRIDGE_TO_PRODUCT: _____
- [ ] FAQ section 有真实 Q-A: _____
- [ ] TL;DR 首句独立可读: _____
- [ ] 反贬损 (无贬低其他厂商): _____

**扩展维度 (每一篇必填, 覆盖文章质量的每个角度)**:

- [ ] AI 检测分数 / AI percentage: _____ (跑过 AI detector, 记录百分比 + 工具名, 例如 "GPTZero 18%")
- [ ] 段落级质量评分 (逐段标注): _____ (列出每一段是否过关, 不过关的段写原因)
- [ ] 关键词密度 (无堆砌, 自然分布): _____ (主关键词出现 N 次, 关键词密度 X%)
- [ ] 句长方差 (避免连续同长度): _____ (是否有连续 3 句以上句式长度相近的位置)
- [ ] 禁用词命中 (Kazik 清单 + ZIXEL 黑名单): _____ (数量 + 命中词)
- [ ] 信息增益的具体形式 (一手经验/独家数据/整合洞察, 至少 1 种明确出现): _____ (写明是哪种 + 在哪段)
- [ ] 可读性 (有无难懂的术语堆叠): _____ (是否有 3 句以上连续术语堆叠的段落)

## 发现的具体问题

(列具体段落 + 问题描述)

## 决策

[ ] Quality 过关 → 准备开始 branch-original W1 工程化
[ ] Quality 不过关 → 调以下事项再 re-run:
    - [ ] 调 prompt: _____
    - [ ] 调 §9 约束表: _____
    - [ ] 调 role_word_targets: _____
    - [ ] 加 sub_pattern (operation/diagnosis): _____

## 下窗口动作

(根据决策, 列具体下窗口该做什么)
```

---

## E. MVP 脚本结构 (供下窗口写 mvp/run.md 时参考)

```typescript
// mvp/run.ts (伪代码)

import { classifyIntent, genPlan, genSection, humanizerL2 } from './prompts';
import { validateOutline } from './constraints';
import { ZIXEL_FEATURES, FORBIDDEN_TERMS, ROLE_WORD_TARGETS } from './constants';

async function main() {
  const keyword = process.argv[2];  // "dwg 文件打不开怎么办"
  const mode: 'DIRECTOR' = 'DIRECTOR';  // MVP 锁定 DIRECTOR

  // Step 1: classify intent
  const intent = await classifyIntent(keyword);
  // intent_type: "solve", scenario: "..."

  // Step 2: SerpAPI 拿 competitor_outlines (最简: 标题 + meta)
  const competitorOutlines = await fetchSerpOutlines(keyword);

  // Step 3: gen_plan
  let plan;
  for (let attempt = 0; attempt < 3; attempt++) {
    plan = await genPlan({
      keyword,
      intent_type: intent.intent_type,
      flow_mode: mode,
      competitor_outlines: competitorOutlines,
      product_features: ZIXEL_FEATURES,
    });
    const validation = validateOutline(plan.suggested_outline, intent.intent_type, mode);
    if (validation.ok) break;
    plan.retry_reason = validation.reason;
  }
  if (!plan) throw new Error("gen_plan failed 3 attempts");

  // Step 4: gen each section in parallel
  const sections = await Promise.all(
    plan.suggested_outline.map((slot, idx) =>
      genSection({
        role: slot.role,
        brief_hint: slot.brief_hint,
        word_target: slot.estimated_words,
        keyword,
        intent_type: intent.intent_type,
        flow_mode: mode,
        thesis: plan.thesis_summary,
        product_features: ZIXEL_FEATURES,
        position: idx,
        total: plan.suggested_outline.length,
      })
    )
  );

  // Step 5: assemble markdown
  const articleMd = assembleArticle(plan, sections);

  // Step 6: quick humanizer scan (L1 only, 简化版)
  const scan = quickHumanizerScan(articleMd, FORBIDDEN_TERMS);

  // Step 7: 可选 L2 humanizer (LLM scoring)
  const l2Score = process.env.RUN_L2 ? await humanizerL2(articleMd) : null;

  // Step 8: write outputs
  await writeOutputs(keyword, articleMd, plan, sections, scan, l2Score, trace);

  console.log(`✅ Done. Article at output/${slug}/article.md`);
}
```

**关键细节**:
- Step 3 重试逻辑: 验证失败的 reason 反馈给下一次 gen_plan, prompt 里加 "上次失败原因: X, 这次避免"
- Step 4 并行: 各 section 互不依赖, 可以并发跑(节省时间, 但要注意 LLM rate limit)
- Step 6 简化版扫描见 §C.6

---

## F. 迭代框架 — 项目核心 (质量收敛)

> ⚠️ **这是整个项目的核心, 不是附属环节**。用户明确说: "我们这个要做的是围绕 MVP 进行迭代升级"。MVP 不是"验证一次就扔的脚手架", 而是**质量迭代的起点和载体**。整个项目的本质 = 反复跑 MVP → review → 调 → 再跑, 直到文章质量稳定到可用。

### F.1 迭代循环

```
              ┌─────────────────────────────────┐
              │                                 │
              ↓                                 │
   ┌──────────────────┐                         │
   │ 跑 MVP 脚本      │                         │
   │ (1 个关键词)     │                         │
   └────────┬─────────┘                         │
            ↓                                   │
   ┌──────────────────┐                         │
   │ 产出 article.md  │                         │
   │ + trace.json     │                         │
   └────────┬─────────┘                         │
            ↓                                   │
   ┌──────────────────┐                         │
   │ 用户 review      │                         │
   │ (review.md 10 维)│                         │
   └────────┬─────────┘                         │
            ↓                                   │
      质量稳定了吗?                              │
        ┌────┴────┐                             │
        ↓         ↓                             │
       否        是                             │
        │         │                             │
        │         ↓                             │
        │   ┌──────────────────┐                │
        │   │ 质量收敛 ✅       │                │
        │   │ 才考虑下游选择    │                │
        │   │ (见 F.4)         │                │
        │   └──────────────────┘                │
        │                                       │
        ↓                                       │
   ┌──────────────────────────────┐             │
   │ 定位问题 + 调整 (见 F.2)     │             │
   │ - 调 prompt                  │             │
   │ - 调 §9 约束表 (两 branch 同步)│            │
   │ - 调 role_word_targets       │             │
   │ - 调 role brief_hint         │             │
   │ - 考虑加 sub_pattern         │             │
   │ - 换关键词试不同 intent      │             │
   └────────┬─────────────────────┘             │
            └───────────────────────────────────┘
                    (回到顶部再跑)
```

### F.2 每轮迭代要调的东西 (按"调整成本"从低到高)

| 调整对象 | 成本 | 什么时候调 | 改哪里 |
|---|---|---|---|
| prompt 措辞 | 低 | AI 味重 / 关键词生硬 / ZIXEL 提及突兀 / 信息增益弱 | `mvp/prompts.ts` |
| role brief_hint | 低 | 某个段空洞 / 没写到点子上 | gen_plan prompt 里的 brief_hint 生成逻辑 |
| role_word_targets | 中 | 某段为凑字数注水 / 某段太短没深度 | `mvp/constants.ts` + DECISIONS §B.5 (两 branch 同步) |
| §9 约束表 | 中 | 段落组合不合理 / LLM 老选错 role | `mvp/constants.ts` + inherited_rules §9 (两 branch 同步) |
| 加 sub_pattern | 高 | solve operation/diagnosis 这类子类型差异 (见 branch-original §N.2) | keyword_intents 加字段 + 约束表两轴 |
| 换 model | 高 | Kimi/DeepSeek 输出质量天花板低 | LLMGateway 配置 |

**关键纪律**: 调 §9 约束表 / role_word_targets / enum 这些是 **spec 层改动**, 改了 branch-original 也要跟着改 (两条 branch 共享这些)。不要让 MVP 私自分叉 spec。每次改完更新本文件 §A 的"继承的决策"对应引用。

### F.3 质量稳定的判定标准

review.md 的 10 个维度 (见 §D.3) **连续 2-3 篇不同关键词的文章都过关**, 才算质量稳定。单篇过关不算 — 可能是运气。

特别关注:
- AI 味 (humanizer 维度) — 最难稳定
- 信息增益 — ZIXEL v1 主要靠整合性洞察 (见 branch-original §N.7)
- 反贬损 — replace/choose 类关键词最容易踩
- ZIXEL 提及自然度 — Help Don't Sell pattern 是否真落地

### F.4 质量收敛后的固定路径 (三阶段顺序, 都是必经)

质量收敛 (连续 2-3 篇不同关键词文章过 review) 后**必须**进入下一阶段。下游**不是**"要不要工程化"的二选一, 而是固定顺序:

```
阶段 1 (本阶段, MVP script) → 阶段 2 (聚类, 仍是 script) → 阶段 3 (工程化, branch-original)
```

MVP 阶段的 `mvp/` 文件 (`run.ts` / `prompts.ts` / `constants.ts`) **不丢弃**, 是后续两阶段的迭代基础。聚类阶段在 MVP 基础上扩展 (加聚类逻辑, 仍不引入 DB)。工程化阶段才把脚本重写成 Next.js workers。

三个阶段都是必经的, 不存在"产量低就一直停在脚本"这种结束态。Feishu 推送 / 自动 QC / 完整 humanizer / admin UI 都在工程化阶段, 都必做。

**MVP / 聚类阶段的产物怎么进工程化** (按 §F.6 整合):
- 迭代稳定的 prompts (`mvp/prompts.ts`) → seed 进 `prompts` 表 (W2)
- 迭代稳定的 §9 约束 → 已经写进 inherited_rules §9, 不变
- 迭代稳定的 ZIXEL features → seed 进 `product_features` 表 (W2)
- trace.json 样例 → W2 测试用例参考
- 聚类逻辑 → 进工程化时改成 worker, 不再单脚本
- **不能合并的**: 脚本本身 (用 Next.js workers 重写) / 文件 cache (用 Redis) / 硬编码常量 (用 DB)

---

### F.5 聚类阶段 (post-MVP, pre-engineering, 仍是 script)

**触发条件**: MVP 阶段连续 2-3 篇不同关键词文章过 review (质量稳定)。

**目标**: 让语义相近的关键词产出**差异化**文章 (不同 thesis / 不同 outline / 不同切入角度), 避免 SEO 自蚕食 (cannibalization)。

**形态**: 在 `mvp/` 基础上扩展 (新增 `mvp/cluster.ts` 等), 仍是脚本, **不引入** DB / admin / job queue。

**输入**: MVP 阶段的产物 (稳定的 prompts / constants) + 一组语义相近的关键词。

**输出**: 多篇 markdown, 每篇 thesis/outline 显著不同。

**不在范围 (都在 §F.6 工程化阶段)**:
- Feishu 自动推送
- 自动 QC (humanizer 完整 L1 + L2)
- humanizer 完整 15 条规则
- admin UI / DB / Trigger.dev

**详细 spec**: 本文件**不写**。聚类设计依赖 MVP 迭代暴露的问题 (例如 LLM 在语义相近关键词上是否倾向同一 thesis、competitor_outlines 是否需要差异化扰动等), 留到聚类专属窗口起手。

---

### F.6 工程化阶段 (mandatory, 转 branch-original W1-W6)

**触发条件**: 聚类阶段稳定 (一组关键词产出的多篇文章 review 都过关, 且彼此差异化明显)。

**必做 (不再是"可选下游")**:
- Feishu 自动推送 (替代 MVP / 聚类阶段的手动复制)
- 自动 QC (humanizer L1 完整 15 条 + L2 LLM 评分, 见 `reference/humanizer_rules.md`)
- 完整 inherited_rules / role 约束的 DB 化
- admin UI (W6)
- 5 个 intent 全做
- ME mode (可选, advisor 不要求)
- L4 活人感终审 (引用 `reference/kazik_adaptation.md §1.7` 改造版)

**路径**: 走完整 branch-original W1-W6 (见 `branch-original/ROADMAP.md`)。

**MVP / 聚类产物的迁移**: 按 §F.4 列表 seed 进 DB。

---

## G. 下窗口接手 (branch-mvp) 后第一个动作

```markdown
1. 读本文件 + branch-original/DECISIONS_v3.md (完整) + CLAUDE.md + 当前 inherited_rules.md + data_shapes.md
2. 向用户确认: "我已读完两份 DECISIONS_v3, 即将写 mvp/run.md 规格 + 开始 MVP 脚本"
3. 写 mvp/run.md (~250-400 行) — 按 §D / §E / §C 内容铺开
4. 询问用户选哪个 keyword (默认 "dwg 文件打不开怎么办")
5. 询问用户是否要在跑脚本前先改 §9 (本窗口推迟到下窗口的事)
   - 答 "改" → 改 inherited_rules.md §9 + data_shapes.md role_in_arc enum 后再写脚本
   - 答 "不改" → 直接写脚本, 约束逻辑硬编码在 constants.ts (违反 B7 / B11 MVP 豁免)
6. 写 mvp/constants.ts (ZIXEL features, role constraints, forbidden terms 等)
7. 写 mvp/prompts.ts (4 个 prompt)
8. 写 mvp/run.ts (主脚本)
9. 跑一次, 检查输出文件结构是否完整
10. 输出 article.md 给用户 review
```

---

## H. MVP 的关键警告

### H.1 MVP 是三阶段路径的第一阶段, 不是可能扔掉的脚手架

MVP 不是"工程系统的粗糙版", 也不是"可能扔掉的脚手架"。MVP 是三阶段路径的**第一阶段 (script)**, 聚类是**第二阶段 (仍 script)**, 工程化是**第三阶段 (Next.js)**。前两阶段的 `mvp/` 文件是后续迭代的基础, **不丢弃**。三个阶段都必经。

但 MVP 阶段内部, 不要加 admin UI / 数据库 / job queue — 那些是工程化阶段的范围。**用户明确说过**: "目前如果要做 MVP 必须要先把文章做好 质量把控好之后再说"。MVP 阶段把质量做好, 聚类阶段把跨文章差异化做好, 工程化阶段把规模 / 自动化 / 飞书 / QC 做好。

### H.2 不要把 MVP 优化变成 branch-original 重做

MVP 跑出来后, 调 prompt 是预期的。但**调 §9 约束表 / role_in_arc enum / 字数表** 这些是 spec 层决定, 改它们意味着 branch-original 也要跟着改。**保持两条 branch 同步**, 不要让 MVP 私自分叉。

### H.3 MVP 不写测试

测试是工程化的事。MVP 阶段, 跑 1 次出 1 篇文章, 人眼判断 = 测试。不要花时间写 unit test。

### H.4 MVP token 预算上限

预估单次 MVP 跑:
- classify_intent: ~500 token in, ~200 token out
- gen_plan: ~2k token in, ~1k token out
- gen_section × 7: 每次 ~1.5k in + ~400 out = ~13k total
- humanizer_l2 (optional): ~3k in, ~500 out

**单次跑 ~ 20k token, 用 Kimi K2 估算 ~ ¥0.05-0.1**。如果跑 3 次调 prompt, ¥ 0.3。**完全可以接受**。

---

**END of DECISIONS_v3 (branch-mvp)**
