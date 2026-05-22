# DATA_MODEL.md — Database schema

> All tables. Field-by-field. Drizzle schema matches this verbatim.

Conventions:
- All `id` are `uuid` default `gen_random_uuid()`
- All tables have `created_at timestamptz default now()`
- Tables with mutable state add `updated_at timestamptz default now()` with trigger
- Status fields are `text` with values in `SCREAMING_SNAKE_CASE`
- Enum-like fields use CHECK constraints

---

## Table relationships (high level)

```
keywords ──┬─► keyword_intents ──► article_plans ──► article_skeletons ──► articles ──► article_sections
           │                                                                 │
           │                                                                 ├─► quality_checks
hot_reports ─► hot_topics ──────────────────────┘ (via keyword_intents.hot_topic_id)
                                                                              │
products ──► product_features ──► feature_steps                              │
                                                                              │
competitors ──► competitor_features                                          │
                                                                              │
prompts ──► prompt_sets (referenced by articles.prompt_set_id)               │
                                                                              │
generation_runs ────────────────────────────────────────────────────────────┘ (polymorphic)
```

---

## A. Knowledge Base

### `products`
ZIXEL product SKUs. Pre-seeded with 5 default products.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | NOT NULL | e.g. "云原生3D CAD", "3D一览通" |
| description | text | | |
| is_default | bool | DEFAULT false | one row marked default |
| sort_order | int | DEFAULT 0 | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | trigger |

Seed: 5 rows from previous version's DEFAULT_PRODUCT_LIBRARY group names.

### `product_features`
Specific features of ZIXEL products. LLM can mention only features in this table.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| product_id | uuid | FK products NOT NULL | |
| feature_name | text | NOT NULL | e.g. "版本管理" |
| feature_description | text | NOT NULL | full description for prompt injection |
| value_proposition | text | | user-facing benefit |
| is_unique | bool | DEFAULT false | ZIXEL-unique differentiator |
| priority | text | DEFAULT 'NORMAL' | LEAD / NORMAL / FALLBACK |
| keywords | text[] | | tags for matching |
| sort_order | int | DEFAULT 0 | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `priority IN ('LEAD','NORMAL','FALLBACK')`

Seed: pulled from previous version's DEFAULT_PRODUCT_LIBRARY content. User confirms exact list before W1 finalization.

### `feature_steps`
Step-by-step instructions for using a feature. Required for how_to articles.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| feature_id | uuid | FK product_features NOT NULL | |
| title | text | NOT NULL | e.g. "如何回滚到上一版本" |
| steps | jsonb | NOT NULL | array of step objects (shape in data_shapes.md) |
| screenshots | text[] | | optional URLs |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

### `competitors`
Competitor entries. **Initial seed is empty** — user populates via admin UI.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | NOT NULL UNIQUE | e.g. "AutoCAD" |
| aliases | text[] | | for regex matching |
| website_url | text | | for fetch_competitor |
| country | text | | |
| policy | text | DEFAULT 'MENTION' | MENTION / NEVER / CONTEXTUAL |
| last_fetched_at | timestamptz | | |
| fetch_status | text | DEFAULT 'NOT_FETCHED' | NOT_FETCHED / FETCHING / FETCHED / FAILED |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `policy IN ('MENTION','NEVER','CONTEXTUAL')`
CHECK: `fetch_status IN ('NOT_FETCHED','FETCHING','FETCHED','FAILED')`

### `competitor_features`
Competitor feature lists. Used for differentiation context.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| competitor_id | uuid | FK competitors NOT NULL | |
| feature_name | text | NOT NULL | |
| feature_description | text | | |
| source | text | NOT NULL | MANUAL / AUTO_FETCHED |
| source_url | text | | |
| last_verified_at | timestamptz | | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

### `forbidden_terms`
Words/phrases that produce AI flavor.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| term | text | NOT NULL UNIQUE | the word |
| category | text | NOT NULL | see GLOSSARY |
| severity | text | DEFAULT 'WARN' | WARN / BAN |
| notes | text | | |
| created_at | timestamptz | DEFAULT now() | |

CHECK: `severity IN ('WARN','BAN')`
CHECK: `category IN ('MARKETING_HYPERBOLE','EMPTY_VERBS','VAGUE_QUANTIFIERS','AI_SUMMARY_WORDS','STRUCTURE_CONNECTORS','EMPTY_BENEFITS','AI_OPENERS','COMPETITOR_LEAK','GENERIC')`

Seed: ~60 words from inherited_rules.md.

### `content_sources`
Domain whitelist/greylist/blacklist for SerpAPI results.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| domain | text | NOT NULL UNIQUE | e.g. "huxiu.com" |
| tier | text | NOT NULL | WHITE / GRAY / BLACK |
| reason | text | | |
| language | text | DEFAULT 'zh' | zh / en / both |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `tier IN ('WHITE','GRAY','BLACK')`

Seed: initial list in `reference/initial_sources.md`.

### `blocked_keywords`
Keywords that should be rejected at ingest (piracy, cracking, leak themes).

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| pattern | text | NOT NULL UNIQUE | substring to match |
| reason | text | | |
| created_at | timestamptz | DEFAULT now() | |

Seed: from previous version's BLOCKED_KEYWORDS list.

---

## B. Keyword pipeline

### `keywords`
Source material.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| raw_text | text | NOT NULL | original input |
| normalized_text | text | NOT NULL | lowercase, punctuation stripped |
| keyword_hash | text | NOT NULL UNIQUE | sha256(normalized) |
| search_volume | int | DEFAULT 0 | from import if available |
| cluster_id | uuid | FK keyword_clusters | nullable |
| embedding | vector(1024) | | pgvector |
| status | text | DEFAULT 'PENDING' | see below |
| priority | text | DEFAULT 'NORMAL' | NORMAL / HOT |
| source | text | DEFAULT 'MANUAL' | MANUAL / IMPORT / HOT_TOPIC |
| block_reason | text | | reason if status=BLOCKED |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `status IN ('PENDING','NORMALIZED','CLUSTERED','INTENT_GENERATED','SKIPPED','BLOCKED')`
CHECK: `priority IN ('NORMAL','HOT')`
CHECK: `source IN ('MANUAL','IMPORT','HOT_TOPIC')`

Indexes:
- UNIQUE on `keyword_hash`
- btree on `normalized_text`
- ivfflat on `embedding` (cosine)
- btree on `status`

### `keyword_clusters`
Computed clusters of related keywords.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| cluster_name | text | | LLM-summarized topic name |
| centroid_embedding | vector(1024) | | |
| keyword_count | int | DEFAULT 0 | denormalized |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

### `keyword_intents`
One row per intent. A keyword can have multiple intents.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| keyword_id | uuid | FK keywords NOT NULL | |
| hot_topic_id | uuid | FK hot_topics | nullable, set when from hot pipeline |
| intent_type | text | NOT NULL | learn/solve/choose/replace/understand |
| role | text | NOT NULL | one of 10 fixed roles |
| scenario | text | NOT NULL | concrete moment |
| constraint_text | text | | implicit user limit |
| article_angle | text | NOT NULL | one-sentence framing |
| category | text | NOT NULL | one of 10 fixed categories |
| flow_mode | text | DEFAULT 'DIRECTOR' | DIRECTOR / ME |
| dedupe_status | text | DEFAULT 'PENDING' | PENDING / UNIQUE / DUPLICATE |
| duplicate_of_intent_id | uuid | FK keyword_intents | nullable |
| embedding | vector(1024) | | for cross-cluster dedup |
| status | text | DEFAULT 'PENDING' | PENDING / READY / SKIPPED |
| created_by_prompt_id | uuid | FK prompts | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `intent_type IN ('learn','solve','choose','replace','understand')`
CHECK: `flow_mode IN ('DIRECTOR','ME')`
CHECK: `dedupe_status IN ('PENDING','UNIQUE','DUPLICATE')`
CHECK: `status IN ('PENDING','READY','SKIPPED')`
CHECK: `role IN ('机械工程师','结构工程师','ID工程师','工艺工程师','售前/售后工程师','研发负责人/管理层','项目经理','采购/IT/数字化','学生/教师','创客/自由职业者')`
CHECK: `category IN ('CAD文件','CAD常见问题','CAD名词解释','CAD协作','CAD建模','CAD行业观察','CAD快捷键','CAD工程图','CAD集成应用','CAD产品资讯')`

UNIQUE: `(keyword_id, intent_type, role)`

Indexes:
- btree on `keyword_id`
- ivfflat on `embedding`
- btree on `status`

---

## C. Hot topic pipeline

### `hot_reports`
Full pasted/fetched report.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| source | text | NOT NULL | FEISHU_OPENCLAW / AIHOT_API / MANUAL_PASTE |
| report_date | date | | |
| raw_content | text | NOT NULL | full original text |
| parse_status | text | DEFAULT 'PENDING' | PENDING / PARSED / FAILED |
| parsed_topics_count | int | DEFAULT 0 | denormalized |
| error_message | text | | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `source IN ('FEISHU_OPENCLAW','AIHOT_API','MANUAL_PASTE')`
CHECK: `parse_status IN ('PENDING','PARSED','FAILED')`

### `hot_topics`
Individual topic extracted from a report.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| report_id | uuid | FK hot_reports NOT NULL | |
| event_summary | text | NOT NULL | |
| source_url | text | | |
| why_hot | text | | |
| proposed_title | text | | from report |
| proposed_keywords | text[] | | Pillar keywords |
| cluster_hint | text | | A/B/C labels from report |
| score | int | | report's score |
| status | text | DEFAULT 'PENDING' | see below |
| selected_at | timestamptz | | when user selected |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `status IN ('PENDING','SELECTED','SKIPPED','GENERATING','DONE','FAILED')`

---

## D. Article generation

### `article_plans`
The argumentative blueprint.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| intent_id | uuid | FK keyword_intents NOT NULL | |
| thesis | text | NOT NULL | one-sentence argument |
| key_points | jsonb | NOT NULL | array of strings (shape in data_shapes.md) |
| narrative_arc | jsonb | NOT NULL | flow object |
| product_feature_ids | uuid[] | | optional, can be empty |
| competitor_diff_analysis | jsonb | | SerpAPI gap analysis result |
| avoid_topics | text[] | | topics excluded |
| differentiation_strategy | text | NOT NULL DEFAULT 'STANDARD' | see below |
| status | text | DEFAULT 'PENDING' | PENDING / READY / SKIPPED |
| created_by_prompt_id | uuid | FK prompts | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `differentiation_strategy IN ('ANGLE_GAP','DEPTH','STANDARD','EXECUTION')`
CHECK: `status IN ('PENDING','READY','SKIPPED')`

### `article_skeletons`
Section-by-section outline.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| plan_id | uuid | FK article_plans NOT NULL | |
| title | text | NOT NULL | SEO title |
| sections | jsonb | NOT NULL | array of section objects (shape in data_shapes.md) |
| status | text | DEFAULT 'PENDING' | PENDING / READY |
| created_by_prompt_id | uuid | FK prompts | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

### `articles`
The final article. Supports multiple versions per intent.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| skeleton_id | uuid | FK article_skeletons NOT NULL | |
| intent_id | uuid | FK keyword_intents NOT NULL | |
| version_number | int | NOT NULL DEFAULT 1 | |
| title | text | NOT NULL | |
| meta_description | text | | SEO description |
| status | text | DEFAULT 'DRAFT' | see below |
| status_reason | text | | e.g. which feature_steps missing |
| source_type | text | DEFAULT 'REGULAR' | REGULAR / HOT |
| word_count | int | | computed |
| prompt_set_id | uuid | FK prompt_sets | |
| feishu_doc_url | text | | post-publish |
| published_at | timestamptz | | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `status IN ('DRAFT','ASSEMBLING','WAITING_FOR_STEPS','QC_PENDING','QC_PASSED','QC_FAILED','PUBLISHED','DEPRECATED')`
CHECK: `source_type IN ('REGULAR','HOT')`

UNIQUE: `(intent_id, version_number)`

### `article_sections`
One row per section. Independent for regeneration.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| article_id | uuid | FK articles NOT NULL | |
| section_index | int | NOT NULL | 0-based |
| tag | text | NOT NULL | H2/H3/STEPS/ZIXEL/CTA/INTRO |
| title | text | NOT NULL | |
| brief | text | | |
| role_in_arc | text | NOT NULL | |
| body | text | NOT NULL | markdown |
| word_count | int | | |
| feature_id | uuid | FK product_features | nullable |
| created_by_prompt_id | uuid | FK prompts | |
| regeneration_count | int | DEFAULT 0 | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

CHECK: `tag IN ('H2','H3','STEPS','ZIXEL','CTA','INTRO','CONCLUSION')`
CHECK: `role_in_arc IN ('INTRO_PAIN','ANALYZE_CAUSE','COMPARE_OPTIONS','HOW_TO_STEP','BRIDGE_TO_PRODUCT','CTA','CONTEXT','CONCLUSION')`

UNIQUE: `(article_id, section_index)`

---

## E. Quality

### `quality_checks`
One row per check run (humanizer + quality are separate rows).

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| article_id | uuid | FK articles NOT NULL | |
| check_type | text | NOT NULL | HUMANIZER / QUALITY / MANUAL |
| layer | text | | CODE / LLM / COMBINED |
| checks | jsonb | NOT NULL | detail (shape in data_shapes.md) |
| overall_score | int | | 0-100 |
| threshold_passed | bool | NOT NULL | |
| issues | jsonb | | list of specific findings |
| checked_by_prompt_id | uuid | FK prompts | null for code-only layer |
| reviewer | text | | for MANUAL |
| review_note | text | | |
| created_at | timestamptz | DEFAULT now() | |

CHECK: `check_type IN ('HUMANIZER','QUALITY','MANUAL')`
CHECK: `layer IN ('CODE','LLM','COMBINED') OR layer IS NULL`

---

## F. Prompt assets

### `prompts`
Each prompt is one row. Versioned.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | NOT NULL | e.g. "gen_plan_v3" |
| stage | text | NOT NULL | see below |
| content | text | NOT NULL | full Jinja template |
| version | int | NOT NULL | |
| is_active | bool | DEFAULT false | one per stage |
| parent_prompt_id | uuid | FK prompts | derived from |
| description | text | | change notes |
| deprecated_at | timestamptz | | |
| created_at | timestamptz | DEFAULT now() | |

CHECK: `stage IN ('NORMALIZE_KEYWORD','INTENT','PLAN','SKELETON','SECTION_GENERIC','SECTION_ZIXEL','SECTION_STEPS','QC_HUMANIZER','QC_QUALITY','PARSE_HOT','FETCH_COMPETITOR')`

UNIQUE: `(stage, version)`
PARTIAL UNIQUE: `(stage) WHERE is_active = true`

### `prompt_sets`
Bundle of one active prompt per stage.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | | |
| intent_prompt_id | uuid | FK prompts NOT NULL | |
| plan_prompt_id | uuid | FK prompts NOT NULL | |
| skeleton_prompt_id | uuid | FK prompts NOT NULL | |
| section_generic_prompt_id | uuid | FK prompts NOT NULL | |
| section_zixel_prompt_id | uuid | FK prompts NOT NULL | |
| section_steps_prompt_id | uuid | FK prompts NOT NULL | |
| qc_humanizer_prompt_id | uuid | FK prompts NOT NULL | |
| qc_quality_prompt_id | uuid | FK prompts NOT NULL | |
| is_active | bool | DEFAULT false | only one true |
| created_at | timestamptz | DEFAULT now() | |

---

## G. Operations / config

### `generation_runs`
Every LLM call logged.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| stage | text | NOT NULL | same enum as prompts.stage |
| prompt_id | uuid | FK prompts | |
| model | text | NOT NULL | model name string |
| provider | text | NOT NULL | MOONSHOT / DEEPSEEK / ANTHROPIC |
| input_payload | jsonb | NOT NULL | redact secrets |
| output_payload | jsonb | | null on failure |
| tokens_input | int | | |
| tokens_output | int | | |
| cost_usd | numeric(10,6) | | |
| duration_ms | int | | |
| status | text | NOT NULL | SUCCESS / FAILED / TIMEOUT |
| error_code | text | | |
| error_message | text | | |
| related_entity_type | text | | KEYWORD/INTENT/PLAN/SKELETON/SECTION/ARTICLE/HOT_TOPIC |
| related_entity_id | uuid | | |
| trigger_run_id | text | | Trigger.dev run ID |
| created_at | timestamptz | DEFAULT now() | |

CHECK: `provider IN ('MOONSHOT','DEEPSEEK','ANTHROPIC')`
CHECK: `status IN ('SUCCESS','FAILED','TIMEOUT')`

Indexes:
- btree on `related_entity_id`
- btree on `stage`
- btree on `created_at`
- btree on `status`

### `model_routing`
Per-stage model + provider config.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| stage | text | NOT NULL UNIQUE | |
| primary_model | text | NOT NULL | |
| primary_provider | text | NOT NULL | |
| fallback_model | text | | |
| fallback_provider | text | | |
| temperature | numeric(3,2) | DEFAULT 0.7 | |
| max_tokens | int | DEFAULT 4000 | |
| updated_at | timestamptz | DEFAULT now() | |

Seed: default routings per `reference/model_recipes.md`.

### `quality_thresholds`
Pass/fail thresholds for QC.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| check_type | text | NOT NULL UNIQUE | HUMANIZER / QUALITY |
| min_overall_score | int | NOT NULL | |
| individual_min | jsonb | | per-rule minimums |
| updated_at | timestamptz | DEFAULT now() | |

### `config_kv`
Loose string config + flags.

| field | type | constraints | notes |
|---|---|---|---|
| key | text | PK | |
| value | text | | |
| description | text | | |
| is_secret | bool | DEFAULT false | masked in UI |
| updated_at | timestamptz | DEFAULT now() | |

Seed keys:
- `ui.show_experimental_flow_modes` — "false" by default
- `feishu.target_folder_token` — from env
- `feishu.target_table_id` — from env
- `redis.serp_ttl_regular_days` — "7"
- `redis.serp_ttl_hot_hours` — "6"

### `publish_records`
Push history per article per channel.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| article_id | uuid | FK articles NOT NULL | |
| channel | text | NOT NULL | FEISHU |
| target | text | NOT NULL | folder/table |
| status | text | DEFAULT 'PENDING' | PENDING / SUCCESS / FAILED |
| response_payload | jsonb | | |
| error_message | text | | |
| published_at | timestamptz | | |
| created_at | timestamptz | DEFAULT now() | |

CHECK: `status IN ('PENDING','SUCCESS','FAILED')`

---

## H. Skeleton templates (DB-backed)

### `skeleton_templates`
Default skeleton structures per intent_type × flow_mode.

| field | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| intent_type | text | NOT NULL | |
| flow_mode | text | NOT NULL | |
| sections | jsonb | NOT NULL | section template array |
| is_default | bool | DEFAULT false | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

UNIQUE: `(intent_type, flow_mode)` where `is_default = true`

Seed: 10 rows (5 intent_types × 2 flow_modes), templates from inherited_rules.md.

---

## I. Index summary

(Drizzle migration creates these explicitly)

- `keywords.keyword_hash` UNIQUE
- `keywords.normalized_text` btree
- `keywords.embedding` ivfflat (vector_cosine_ops)
- `keyword_intents.keyword_id` btree
- `keyword_intents.embedding` ivfflat
- `hot_topics.report_id` btree
- `hot_topics.status` btree
- `articles.intent_id` btree
- `articles.status` btree
- `article_sections.article_id` btree
- `generation_runs.related_entity_id` btree
- `generation_runs.stage` btree
- `generation_runs.created_at` btree
- `quality_checks.article_id` btree
- `prompts` PARTIAL UNIQUE `(stage) WHERE is_active`

---

## J. Seed data (W1 ends with this loaded)

| Table | Source |
|---|---|
| products | 5 rows from previous DEFAULT_PRODUCT_LIBRARY group names |
| product_features | parsed from previous DEFAULT_PRODUCT_LIBRARY entries content |
| feature_steps | empty (user adds via admin UI) |
| competitors | empty (user adds via admin UI) |
| competitor_features | empty |
| forbidden_terms | ~60 rows from `reference/inherited_rules.md` |
| content_sources | initial list in `reference/initial_sources.md` |
| blocked_keywords | from previous BLOCKED_KEYWORDS list |
| skeleton_templates | 10 rows from inherited_rules.md (5 types × 2 modes) |
| prompts | 1 row per stage at v1, content from `prompts/*.md` |
| prompt_sets | 1 row "default_v1" linking all v1 prompts |
| model_routing | rows per `reference/model_recipes.md` |
| quality_thresholds | HUMANIZER (min 70), QUALITY (min 70) |
| config_kv | initial keys listed above |
