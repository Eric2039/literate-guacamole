# IA.md — Information architecture

> Complete admin UI map. Every page, every interaction, every disabled-state explanation. No dead ends.

---

## Top-level nav (left sidebar)

```
🏠 Dashboard
🔑 Keywords
🔥 Hot Topics
⚙️ Pipeline
📄 Articles
✅ Quality
📚 Knowledge Base
💬 Prompts
📊 Runs
🔧 Settings
```

---

## 1. Dashboard

### What it does
At-a-glance status. Quick actions.

### Contents
- 4 stat cards (clickable):
  - Today's generated count → Articles filtered today
  - Pending QC count → Quality > Pending
  - Published today → Articles filtered today + published
  - Failed runs today → Runs filtered failed + today
- 7-day generation trend line chart
- Currently running jobs list (stage, progress, ETA), each links to Runs detail
- Quick action buttons:
  - "Import keywords" → Keywords > Import
  - "Paste hot report" → Hot Topics > Import
  - "Review pending articles" → Quality > Pending

### Empty state
First visit: "No data yet. Click below to start." Two buttons: Import keywords / Paste hot report.

---

## 2. Keywords

### 2.1 List
- Columns: raw_text / normalized / type / cluster / source / status / actions
- Filters: status, keyword_type, cluster, source, priority, date range
- Search: fuzzy match on raw_text
- Row actions: View detail / Re-normalize / Generate intent / Mark skipped
- Bulk actions (multi-select): bulk re-normalize / bulk generate intent / bulk mark skipped
- Empty state: "No keywords yet" + Import button

### 2.2 Import
- CSV upload (`raw_text, search_volume` columns)
- Text paste (one per line)
- Preview shows: normalized form + dedup detection
- On confirm: bulk insert
- Result toast: "Imported N rows, M duplicates skipped, K blocked"

### 2.3 Detail
- Header: raw_text, normalized, hash, cluster, status, source
- Related intents block: list, click → Pipeline > Intents detail
- Related articles block: list, click → Articles detail
- History block: related generation_runs, click → Runs detail
- Actions: Regenerate intent, Mark skipped, Assign to cluster
- Breadcrumb: Keywords > {raw_text}
- Unreached state: no intent yet → "No intent generated. Click below." + Generate button

---

## 3. Hot Topics

### 3.1 Reports
- Columns: source / date / topics_count / selected_count / published_count / status
- Row actions: View detail / Re-parse / Delete (confirm)
- Empty: "No reports yet" + Paste / Fetch from AI HOT buttons

### 3.2 Report Detail
- Header: source / date / collapsed raw_content
- Card grid: one card per hot_topic
  - Title / score / Pillar / keyword tags / status
  - Click card → Topic Detail
  - "Generate article" button (triggers gen_plan)
  - Skip button
- Bulk action: multi-select cards → "Generate articles"

### 3.3 Topics (cross-report list)
- Filters: status, cluster_hint, score range, report, date
- Columns: proposed_title / Pillar / score / status / report_date
- Same row actions as report detail

### 3.4 Import
- Three input methods:
  - Paste text (auto-detect OpenClaw format or free text)
  - Fetch from AI HOT (button → aihot.virxact.com API)
  - Paste single news item (event description + source)
- After parse: shows extracted candidate topics, user confirms which to import

### 3.5 Topic Detail
- Shows: event_summary, source_url, why_hot, proposed_title, proposed_keywords, cluster_hint, score, status
- Related products: linked article_plan, linked article (click to navigate)
- Actions: Generate article (if not), Skip, Back to report

---

## 4. Pipeline

### Sub-tabs: Intents / Plans / Skeletons / Sections

### 4.1 Intents
- Columns: keyword / intent_type / role / flow_mode / scenario / dedupe_status / status
- Filters: intent_type, flow_mode, status, cluster
- Row actions: View detail / Regenerate (pick prompt version) / Skip

### 4.2 Plans
- Columns: intent / thesis (truncated) / differentiation_strategy / feature_count / status
- Filters: differentiation_strategy, status, has_features, is_hot

### 4.3 Skeletons
- Columns: title / section_count / requires_steps / status
- Same actions as above

### 4.4 Sections
- Columns: article / index / tag / role_in_arc / word_count / regeneration_count
- Row actions: Regenerate this section

### Common Detail view (all 4 tabs)
Three-column layout:
```
┌──────────┬──────────┬──────────┐
│ Upstream │ This     │ Downstream│
│ artifact │ stage    │ artifact  │
│          │ output   │           │
│ (links)  │ (full)   │ (links)   │
└──────────┴──────────┴──────────┘
```
Bottom: list of generation_runs for this stage (view prompt / input / output / tokens / errors)

Unreached state: no artifact yet → "Upstream not generated, click here" with jump.

---

## 5. Articles

### 5.1 List
- Columns: title / intent / version / status / flow_mode / source_type / word_count / created_at
- Filters: status, version, intent, source_type (REGULAR/HOT), flow_mode, prompt_set, date

### 5.2 Detail
- Header: title / status / version / intent (click) / hot_topic (click) / created_at / prompt_set / flow_mode
- Body: article content rendered as sections
  - Each section: top-right has "Regenerate this section" + "View brief" buttons
  - Below each section: which prompt version generated it
- Right column:
  - QC results panel (humanizer score + quality score, both with breakdown)
  - generation_runs panel (all LLM calls for this article)
  - Feishu publish status
- Footer actions:
  - Regenerate full article → new version (confirm)
  - Push to Feishu (enabled only if QC_PASSED, tooltip explains if disabled)
  - Mark deprecated

Unreached state handling:
- QC_FAILED: Push button disabled with tooltip "QC not passed, fix in Quality"
- WAITING_FOR_STEPS: top banner "Missing feature steps for {feature_name}" + jump to Knowledge Base > Steps

---

## 6. Quality

### 6.1 Pending
- Lists articles with QC_FAILED or manually held
- Columns: title / humanizer_score / quality_score / failed_items / created_at
- Actions:
  - View QC report (modal)
  - Manual pass (override to QC_PASSED with note)
  - Regenerate full article
  - Regenerate failed sections (auto-locates failing sections)
  - Mark deprecated

### 6.2 Passed
- Lists QC_PASSED articles ready to push

### 6.3 Failed
- Repeatedly failed articles, with retry counts
- Manual decision: revive or deprecate

### QC Report Modal
- Both humanizer and quality scores with per-rule breakdown
- Issues list, each tied to a section (deep-link)
- LLM suggestions (from Layer 2)
- Actions:
  - Regenerate single section
  - Regenerate full article
  - Manual override pass (require note)

---

## 7. Knowledge Base

### 7.1 Products
- Manage ZIXEL products
- CRUD + set default
- Fields: name, description, is_default

### 7.2 Product Features
- Columns: feature_name / product / priority / is_unique / steps_count
- CRUD via edit form
- Edit fields: feature_name / description / value_proposition / is_unique / priority / keywords[]
- Side panel: linked feature_steps, jump to Steps page

### 7.3 Steps
- Grouped by product_feature
- Edit fields: feature_id (dropdown) / title / steps (dynamic array, one row per step) / screenshots[]
- Missing alert at top: "N articles waiting for steps" + jump to Articles filtered WAITING_FOR_STEPS

### 7.4 Competitors
- Initial empty state. User adds.
- Columns: name / country / policy / last_fetched / fetch_status / features_count
- Actions:
  - CRUD
  - "Fetch features from website" button (triggers fetch_competitor)
  - View competitor_features in detail

### 7.5 Competitor Features
- Either sub-page or inline edit in competitor detail
- Shows source (MANUAL vs AUTO_FETCHED), last_verified_at

### 7.6 Forbidden Terms
- Grouped by category (MARKETING_HYPERBOLE / EMPTY_VERBS / VAGUE_QUANTIFIERS / AI_SUMMARY_WORDS / STRUCTURE_CONNECTORS / EMPTY_BENEFITS / AI_OPENERS / ...)
- CRUD + bulk import (paste list)
- Each entry shows severity (WARN / BAN) + notes

### 7.7 Content Sources
- Grouped by tier (WHITE / GRAY / BLACK)
- Fields: domain / tier / reason / language
- CRUD + bulk import

---

## 8. Prompts

### 8.1 List
- Left side: stage tree (NORMALIZE_KEYWORD / INTENT / PLAN / SKELETON / SECTION_GENERIC / SECTION_ZIXEL / SECTION_STEPS / QC_HUMANIZER / QC_QUALITY / PARSE_HOT / FETCH_COMPETITOR)
- Right side: that stage's version list
- Version columns: version / is_active / description / created_at
- Actions: View / Edit (new version) / Set active / Deprecate

### 8.2 Editor
- Header: stage / version / description
- Main: Monaco editor with Jinja highlighting
- Right panel: available variables for this stage (e.g., `{{ keyword }}`, `{{ product_features }}`)
- Footer:
  - Save as new version
  - Test in sandbox (input sample → call LLMGateway → show output + tokens)
  - Set active

### 8.3 Diff
- Side-by-side comparison of two versions

### 8.4 Sets
- Manage prompt_sets
- Fields: name / per-stage prompt selectors / is_active
- CRUD + set active

---

## 9. Runs

### 9.1 List
- Columns: stage / model / provider / related_entity / status / tokens / cost / duration / created_at
- Filters: stage, status, provider, related_entity_type, date
- Search: related_entity_id exact match

### 9.2 Detail
- Full input_payload / output_payload / error_message / token / cost
- Link to Trigger.dev dashboard for this run
- Actions: Retry (if failed) / Copy input to sandbox / Export JSON

---

## 10. Settings

### 10.1 API Keys
- Show configured key names (masked)
- Fields: MOONSHOT_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY (optional), SERPAPI_API_KEY, FEISHU_*
- Edits write to env locally (in production: read-only)

### 10.2 Model Routing
- Per-stage row: primary_model / fallback_model / temperature / max_tokens
- Edit + test (sandbox call)

### 10.3 Quality Thresholds
- HUMANIZER row, QUALITY row
- Edit min_overall_score and individual_min

### 10.4 Feishu
- Webhook URL, target folder, target table_id
- Test push (sends test message)

### 10.5 Cache
- Redis hit rate stats / SERP cache count / size
- Action: Clear SERP cache (confirm)

### 10.6 **Experimental** (hidden by default)

⚠️ **This page is hidden behind a feature flag.**

Access path: navigate to `/settings/experimental` directly (no sidebar link by default).

Setting: "Show experimental flow modes"
- Toggle off (default): only DIRECTOR flow_mode appears in intent creation UI
- Toggle on: ME flow_mode appears as option in intent creation; flow_mode column appears in pipeline lists

This setting is stored in `config_kv` under key `ui.show_experimental_flow_modes`. Value is `"true"` or `"false"`.

When director-style audiences view the system, leave this toggle off — they will never see the ME mode exists.

---

## Global UX principles (no dead ends)

1. **Two-way navigation**: keyword ↔ intent ↔ plan ↔ skeleton ↔ article any-direction jumpable
2. **Empty-state guidance**: every empty list has a "create first" CTA
3. **Disabled-button tooltips**: every disabled button explains why + how to enable
4. **Retry buttons**: every error state has retry
5. **Filter/search/paginate**: every list
6. **Loading feedback**: LLM calls show current stage, not just "loading"
7. **Confirm dialogs**: every destructive op (delete / deprecate / overwrite / full regen / publish)
8. **Breadcrumbs**: all detail pages
9. **Global search**: top bar searches keyword / article title / topic title
10. **Keyboard shortcuts** (W6): `/` focus search, `n` new, `esc` close

---

## Routes

```
/                                       → /dashboard
/dashboard
/keywords
/keywords/import
/keywords/[id]
/hot-topics
/hot-topics/reports
/hot-topics/reports/[id]
/hot-topics/topics
/hot-topics/topics/[id]
/hot-topics/import
/pipeline                                → tab=intents
/pipeline/intents/[id]
/pipeline/plans/[id]
/pipeline/skeletons/[id]
/pipeline/sections/[id]
/articles
/articles/[id]
/quality                                 → tab=pending
/knowledge/products
/knowledge/products/[id]
/knowledge/features
/knowledge/features/[id]
/knowledge/steps
/knowledge/competitors
/knowledge/competitors/[id]
/knowledge/forbidden-terms
/knowledge/content-sources
/prompts
/prompts/[stage]
/prompts/[stage]/[version]
/prompts/sets
/runs
/runs/[id]
/settings/api-keys
/settings/model-routing
/settings/quality-thresholds
/settings/feishu
/settings/cache
/settings/experimental                   ← hidden, no sidebar link
```
