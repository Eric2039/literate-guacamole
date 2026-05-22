# GLOSSARY.md — Term definitions

> Every term in this system, defined once with a concrete example. When implementing, look here first.

---

## Pipeline stage terms

### `keyword`
A user-typed search phrase. Examples: `dwg文件怎么打开`, `免费CAD软件`, `STP和STEP区别`.

The original raw text plus a normalized version (lowercased, punctuation stripped, whitespace collapsed) and a sha256 hash for dedup.

Lives in `keywords` table.

---

### `intent` (also `keyword_intent`)
A specific interpretation of why someone searched a keyword. One keyword can have multiple intents.

Five mutually exclusive `intent_type` values (from previous version, kept verbatim):

| intent_type | What user wants | Example keyword |
|---|---|---|
| `learn` | Understand a concept | `STP文件是什么` |
| `solve` | Fix a specific problem | `dwg文件打不开` |
| `choose` | Pick from options | `免费CAD软件推荐` |
| `replace` | Switch from current tool | `AutoCAD替代品` |
| `understand` | Distinguish similar concepts | `DWG和DXF的区别` |

Each intent also has a **role** (target user role, 10 fixed values), **scenario** (the specific moment that triggered the search), **constraint** (implicit limit like "免费" or "不想安装"), **article_angle** (the specific framing for this article), and **category** (one of 10 fixed CAD categories).

Lives in `keyword_intents` table.

**Real example** (from intent generation output):
```json
{
  "keyword_type": "solve",
  "role": "结构工程师",
  "scenario": "收到同事发来的exb文件,自己电脑没有CAXA不知道怎么打开",
  "constraint": "不想安装新软件",
  "article_angle": "用浏览器在线打开exb文件,不用装CAXA",
  "category": "CAD文件",
  "flow_mode": "DIRECTOR"
}
```

---

### `scenario`
The specific moment that triggered the search. **Must contain a verb and a situation, not an abstract need.**

✅ Correct: `收到同事发来的exb文件,自己电脑没有CAXA不知道怎么打开`
❌ Wrong: `用户想了解exb格式` (this is a need description, not a scenario)
❌ Wrong: `工程师在工作中遇到问题` (too abstract)

---

### `article_angle`
A one-sentence statement of how this specific article frames the topic. Distinct from the article **title** (which is SEO-optimized phrasing of the angle).

✅ Correct: `用浏览器在线打开exb文件,不用装CAXA`
❌ Wrong: `如何打开exb文件` (this is a title, not an angle — too vague)

Lives in `keyword_intents.article_angle`.

---

### `differentiation_strategy`
A new field on `article_plans`. Records HOW this article differentiates from competitor SERP results. Four values:

| Value | Meaning | When used |
|---|---|---|
| `ANGLE_GAP` | Found a genuinely useful angle competitors missed | Use it as thesis |
| `DEPTH` | No strong gap, going deeper on a common angle | Compete on detail/concreteness |
| `STANDARD` | No special play, write a clean conventional article | Default when nothing else fits |
| `EXECUTION` | Saturated topic, compete purely on writing quality | Rare |

The strategy is decided by gen_plan after looking at SerpAPI results. **System never forces a gap**. If no useful gap exists, `STANDARD` is the right answer.

---

### `plan` (also `article_plan`)
The argumentative blueprint of an article. NOT the title. NOT the structure. The plan answers: "What is this article arguing, and why?"

Fields:
- `thesis` — one sentence the article exists to prove
- `key_points` — 3-5 sub-claims that must be made
- `narrative_arc` — JSON describing the flow (pain → cause → solution → close)
- `product_feature_ids` — which ZIXEL features the article will touch (can be empty)
- `competitor_diff_analysis` — what competitors emphasize that we'll avoid / where the gap is
- `avoid_topics` — what this article must NOT discuss
- `differentiation_strategy` — see above

**Real example**:
```json
{
  "thesis": "exb文件在没装CAXA的情况下,用云端在线工具能在30秒内打开并完成基本测量",
  "key_points": [
    "exb文件是CAXA电子图板的专有格式",
    "传统做法是装CAXA,但只为看图装一个GB级软件不划算",
    "云端在线工具不下载就能打开",
    "支持基本测量、标注、批注"
  ],
  "narrative_arc": {
    "intro": "describe the moment of receiving an exb",
    "context": "explain what exb is and why it's a problem",
    "solution_bridge": "introduce browser-based viewing",
    "product_mention": "ZIXEL 3D一览通 as one such tool",
    "close": "summarize"
  },
  "product_feature_ids": ["uuid-for-3d-viewer-feature"],
  "competitor_diff_analysis": {
    "common_focus": ["how to install CAXA", "alternative full CAD software"],
    "gap": "no article covers the cloud-only solution path"
  },
  "avoid_topics": ["pricing comparisons", "feature checklists"],
  "differentiation_strategy": "ANGLE_GAP"
}
```

---

### `skeleton` (also `article_skeleton`)
The section-by-section outline of an article, before any paragraph text exists. Structured data, not prose.

Fields:
- `title` — article title (SEO-friendly phrasing of thesis)
- `sections` — JSONB array of section objects

Each section object:
- `index` — int, ordering
- `tag` — `H2` / `STEPS` / `ZIXEL` / `CTA` / `INTRO`
- `title` — section heading text
- `brief` — what this section must cover, ≤50 chars
- `role_in_arc` — `INTRO_PAIN` / `ANALYZE_CAUSE` / `COMPARE_OPTIONS` / `HOW_TO_STEP` / `BRIDGE_TO_PRODUCT` / `CTA`
- `requires_steps` — bool, true if this section needs `feature_steps`
- `feature_id` — UUID, set when section is bound to a specific product feature (e.g., ZIXEL section, STEPS section)
- `words` — target word count range, e.g. `150-200字`

**Real example** (skeleton for a `solve` intent in DIRECTOR mode):
```json
{
  "title": "exb文件打不开?浏览器30秒搞定",
  "sections": [
    {
      "index": 0,
      "tag": "INTRO",
      "title": "前言",
      "brief": "收到exb却没装CAXA的尴尬时刻",
      "role_in_arc": "INTRO_PAIN",
      "requires_steps": false,
      "feature_id": null,
      "words": "100-150字"
    },
    {
      "index": 1,
      "tag": "H2",
      "title": "exb文件是什么,为什么打不开",
      "brief": "exb是CAXA专有格式,通用看图软件不支持",
      "role_in_arc": "ANALYZE_CAUSE",
      "requires_steps": false,
      "feature_id": null,
      "words": "150-200字"
    },
    {
      "index": 2,
      "tag": "H2",
      "title": "装CAXA和不装CAXA两条路",
      "brief": "对比本地装和云端在线两种方案的代价",
      "role_in_arc": "COMPARE_OPTIONS",
      "requires_steps": false,
      "feature_id": null,
      "words": "150-200字"
    },
    {
      "index": 3,
      "tag": "STEPS",
      "title": "用浏览器打开exb的具体步骤",
      "brief": "三步操作,从上传到查看",
      "role_in_arc": "HOW_TO_STEP",
      "requires_steps": true,
      "feature_id": "feature-uuid-3d-viewer",
      "words": "150-200字"
    },
    {
      "index": 4,
      "tag": "ZIXEL",
      "title": "推荐子虔Zixel 3D一览通",
      "brief": "本场景下选3D一览通的核心优势",
      "role_in_arc": "BRIDGE_TO_PRODUCT",
      "requires_steps": false,
      "feature_id": "feature-uuid-3d-viewer",
      "words": "150-200字"
    },
    {
      "index": 5,
      "tag": "CTA",
      "title": "CTA",
      "brief": null,
      "role_in_arc": "CTA",
      "requires_steps": false,
      "feature_id": null,
      "words": "30-50字"
    }
  ]
}
```

---

### `section` (also `article_section`)
A single written paragraph (or paragraph group) corresponding to one entry in the skeleton's sections array. The actual prose lives here.

Has its own `regeneration_count` field — sections can be rewritten independently of the rest of the article.

Lives in `article_sections` table.

---

### `narrative_arc`
A JSONB field on `article_plans` describing the article's emotional/logical flow. Different from skeleton — narrative_arc is the **plan**, skeleton is the **structure that implements the plan**.

**Real example**:
```json
{
  "intro": "open with the moment user encounters the problem",
  "context": "give background on why this problem exists",
  "options_review": "compare known approaches",
  "solution_bridge": "introduce the better approach",
  "product_mention": "mention ZIXEL as an example of the approach",
  "close": "summarize and CTA"
}
```

Keys are free-form (different intent types may use different keys). Values describe the intent of each phase, not the final wording.

---

### `role_in_arc`
A field on each skeleton section, telling `gen_section` what writing mode to use. Six values:

| Value | Writing behavior |
|---|---|
| `INTRO_PAIN` | Describe pain only. No solution. End with a question. |
| `ANALYZE_CAUSE` | Explain root cause. No product mention. |
| `COMPARE_OPTIONS` | Lay out approaches/competitors objectively. Brief, not exhaustive. |
| `HOW_TO_STEP` | Walk through steps from `feature_steps`. No padding. |
| `BRIDGE_TO_PRODUCT` | Connect prior section's problem to ZIXEL. Use product info from DB. |
| `CTA` | Fixed template, no LLM call. |

The section prompt receives `role_in_arc` and switches its instructions accordingly. This is the mechanism that prevents ZIXEL sections from sounding like generic H2 sections.

---

### `flow_mode`
Determines how the article pushes ZIXEL. Two values:

| Value | ZIXEL section | Voice |
|---|---|---|
| `DIRECTOR` | Always present | Strong push, sales-flyer voice |
| `ME` | Conditional on intent_type (omit for `learn` / `understand`) | Soft mention, "engineer talking to engineer" voice (includes the positive style anchor) |

Default at insert: `DIRECTOR`.
ME mode hidden behind Settings toggle "Show experimental flow modes" (off by default).

Lives in `keyword_intents.flow_mode`.

---

### `product_push_intensity` (relationship to flow_mode)

Derived from `flow_mode` × `intent_type`. Not a stored field — calculated at gen_plan time:

| flow_mode | intent_type | resulting intensity |
|---|---|---|
| DIRECTOR | any | `DIRECT` (strong push always) |
| ME | learn | `SOFT` (no ZIXEL section, mention if relevant) |
| ME | understand | `SOFT` |
| ME | solve | `BALANCED` (ZIXEL section yes, soft voice) |
| ME | choose | `BALANCED` |
| ME | replace | `BALANCED` |

Used internally to select skeleton template variant and to inject the right style anchor into the section prompt.

---

## Quality / safety terms

### `humanizer` (also "humanizer pass" / "humanizer check")
Two-layer check that an article doesn't sound AI-written.

**Layer 1 — code (mechanical patterns):**
- Regex against `forbidden_terms` table by category
- Detect "首先/其次/再次" sequences
- Detect "另外/此外/同时/还有" mid-paragraph
- Detect rule-of-three (forced 3-item lists)
- Detect dash overuse
- Count emoji in body
- Detect bold-phrase emphasis abuse

**Layer 2 — LLM (semantic patterns):**
- Does the writing feel like an engineer talking to an engineer?
- Are there forced transitions?
- Does the article admit limitations honestly (ME mode only)?
- Are claims specific (numbers, versions, steps) or vague?
- Does the structure feel mechanical (same template feel)?

Combined score 0-100. Threshold (default 70) in `quality_thresholds`. Fail → article goes to Quality > Pending. Pass → moves to next QC.

Named after Humanizer-zh repo (24 rule categories), though implementation is custom.

---

### `forbidden_terms`
Words/phrases that produce AI flavor. Categorized for severity-based scoring.

Categories:
- `MARKETING_HYPERBOLE` — 卓越/优质/极致/完美/全方位/一站式/革命性
- `EMPTY_VERBS` — 实现/做到/达到/进行/开展/推动/促进
- `VAGUE_QUANTIFIERS` — 大量/许多/多种/各种/广泛/众多
- `AI_SUMMARY_WORDS` — 综上所述/总而言之/由此可见/不难看出/可以发现/值得注意的是
- `STRUCTURE_CONNECTORS` — 首先/其次/再次/最后/综上/本文/总之
- `EMPTY_BENEFITS` — 提升/赋能/助力/打造/高效/便捷/强大
- `AI_OPENERS` — 随着数字化技术的不断发展/X是现代工程设计中不可或缺的/本文将为您详细介绍

Severity:
- `BAN` — appearance fails the article
- `WARN` — appearance deducts from humanizer score

Default seed data populates ~60 entries across categories.

---

### `quality_check`
Distinct from humanizer. Quality covers:
- Word count vs target
- Forbidden terms hit count
- Competitor mention rule violations
- Product feature accuracy (mentioned features all exist in `product_features`)
- Brand voice consistency (uses 子虔小编 persona)
- Structural coherence (sections connect properly)
- Uniqueness vs SERP (didn't accidentally write the same article as competitors)

Two layers like humanizer. Code layer catches mechanical issues. LLM layer judges semantic quality.

Lives in `quality_checks` table with `check_type` field distinguishing humanizer vs quality.

---

## Data layer terms

### `prompt`
A row in the `prompts` table. Each prompt is a string template with Jinja-style variables (`{{ product_features }}`, `{{ intent }}`, etc.) that get replaced at LLM call time.

Each row:
- `stage` — which pipeline stage (`INTENT`, `PLAN`, etc.)
- `version` — int, monotonic
- `is_active` — bool, one true per stage
- `content` — the full prompt text

Editing creates a new row. Old versions kept for traceability.

---

### `prompt_set`
A bundle of one active prompt per stage, snapshotted together. When an article is generated, the `prompt_set_id` is stored on the article — so even if prompts change later, you know exactly which set produced that article.

---

### `generation_run`
A record of one LLM call. Every call writes one row, success or failure. Contains input, output, tokens, cost, duration, model used, related entity. Source of truth for cost tracking, debugging, and prompt iteration.

---

### `embedding`
A 1024-dimensional float vector representing the semantic meaning of a piece of text. Used for:
- Keyword similarity (dedup keywords with same meaning)
- Intent dedup across clusters
- Article uniqueness check vs SERP

Generated by an embedding model (currently using Moonshot's embedding endpoint). Stored as `pgvector` type.

Two embeddings are "similar" if their cosine similarity > 0.85 (configurable).

---

### `cluster`
A grouping of related keywords. Computed in batch by `cluster_keywords` Trigger.dev job.

Two keywords belong to the same cluster if their embeddings have cosine similarity > threshold (default 0.75).

Used to dedup near-duplicate keywords and to inform intent generation (LLM sees "other keywords in the same cluster" for context).

---

### `LLMGateway`
The single abstraction layer through which all LLM calls go. Method signature:

```typescript
LLMGateway.call({
  stage: 'gen_plan',          // looks up active prompt + model routing
  input: { ... },             // structured input
  promptOverride?: string,    // optional, for sandbox testing
  modelOverride?: string,     // optional, for A/B testing
}): Promise<{
  output: any,                // parsed JSON response
  runId: string,              // generation_runs row ID
  tokensUsed: number,
  costUsd: number,
}>
```

Internally:
1. Reads `model_routing` for stage to pick provider + model
2. Reads `prompts` for stage's active version
3. Renders prompt with input via Jinja
4. Calls provider adapter (Moonshot / DeepSeek / Anthropic)
5. Parses + validates response
6. Writes `generation_runs` row
7. Returns

Provider adapters live in `lib/llm/adapters/`. Each implements a common interface so the gateway doesn't care which.

---

### `Jinja-style template`
String template with `{{ variable }}` placeholders. Example:

```
你正在为关键词「{{ keyword }}」生成意图。
当前 cluster:{{ cluster_name }}
产品信息:
{{ product_features }}
```

At call time, the gateway replaces `{{ ... }}` with values from the input object. Use `nunjucks` library (already in tech stack table).

---

## Hot topic terms

### `hot_report`
A whole parsed report from one of three sources (Feishu OpenClaw paste / AI HOT API / manual paste). One report contains multiple `hot_topics`.

---

### `hot_topic`
One selectable article subject extracted from a `hot_report`. Has its own status — user can `SELECT` topics to turn into articles, or `SKIP` them.

When selected, a `hot_topic` becomes a `keyword_intent` (with `hot_topic_id` filled in) and enters the main pipeline at the `gen_plan` stage, skipping `gen_intent` (because the topic already carries angle info from the report).

---

## Status enums (all SCREAMING_SNAKE_CASE)

| Entity | Statuses |
|---|---|
| keywords | `PENDING` → `NORMALIZED` → `CLUSTERED` → `INTENT_GENERATED`. Also `BLOCKED` / `SKIPPED` |
| keyword_intents | `PENDING` → `READY` → `SKIPPED` / `DUPLICATE` |
| article_plans | `PENDING` → `READY` / `SKIPPED` |
| article_skeletons | `PENDING` → `READY` |
| articles | `DRAFT` → `ASSEMBLING` → `WAITING_FOR_STEPS` (if needed) → `QC_PENDING` → `QC_PASSED` / `QC_FAILED` → `PUBLISHED` / `DEPRECATED` |
| hot_reports | `PENDING` → `PARSED` / `FAILED` |
| hot_topics | `PENDING` → `SELECTED` / `SKIPPED` → `GENERATING` → `DONE` / `FAILED` |
| generation_runs | `SUCCESS` / `FAILED` / `TIMEOUT` |
| publish_records | `PENDING` → `SUCCESS` / `FAILED` |

---

## Anti-glossary (what these terms are NOT)

- **plan** ≠ article structure (that's skeleton)
- **thesis** ≠ article title (title is the SEO version of thesis)
- **angle** ≠ thesis (angle is one sentence framing; thesis is the argument the article will prove)
- **section.brief** ≠ section.body (brief is what should be written; body is what was written)
- **role** (target user role on intent) ≠ **role_in_arc** (section's narrative function)
- **intent_type** ≠ **flow_mode** (intent_type is what user wants; flow_mode is how aggressively to push ZIXEL)
- **humanizer** ≠ **quality** (humanizer = AI-flavor detection; quality = correctness/coherence)
- **prompt** ≠ **prompt_set** (a prompt is one stage's instruction; a set is a bundle of all stages' prompts)
- **generation_run** ≠ **Trigger.dev run** (generation_run = one LLM call; Trigger.dev run = one job execution, which may contain multiple LLM calls)
