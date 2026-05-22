# ARCHITECTURE.md — System architecture

> Read once at start of W1, refer back as needed in later windows.

---

## 1. System overview

```
┌──────────────────────────────────────────────────────────────────┐
│                  Admin UI (Next.js App Router)                    │
│  Dashboard / Keywords / Hot Topics / Pipeline / Articles /        │
│  Quality / Knowledge Base / Prompts / Runs / Settings             │
└─────────────────┬────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              API Routes (Next.js Route Handlers)                  │
│  CRUD / trigger jobs / query state / serve admin                 │
└─────────────────┬────────────────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
┌──────────────┐    ┌────────────────────────────────────┐
│  Postgres    │    │   Trigger.dev v3 (Workers)          │
│  (Neon)      │    │                                     │
│  + pgvector  │◄───┤   ingest_keyword                    │
│              │    │   cluster_keywords                   │
│              │    │   gen_intent                        │
│              │    │   dedupe_intent                     │
│              │    │   gen_plan (DIRECTOR / ME)          │
│              │    │   gen_skeleton                      │
│              │    │   gen_section (per section)         │
│              │    │   assemble_article                  │
│              │    │   qc_humanizer (code + LLM)         │
│              │    │   qc_quality (code + LLM)           │
│              │    │   publish_feishu                    │
│              │    │   parse_hot_report                  │
│              │    │   fetch_aihot                       │
│              │    │   fetch_competitor_features         │
└──────────────┘    └──────┬──────────────────────────────┘
        ▲                  │
        │                  ▼
        │           ┌────────────────────────┐
        │           │  LLMGateway            │
        │           │  (single abstraction)  │
        │           │                        │
        │           │  → Moonshot (Kimi K2)  │
        │           │  → DeepSeek            │
        │           │  → Anthropic (reserved)│
        │           └──────┬─────────────────┘
        │                  │
        ▼                  ▼
┌──────────────┐    ┌────────────────────────┐
│ Upstash Redis│    │  External APIs         │
│  - SERP cache│    │  - SerpAPI             │
│  - job locks │    │  - aihot.virxact.com   │
└──────────────┘    │  - Feishu webhook      │
                    └────────────────────────┘
```

---

## 2. Main pipeline (regular keyword flow)

```
[user] paste CSV or text → /api/keywords/import
        │
        ▼
ingest_keyword
   - normalize (code: lowercase, trim, punctuation)
   - hash dedup (code: sha256)
   - check BLOCKED_KEYWORDS list (code)
   - generate embedding (LLM call: Moonshot embedding API)
   - insert into keywords table
        │
        ▼
cluster_keywords  (batch job, runs nightly + on-demand)
   - assign new keywords to clusters via embedding similarity
   - code only, no LLM
        │
        ▼
gen_intent  (per keyword, NOT per cluster)
   - inputs: keyword, cluster context, similar keywords
   - LLM produces 1-N intents (minimum 2, see §4.5)
   - for each intent: keyword_type, role, scenario, constraint, article_angle, category
   - default flow_mode = DIRECTOR (or ME if Settings toggle on AND user selected ME)
   - sanitize against valid enums (code)
        │
        ▼
dedupe_intent  (cross-cluster semantic dedup)
   - embedding similarity check against all existing intents
   - mark DUPLICATE if cosine > 0.90, skip downstream
        │
        ▼
gen_plan  (per intent)
   - inputs: intent, SerpAPI top 10 results, content_sources filter
   - LLM produces thesis, key_points, narrative_arc
   - LLM decides differentiation_strategy (ANGLE_GAP / DEPTH / STANDARD / EXECUTION)
   - LLM identifies product_feature_ids (can be empty)
   - inserts article_plans row
        │
        ▼
gen_skeleton  (per plan)
   - select base template by intent_type (code, SKELETON_TEMPLATES)
   - if flow_mode = ME and intent_type in (learn, understand), drop ZIXEL section (code)
   - LLM fills section titles + briefs (LLM, structured output)
   - assigns role_in_arc to each section (code)
   - assigns feature_id to STEPS and ZIXEL sections (code)
   - validates structure (code, against template skeleton)
        │
        ▼
gen_section  (per section, parallel)
   - selects prompt based on role_in_arc (different writing instructions per role)
   - CTA section: code-only, no LLM (fixed template)
   - STEPS section: code checks feature_steps exists; if not, article → WAITING_FOR_STEPS
   - inserts forbidden_terms by category into prompt (code → prompt variable)
   - injects product_features content for ZIXEL section (code → prompt variable)
   - injects upstream section ending for continuity (code)
   - streams LLM output, writes to article_sections.body
        │
        ▼
assemble_article  (code only, no LLM)
   - concatenates section bodies in order
   - adds title, meta description
   - generates final markdown
   - article status → QC_PENDING
        │
        ▼
qc_humanizer  (TWO LAYERS)
   - Layer 1 CODE:
     - regex scan forbidden_terms (BAN = fail, WARN = deduct)
     - detect "首先/其次/再次/最后" sequences
     - detect "另外/此外/同时/还有" mid-paragraph
     - count emoji in body (>0 = warn)
     - count bold phrases (>5 = warn)
     - rule-of-three detection (lists of exactly 3 items, regex)
     - dash overuse (>3 — in body = warn)
   - Layer 2 LLM (only if Layer 1 didn't auto-fail):
     - voice judgment ("engineer-to-engineer" vs "sales flyer")
     - admit-limitations check (ME mode only)
     - claim specificity (vague vs concrete)
     - structural feel
   - combined score 0-100
   - threshold check from quality_thresholds
        │
        ▼
qc_quality  (TWO LAYERS)
   - Layer 1 CODE:
     - word count vs target
     - all mentioned ZIXEL features exist in product_features
     - competitor mentions match competitors.policy rules
     - feature_steps used in STEPS sections match actual rows
   - Layer 2 LLM:
     - thesis coherence (does article prove what plan said it would)
     - structural transitions (do sections flow)
     - brand voice (子虔小编 persona maintained)
     - uniqueness vs SERP (semantic, not literal)
        │
        ▼
   If both QC passed:  status = QC_PASSED
   If either failed:    status = QC_FAILED, lands in Quality > Pending
        │
        ▼
publish_feishu  (manual or auto)
   - creates Feishu doc from markdown (reuse markdownToBlocks from previous version)
   - adds row to Feishu multi-dim table
   - publish_records row created
   - article status → PUBLISHED
```

---

## 3. Hot topic pipeline

```
[user input]
   ├─ paste Feishu OpenClaw report
   ├─ click "Fetch from AI HOT"
   └─ paste single news item
        │
        ▼
parse_hot_report
   - LLM extracts candidate topics
   - each topic: event_summary, why_hot, proposed_title, proposed_keywords, cluster_hint, score
   - inserts hot_reports + hot_topics rows
        │
        ▼
[user] selects topics in Hot Topics > Reports/Topics page
        │
        ▼
hot_topic_to_intent  (code, no LLM)
   - constructs a keyword_intent from hot_topic fields
   - flow_mode = DIRECTOR (default)
   - intent_type heuristic: solve if event mentions a problem, learn for tutorials,
     understand for explainers, choose for "X vs Y" topics
   - scenario derived from event_summary
   - article_angle = proposed_title (from report)
        │
        ▼
[enters main pipeline at gen_plan]
   - gen_plan runs with hot context (knows it's time-sensitive)
   - skips dedupe (hot topics race against time)
   - rest of pipeline identical
```

Hot articles get `articles.source_type = HOT` for analytics.

---

## 4. Key design decisions

### 4.1 LLM Gateway abstraction
All LLM calls go through `LLMGateway.call({stage, input})`. Internally:
1. Looks up active prompt for stage from `prompts` table
2. Looks up model + provider from `model_routing` table
3. Renders Jinja template
4. Calls correct provider adapter
5. Validates response shape
6. Logs to `generation_runs`
7. Returns parsed output

**Why**: providers swap by config change, not code change. When Claude API arrives, only update `model_routing` rows.

### 4.2 Default model routing (see reference/model_recipes.md)
| Stage | Primary | Fallback | Why |
|---|---|---|---|
| normalize_keyword | DeepSeek-V3 | Kimi K2 | Trivial task, cheap model fine |
| cluster_keywords | code only | — | Pure math, no LLM |
| gen_intent | Kimi K2 | DeepSeek-V3 | Needs Chinese intent understanding |
| dedupe_intent | code (embeddings) | — | Math only |
| gen_plan | **Kimi K2** | DeepSeek-V3 | Most important LLM stage |
| gen_skeleton | DeepSeek-V3 | Kimi K2 | Filling structured output |
| gen_section (普通) | DeepSeek-V3 | Kimi K2 | Volume stage, cheap fine |
| gen_section (ZIXEL) | **Kimi K2** | DeepSeek-V3 | Brand voice critical |
| gen_section (CTA) | code only | — | Fixed template |
| qc_humanizer (L1) | code only | — | Mechanical scan |
| qc_humanizer (L2) | DeepSeek-V3 | Kimi K2 | Semantic |
| qc_quality (L1) | code only | — | Mechanical |
| qc_quality (L2) | DeepSeek-V3 | Kimi K2 | Semantic |
| parse_hot_report | DeepSeek-V3 | Kimi K2 | Structured extraction |
| fetch_competitor | Kimi K2 | DeepSeek-V3 | Web page reading |

### 4.3 Prompts in DB, never in code
`prompts` table holds every prompt, versioned. `prompt_sets` bundles one prompt per stage. Each article records which `prompt_set_id` produced it.

Changing a prompt:
1. Edit in admin UI → creates new `prompts` row, version incremented
2. Set `is_active = true` on new row → old row's `is_active` flips to false
3. New articles use new prompt; old articles still trace to old version

### 4.4 Two-layer QC
Layer 1 is **code**, Layer 2 is **LLM**. Code runs first, fails fast on mechanical issues. LLM only judges what code can't.

Why: deterministic checks shouldn't cost tokens. ~70% of humanizer issues are catchable with regex.

### 4.5 Intent count rule
gen_intent prompt requires minimum 2 intents per keyword. From previous version's empirical finding: without this rule, LLM returns 1 intent and misses obvious angle splits.

Maximum 3. If LLM honestly can't find 3 distinct intents, 2 is fine.

### 4.6 Section regeneration
`article_sections` are independent rows. UI exposes "regenerate this section" per section. Worker re-runs `gen_section` with same inputs (new LLM call, new generation_runs row). `regeneration_count` tracks.

Use case: humanizer flags one section, fix only that section.

### 4.7 Article versioning
`articles.version_number` allows multiple versions per intent. Triggering "regenerate full article" creates a new row with same `intent_id`, incremented version. UI defaults to showing latest.

### 4.8 Differentiation strategy (NEW — addresses advisor concern)

`gen_plan` computes `differentiation_strategy` based on SerpAPI top 10 analysis. The system **never forces** finding a gap — that produced AI-flavored content in the previous version. Instead:

```
SerpAPI returns top 10 → LLM summarizes their common angles + gaps
   │
   ▼
LLM judges:
   - Is there a real user-relevant angle that competitors missed?
     → ANGLE_GAP
   - Is everyone covering the obvious angles but shallowly?
     → DEPTH (go deeper on a common angle)
   - Saturated, all competitors strong?
     → EXECUTION (compete on writing quality only)
   - None of the above clearly applies?
     → STANDARD (just write a clean article)
   │
   ▼
Strategy recorded on article_plans.differentiation_strategy
   - ANGLE_GAP → thesis is the gap topic
   - DEPTH    → thesis is a deeper take on the most common angle
   - STANDARD → thesis is the natural angle for this intent
   - EXECUTION→ thesis is the most actionable angle, doesn't try to differ
```

This prevents the "forced unique angle" problem.

### 4.9 Flow mode (NEW — addresses director vs your version)

| Aspect | DIRECTOR | ME |
|---|---|---|
| ZIXEL section | Always present | Omitted for `learn` / `understand` |
| ZIXEL section length | 150-200字 always | 100-150字 when present |
| Section prompt persona anchor | Stronger product framing | Adds positive style anchor with "admit limitations" |
| Allowed in: skeleton template | All 6 sections including ZIXEL | 5 sections without ZIXEL for some intents |
| Visibility in UI | Default | Hidden behind Settings toggle |

`flow_mode` lives on `keyword_intents.flow_mode`. Set at intent creation.

**UI behavior**:
- Default: every new intent created has flow_mode = DIRECTOR
- Settings has toggle "Show experimental flow modes" (off by default)
- When toggle on, intent creation form shows flow_mode dropdown
- Director-facing demos: toggle stays off, only DIRECTOR mode visible

**Module separation rule (important for maintainability)**:

Each flow mode lives in its own directory (`lib/flow/director/` and `lib/flow/me/`). They implement a common `Flow` interface defined in `lib/flow/types.ts`. Code that needs flow-specific behavior calls `resolveFlow(flowMode)` and uses the returned object — never reads `flowMode === 'DIRECTOR'` inline.

Reasons:
- Want to change ME mode? Edit `lib/flow/me/*` only. DIRECTOR is untouched.
- Want to add a third mode? Copy the directory and rename. No core code touched.
- Want to diff the modes? `diff -r lib/flow/director lib/flow/me` shows everything that differs.
- Want to A/B compare? Set `flow_mode` to other value on a keyword_intent — regeneration auto-uses the other ruleset.

`Flow` interface contract (in `lib/flow/types.ts`):

```typescript
export interface Flow {
  // Which skeleton template to use for this intent + plan
  getSkeletonTemplate(intentType: IntentType, planContext: PlanContext): SectionSpec[];

  // Extra instructions appended to base section prompt, by section role
  getSectionPromptOverlay(sectionRole: RoleInArc): string;

  // The voice anchor injected into section prompts
  getStyleAnchor(): string;

  // Whether the ZIXEL section should be omitted for a given intent
  shouldOmitZixelSection(intentType: IntentType): boolean;

  // Identifier for logging
  readonly modeName: 'DIRECTOR' | 'ME';
}
```

Then `flow-resolver.ts` is just:

```typescript
import { DirectorFlow } from './director';
import { MeFlow } from './me';
import type { Flow } from './types';

export function resolveFlow(flowMode: 'DIRECTOR' | 'ME'): Flow {
  return flowMode === 'ME' ? MeFlow : DirectorFlow;
}
```

Adding a new flow later = add `lib/flow/{name}/` + add a case to the resolver. Nothing else.

### 4.10 SerpAPI cache
Redis key `serp:{sha256(normalized_keyword)}`. TTL:
- Regular keywords: 7 days
- Hot topic keywords: 6 hours

### 4.11 Content source filtering
`content_sources` table classifies domains:
- `WHITE` — pass through (虎嗅/36kr/机器之心/量子位/InfoQ/CSDN/掘金)
- `GRAY` — passes through but plan-stage uses lower weight
- `BLACK` — filtered out (搜狐/百家号/UC大鱼号/网易号/新浪博客/聚合站)

Applied when SerpAPI results are passed to LLM at gen_plan.

### 4.12 Humanizer rules (Layer 1 code patterns)

Mechanical patterns checkable with regex / counts:
1. Forbidden term presence (per category, per severity)
2. "首先/其次/再次/最后" sequence detection
3. "另外/此外/同时/还有" mid-paragraph
4. Three-item list overuse (rule-of-three)
5. Emoji in body
6. Bold phrase count
7. Dash count (—)
8. Sentence average length (>40 chars = warn)
9. Adjective stacking (3+ adjectives in row)
10. Empty conclusion phrases ("综上所述/总而言之")
11. Banned openers ("随着...的不断发展")
12. Year mention without current year
13. Paragraph length (>200字 single paragraph = warn)
14. Header emoji
15. Identical sentence-start patterns across paragraphs

Layer 2 (LLM) handles:
16. Voice authenticity
17. Tone consistency
18. Forced transitions
19. Repetition of ideas under different words
20. Hollow specifics ("一些"/"许多" instead of numbers)
21. Conclusion-by-assertion (no evidence)
22. Limitations admitted (ME mode only)
23. Persona consistency
24. Reads-like-AI gut check (binary)

---

## 5. Directory structure

```
/
├── app/                          # Next.js App Router
│   ├── (admin)/
│   │   ├── dashboard/
│   │   ├── keywords/
│   │   ├── hot-topics/
│   │   ├── pipeline/
│   │   ├── articles/
│   │   ├── quality/
│   │   ├── knowledge/
│   │   ├── prompts/
│   │   ├── runs/
│   │   └── settings/
│   ├── api/                      # API routes
│   │   ├── keywords/
│   │   ├── intents/
│   │   ├── plans/
│   │   ├── articles/
│   │   ├── hot-topics/
│   │   ├── prompts/
│   │   ├── trigger/              # manual triggers
│   │   └── webhooks/
│   └── layout.tsx
│
├── trigger/                       # Trigger.dev jobs
│   ├── ingest-keyword.ts
│   ├── cluster-keywords.ts
│   ├── gen-intent.ts
│   ├── dedupe-intent.ts
│   ├── gen-plan.ts
│   ├── gen-skeleton.ts
│   ├── gen-section.ts
│   ├── assemble-article.ts
│   ├── qc-humanizer.ts
│   ├── qc-quality.ts
│   ├── publish-feishu.ts
│   ├── parse-hot-report.ts
│   ├── fetch-aihot.ts
│   ├── fetch-competitor.ts
│   └── trigger.config.ts
│
├── lib/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   ├── migrations/
│   │   ├── queries/
│   │   └── seed/
│   ├── llm/
│   │   ├── gateway.ts            # LLMGateway class
│   │   ├── adapters/
│   │   │   ├── moonshot.ts
│   │   │   ├── deepseek.ts
│   │   │   └── anthropic.ts      # reserved
│   │   ├── prompts.ts            # prompt fetch + render
│   │   └── types.ts
│   ├── humanizer/
│   │   ├── code-checks.ts        # Layer 1 mechanical
│   │   ├── llm-checks.ts         # Layer 2 semantic
│   │   ├── rules/                # individual rule modules
│   │   └── index.ts
│   ├── serp/
│   ├── feishu/
│   ├── aihot/
│   ├── redis/
│   ├── flow/                    # IMPORTANT: each mode is its own module
│   │   ├── README.md             # explains why two modes are physically separate
│   │   ├── types.ts              # Flow interface contract
│   │   ├── flow-resolver.ts      # resolves flow_mode → Flow object
│   │   ├── director/             # DIRECTOR mode files
│   │   │   ├── skeleton-template.ts
│   │   │   ├── section-prompt-overlay.ts
│   │   │   ├── style-anchor.ts
│   │   │   └── index.ts          # exports DirectorFlow
│   │   └── me/                   # ME mode files
│   │       ├── skeleton-template.ts
│   │       ├── section-prompt-overlay.ts
│   │       ├── style-anchor.ts
│   │       └── index.ts          # exports MeFlow
│   └── utils/
│
├── components/
│   ├── ui/                       # shadcn/ui
│   └── ...
│
├── specs/                         # this folder
│   ├── CLAUDE.md
│   ├── CONSTRAINTS.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── GLOSSARY.md
│   ├── IA.md
│   ├── windows/
│   ├── prompts/
│   └── reference/
│
├── .env.local
├── drizzle.config.ts
├── trigger.config.ts
└── package.json
```

---

## 6. Environment variables

```
DATABASE_URL=postgres://...@neon...
TRIGGER_API_KEY=...
TRIGGER_API_URL=...
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...
MOONSHOT_API_KEY=...
DEEPSEEK_API_KEY=...
ANTHROPIC_API_KEY=               # reserved, may be empty
SERPAPI_API_KEY=...
FEISHU_APP_ID=...                # required: Feishu app credential
FEISHU_APP_SECRET=...            # required: Feishu app credential
FEISHU_APP_TOKEN=...             # required: target bitable (multi-dim table) doc token
FEISHU_TABLE_ID=...              # required: target table ID within the bitable
FEISHU_FOLDER_TOKEN=...          # required: folder where new docx documents are created
FEISHU_WEBHOOK_URL=...           # OPTIONAL: bot webhook for failure alerts only (not used for article publishing)
```

See `reference/env_vars.md` for descriptions and where each is used.

---

## 7. Deployment (post-MVP)

- Vercel (Next.js)
- Neon (DB)
- Trigger.dev Cloud (jobs)
- Upstash (Redis)

Total floor: $0/month at free tiers (Neon free + Trigger.dev free + Upstash free). Upgrade Neon to Pro ($25) when DB > 500MB. Upgrade Trigger.dev when log retention pain (1-day retention bites first).

---

## 8. Migration path from old system

Previous version (server.js + HTML) is reference, not source. New system is fresh.

- Reuse the markdownToBlocks function for Feishu integration (copy verbatim to lib/feishu/)
- Reuse the BLOCKED_KEYWORDS list as initial seed for keyword block table
- Reuse DEFAULT_PRODUCT_LIBRARY as seed for product_groups / product_features
- Reuse SKELETON_TEMPLATES as defaults in DB skeleton_templates table
- Reuse the buildCompetitorRule logic in `lib/flow/director/` and `lib/flow/me/` (each flow has its own competitor handling)

Other code patterns from previous version are reference only — new system uses Drizzle, not raw SQL; uses Trigger.dev, not in-process; uses prompts table, not constants.
