// mvp/prompts.ts
//
// ⚠️ MVP-ONLY: Prompts hardcoded as TS template literals. Violates CONSTRAINTS B11
// (no hardcoded prompts in code). MVP-stage exemption per branch-mvp/DECISIONS_v3 §C.2.
// Once MVP passes quality validation, these move to the `prompts` DB table per
// branch-original W2.
//
// Each prompt is a function that takes typed input and returns a string.
// The function bodies render markdown / plain-text prompts; the LLM call layer
// (mvp/llm.ts) adds any JSON-mode instructions and parses JSON.
//
// Spec mapping:
//   classifyIntent prompt   → inherited_rules.md §4 (intent definitions + disambiguation)
//                             + §6 (10 categories)
//   genPlan prompt          → branch-original/DECISIONS_v3.md §B.6 (gen_plan output shape)
//                             + §B.2/B.3/B.4 (constraints)
//                             + §G (fork point + SERP)
//   genSection prompt       → inherited_rules.md §1/§2/§3.2/§17 (anchors)
//                             + §10 (competitor mention rule)
//                             + §11 (forbidden terms)
//                             + branch-original/DECISIONS_v3.md §C.3 (role guidance)
//                             + §D.2 (TL;DR rule for INTRO_PAIN)
//                             + §H.1 (Help Don't Sell for BRIDGE_TO_PRODUCT)
//                             + kazik_adaptation.md §1.1 (forbidden phrases — LLM-side prevention)
//                             + kazik_adaptation.md §1.2 (forbidden punctuation)
//                             + kazik_adaptation.md §1.3/§1.4/§1.5/§1.6 (rhythm / disruption / visceral / colloquial subset)
//   humanizerL2 prompt      → branch-original/DECISIONS_v3.md §F.2 (disparagement)
//                             + §I.2 (info-gain check)

import {
  ALL_ROLES,
  CATEGORIES,
  FORBIDDEN_COMPETITORS,
  KAZIK_FORBIDDEN_PUNCTUATION,
  KAZIK_FORBIDDEN_TERMS,
  ROLE_WORD_TARGETS,
  ROLE_WRITING_GUIDANCE,
} from "./constants";
import type { IntentType, ProductFeature, RoleInArc } from "./constants";

// ---------------------------------------------------------------------------
// Shared anchors — inherited_rules.md §1 / §2 / §3.2 / §17
// ---------------------------------------------------------------------------

const PERSONA_ANCHOR = `子虔小编是一个真正用过CAD的人,在跟另一个用CAD的人说一件有用的事。`;

const ANTI_VERBOSE = `每段只说一件事,说完就停。出现「另外」「此外」「同时」「还有」说明在用一段说两件事,必须拆开或删掉其中一个。如果一句话删掉后意思没变,就删掉它。`;

const DIRECTOR_STYLE = `直白,不绕弯。一句话一件事,事情说清楚就停。不堆形容词,不用"高效便捷"这种没信息的词。该具体就具体——给数字,给步骤,给具体软件版本。读起来要像一个工程师在 IM 里跟同事讲一件事。`;

const ADDRESSING = `写作人称:全文用"你"或不出现第二人称(避免"用户""读者""大家"这类抽离称呼)。
不要用"对于 XX 工程师来说"这类按职业分组的开场。
不要总结性收尾(综上所述、总而言之等)。`;

// Kazik §1.3 + paragraph density — rhythm rules to prevent over-fragmentation
const RHYTHM_NOTE = `节奏规则 (本段, 严格遵守):

1. **默认是流畅段落** (prose), 不是逐句换行。多个相关短句应该用逗号 / 句号连成一段流动的文字。
2. 每个 H2 子段下面应该有 **2-4 段** 段落 (用空行分隔), **不是** 5-10 段碎片。
3. 段落内部句子直接连写, **不要每写一个句号就换行** — 同一段内的句子共享同一行直到段落结束, 让 markdown 自然 wrap。
4. 一句话独立成段是高级技巧, **整个段落里最多 1 次**, 用在情绪转折或关键 punchline 处, 不要每段都用。
5. 反例 (不要写成这样, 这是把一段拆成 3 段, 节奏碎):
   \`\`\`
   第一个错: 反复双击文件。
   你越急, 双击越快, CAD 进程堆了一串。
   正确做法: 先开任务管理器结束 CAD 进程。
   \`\`\`
6. 正例 (同样信息, 写成一段流动的 prose):
   \`\`\`
   第一个错是反复双击文件。你越急双击越快, CAD 进程堆了一串, 最后全卡死。这时候要先开任务管理器, 把所有 CAD 进程都结束, 再重新打开一次就好。
   \`\`\`
7. 长短句交替, 但**主体应该是中长句**, 不是连续短句。连续 3 句以上句式长度相近 (都是 6-10 字短句) = 节奏呆板。`;

// Kazik §1.4 / §1.5 — visceral memory (light dose, DIRECTOR less than ME)
const VISCERAL_NOTE = `写情绪和体验用体感记忆而不是知识性描述。例: "我当时就愣住了" 优于 "我当时很震撼"。DIRECTOR 模式低频用, 整篇 0-1 次足够。`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderKazikForbiddenList(): string {
  const items = KAZIK_FORBIDDEN_TERMS
    .map(({ term, replacement_hint }) => `  - "${term}" → 改用: ${replacement_hint}`)
    .join("\n");
  const punct = KAZIK_FORBIDDEN_PUNCTUATION
    .map(({ pattern, replacement_hint }) => `  - 标点 "${pattern}" → ${replacement_hint}`)
    .join("\n");
  return `下列词语在正文段落里绝对不要出现 (一旦出现立刻 AI 味暴露):
${items}

下列标点在正文段落里也不要用 (H2/H3 标题不受此限):
${punct}

复合短语 "随着 ... 的发展 / 随着 ... 的不断发展 / 在当今 ... 的时代" 也禁止 — 不要做这种宏大开篇, 从具体事件切入。`;
}

function renderForbiddenCompetitorList(): string {
  return FORBIDDEN_COMPETITORS.join(" / ");
}

function renderFeaturesShort(features: ProductFeature[]): string {
  return features
    .map(f => `- [${f.product} · ${f.priority}] ${f.feature_name}: ${f.description}  (价值: ${f.value_proposition})`)
    .join("\n");
}

function renderRoleEnumWithGuidance(): string {
  return ALL_ROLES
    .map(role => {
      const [min, max] = ROLE_WORD_TARGETS[role];
      return `  - ${role}  [${min}-${max}字]  — ${ROLE_WRITING_GUIDANCE[role]}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// LLM #1: classifyIntent
// ---------------------------------------------------------------------------

export type ClassifyIntentInput = { keyword: string };

export function buildClassifyIntentPrompt(input: ClassifyIntentInput): string {
  return `你是 SEO 关键词分类助手。给定一个中文 SEO 关键词, 你要做三件事:

1. 判断它属于哪个 intent_type (5 选 1):
   - learn:    读者想理解某个概念是什么 (例: "STP 文件是什么意思")
   - solve:    读者碰到具体问题想解决 (例: "dwg 文件打不开怎么办")
   - choose:   读者在做选型 (例: "免费 CAD 软件推荐")
   - replace:  读者想换工具 (例: "AutoCAD 替代品")
   - understand: 读者想区分相似概念 (例: "DWG 和 DXF 的区别")

   判断顺序 (优先级从高到低):
   - 含 "vs / 区别 / 差别 / 对比 X 和 Y" → understand
   - 含 "替代 / 替换 / 平替 / 换" + 产品名 → replace
   - 含 "推荐 / 排行 / 最佳 / 好用的 / 哪个" → choose
   - 含 "怎么办 / 不能 / 失败 / 报错 / 打不开 / 卡顿 / 慢" → solve
   - 其他 → learn

2. 写 1 句 scenario, 描述读者搜这个词时的真实处境 (不要泛泛, 越具体越好)

3. 从下面 10 个 category 选 1 个 (必须 verbatim 是其中之一):
${CATEGORIES.map(c => `   - ${c}`).join("\n")}

关键词: "${input.keyword}"

只输出一个 JSON 对象, 不要任何额外文字, 不要 markdown 代码块:

{
  "intent_type": "...",
  "scenario": "...",
  "category": "...",
  "reasoning": "1-2 句, 解释为什么分这个 intent"
}`;
}

// ---------------------------------------------------------------------------
// LLM #2: genPlan (DIRECTOR mode only in MVP)
// ---------------------------------------------------------------------------

export type GenPlanInput = {
  keyword: string;
  intent_type: IntentType;
  flow_mode: "DIRECTOR";
  competitor_outlines: Array<{ rank: number; title: string; snippet: string }>;
  product_features: ProductFeature[];
  forbidden_competitors: string[];
  retry_reason?: string;
  required_roles: RoleInArc[];
  forbidden_roles: RoleInArc[];
};

export function buildGenPlanPrompt(input: GenPlanInput): string {
  const competitorBlock = input.competitor_outlines.length === 0
    ? "(本次没有抓到竞品 outline, 你独立设计 outline)"
    : input.competitor_outlines
        .map(o => `  ${o.rank}. ${o.title}\n     ${o.snippet}`)
        .join("\n");

  const retryBlock = input.retry_reason
    ? `\n\n🚨 上一次输出未通过验证, 失败原因:\n   ${input.retry_reason}\n\n请这次严格避免该问题, 仔细看下面的 "硬性约束" 和 "合法末尾模式" 部分。\n`
    : "";

  return `${PERSONA_ANCHOR}
${retryBlock}
你的任务是为一篇中文 SEO 长文 (≥ 1500 字) 设计 outline (大纲 + 段落规划)。这是 DIRECTOR 模式 — 文章要稳健推 ZIXEL 产品。

---

## 输入

关键词: "${input.keyword}"
intent_type: ${input.intent_type}
flow_mode: DIRECTOR

竞品 SERP 前 10 outline (你要从中找空隙, 写出差异化 thesis):
${competitorBlock}

可用 ZIXEL 产品特性 (从中选 1 个作为 thesis_feature_id, 用 "<product> · <feature_name>" 格式标识):
${renderFeaturesShort(input.product_features)}

---

## 可选 role (20 个段落能力库)

挑 5-9 个 role 组成 outline, 每个 role 已标了写作定位和字数区间:
${renderRoleEnumWithGuidance()}

---

## 硬性约束 (违反即被代码 reject, 重试浪费 token)

1. 段数 ∈ [5, 9]
2. 第一段 role 必须是 INTRO_PAIN
3. 最后一段 role 必须是 CTA (DIRECTOR 模式)
4. **末尾顺序**: BRIDGE_TO_PRODUCT → FAQ → CTA 必须是文章的最后三段, 或 BRIDGE_TO_PRODUCT → FAQ 作为最后两段, FAQ 紧接着 CTA (BRIDGE 后面只能跟 FAQ 和 CTA, 不能跟其他段)
5. FAQ 必含, 且 FAQ 必须紧跟在 BRIDGE_TO_PRODUCT 后面 (或就是倒数第二段)
6. 当前 intent (${input.intent_type}) 必含 role: ${input.required_roles.join(", ") || "(无)"}
7. 当前 intent (${input.intent_type}) 禁用 role: ${input.forbidden_roles.join(", ") || "(无)"}
8. 每段 estimated_words 必须落在对应 role 的 [min, max] 区间内
9. 全文 estimated_words 总和 ≥ 1500

---

## 合法末尾模式 (照这个走, 不要把 BRIDGE 放中间)

合法的末尾三段 (按段数取一个):

  - 7 段示例: \`[INTRO_PAIN, X, Y, Z, BRIDGE_TO_PRODUCT, FAQ, CTA]\`
  - 6 段示例: \`[INTRO_PAIN, X, Y, BRIDGE_TO_PRODUCT, FAQ, CTA]\`
  - 8 段示例: \`[INTRO_PAIN, X, Y, Z, W, BRIDGE_TO_PRODUCT, FAQ, CTA]\`

**违法示例 (不要这样做)**:

  - ❌ \`[..., BRIDGE_TO_PRODUCT, COMMON_MISTAKES, REAL_USAGE, FAQ, CTA]\` — BRIDGE 后面只能跟 FAQ 和 CTA
  - ❌ \`[..., HOW_TO_STEP, BRIDGE_TO_PRODUCT, SCENARIO_BREAKDOWN, FAQ, CTA]\` — 同上
  - ❌ \`[..., BRIDGE_TO_PRODUCT, ..., CTA]\` 中间有任何非 FAQ 段都违法

要在 BRIDGE 之前规划好所有正文段, BRIDGE 之后只允许 FAQ + CTA。

---

## 写作策略要求

- 选 differentiation_strategy:
  - ANGLE_GAP: 竞品没人写这个角度
  - DEPTH:     某个角度竞品写得浅, 你写深
  - STANDARD:  按标准结构稳健写
  - EXECUTION: 同样结构但执行 (步骤/数字/具体性) 远超竞品
- thesis_summary (1 句): 这篇文章想让读者带走的 ZIXEL 价值点是什么
- thesis_feature_id: 用 "<product> · <feature_name>" 格式, 必须是上面 ZIXEL 列表中存在的
- serp_gap_notes (可选): 1-2 句, 说明你从竞品 outline 看出的空隙

---

## 段落 brief_hint 写作要求 (核心, 决定全文是否变成广告)

🚨 **关键约束**: ZIXEL / 子虔 / 子虔科技平台 / 3D一览通 / 云原生3D CAD / PDM / 几何搜索 / 3D工艺大师 这些名字, **只允许出现在 BRIDGE_TO_PRODUCT 段的 brief_hint 里**。其他段的 brief_hint 一律不准提 ZIXEL 任何产品名 — 它们是为关键词 "${input.keyword}" 服务, 不是软广。

| Role | brief_hint 应该写什么 |
|---|---|
| INTRO_PAIN | 直接答关键词 + 引读者真实痛点。不提 ZIXEL。 |
| ANALYZE_CAUSE / DEFINITION / MECHANISM | 给真实的原因 / 定义 / 机制。不提 ZIXEL。 |
| HOW_TO_STEP | **针对 ${input.keyword} 真实可执行的解决步骤**。例: 这是 "dwg 打不开" 类问题, 该段应包含 "用 DWG TrueView 打开 / 检查文件版本兼容性 / 用 CAD 自带的 RECOVER 命令 / 转 dxf 中转格式" 等真实通用方案。不准只写 "用 ZIXEL 怎么怎么"。 |
| COMMON_MISTAKES | 真实错误纠正。不提 ZIXEL。 |
| SCENARIO_BREAKDOWN / REAL_USAGE | 真实场景叙事。可以**最多**带一句轻描淡写的 ZIXEL 提及, 但**不是必须**, 也**不要每个场景都提**。 |
| COMPARE_OPTIONS / DECISION_FRAMEWORK / DIMENSION_ANALYSIS / WHEN_TO_USE_WHICH | 客观比较各种通用解法 / 给判断框架。不点名 ZIXEL 作为答案。 |
| LIMITATIONS_OF_CATEGORY | 批"这类工具"的共同局限。不提 ZIXEL。 |
| **BRIDGE_TO_PRODUCT** | **唯一**自然带出 ZIXEL 的段。明确写: 先讲什么场景痛点, 然后带出 ZIXEL 哪个功能, 怎么具体解决。 |
| FAQ | 3 个**关于关键词主题**的真实问题, 不是 "ZIXEL 支持哪些操作系统" 这种产品 FAQ。 |
| CTA | (代码生成, brief_hint 写啥都行) |

🚨 整篇文章 ZIXEL 出现总次数应该 **3-6 次**, 集中在 BRIDGE_TO_PRODUCT 段。超过 8 次就是广告稿。

具体原则:
- 不写 "介绍 X" — 写 "讲 X 的 3 个具体场景"
- 不写 "解决问题" — 写要解决的**具体子问题**和**真实可操作步骤**
- FAQ 段的 brief_hint 要列出你建议的 3 个具体问题, 关于**关键词主题**而不是产品

---

## 反贬损

正文里不要出现这些竞品名 (本次 intent 是 ${input.intent_type}, 全篇禁止): ${renderForbiddenCompetitorList()}
即使是 LIMITATIONS_OF_CATEGORY 段, 也只批"这类工具"不点名厂商。

---

## 输出格式

只输出一个 JSON 对象, 不要任何额外文字, 不要 markdown 代码块:

{
  "thesis_feature_id": "<product> · <feature_name>",
  "thesis_summary": "一句话",
  "differentiation_strategy": "ANGLE_GAP" | "DEPTH" | "STANDARD" | "EXECUTION",
  "suggested_outline": [
    { "role": "INTRO_PAIN", "brief_hint": "...", "estimated_words": 150 },
    ...
  ],
  "serp_gap_notes": "..."
}`;
}

// ---------------------------------------------------------------------------
// LLM #3: genSection
// ---------------------------------------------------------------------------

export type GenSectionInput = {
  role: RoleInArc;
  brief_hint: string;
  word_target: number;
  word_min: number;
  word_max: number;
  keyword: string;
  intent_type: IntentType;
  flow_mode: "DIRECTOR";
  thesis_summary: string;
  thesis_feature: ProductFeature;
  product_features: ProductFeature[];
  position: number;
  total: number;
  scenario: string;
  category: string;
  serp_gap_notes?: string;
};

export function buildGenSectionPrompt(input: GenSectionInput): string {
  // Competitor rule per inherited_rules.md §10
  const competitorAllowed = (input.intent_type === "choose" || input.intent_type === "replace")
    && input.role === "COMPARE_OPTIONS";
  const competitorRule = competitorAllowed
    ? `本段允许提及竞品, 但每个竞品仅一句客观描述, 不展开优缺点, 不评价 (不要 差/烂/不行/落后 这类词)。`
    : `本段禁止出现任何竞品名称 (${renderForbiddenCompetitorList()})。即使在比较语境也不点名, 用 "传统工具 / 一些桌面端 CAD / 其他在线方案" 这类指代。`;

  // Role-specific addons
  const isIntroPain = input.role === "INTRO_PAIN";
  const isBridge = input.role === "BRIDGE_TO_PRODUCT";
  const isFaq = input.role === "FAQ";
  const isHowTo = input.role === "HOW_TO_STEP";
  const isLimitCat = input.role === "LIMITATIONS_OF_CATEGORY";
  const isRealUsage = input.role === "REAL_USAGE";

  // ZIXEL mention policy per role — keep article from becoming an advertorial
  const zixelMentionRule = isBridge
    ? `本段是文章里**唯一**自然带出 ZIXEL 的段, 按下面 Help-Don't-Sell pattern 来。`
    : isRealUsage
    ? `本段是叙事段, ZIXEL 提及**最多 1 次**且必须自然 (不要刻意安插)。也可以完全不提。`
    : input.role === "CTA"
    ? `(此段由代码生成, 此 prompt 不会被调用)`
    : `🚨 **本段绝对不准提及 ZIXEL / 子虔 / 子虔科技 / 3D一览通 / 云原生3D CAD / PDM / 几何搜索 / 3D工艺大师**。本段是为关键词 "${input.keyword}" 服务, 不是产品介绍。读者来搜这个词是想找答案不是看广告。如果你写到这些词, 段会被判为不合格重写。`;

  // No-fabrication rule for all sections
  const noFabricateRule = `🚨 **不准捏造数据**: 不要写 "支持高达 100MB / 不超过 10 秒 / 50+ 格式兼容 / 100% 兼容" 这类具体数字, 除非这个数字明确出现在下面 BRIDGE_TO_PRODUCT 段提供的 ZIXEL 产品描述里。如果数字未知, 用 "通常 / 一般 / 多数情况" 这类限定词, 或者直接不写数字。`;

  const tldrAddon = isIntroPain
    ? `\n## 本段额外要求 — TL;DR 首句规则\n本段首句必须是一个**自包含的陈述句**, 直接回答关键词 "${input.keyword}" 所问的问题。脱离上下文也能读懂 (这句话被搜索引擎答题框 / AI 引用时是合法独立的事实陈述)。然后第二句开始才转入痛点引入。\n示例 (关键词 "STP 文件是什么"): 第一句 "STP 文件是 STEP 标准格式的简写, 用于在不同 CAD 软件之间交换 3D 模型数据。" 然后第二句才开始 "很多设计师在用 ZIXEL 协作时, 经常碰到团队同事用 SolidWorks 导出的文件打不开..." (这是示例, 不要照抄)\n`
    : "";

  const bridgeAddon = isBridge
    ? `\n## 本段额外要求 — Help Don't Sell 写作 pattern (核心!)

❌ 错误示例: "我们的云原生 3D CAD 软件是市面上最好的, 快来购买吧!"

✅ 正确 pattern:
  1. 先讲场景痛点 (具体, 不泛泛): "在团队协作设计中, 很多人习惯通过邮件反复传输 CAD 文件, 不仅效率低, 还容易版本混乱。"
  2. 自然带出产品: "在这个案例里, 我们使用 子虔科技 ZIXEL <thesis 功能>, ..."
  3. 具体讲产品做什么 (功能 + 它怎么解决上面那个痛点, 不是吹有多好)
  4. 邀请体验, 不卖: "如果你也想体验这种 ..., 可以访问 [链接]" 或类似温和邀请

本段要植入的 ZIXEL 产品: ${input.thesis_feature.product}
本段要植入的核心功能: ${input.thesis_feature.feature_name}
功能描述: ${input.thesis_feature.description}
功能价值: ${input.thesis_feature.value_proposition}
全文 thesis: ${input.thesis_summary}

务必让读者感觉是"在帮我解决问题", 不是"在向我推销"。
`
    : "";

  const faqAddon = isFaq
    ? `\n## 本段额外要求 — FAQ 写法
- 用 markdown ### Q: ... 形式的子标题
- 3 个 Q-A pair (不要 2 个不要 4 个)
- 问题模仿 SerpAPI "People Also Ask" 风格, 像真用户搜的子问题
- 每个答 60-100 字, 直接给答案, 不绕
- 不重复 INTRO_PAIN 已经解释过的同一件事 — FAQ 是补充, 不是复读
`
    : "";

  const howToAddon = isHowTo
    ? `\n## 本段额外要求 — HOW_TO_STEP 写法
- 用编号列表 1. 2. 3. ...
- 每步一个动作, 不要把两步并在一条
- 写到具体: 软件版本, 菜单位置, 按钮名, 文件后缀
- 不要假装的操作步骤 (例如不要写 "进入设置 - 选择 - 点击" 这种空泛步骤); 不确定就只写概念性步骤, 但概念也要具体到能做
- 🚨 **本段必须列出多个通用方案** (例如 dwg 打不开类问题: 用 Autodesk DWG TrueView 打开 / 检查 dwg 文件版本 / 用 CAD 软件自带的 RECOVER 命令 / 转 dxf 中转格式 / 检查文件是否损坏)。本段不准提 ZIXEL — 它是解答关键词, 不是产品推广段。ZIXEL 留给后面的 BRIDGE_TO_PRODUCT 段。
`
    : "";

  const limitCatAddon = isLimitCat
    ? `\n## 本段额外要求 — LIMITATIONS_OF_CATEGORY 写法
本段是**反贬损**的核心承载段。批的是"这类工具"普遍存在的问题, 不点名任何具体厂商。例: "本地桌面端 CAD 这一类工具普遍存在文件版本混乱的问题", 不要写 "AutoCAD 文件版本混乱"。
`
    : "";

  return `${PERSONA_ANCHOR}

${ANTI_VERBOSE}
${RHYTHM_NOTE}

${DIRECTOR_STYLE}
${VISCERAL_NOTE}

${ADDRESSING}

---

## 你的任务

写一段中文 SEO 长文的某一段, 段在文章中的角色是: **${input.role}**

写作定位: ${ROLE_WRITING_GUIDANCE[input.role]}

本段在文章中的位置: 第 ${input.position + 1} 段 / 共 ${input.total} 段
本段字数目标: ${input.word_target} 字 (允许区间 ${input.word_min}-${input.word_max} 字)

---

## 上下文

关键词: "${input.keyword}"
intent_type: ${input.intent_type}
读者场景: ${input.scenario}
全文 thesis: ${input.thesis_summary}
category: ${input.category}
${input.serp_gap_notes ? `差异化机会: ${input.serp_gap_notes}` : ""}

本段 brief_hint (写什么): ${input.brief_hint}

---

## ZIXEL 提及规则 (本段特定)

${zixelMentionRule}

## 不捏造数据

${noFabricateRule}

## 竞品规则

${competitorRule}

---

## 禁用词清单 (kazik 整理, AI 痕迹极重, 一出现立刻暴露)

${renderKazikForbiddenList()}

---

## 禁用词清单 (内部黑名单, 选取严重的)

下列词在本段绝对不要出现 (BAN):
- 极致 / 完美 / 全方位 / 一站式 / 革命性 / 颠覆性 / 全新升级 / 重磅 / 业界领先 / 行业标杆

下列词慎用 (WARN, 用了得人眼判断是否替换):
- 提升 / 赋能 / 助力 / 打造 / 高效 / 便捷 / 强大 / 卓越 / 优质 / 优秀
- 大量 / 许多 / 多种 / 各种 / 广泛 / 众多 / 不少 / 相当多 / 大幅
- 实现 / 做到 / 达到 / 进行 / 开展 / 推动 / 促进 / 优化 / 完善 / 加强
- 应运而生 / 不可或缺 / 至关重要 / 举足轻重 / 不二之选 / 必备工具
${tldrAddon}${bridgeAddon}${faqAddon}${howToAddon}${limitCatAddon}
---

## 输出格式

只输出一个 JSON 对象, 不要任何额外文字, 不要 markdown 代码块:

{
  "h2_title": "本段的 H2 标题 (10-25 字, 含关键信号词, 不堆形容词)。INTRO_PAIN 段可固定 '前言' 但不建议; 给一个具体标题更好。FAQ 段固定 '常见问题'。CTA 段不会调到这个 prompt。",
  "markdown": "本段完整 markdown, 含 ## 标题行 + 段正文。段正文不要再有 H2/H3 (FAQ 例外, FAQ 段正文里用 ### Q: ... 作为子标题)。",
  "word_count": <段正文字数, 不含标题, 中文字符 + 英文 word 都算>
}`;
}

// ---------------------------------------------------------------------------
// LLM #4 (optional): humanizerL2
// ---------------------------------------------------------------------------

export type HumanizerL2Input = {
  full_markdown: string;
  keyword: string;
  intent_type: IntentType;
};

export function buildHumanizerL2Prompt(input: HumanizerL2Input): string {
  return `你是 SEO 文章 humanizer 评分员。你要从"是否有 AI 味 / 是否有信息增益 / 是否贬损竞品"三个角度评 1 篇中文 SEO 文章。

---

## 文章

关键词: ${input.keyword}
intent_type: ${input.intent_type}

\`\`\`markdown
${input.full_markdown}
\`\`\`

---

## 评分维度

1. ai_flavor_score (0-10, 越低越好): 这文章读起来像不像 AI 写的?
   - 检查项: 是否含 ${KAZIK_FORBIDDEN_TERMS.map(t => t.term).slice(0, 8).join(" / ")} 这类词; 段落结构是否过于工整; 是否有"活人感"细节
2. info_gain_satisfied (bool): 是否至少包含以下一项?
   - first_hand: 真实操作步骤 + 具体描述 + 实战错误
   - exclusive_data: 性能对比数字 / 使用统计 / 实测结果
   - integrative_insight: 把多个概念串联成更高层理解
   如果满足, info_gain_kind 标注是哪种, 出现在哪段。
3. disparagement_violations: 是否贬损其他厂商? 列出违反 snippet。客观描述不算违反; 评价性词汇 (差/烂/不行/落后) 算违反。
4. issues: 段落级别的问题 (空洞 / 复读 / 没回扣关键词 / 字数不足 / 等)。每个 issue 给 paragraph_idx (0-indexed) 和 suggestion。

---

## 输出格式

只输出一个 JSON 对象:

{
  "score": <0-100, 综合分>,
  "ai_flavor_score": <0-10>,
  "info_gain_satisfied": <bool>,
  "info_gain_kind": "first_hand" | "exclusive_data" | "integrative_insight" | null,
  "info_gain_location": "<在第几段, 1-indexed; null 如果不满足>",
  "disparagement_violations": [{ "snippet": "...", "reason": "..." }],
  "issues": [{ "paragraph_idx": 0, "issue": "...", "suggestion": "..." }]
}`;
}
