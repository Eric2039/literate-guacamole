# humanizer_rules.md — 24 AI-flavor detection rules

> Detection rules for the humanizer QC stage. Layer 1 is code (regex / counting / heuristics). Layer 2 is LLM (semantic judgment). Each rule: trigger condition, severity, exemptions, and good/bad examples.

Scoring model:
- Each rule has weight (default 5 points each)
- Article starts at 100
- Each rule violation deducts: `severity_multiplier × occurrence_count × weight`
- `BAN` severity: hit even once = fail regardless of total score
- `WARN` severity: deducts proportionally; pass if total ≥ threshold (default 70)

---

## Layer 1: Code-based rules (1–15)

Pure pattern matching. Fast, deterministic, runs first.

---

### Rule 1: Forbidden term presence

**Layer**: code
**Severity**: per-term (see `forbidden_terms.severity`)
**Trigger**: any occurrence of a term in `forbidden_terms` table (substring match against article body)

**Implementation**: build single regex from all WARN terms, single regex from all BAN terms. Run both against `articles.body` (after section assembly). Count hits.

**Scoring**:
- WARN hits: deduct 2 points per occurrence, capped at 20 points total
- BAN hits: hard fail (set `threshold_passed = false`)

**Exempt**: inside markdown code blocks (between triple backticks) — the article shouldn't have code blocks anyway, but if it does, skip.

**Bad**: `云原生 CAD 提升设计效率,助力数字化转型` (3 EMPTY_BENEFITS hits)
**Good**: `云原生 CAD 让设计文件版本同步从 5 分钟缩短到秒级`

---

### Rule 2: Sequence connectors

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: any occurrence of these sequence markers across paragraphs in the same article:
```
首先 / 其次 / 再次 / 最后 / 第一 / 第二 / 第三
```
Or numeric prefixes `1./2./3.` followed by complete sentences (not list items).

**Implementation**: regex `/(首先|其次|再次|最后|第一|第二|第三)[,,、]/g`. Count occurrences across all section bodies.

**Scoring**: deduct 3 points per hit, capped at 15.

**Exempt**:
- Inside STEPS section (step-by-step is the point there)
- Inside markdown bullet/numbered list (lines starting with `-` or `1.` `2.` etc. in list context)

**Bad**:
> 首先,云原生 CAD 不用下载。其次,它支持协同。再次,版本管理也方便。最后,价格还便宜。

**Good**:
> 云原生 CAD 不用下载,带来的不只是省安装时间——浏览器一打开就是同一个工作环境,协同和版本管理是顺手的事。

---

### Rule 3: Mid-paragraph supplementary connectors

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: words ["另外","此外","同时","还有","并且","除此之外"] appearing **not at start of paragraph** within a section body.

**Implementation**: for each paragraph in section body, regex `/[^。\n](另外|此外|同时|还有|并且|除此之外)/`. Match = hit.

**Scoring**: deduct 2 points per hit. No cap.

**Exempt**:
- The word appears in a quotation
- The word appears in code block

**Bad**:
> 云原生 CAD 不用下载,使用门槛低。另外,它还支持多人协作。
**Good** (split):
> 云原生 CAD 不用下载,使用门槛低。
>
> 多人协作也是顺带的事——同一个文件,多个人同时改,云端实时同步。
**Good** (merge):
> 云原生 CAD 不用下载,使用门槛低,多人协作也是顺带的。

---

### Rule 4: Rule-of-three list pattern

**Layer**: code (heuristic)
**Severity**: WARN
**Trigger**: a paragraph contains a 3-item list (joined by 、 or ,) where each item is itself a benefit/feature, AND the list is preceded or followed by a summary statement.

**Implementation**: detect patterns like:
- `X、Y、Z,这就是...` (3-item list + summary)
- `主要有 X、Y、Z 三个方面` (explicit "three")
- Adjective stacking: 3+ commas/、 separating same-POS phrases in one sentence

Heuristic: count occurrences of `[^,、]{2,8}[、,][^,、]{2,8}[、,][^,、]{2,8}` per paragraph. If count > 1 in same article, hit.

**Scoring**: deduct 4 points per hit, capped at 16.

**Exempt**:
- Inside STEPS or `role_in_arc = HOW_TO_STEP` section
- 3-item list of concrete things (e.g. file format names "DWG、DXF、STEP")

**Bad**:
> ZIXEL 3D CAD 具有高效、便捷、强大三大特点,这就是云原生设计的优势。
**Good**:
> ZIXEL 3D CAD 改变了一件事:文件版本不再靠文件名管,云端帮你管。

---

### Rule 5: Emoji in body

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: any emoji character (Unicode emoji ranges) appearing in `articles.body` or any section's `body`.

**Implementation**: regex `/\p{Emoji}/gu`. Count.

**Scoring**: deduct 5 points per emoji, cap at 30. Three emojis = hard fail.

**Exempt**: none (Chinese B2B SEO never needs emoji)

**Bad**:
> ZIXEL 3D 一览通让评审更简单 ✨ 不用安装 🚀
**Good**:
> ZIXEL 3D 一览通让评审更简单,不用安装。

---

### Rule 6: Bold phrase abuse

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: more than 5 occurrences of `**...**` (markdown bold) in article body, OR bold spans appearing inside every section.

**Implementation**: regex `/\*\*[^*]+\*\*/g`. Count.

**Scoring**: deduct 2 points per occurrence above 5, capped at 20.

**Exempt**: bold around product names (ZIXEL/子虔/3D一览通) doesn't count toward limit if it's the first occurrence in the section.

**Bad**: every paragraph has 2-3 bolded phrases for "emphasis"
**Good**: at most 1-2 bolded items per section, only when truly necessary

---

### Rule 7: Em-dash overuse

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: count of `—` (em-dash, U+2014) in article body > 3.

**Implementation**: count `—` characters.

**Scoring**: deduct 3 points per em-dash above 3.

**Exempt**: dialogue or quotation contexts (none expected in SEO content).

**Bad**: 7 em-dashes in 1500-word article
**Good**: 0-2 em-dashes total, used only where comma/period won't do

---

### Rule 8: Long-sentence average

**Layer**: code (counting)
**Severity**: WARN
**Trigger**: average sentence length in article body > 40 Chinese characters.

**Implementation**: split body by `[。!?\n]`, filter empty, compute mean length.

**Scoring**: deduct 1 point per Chinese character above 40 in average, capped at 15.

**Exempt**: STEPS section sentences (often longer for completeness).

**Bad**: average 55 chars — typical of AI long-clause writing
**Good**: average 25-35 chars — natural Chinese rhythm

---

### Rule 9: Adjective stacking

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: 3+ adjectives in a row before a noun. Heuristic: pattern like `[Adj]、[Adj]、[Adj]的[Noun]`.

**Implementation**: regex `/([的高低快慢强弱大小好坏][,、]){3,}/`. Approximate; refine over time.

**Scoring**: deduct 3 points per occurrence.

**Exempt**: list of concrete characteristics if they're factual (e.g. "DWG、DXF、STEP 等格式").

**Bad**:
> 高效、便捷、强大、专业的云原生 CAD 平台
**Good**:
> 一个云原生 CAD 平台

---

### Rule 10: Banned conclusion phrases

**Layer**: code (regex)
**Severity**: BAN
**Trigger**: AI_SUMMARY_WORDS category (rule 11.2 in inherited_rules.md) appearing anywhere.

```
综上所述, 总而言之, 由此可见, 不难看出, 可以发现, 值得注意的是, 显而易见, 毋庸置疑, 不可否认, 众所周知
```

**Implementation**: regex disjunction.

**Scoring**: each occurrence = hard fail.

**Exempt**: none.

---

### Rule 11: Banned opener patterns

**Layer**: code (regex)
**Severity**: BAN
**Trigger**: first paragraph of article (or first paragraph of INTRO section) matches AI_OPENERS regex from inherited_rules.md §15.

**Scoring**: hit = hard fail.

**Exempt**: none.

---

### Rule 12: Wrong year mention

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: any 4-digit year in body that isn't `__CURRENT_YEAR__` or `__CURRENT_YEAR__ - 1` (for "去年" references).

**Implementation**: regex `/\b(19|20)\d{2}\b/g`. For each match: if year ∉ [CURRENT_YEAR - 1, CURRENT_YEAR + 1], hit.

**Scoring**: deduct 5 points per occurrence.

**Exempt**:
- Inside historical context section ("AutoCAD 1982 年发布" type statements)
- Year version of software (e.g. "AutoCAD 2024" is a product name, not a date)

**Implementation note**: distinguish product version year from date by checking if preceded by product name within 5 chars.

---

### Rule 13: Long paragraph

**Layer**: code (counting)
**Severity**: WARN
**Trigger**: any single paragraph > 200 Chinese characters.

**Implementation**: split body by `\n\n+`, filter empty, check each length.

**Scoring**: deduct 5 points per oversized paragraph.

**Exempt**: STEPS section can have one longer paragraph if step requires explanation.

**Bad**: 350-character single paragraph trying to convey 3-4 ideas
**Good**: 100-150 character paragraphs, one idea each

---

### Rule 14: Header decoration

**Layer**: code (regex)
**Severity**: WARN
**Trigger**: H2 or H3 headers containing:
- Emoji
- Decorative characters: `「」『』`【】`<>` around the whole title
- Trailing exclamation marks
- Numbers like "1." "(1)" preceding the title text (other than the section index itself)

**Implementation**: for each line starting with `## ` or `### `, regex check.

**Scoring**: deduct 3 points per decorated header.

**Exempt**: 「传统CAD软件的局限性」 — bracket-style titles that are integral to the title text, not decoration, are OK. Heuristic: brackets around 4+ chars = title, OK; brackets around full title or as decoration = hit.

---

### Rule 15: Identical sentence-start patterns

**Layer**: code (heuristic)
**Severity**: WARN
**Trigger**: 3+ paragraphs in same article starting with the same opening word.

**Implementation**: for each section, get first word of each paragraph (first 3-5 chars). Count duplicates. Hit if same start word appears in 3+ paragraphs.

**Scoring**: deduct 4 points per duplicate set.

**Exempt**: list-context paragraphs (numbered/bulleted lists).

**Bad**: every paragraph in section starts with "对于..." or "在..."
**Good**: varied paragraph openings

---

## Layer 2: LLM-based rules (16–24)

Semantic judgment. Runs only if Layer 1 didn't hard-fail. Single LLM call with structured output scoring each.

The prompt for Layer 2 lives in `prompts/qc_humanizer_l2.md`.

---

### Rule 16: Voice authenticity

**Layer**: LLM
**Severity**: WARN
**Trigger**: writing reads like sales-flyer voice, not engineer-to-engineer.

**LLM judgment criteria**:
- Does the article use product-page marketing tone?
- Are there phrases that sound like brochure copy?
- Could this be replaced with a press release with minor edits?

**Score**: 0-10 (10 = clearly engineer voice, 0 = clearly marketing voice)
**Scoring**: deduct `(10 - score) × 1` points, max 10.

**Bad**:
> ZIXEL 云原生 CAD 重磅推出,为企业研发协同注入新动力!
**Good**:
> ZIXEL 的版本管理是云端的,所以"final_v3_real_final.dwg" 这种文件名不会再出现。

---

### Rule 17: Forced transitions

**Layer**: LLM
**Severity**: WARN
**Trigger**: paragraph-to-paragraph transitions are mechanical bridges rather than natural argument flow.

**LLM judgment criteria**:
- Do paragraphs connect through reasoning, or through filler words?
- Are there moments where one paragraph's conclusion is restated as the next paragraph's intro?
- Could you delete the first sentence of paragraph N+1 without losing meaning?

**Score**: 0-10
**Scoring**: deduct `(10 - score) × 1`.

---

### Rule 18: Repetition under different words

**Layer**: LLM
**Severity**: WARN
**Trigger**: the same idea is stated multiple times in the article under slightly varied phrasings, padding word count without adding info.

**Score**: 0-10
**Scoring**: deduct `(10 - score) × 1`.

**Bad**: article says "云端 CAD 不需要安装" in §1, then "无需下载即可使用" in §2, then "免安装的设计平台" in §3 — same idea three times.

---

### Rule 19: Hollow specifics

**Layer**: LLM
**Severity**: WARN
**Trigger**: article uses vague quantifiers ("一些"/"许多"/"大量"/"显著") instead of concrete numbers, version names, or named steps, where concrete info would be possible.

**Score**: 0-10 (10 = consistently concrete, 0 = consistently vague)
**Scoring**: deduct `(10 - score) × 1.5`, max 15.

**Bad**:
> 云原生 CAD 大幅提升了协作效率。
**Good**:
> 同一个文件 5 个人同时编辑,改动一秒同步,不用再发 "改完了的版本" 邮件。

---

### Rule 20: Conclusion by assertion

**Layer**: LLM
**Severity**: WARN
**Trigger**: article makes claims without supporting evidence — declares benefits as fact rather than demonstrating them.

**Score**: 0-10 (10 = claims always grounded in mechanism/example, 0 = claims always asserted)
**Scoring**: deduct `(10 - score) × 1`.

**Bad**:
> ZIXEL 3D 一览通帮助企业大幅提升评审效率。
**Good**:
> ZIXEL 3D 一览通的评审是在模型上批注,不用截图发邮件。文件越多,这套流程省的时间越明显。

---

### Rule 21: Limitations admitted (ME mode only)

**Layer**: LLM
**Severity**: WARN
**Trigger**: in ME mode, article never admits any limitation or scenario where ZIXEL might not be the best fit. Always 100% positive about ZIXEL.

**Applies**: only when `flow_mode = ME`. Skip this rule entirely for DIRECTOR mode.

**Score**: 0-10 (10 = naturally acknowledges limitations, 0 = uniformly positive)
**Scoring**: deduct `(10 - score) × 1`, max 10. Only applied if `flow_mode = ME`.

**Bad** (in ME mode):
> ZIXEL 适合所有团队。
**Good** (in ME mode):
> 如果你的工作流离不开 SolidWorks 的某个高级功能,ZIXEL 目前还不能完全替代——它的强项是协同和云端访问,不是单机建模深度。

---

### Rule 22: Persona consistency

**Layer**: LLM
**Severity**: WARN
**Trigger**: article voice shifts across sections — some sections sound like 子虔小编 (engineer talking to engineer), others sound like product page copy.

**Score**: 0-10
**Scoring**: deduct `(10 - score) × 0.5`, max 5.

---

### Rule 23: Structural mechanical feel

**Layer**: LLM
**Severity**: WARN
**Trigger**: article structure obviously follows a template — every section's purpose is announced by its title in a templated way.

**Score**: 0-10 (10 = sections flow as needed by content, 0 = sections obviously slotted into template)
**Scoring**: deduct `(10 - score) × 0.5`.

---

### Rule 24: Reads-like-AI gut check

**Layer**: LLM
**Severity**: WARN (composite)
**Trigger**: composite "if I read this without knowing, would I think it was AI?" judgment by LLM.

**Score**: binary 0 or 10 + 1-line explanation
**Scoring**: 0 = deduct 15 points; 10 = no deduction.

This is the catch-all. Rules 1-23 cover specific patterns; rule 24 catches what they miss.

---

## Overall scoring summary

```
final_score = 100
  - rule_1_deductions  (forbidden terms, cap 20)
  - rule_2_deductions  (sequence connectors, cap 15)
  - rule_3_deductions  (mid-para supplements)
  - rule_4_deductions  (rule-of-three, cap 16)
  - rule_5_deductions  (emoji, cap 30)
  - rule_6_deductions  (bold abuse, cap 20)
  - rule_7_deductions  (em-dash)
  - rule_8_deductions  (long sentences, cap 15)
  - rule_9_deductions  (adjective stacking)
  - rule_10_BAN        (hard fail if hit)
  - rule_11_BAN        (hard fail if hit)
  - rule_12_deductions (wrong year)
  - rule_13_deductions (long paragraphs)
  - rule_14_deductions (header decoration)
  - rule_15_deductions (sentence-start repetition)
  - rule_16_deductions (voice, cap 10)
  - rule_17_deductions (transitions, cap 10)
  - rule_18_deductions (repetition, cap 10)
  - rule_19_deductions (hollow specifics, cap 15)
  - rule_20_deductions (conclusion by assertion, cap 10)
  - rule_21_deductions (limitations, ME only, cap 10)
  - rule_22_deductions (persona, cap 5)
  - rule_23_deductions (structural, cap 5)
  - rule_24_deduction  (gut check, 0 or 15)

pass = (rule_10 not hit) AND (rule_11 not hit) AND (final_score ≥ threshold)

default threshold = 70 (from quality_thresholds table)
```

---

## Output shape for QC stage

After running all 24 rules:

```typescript
{
  layer: 'COMBINED',  // both code + LLM done
  overall_score: 78,
  threshold_passed: true,
  checks: {
    rule_1_forbidden_terms: { hits: 2, deduction: 4, terms_hit: ['提升', '助力'] },
    rule_2_sequence_connectors: { hits: 0, deduction: 0 },
    rule_3_mid_para_supplements: { hits: 1, deduction: 2, examples: ['...另外...'] },
    rule_4_rule_of_three: { hits: 0, deduction: 0 },
    rule_5_emoji: { hits: 0, deduction: 0 },
    rule_6_bold_abuse: { hits: 3, deduction: 0 },
    rule_7_em_dash: { hits: 2, deduction: 0 },
    rule_8_long_sentences: { avg_length: 32, deduction: 0 },
    rule_9_adjective_stacking: { hits: 0, deduction: 0 },
    rule_10_banned_conclusion: { hit: false },
    rule_11_banned_opener: { hit: false },
    rule_12_wrong_year: { hits: 0, deduction: 0 },
    rule_13_long_paragraphs: { hits: 1, deduction: 5, paragraph_indexes: [3] },
    rule_14_header_decoration: { hits: 0, deduction: 0 },
    rule_15_repeated_starts: { hits: 0, deduction: 0 },
    rule_16_voice: { score: 8, deduction: 2 },
    rule_17_transitions: { score: 7, deduction: 3 },
    rule_18_repetition: { score: 9, deduction: 1 },
    rule_19_hollow_specifics: { score: 6, deduction: 6 },
    rule_20_conclusion_assertion: { score: 8, deduction: 2 },
    rule_21_limitations_admitted: { score: 5, deduction: 5, note: "only checked in ME mode" },
    rule_22_persona_consistency: { score: 9, deduction: 0.5 },
    rule_23_structural_mechanical: { score: 7, deduction: 1.5 },
    rule_24_gut_check: { score: 10, deduction: 0, llm_note: "reads natural" }
  },
  issues: [
    { rule: 'rule_1', severity: 'WARN', detail: 'Terms 提升, 助力 (categorized EMPTY_BENEFITS)' },
    { rule: 'rule_3', severity: 'WARN', detail: 'Mid-paragraph 另外 in section 2' },
    { rule: 'rule_13', severity: 'WARN', detail: 'Section 3 has 240-char paragraph' },
    { rule: 'rule_19', severity: 'WARN', detail: 'Article uses vague benefits without numbers in §1, §4' }
  ]
}
```

This is what gets written to `quality_checks.checks` JSONB and `quality_checks.issues` JSONB.

---

## Implementation guide for Claude Code

1. Layer 1 implementation files under `lib/humanizer/rules/`:
   - `rule-01-forbidden-terms.ts` through `rule-15-repeated-starts.ts`
   - Each exports a function `(article: Article) => RuleResult`
   - `lib/humanizer/code-checks.ts` runs all 15 in parallel, collects results

2. Layer 2:
   - `lib/humanizer/llm-checks.ts` calls `LLMGateway` with stage `QC_HUMANIZER`
   - The prompt is `qc_humanizer_l2` from `prompts` table
   - Output JSON schema validated; failed validation → retry once → if still failing, log to `generation_runs` and skip layer 2 (use only layer 1 score)

3. Orchestration:
   - `lib/humanizer/index.ts` exports `runHumanizerQC(article): Promise<QualityCheck>`
   - Returns the combined result
   - Trigger.dev job `qc_humanizer` calls this function

4. Rule weight tuning:
   - Weights can be adjusted later by editing `quality_thresholds.individual_min` JSONB
   - First version uses defaults stated above

---

## Appendix: Kazik adapted forbidden terms & punctuation

> 来源: `KazikSkillReference/SKILL.md` 的 L1 自检层。卡兹克写的是公众号长文, ZIXEL 写 SEO 文章, **不整体套用**。下面只列从卡兹克 skill 借用且对 SEO 也适用的部分。完整说明见 `reference/kazik_adaptation.md`。

**Forbidden terms (adapted from Kazik L1)**: 见 `reference/kazik_adaptation.md §1.1` (15 个词)。MVP 阶段在 `mvp/constants.ts` 硬编码; 工程化阶段进 `forbidden_terms` 表 (severity 设为 WARN 或 BAN 按团队判断)。

**Forbidden punctuation (adapted from Kazik L1)**: 见 `reference/kazik_adaptation.md §1.2` (冒号 / 破折号 / 双引号)。这些不进 `forbidden_terms` 表 (那是词的表), 工程化阶段加一个独立的 punctuation scanner, 或合并进 humanizer Layer 1 的 code-based rule (建议新加一条 Rule 16: forbidden-punctuation)。

**整合细节 + 不迁移的元素**: 完整列表见 `reference/kazik_adaptation.md §2`。
