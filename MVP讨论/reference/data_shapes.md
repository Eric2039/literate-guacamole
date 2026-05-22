# data_shapes.md — JSONB field shapes

> Every JSONB field in the schema gets a TypeScript shape + a real example. Drizzle types should match these definitions exactly. When writing or reading any JSONB, look here.

---

## 1. `feature_steps.steps`

The step-by-step instructions for using a product feature. Used in `STEPS` sections of how_to-style articles.

**TypeScript shape**:
```typescript
type FeatureStep = {
  step_number: number;       // 1-based
  action: string;            // user-facing action description
  detail?: string;           // optional elaboration
  screenshot?: string;       // optional image URL
};

type FeatureStepsArray = FeatureStep[];
```

**Real example** (for feature: 3D一览通的实时批注):
```json
[
  {
    "step_number": 1,
    "action": "登录 ZIXEL 3D 一览通",
    "detail": "访问 https://www.zixel3d.com/product/viewer 用企业账号登录"
  },
  {
    "step_number": 2,
    "action": "上传或选择已有模型",
    "detail": "支持 DWG/STP/SLDPRT 等 50+ 格式,直接拖拽到浏览器"
  },
  {
    "step_number": 3,
    "action": "邀请评审人员",
    "detail": "点击右上角分享,输入评审人员邮箱或选择已有团队"
  },
  {
    "step_number": 4,
    "action": "进入批注模式",
    "detail": "点击工具栏批注按钮,在模型表面任意位置点击添加批注"
  },
  {
    "step_number": 5,
    "action": "实时同步与回复",
    "detail": "所有人看到的批注是实时同步的,可以回复、@他人、标记已解决"
  }
]
```

**Notes**:
- `step_number` is sequential and starts at 1
- `action` is the headline of the step (will be turned into bold/numbered in output)
- `detail` is the explanatory text (optional)
- LLM in STEPS section consumes this and weaves it into prose, not just a bulleted list

---

## 2. `article_plans.key_points`

3-5 sub-claims the article must establish to prove the thesis.

**TypeScript shape**:
```typescript
type KeyPoint = {
  point: string;             // one-sentence claim
  section_hint?: string;     // optional hint about which section discusses this
};

type KeyPointsArray = KeyPoint[];
```

Note: simple array of strings is also valid (when no section_hint needed). Code should handle both shapes.

**Real example**:
```json
[
  {
    "point": "exb 是 CAXA 电子图板的专有格式",
    "section_hint": "CONTEXT section"
  },
  {
    "point": "传统做法是装 CAXA,但只为看图装 GB 级软件不划算",
    "section_hint": "COMPARE_OPTIONS section"
  },
  {
    "point": "云端在线工具不下载就能打开",
    "section_hint": "BRIDGE_TO_PRODUCT section"
  },
  {
    "point": "ZIXEL 3D 一览通支持测量、批注、协同评审",
    "section_hint": "BRIDGE_TO_PRODUCT section"
  }
]
```

---

## 3. `article_plans.narrative_arc`

The flow logic of the article. Free-form keys per intent_type but follows a common pattern.

**TypeScript shape**:
```typescript
type NarrativeArc = {
  intro?: string;            // opener purpose
  context?: string;          // background-setting purpose
  options_review?: string;   // covering alternatives purpose
  cause_analysis?: string;   // root-cause purpose
  solution_bridge?: string;  // transition to solution
  product_mention?: string;  // when/how to mention ZIXEL
  close?: string;            // closing purpose
  [custom_key: string]: string | undefined;
};
```

**Real example** (for solve intent):
```json
{
  "intro": "open with the moment user receives an exb file with no CAXA installed",
  "context": "briefly explain what exb is and why standard viewers don't open it",
  "options_review": "compare installing CAXA vs cloud-based viewers",
  "solution_bridge": "introduce the cloud-only approach as the leaner answer",
  "product_mention": "ZIXEL 3D 一览通 as one such tool, focusing on its 50+ format support and shareable annotation",
  "close": "one-sentence takeaway tying back to the opening moment"
}
```

**Real example** (for learn intent in ME mode, no product_mention):
```json
{
  "intro": "frame reader's curiosity or moment of confusion about the concept",
  "context": "concept definition and core characteristics",
  "common_misconceptions": "what people typically get wrong",
  "practical_handling": "how to deal with it in practice",
  "close": "one-sentence summary"
}
```

---

## 4. `article_plans.competitor_diff_analysis`

SerpAPI top-N analysis used to decide `differentiation_strategy`.

**TypeScript shape**:
```typescript
type CompetitorDiffAnalysis = {
  serp_count: number;                  // how many articles analyzed
  common_focus_points: string[];       // angles most competitors cover
  common_gaps: string[];               // angles few or none cover
  potential_gaps_worth_filling: string[];  // gaps that ALSO seem user-relevant
  competitor_dominant_terms: string[]; // words competitors overuse
  analysis_note: string;               // free-text LLM note
};
```

**Real example**:
```json
{
  "serp_count": 10,
  "common_focus_points": [
    "how to install CAXA",
    "list of CAXA alternative software",
    "feature comparison chart"
  ],
  "common_gaps": [
    "cloud-only viewing without installation",
    "how to handle exb in mixed-team workflow",
    "what to do when receiver has Mac"
  ],
  "potential_gaps_worth_filling": [
    "cloud-only viewing without installation"
  ],
  "competitor_dominant_terms": [
    "免费下载", "破解", "兼容性"
  ],
  "analysis_note": "Most competitors push installation routes. Cloud-only is a genuine gap and user-relevant since the search intent implies wanting a quick solution."
}
```

If `potential_gaps_worth_filling` is non-empty, gen_plan likely picks `ANGLE_GAP` strategy. If empty but `common_focus_points` are weak, picks `DEPTH`. Otherwise `STANDARD`.

---

## 5. `article_skeletons.sections`

The section-by-section outline. Each item shapes a section to be written by `gen_section`.

**TypeScript shape**:
```typescript
type SectionSpec = {
  index: number;                       // 0-based
  tag: 'INTRO' | 'H2' | 'H3' | 'STEPS' | 'ZIXEL' | 'CTA';
  title: string;                       // final section title
  brief: string;                       // what to cover, ≤80 chars
  role_in_arc: RoleInArc;
  requires_feature_id: boolean;
  feature_id: string | null;           // UUID if required (for STEPS or ZIXEL)
  word_target: string;                 // e.g. "150-200字"
  upstream_summary?: string;           // 1-sentence summary of previous section, for continuity
};

type RoleInArc =
  | 'INTRO_PAIN'
  | 'ANALYZE_CAUSE'
  | 'COMPARE_OPTIONS'
  | 'HOW_TO_STEP'
  | 'BRIDGE_TO_PRODUCT'
  | 'CTA'
  | 'CONTEXT'
  | 'CONCLUSION';
```

**Real example** (solve × DIRECTOR skeleton):
```json
[
  {
    "index": 0,
    "tag": "INTRO",
    "title": "前言",
    "brief": "收到 exb 却没装 CAXA 的尴尬时刻",
    "role_in_arc": "INTRO_PAIN",
    "requires_feature_id": false,
    "feature_id": null,
    "word_target": "100-150字"
  },
  {
    "index": 1,
    "tag": "H2",
    "title": "exb 是什么,为什么常规软件打不开",
    "brief": "exb 是 CAXA 专有格式,通用看图软件不支持",
    "role_in_arc": "ANALYZE_CAUSE",
    "requires_feature_id": false,
    "feature_id": null,
    "word_target": "150-200字",
    "upstream_summary": "Reader has an exb file and no CAXA installed"
  },
  {
    "index": 2,
    "tag": "H2",
    "title": "装 CAXA 和不装 CAXA 两条路",
    "brief": "对比本地装 CAXA 和云端在线两种方案的代价",
    "role_in_arc": "COMPARE_OPTIONS",
    "requires_feature_id": false,
    "feature_id": null,
    "word_target": "150-200字",
    "upstream_summary": "exb is a CAXA-specific format"
  },
  {
    "index": 3,
    "tag": "STEPS",
    "title": "用浏览器打开 exb 的具体步骤",
    "brief": "三步操作,从上传到查看",
    "role_in_arc": "HOW_TO_STEP",
    "requires_feature_id": true,
    "feature_id": "feature-uuid-3d-viewer-multi-format",
    "word_target": "150-200字",
    "upstream_summary": "Cloud-based viewing is the lighter option"
  },
  {
    "index": 4,
    "tag": "ZIXEL",
    "title": "推荐子虔 Zixel 3D 一览通",
    "brief": "本场景下选 3D 一览通的核心优势",
    "role_in_arc": "BRIDGE_TO_PRODUCT",
    "requires_feature_id": true,
    "feature_id": "feature-uuid-3d-viewer-50-formats",
    "word_target": "150-200字",
    "upstream_summary": "Steps showed how cloud-based viewing works in practice"
  },
  {
    "index": 5,
    "tag": "CTA",
    "title": "CTA",
    "brief": "",
    "role_in_arc": "CTA",
    "requires_feature_id": false,
    "feature_id": null,
    "word_target": "30-50字"
  }
]
```

**Notes**:
- `feature_id` for STEPS = the feature whose `feature_steps` is consumed
- `feature_id` for ZIXEL = the feature being highlighted (one feature only per ZIXEL section, by design)
- `upstream_summary` is generated by `gen_skeleton` to give each section continuity with the previous

---

## 6. `quality_checks.checks`

Detailed per-rule scoring. Schema depends on `check_type`.

### 6.1 For `check_type = HUMANIZER`

See `humanizer_rules.md` § "Output shape for QC stage" for the full example.

Summary shape:
```typescript
type HumanizerChecks = {
  [ruleKey: string]: {  // keys: 'rule_1_forbidden_terms' through 'rule_24_gut_check'
    hits?: number;       // for code rules
    score?: number;      // for LLM rules (0-10)
    deduction: number;
    [other_field: string]: any;
  };
};
```

### 6.2 For `check_type = QUALITY`

Quality QC has different rules:

```typescript
type QualityChecks = {
  word_count: {
    actual: number;
    target_min: number;
    target_max: number;
    deduction: number;
  };
  forbidden_term_hits: {
    bans: string[];
    warns: string[];
    deduction: number;
  };
  competitor_mention_violations: {
    violations: { section_index: number; competitor: string; reason: string }[];
    deduction: number;
  };
  product_feature_accuracy: {
    features_mentioned: string[];      // names from article
    features_unknown: string[];        // not in product_features table
    deduction: number;
  };
  feature_steps_accuracy: {
    steps_sections: number;
    steps_with_valid_feature_id: number;
    deduction: number;
  };
  thesis_coherence: {                  // LLM
    score: number;                     // 0-10
    deduction: number;
    note?: string;
  };
  brand_voice: {                       // LLM
    score: number;
    deduction: number;
  };
  uniqueness_vs_serp: {                // LLM (semantic)
    score: number;
    deduction: number;
    note?: string;
  };
  structure_score: {                   // LLM
    score: number;
    deduction: number;
  };
};
```

### 6.3 For `check_type = MANUAL`

```typescript
type ManualChecks = {
  reviewer: string;
  decision: 'OVERRIDE_PASS' | 'CONFIRM_FAIL';
  note: string;
};
```

---

## 7. `quality_checks.issues`

Flat list of issue records. UI uses this to surface findings.

**TypeScript shape**:
```typescript
type Issue = {
  rule: string;                        // e.g. 'rule_1', 'word_count', 'competitor_mention'
  severity: 'BAN' | 'WARN';
  detail: string;                      // human-readable description
  section_index?: number;              // if locatable to a section
  suggested_fix?: string;              // optional LLM-generated suggestion
};

type IssuesArray = Issue[];
```

**Real example**:
```json
[
  {
    "rule": "rule_1_forbidden_terms",
    "severity": "WARN",
    "detail": "Terms 提升、助力 found 3 times (category EMPTY_BENEFITS)",
    "suggested_fix": "Replace with concrete outcomes: '设计文件版本同步从 5 分钟缩短到秒级'"
  },
  {
    "rule": "competitor_mention",
    "severity": "BAN",
    "detail": "AutoCAD mentioned in section 1 (INTRO_PAIN); only COMPARE_OPTIONS sections allow competitor names for choose/replace intents",
    "section_index": 1,
    "suggested_fix": "Remove AutoCAD mention from intro"
  },
  {
    "rule": "rule_19_hollow_specifics",
    "severity": "WARN",
    "detail": "Article uses 'multiple', 'a lot of', 'significant' instead of numbers in §2 and §4",
    "suggested_fix": "Add specific numbers or remove vague modifiers"
  }
]
```

---

## 8. `generation_runs.input_payload`

Whatever was passed into the LLM call. Shape varies by stage.

**General TypeScript shape**:
```typescript
type GenerationRunInput = {
  prompt_rendered: string;             // final prompt after Jinja substitution
  prompt_variables: Record<string, any>; // values that filled the template
  llm_request: {
    model: string;
    temperature: number;
    max_tokens: number;
    messages?: Array<{ role: string; content: string }>;
    response_format?: { type: string };
  };
  context?: Record<string, any>;       // anything else useful for debugging
};
```

**Real example** (for `gen_intent` call):
```json
{
  "prompt_rendered": "你是一个 SEO 意图分析师...\n关键词: dwg打不开\nCluster context: 文件打开问题相关\n...(full rendered prompt)...",
  "prompt_variables": {
    "keyword": "dwg打不开",
    "cluster_name": "文件打开问题相关",
    "current_year": "2026",
    "category_list": ["CAD文件", "CAD常见问题", "..."]
  },
  "llm_request": {
    "model": "moonshot-v1-32k",
    "temperature": 0.3,
    "max_tokens": 1500,
    "response_format": { "type": "json_object" }
  },
  "context": {
    "keyword_id": "kw-uuid-123",
    "trigger_run_id": "trig-run-abc"
  }
}
```

**Redact rule**: never include API keys, tokens, webhook URLs in `input_payload`. If `prompt_variables` would expose them, replace with `"<REDACTED>"`.

---

## 9. `generation_runs.output_payload`

The LLM response and parsed result.

**TypeScript shape**:
```typescript
type GenerationRunOutput = {
  raw_response: string;                // exact text from LLM
  parsed: any;                         // JSON.parse result if applicable
  finish_reason?: string;              // 'stop' / 'length' / 'tool_calls'
  validation: {
    schema_valid: boolean;
    errors?: string[];
  };
};
```

**Real example**:
```json
{
  "raw_response": "{\"intents\":[{\"keyword_type\":\"solve\",\"role\":\"机械工程师\",...}]}",
  "parsed": {
    "intents": [
      {
        "keyword_type": "solve",
        "role": "机械工程师",
        "scenario": "在公司电脑上想打开供应商发来的 dwg 文件,系统提示没有关联程序",
        "constraint": "想免费、不想装大软件",
        "article_angle": "不用装 AutoCAD 也能打开 dwg 的几种方式",
        "category": "CAD文件"
      },
      {
        "keyword_type": "solve",
        "role": "工艺工程师",
        "scenario": "现场用平板想看 dwg 图纸,平板上没有 CAD 软件",
        "constraint": "需要移动端方案",
        "article_angle": "在平板和手机上打开 dwg 的方法",
        "category": "CAD文件"
      }
    ]
  },
  "finish_reason": "stop",
  "validation": {
    "schema_valid": true
  }
}
```

On failure:
```json
{
  "raw_response": "Some malformed text...",
  "parsed": null,
  "finish_reason": "stop",
  "validation": {
    "schema_valid": false,
    "errors": ["Expected JSON object, got text", "Missing required field 'intents'"]
  }
}
```

---

## 10. `hot_topics.proposed_keywords`

Simple text array of Pillar keywords from the OpenClaw report.

**TypeScript shape**: `string[]`

**Real example**:
```json
[
  "云原生设计工具基础设施",
  "代码化配置",
  "Dockerfile",
  "容器化开发",
  "Infrastructure as Code"
]
```

---

## 11. `keyword_intents.flow_mode`

Not JSONB but enum, listing here for completeness:

```typescript
type FlowMode = 'DIRECTOR' | 'ME';
```

Default: `DIRECTOR`.

---

## 12. `prompts.content` template variables

`prompts.content` is plain text (not JSONB) but uses Jinja-style variables. The variable list per stage is documented here for reference.

### Available variables by stage

#### `INTENT` stage
```
{{ keyword }}                    - the keyword string
{{ cluster_name }}               - parent cluster name (or empty)
{{ similar_keywords }}           - array of strings, in cluster
{{ current_year }}               - 4-digit year
{{ category_list }}              - array of 10 valid categories
{{ role_list }}                  - array of 10 valid roles
{{ flow_mode }}                  - 'DIRECTOR' or 'ME'
```

#### `PLAN` stage
```
{{ intent }}                     - full intent object
{{ serp_summary }}               - top-N SerpAPI summary
{{ competitor_diff_analysis }}   - pre-analyzed gaps
{{ product_library }}            - all product_features as structured text
{{ forbidden_terms_categorized }} - dict of category → terms
{{ flow_mode }}
{{ current_year }}
```

#### `SKELETON` stage
```
{{ plan }}                       - full plan object
{{ template_default }}           - default skeleton template for intent_type × flow_mode
{{ flow_mode }}
{{ feature_available_for_steps }} - list of features with non-empty feature_steps
```

#### `SECTION_GENERIC` / `SECTION_ZIXEL` / `SECTION_STEPS` stage
```
{{ section_spec }}               - SectionSpec object for this section
{{ article_title }}
{{ thesis }}
{{ upstream_summary }}           - last section's tail
{{ persona_anchor }}             - verbatim text
{{ anti_verbose_rule }}          - verbatim text
{{ style_anchor }}               - flow-mode-specific
{{ forbidden_terms_warn }}       - array of WARN-severity terms
{{ forbidden_terms_ban }}        - array of BAN-severity terms
{{ banned_openers_regex }}       - readable list of patterns
{{ competitor_rule }}            - generated text per buildCompetitorRule
{{ product_feature }}            - feature object (for ZIXEL/STEPS sections only)
{{ feature_steps }}              - steps array (for STEPS only)
{{ current_year }}
{{ flow_mode }}
```

#### `QC_HUMANIZER` stage (Layer 2)
```
{{ article_body }}               - full article text
{{ flow_mode }}                  - controls rule 21 evaluation
{{ rules_to_evaluate }}          - ['rule_16', 'rule_17', ..., 'rule_24']
```

#### `QC_QUALITY` stage (Layer 2)
```
{{ article_body }}
{{ thesis }}
{{ key_points }}
{{ plan }}
{{ serp_top_summaries }}         - for uniqueness check
```

#### `PARSE_HOT` stage
```
{{ raw_report_text }}
{{ category_list }}              - 10 valid categories
```

#### `FETCH_COMPETITOR` stage
```
{{ competitor_name }}
{{ website_html }}               - fetched page text
```

#### `NORMALIZE_KEYWORD` stage
```
{{ raw_text }}                   - keyword input
```
(Although normalize is mostly code, this stage exists as a fallback for edge cases code can't handle, e.g. translation requests.)

---

## 13. Validation rules

All JSONB writes should validate against the TypeScript shape via Zod schemas in `lib/db/schema.ts`. Specifically:

| Field | Zod schema name |
|---|---|
| feature_steps.steps | `FeatureStepsSchema` |
| article_plans.key_points | `KeyPointsSchema` |
| article_plans.narrative_arc | `NarrativeArcSchema` |
| article_plans.competitor_diff_analysis | `CompetitorDiffAnalysisSchema` |
| article_skeletons.sections | `SectionSpecArraySchema` |
| quality_checks.checks (HUMANIZER) | `HumanizerChecksSchema` |
| quality_checks.checks (QUALITY) | `QualityChecksSchema` |
| quality_checks.issues | `IssuesArraySchema` |
| generation_runs.input_payload | `GenerationRunInputSchema` |
| generation_runs.output_payload | `GenerationRunOutputSchema` |

W1 must create these schemas. Workers use them on every write/read to fail loudly on malformed data.
