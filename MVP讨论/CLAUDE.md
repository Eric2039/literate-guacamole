# CLAUDE.md — Global rules (read first, every window)

> Each new Claude Code window starts by reading this file in full, then `CONSTRAINTS.md`, then the relevant `windows/W*.md` task file. Only then start work.

---

## Project

ZIXEL SEO content factory. Turns keywords (and hot-topic events) into publish-ready Chinese SEO articles, pushes them to Feishu. Not a CRUD app — a **pipeline factory** where each stage is independent, recorded, retryable, and version-controlled.

Goal: high-volume, differentiated, AI-flavor-resistant content that survives Google helpful-content updates.

---

## Tech stack (do not change without updating this table)

| Layer | Choice | Notes |
|---|---|---|
| App framework | Next.js 15 App Router + TypeScript strict | |
| DB | **Neon Postgres** + pgvector | Supabase entry-point is reserved for later migration; code goes through Drizzle so swap is one env var |
| ORM | Drizzle | Not Prisma |
| Task queue | Trigger.dev v3 (Cloud free tier) | Idempotency keys mandatory |
| Cache | Upstash Redis (free tier) | SERP cache + distributed locks |
| Auth | None for v1 (single-user admin behind network restriction) | Add Clerk in W6 if needed |
| UI | shadcn/ui + Tailwind | No other UI lib |
| LLM providers | Moonshot (Kimi K2) + DeepSeek | Anthropic adapter reserved |
| External APIs | SerpAPI, aihot.virxact.com, Feishu Open API | Only these three. Feishu webhook is optional, used only for failure alerts. |

**No new dependencies without updating this table.**

### Database access restrictions (Neon ↔ Supabase portability)

To keep the door open for migrating Neon → Supabase later with zero code changes:

- **Required**: all DB access goes through Drizzle ORM
- **Forbidden**:
  - `import` from `@supabase/supabase-js`
  - Supabase Auth (use Clerk or Lucia if/when auth is added)
  - Supabase Realtime channels
  - Supabase Storage
  - Supabase Edge Functions
- If a feature seems to require Supabase-specific APIs, stop and discuss with user first

Migrating later means: `pg_dump` from Neon → `psql` into Supabase → change `DATABASE_URL`. Nothing else.

---

## Window startup sequence (every new Claude Code window)

Each window is a fresh conversation. Token budget is precious. Follow this exactly:

1. **Read `CLAUDE.md` (this file) in full** — global rules, ~7k tokens
2. **Read `CONSTRAINTS.md` in full** — red lines, ~6k tokens
3. **Read your current `windows/W{N}.md`** — task list, ~3-5k tokens
4. **Do not preemptively read other files**. Use `view` on demand:
   - Editing schema? → `view DATA_MODEL.md`
   - Writing prompts? → `view prompts/{stage}.md` + `view reference/inherited_rules.md`
   - Wiring LLM call? → `view reference/model_recipes.md` + `view reference/llm_gateway.md`
   - Touching JSONB? → `view reference/data_shapes.md`
   - Setting env vars? → `view reference/env_vars.md`
   - Building admin UI? → `view IA.md`
   - Implementing humanizer? → `view reference/humanizer_rules.md`
5. **Reference uploads (`server.js`, HTML)** are read-once-if-needed, never on every step

Goal: starting context ≤ 15k tokens. Per-message growth ≤ 5k tokens.

---

## Code-over-AI rule (critical)

For any operation with a deterministic answer, use code, **not** an LLM call. LLMs cost money, latency, and add randomness — they're only justified when the task requires genuine language understanding or generation.

| Use code for | Use LLM for |
|---|---|
| Keyword normalization (lowercase, trim, punctuation) | Intent classification |
| Hash-based dedup | Scenario derivation |
| Skeleton template selection by intent_type | Plan / thesis generation |
| CTA text composition (fixed template) | Section writing |
| Year token replacement | Hot-report parsing |
| Markdown → Feishu blocks | Semantic gap analysis |
| Forbidden-word scan against table | Semantic quality scoring |
| Competitor mention scan against table | Semantic humanizer rules (16–24) |
| Word count check | Differentiation strategy decision |
| Mechanical humanizer rules (1–15) | |
| Cluster centroid assignment | |
| Category fallback regex inference | |

**Quality check (QC) is two-layer**: a code-layer scan runs first (cheap, deterministic). Only what code can't judge goes to the LLM. This cuts QC cost ~70%.

---

## Doc map

| File | Required reading |
|---|---|
| `CLAUDE.md` (this file) | Every window |
| `CONSTRAINTS.md` | Every window |
| `GLOSSARY.md` | First window using a new term |
| `ARCHITECTURE.md` | W1, then as needed |
| `DATA_MODEL.md` | W1, W2, then as needed |
| `IA.md` | W6, useful in earlier |
| `windows/W{N}.md` | The window you're in |
| `reference/data_shapes.md` | Whenever writing/reading JSONB |
| `reference/model_recipes.md` | Whenever wiring an LLM call |
| `reference/inherited_rules.md` | Whenever writing prompts |
| `reference/env_vars.md` | W1 |
| `prompts/*.md` | When implementing a stage |

---

## Window plan (each window = a fresh Claude Code conversation)

| Window | Scope | Done when |
|---|---|---|
| W1 | Schema + infra setup | All tables exist on Neon, Trigger.dev + Redis connected, Next.js empty admin starts |
| W2 | Knowledge Base + LLM Gateway | Products / features / steps / competitors / forbidden_terms manageable in admin; LLM Gateway abstraction works against Moonshot + DeepSeek |
| W3 | Keyword main flow (ingest → intent → plan) | Input keyword produces an `article_plan` |
| W4 | Article generation (skeleton → section → assemble) | From a plan, produces a full assembled article |
| W5 | QC + hot-topic flow + Feishu publish | QC runs automatically; hot reports can be pasted/fetched; passing articles push to Feishu |
| W6 | Admin UI completion + Runs viewer + Settings | All IA pages live, no dead ends |

Windows run in order. Each window's task file lists exactly what it produces for the next.

---

## Working protocol (every window)

**Before doing anything:**
1. Read `CLAUDE.md` (this file)
2. Read `CONSTRAINTS.md`
3. Read `windows/W{N}.md`
4. List the proposed changes for this work session and **wait for user confirmation**

**During work:**
- Change one thing → verify it (`npm run typecheck`, migration run, API call) → next thing
- Never assume success — re-view the file or query the DB after writing
- If spec doesn't cover an edge case → **stop and ask**, do not invent
- Bug encountered → find root cause first, do not patch symptoms

**End of session:**
- Report: what was done, files changed, verification results
- Be honest about what didn't get done
- Leave a context summary for the next window in `windows/W{N+1}_intro.md`

---

## Article positioning (the single most important rule)

Articles are classified along two axes that together determine writing behavior:

### Axis 1: `intent_type` (inherited from previous version, 5 values)
- `learn` — searcher wants to understand a concept ("什么是 STP 文件")
- `solve` — searcher hit a specific problem ("dwg 文件打不开怎么办")
- `choose` — searcher in selection/comparison mode ("免费 CAD 软件推荐")
- `replace` — searcher wants to switch from current tool ("AutoCAD 替代品")
- `understand` — searcher wants conceptual distinction ("DWG 和 DXF 的区别")

### Axis 2: `flow_mode` (NEW — controls how ZIXEL is pushed)

| flow_mode | Description | Visibility |
|---|---|---|
| `DIRECTOR` | **Default.** Every article has a mandatory ZIXEL section + strong product push. What the director wants. | Default in UI |
| `ME` | Conditional ZIXEL section based on intent_type, soft mentions. Experimental — under continuous iteration to find what produces highest-quality output. | Hidden toggle in Settings, off by default. Director should not see this toggle. |

**Implementation note**: `flow_mode` lives on `keyword_intents.flow_mode`. Default at insert is `DIRECTOR`. The Settings UI has a "Show experimental flow modes" toggle that, when on, surfaces the `ME` option in intent creation. The toggle state is stored in `config_kv` so it persists per-user.

**Conflict resolution**: when running in `ME` mode for `learn` and `understand` intents, the ZIXEL section is omitted entirely (CTA stays). For `solve`, `choose`, `replace`, both flows keep the ZIXEL section but the writing style differs (see `reference/inherited_rules.md`).

---

## Two important inherited concepts

Inherited from previous version (preserve verbatim where marked):

**Persona anchor (verbatim, do not paraphrase):**
> 子虔小编是一个真正用过CAD的人,在跟另一个用CAD的人说一件有用的事。

**Anti-verbose rule (verbatim):**
> 每段只说一件事,说完就停。出现「另外」「此外」「同时」「还有」说明在用一段说两件事,必须拆开或删掉其中一个。如果一句话删掉后意思没变,就删掉它。

**Positive style anchor (NEW, added in this version):**
> 直白,不绕弯。一句话一件事,事情说清楚就停。不堆形容词,不用"高效便捷"这种没信息的词。该具体就具体——给数字,给步骤,给具体软件版本。该承认局限就承认——某个情况下我们的方案不合适,直接说,不掩饰。读起来要像一个工程师在 IM 里跟同事讲一件事,不是一个销售在路演。

The "admit limitations" line is for ME mode only. DIRECTOR mode drops it.

---

## Naming

- DB tables: `snake_case` plural (`articles`, `product_features`)
- DB fields: `snake_case` singular (`product_id`, `created_at`)
- TS types/interfaces: `PascalCase`
- TS vars/funcs: `camelCase`
- React components: `PascalCase`
- File names: `kebab-case`
- Trigger.dev job names: `snake_case` (`gen_intent`, `qc_humanizer`)
- Env vars: `SCREAMING_SNAKE_CASE`
- Status field values: `SCREAMING_SNAKE_CASE` (`PENDING`, `QC_FAILED`)

---

## Error handling

- All API routes return JSON, never HTML
- Error shape: `{ error: { code: string, message: string, details?: any } }`
- LLM failures **must** be recorded to `generation_runs`
- Trigger.dev jobs retry 3× then mark FAILED — never swallow
- No silent `catch (e) {}`

---

## Anti-patterns (stop immediately if you see these in your own work)

- Starting changes before user confirms the change list
- Edit then move on without verifying
- Catching errors to make them disappear
- Patching symptoms instead of root cause
- Inventing field/table/parameter names not in DATA_MODEL.md
- Inventing product features / competitor info / steps (use seed data; if seed is empty, ask user)
- Adding npm packages not in tech stack table
- Direct `ALTER TABLE` without a migration file
- Skipping QC stage in the workflow
- Generating step text when `feature_steps` is empty
- Calling an LLM for something code can answer deterministically
- Putting prompts as string constants in code (prompts live in DB)

---

## Honest reporting

When ending a session:
- Don't say "all complete" if anything is incomplete
- Don't say "tests pass" if you didn't run them
- Use "I verified X by doing Y" instead of "X should work"
- If you don't know, say so
