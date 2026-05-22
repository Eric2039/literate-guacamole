# CONSTRAINTS.md — Red lines

Two sections:
- **System invariants** — rules the application code must enforce (Claude Code implements these as code-level guards)
- **Claude Code conduct** — rules for the AI assistant during development

---

## A. System invariants (rules the code enforces)

These describe how the running system behaves. Each one becomes a runtime check / DB constraint / API guard.

### A1. Article cannot be published without passing humanizer + quality QC
- `articles.status` transitions from `QC_PENDING` to `PUBLISHED` only via the publish action
- Publish action checks `quality_checks` for the latest passing humanizer + quality records
- API rejects publish requests on articles with `status` not in `QC_PASSED`
- DB-level CHECK constraint enforces valid status values

### A2. how_to article without `feature_steps` cannot proceed
- When skeleton has a section with `requires_steps: true` and no matching `feature_steps` row exists for the referenced `feature_id`, article status is set to `WAITING_FOR_STEPS`
- `gen_section` worker refuses to write the section
- Article stays in queue waiting for steps to be added
- **Never** invent steps to unblock

### A3. ZIXEL features mentioned in articles must come from `product_features` table
- Section prompt's product context is built from DB query, not free-form text
- QC pass scans article for known ZIXEL feature mentions against the table
- Mentions of "features" not in the table flag the article for review

### A4. Competitor mentions follow the table-driven rule
- `competitors.policy` values: `MENTION` / `NEVER` / `CONTEXTUAL`
- Competitors marked `NEVER` cannot appear anywhere in any article
- Competitors marked `CONTEXTUAL` may only appear in sections whose `role_in_arc` is `COMPARE_OPTIONS`
- Code scans article body before publish and blocks on violation

### A5. Forbidden terms enforcement
- `forbidden_terms.severity = BAN` words trigger article rejection (humanizer QC fails)
- `forbidden_terms.severity = WARN` words deduct from humanizer score but don't auto-fail
- Scan happens at article level (whole-article regex), not paragraph-by-paragraph

### A6. Hot topics from untrusted sources don't bypass safety
- `hot_reports.source = MANUAL_PASTE` and `AIHOT_API` go through the same parse + select + gen_plan flow as `FEISHU_OPENCLAW`
- No "express lane" that skips QC

### A7. Every LLM call logs to `generation_runs`
- Success or failure, both write a row
- Input payload, output payload, tokens, cost, duration all recorded
- Failed calls keep partial output if any (for debugging)

### A8. Idempotency keys on Trigger.dev jobs
- Every job invocation uses a deterministic idempotency key based on the business object ID
- Format: `{stage}:{entity_type}:{entity_id}` (e.g., `gen_plan:intent:abc-123`)
- Re-triggering the same job for the same object returns the prior result, no duplicate run

### A9. SerpAPI calls go through Redis cache
- Key: `serp:{normalized_keyword_hash}`
- TTL: 7 days for regular SEO, 6 hours for hot
- Direct uncached calls to SerpAPI are not allowed

### A10. No prompt strings hardcoded in code
- All prompts live in `prompts` table
- `LLMGateway` reads active prompt for each stage from DB
- Code only references prompts by `stage` name

### A11. Articles in `DIRECTOR` flow always have a ZIXEL section
- Skeleton template selection in DIRECTOR mode never omits ZIXEL section
- ME mode allows omitting ZIXEL section for `learn` and `understand` intent types
- The mode is recorded on `keyword_intents.flow_mode`

### A12. Section word count enforcement
- Sections have soft target (range), article has hard floor (1500 words)
- If a section comes in below target, redistribute deficit to other sections by re-running gen_skeleton, do not pad
- If article total below hard floor after all sections written, add 1 supplementary H2 section (worker action, not LLM-invented padding)

### A13. Blocked keywords are rejected at ingest
- `BLOCKED_KEYWORDS` table contains terms tied to piracy/cracking/leak topics
- Ingest worker rejects keywords matching this list, marks them as `BLOCKED` with reason
- No downstream stages run on blocked keywords

### A14. Prompt versions are immutable once `is_active=true`
- Editing an active prompt creates a new row with incremented version, not in-place update
- Old version stays available for tracing past articles
- Only one row per stage can have `is_active = true` at a time (DB partial unique index)

### A15. No invention beyond schema
- Worker code validates LLM output against expected JSON schema for each stage
- Invalid output rejected, retried once with stronger system prompt
- Persistent failure → record to `generation_runs` as FAILED, do not insert garbage

---

## B. Claude Code conduct (rules for the AI assistant)

These describe how Claude Code should behave while writing code.

### B1. No starting before user confirms
- List proposed changes
- Wait for explicit user OK
- Only then begin

### B2. Verify each change
- After every file edit: `view` the file
- After every DB change: query the table
- After every API addition: test the endpoint
- Don't say "done" without verification evidence

### B3. No hardcoding fake data into code or seed files
- When writing seed scripts, only use data the user has explicitly provided
- If a feature's `feature_steps` is needed for testing but doesn't exist, do not invent steps text — leave seed empty and let the runtime flag the article as `WAITING_FOR_STEPS` (this is enforced by system invariant A2)
- Do not invent competitor entries to make seeds "look complete" — competitors table starts empty by design
- Do not invent product features beyond what user provides — `product_features` seed contains only user-supplied entries

### B4. No new dependencies without approval
- Check tech stack table in CLAUDE.md
- If something not listed is needed, ask before `npm install`

### B5. No `--force`, no `@ts-ignore`, no `any` type
- Type errors get fixed properly
- `any` allowed only for raw LLM response before validation
- `--force` flag never used

### B6. Migrations are files, not direct queries
- Schema change → write migration file under `lib/db/migrations/`
- Run `npm run migrate` to apply
- Never execute `ALTER TABLE` via `psql` in development

### B7. No fields/tables/params invented
- All names come from `DATA_MODEL.md`
- Need a new field? Update `DATA_MODEL.md` first, then add via migration, then use

### B8. No symptom patching
- Bug appears → trace to root cause
- Don't add a special case to make the symptom disappear
- Document the fix in commit message

### B9. Honest reporting
- "I implemented X and verified it works by Y" — yes
- "X should work now" — no
- "All complete" — only if literally all complete
- Use TODO comments for known gaps

### B10. No silent error swallowing
- `catch (e) {}` is forbidden in code you write
- Errors must be either handled, logged, or re-thrown
- (System-level rule that LLM failures land in `generation_runs` is A7, code you write must comply)

### B11. No hardcoded prompts in code
- Don't write prompt strings as constants in TypeScript files
- All prompts go into the `prompts` table via seed scripts
- Code reads prompts by stage name from the table (system invariant A10 enforces this at runtime)

### B12. Code-over-AI
- Don't call an LLM if a regex or DB query answers the question
- See CLAUDE.md table for the canonical split

### B13. Don't read uploaded reference files repeatedly
- The previous version's server.js and HTML are for reference only
- Read once at the start of W1 if needed, then don't re-read every session

### B14. No fake test data
- If a test needs a keyword, intent, plan, etc., use seed data or insert real records
- Don't generate placeholder "Lorem ipsum" articles

### B15. Migration safety
- `DROP COLUMN` never (mark deprecated, ignore in code)
- `DROP TABLE` never on tables with data
- Renames go via add new + backfill + remove old, in three separate migrations

---

## C. Hard prohibitions (no exceptions)

1. **Inventing ZIXEL product features** not in `product_features` table
2. **Inventing product steps** not in `feature_steps` table
3. **Inventing competitor names** or competitor features
4. **Hardcoding API keys** in code, prompts, or commits
5. **Catching errors silently**
6. **Adding npm packages** not in tech stack table
7. **Direct `ALTER TABLE`** outside migration files
8. **Skipping QC** before publish
9. **Generating steps** when none exist in DB
10. **Calling LLM** for tasks code can answer deterministically
11. **Hardcoding prompt strings** in code
12. **Bypassing the LLM Gateway** to call provider SDKs directly
13. **Publishing articles** with status not `QC_PASSED`
14. **Reading uploaded `server.js` / `seo-generator-v5_2.html`** more than once per window (they're reference only, not source of truth)
