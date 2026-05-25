# mvp/run.md — MVP script specification

> 阶段 1 (单关键词单篇文章) 的脚本规格。本文件 = 脚本的设计文档, 读它就能理解 `run.ts` / `prompts.ts` / `constants.ts` 之间的关系, 也是 review 失败后回头调整的入口。
>
> **不在范围 (推迟到聚类阶段或工程化阶段)**: 多关键词聚类 / DB / job queue / admin UI / Feishu 推送 / 自动 humanizer 完整 15 条 / publish 检查。详见 `specs/branch-mvp/ROADMAP.md` §不做的事。

---

## 1. CLI

```bash
pnpm tsx mvp/run.ts "<keyword>" [--no-serp] [--l2] [--out-dir=output]
```

| 参数 | 含义 | 默认 |
|---|---|---|
| `<keyword>` | 主关键词, 中文或中英混合 | 必填 |
| `--no-serp` | 跳过 SerpAPI, gen_plan 不带 competitor_outlines | off |
| `--l2` | 跑可选的 humanizerL2 LLM 评分 | off |
| `--out-dir` | 输出根目录 | `mvp/output` |

**示例**:

```bash
pnpm tsx mvp/run.ts "dwg 文件打不开怎么办"
pnpm tsx mvp/run.ts "STP 文件是什么意思" --no-serp --l2
```

**Exit codes**: `0` 全部成功; `1` 任意 LLM 调用失败超过重试; `2` gen_plan 重试 3 次都验证不过; `3` SerpAPI 出错且无 `--no-serp`。

**环境变量** (从 `.env.local` 读, 不进 git):

```
MOONSHOT_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
SERPAPI_KEY=...
DEFAULT_PROVIDER=moonshot       # 或 deepseek
DEFAULT_MODEL=moonshot-v1-32k
SERP_CACHE_TTL_HOURS=24
```

---

## 2. 文件结构

```
mvp/
├── run.md                         # 本文件
├── run.ts                         # 主脚本
├── prompts.ts                     # 4 个 prompt 模板 (TS 常量, MVP 豁免 B11)
├── constants.ts                   # ZIXEL_FEATURES, FORBIDDEN_TERMS, KAZIK_FORBIDDEN_TERMS, ROLE/UNIVERSAL/MODE/INTENT_CONSTRAINTS
├── llm.ts                         # LLM provider 封装 (Moonshot + DeepSeek)
├── serp.ts                        # SerpAPI 调用 + 本地 JSON cache
├── validate.ts                    # validateOutline (代码驱动 gen_skeleton 等价物)
├── humanizer-scan.ts              # quickHumanizerScan, 扫 6 项
├── assemble.ts                    # 段落 markdown 拼装 + frontmatter
├── output/
│   └── {keyword-slug}-{ISO 时间}/
│       ├── article.md             # 最终产物, 给用户眼睛看
│       ├── trace.json             # 每个 LLM 调用的完整记录 (见 §5)
│       ├── plan.json              # gen_plan 输出, 单独保存方便 review
│       ├── humanizer_scan.json    # quickHumanizerScan 结果
│       ├── review.md              # 空模板, 用户手填 (见 §7)
│       └── serp_cache.json        # 该关键词的 SerpAPI 原始结果 (本次跑用的)
└── cache/
    └── serp/
        └── {sha256(keyword)}.json # 24h 内同关键词复用
```

**slug 规则**: 关键词 → trim → lowercased ASCII / 拼音化中文? **不拼音**, 直接用关键词 + 时间戳的 sha8 前缀:
`{keyword 取前 20 字 → 去标点 → 空格转 -}-{ISO 时间, 秒精度, 冒号转 -}`

例: `dwg-文件打不开怎么办-2026-05-22T14-03-11`

---

## 3. 主流程 (按调用顺序)

```
1. parseArgs                    →  { keyword, noSerp, l2, outDir }
2. classifyIntent (LLM #1)      →  { intent_type, scenario, category }
3. fetchSerpOutlines            →  CompetitorOutline[]   (走 cache 或调 SerpAPI)
4. genPlan (LLM #2, 重试 ≤ 3)   →  GenPlanOutput   (validateOutline 通过)
5. genSection × N (LLM #3, 并行) →  SectionOutput[]
6. assembleArticle              →  markdown string
7. quickHumanizerScan           →  HumanizerScanResult
8. (--l2) humanizerL2 (LLM #4)  →  { score, issues[] }      // 可选
9. writeOutputs                 →  写入 article.md / trace.json / plan.json / humanizer_scan.json / review.md
10. 控制台打印产物路径
```

**并行注意**: Step 5 并发 ≤ 4 (避免 Moonshot rate limit), 用 `Promise.allSettled` + 失败重试 1 次。

---

## 4. 4 个 LLM 调用 schema

> 所有 LLM 调用走 `llm.ts` 的 `callLLM(prompt, opts)`, 返回 `{ raw, parsed, tokens, cost_usd, duration_ms, model, provider }`。解析失败 → 重试 1 次 (温度降 0.1)。

### 4.1 classifyIntent (LLM #1)

**输入**:

```typescript
type ClassifyInput = {
  keyword: string;
};
```

**Prompt**: 见 `prompts.ts` `CLASSIFY_INTENT_PROMPT`。任务: 把关键词分到 5 个 intent 之一 (`learn` / `solve` / `choose` / `replace` / `understand`) + 给出 1 句 scenario 描述 + 选 1 个 category (从 §6 inherited_rules 的 10 个 enum 里挑)。

**输出 (LLM 必须返回 JSON)**:

```typescript
type ClassifyOutput = {
  intent_type: "learn" | "solve" | "choose" | "replace" | "understand";
  scenario: string;            // 1 句, 描述读者搜索时的真实处境, 例: "工程师拿到外部供应商 dwg 但本地软件打不开, 急需在线方案"
  category: string;            // 从 inherited_rules §6 10 选 1
  reasoning: string;           // 1-2 句, 解释为什么分这个 intent
};
```

**MVP 简化**: 即使 LLM 分错也不阻塞, 用户在 review.md 标注后下一轮调 prompt。MVP 默认跑 `solve` 关键词, 所以 classify 主要是验证 prompt 能正确识别 solve, 而不是必须 100% 准确。

### 4.2 fetchSerpOutlines (非 LLM)

**输入**: `keyword: string`

**逻辑**:

1. `cacheKey = sha256(keyword)`
2. 看 `mvp/cache/serp/{cacheKey}.json` 是否存在且 `Date.now() - mtime < TTL`
3. 命中 → 读 cache 返回
4. 未命中 → 调 SerpAPI (`engine=baidu`, `q=keyword`, `num=10`)
5. 抽 title + snippet 各前 10 条 → 构造 `CompetitorOutline[]`
6. 写 cache + 复制到本次输出目录 `serp_cache.json`

**输出**:

```typescript
type CompetitorOutline = {
  rank: number;                // 1-10
  title: string;
  snippet: string;             // SerpAPI 给的 meta description
  url: string;
  // MVP 不抓页面正文 H2, 推到工程化阶段 (DECISIONS_v3 branch-original §G.5 Path 2)
};
```

**失败处理**: SerpAPI 报错 + 无 `--no-serp` → exit 3。SerpAPI 返回空 → 警告 + 继续, gen_plan 不带 outlines (等同 `--no-serp`)。

### 4.3 genPlan (LLM #2)

**输入**:

```typescript
type GenPlanInput = {
  keyword: string;
  intent_type: IntentType;
  flow_mode: "DIRECTOR";        // MVP 锁死
  competitor_outlines: CompetitorOutline[];   // 可能为空
  product_features: ProductFeature[];          // ZIXEL_FEATURES from constants.ts
  forbidden_competitors: string[];             // MVP 写在 constants
  retry_reason?: string;                       // 上次 validate 失败原因, 重试时填
};
```

**Prompt**: 见 `prompts.ts` `GEN_PLAN_PROMPT_DIRECTOR`。要求 LLM:

- 从 20 个 role_in_arc 里挑 5-9 个组 outline (LLM 知道完整 enum + 每个的写作定位, 见 DECISIONS_v3 branch-original §C.3)
- 第一段必须 `INTRO_PAIN`
- 最后段是 `FAQ` 或 `CTA`
- DIRECTOR mode 必含 `BRIDGE_TO_PRODUCT` (位置 N-3 或 N-2) + `CTA` (位置 N-1)
- intent 约束 (solve: 必含 `HOW_TO_STEP`, 禁 `WHY_LEAVING` / `MIGRATION_BLOCKERS`; 见 constants.ts `INTENT_CONSTRAINTS`)
- 每段 `estimated_words` 落在 `ROLE_WORD_TARGETS` 区间
- 总字数 ≥ 1500
- 选 `thesis_feature_id` (DIRECTOR 必填) + 写 `thesis_summary`
- 选 `differentiation_strategy` (ANGLE_GAP / DEPTH / STANDARD / EXECUTION)
- 给每段 1 句 `brief_hint`
- 收集 `serp_gap_notes`: 从 competitor_outlines 里看出哪个角度没人写或没写好

**输出 (gen_plan shape, DECISIONS_v3 branch-original §B.6)**:

```typescript
type GenPlanOutput = {
  thesis_feature_id: string;
  thesis_summary: string;
  differentiation_strategy: "ANGLE_GAP" | "DEPTH" | "STANDARD" | "EXECUTION";
  suggested_outline: Array<{
    role: RoleInArc;            // 20 个 enum 之一
    brief_hint: string;
    estimated_words: number;
  }>;
  serp_gap_notes?: string;
};
```

**Validate + 重试**:

```
attempt = 0
while attempt < 3:
  plan = callLLM(GEN_PLAN_PROMPT_DIRECTOR with retry_reason)
  v = validateOutline(plan.suggested_outline, intent_type, "DIRECTOR")
  if v.ok: break
  retry_reason = v.reason
  attempt += 1
if not ok: exit 2 with v.reason
```

`validateOutline` 跑 7 项检查 (DECISIONS_v3 branch-original §B.7): 段数 / 起始 / 结尾 / 必含 / 禁止 / BRIDGE 位置 / 字数区间 / 总字数 floor。

### 4.4 genSection (LLM #3, ×N)

**输入** (每段一次):

```typescript
type GenSectionInput = {
  role: RoleInArc;
  brief_hint: string;
  word_target: number;          // 用 plan 给的 estimated_words, 不用区间
  word_min: number;             // ROLE_WORD_TARGETS[role][0]
  word_max: number;             // ROLE_WORD_TARGETS[role][1]
  keyword: string;
  intent_type: IntentType;
  flow_mode: "DIRECTOR";
  thesis_summary: string;
  thesis_feature: ProductFeature;     // 完整对象, prompt 里展开 description + value_proposition
  product_features: ProductFeature[]; // 全部 ZIXEL features (BRIDGE/CTA 段用)
  position: number;             // 0-indexed
  total: number;
  scenario: string;             // 来自 classify 输出
  category: string;
  category_slug: string;        // CTA 段用, 从 inherited_rules §8 mapping
  serp_gap_notes?: string;
};
```

**Prompt**: 见 `prompts.ts` `GEN_SECTION_PROMPT`。模板会根据 `role` 注入 role-specific 写作指令 (来自 DECISIONS_v3 branch-original §C.3 表)。所有段共享:

- §1 Persona anchor (verbatim)
- §2 Anti-verbose (verbatim) + Kazik §1.3 节奏一句话引用
- §3.2 DIRECTOR style anchor + Kazik §1.5 体感记忆一句话引用
- §11 Forbidden terms 黑名单 (LLM-side 预防)
- **Kazik §1.1 禁用词清单** (LLM-side 预防, 不只是事后扫): "下列词语在正文段落里绝对不要出现: 说白了 / 意味着 / 本质上 / 换句话说 / 不可否认 / 综上所述 / 总的来说 / 首先 / 其次 / 最后 / 值得注意的是 / 不难发现 / 让我们来看看 / 接下来让我们 / 在当今...的时代 / 随着...的发展"
- **Kazik §1.2 禁用标点**: "正文不用全角/半角冒号, 不用破折号 ——, 直接用逗号或句号代替; 引号统一用「」或不加。H2/H3 标题正常标点不受此限。"
- §10 Competitor mention rule (solve = FORBIDDEN, prompt 注入"本段禁止出现任何竞品名称")
- §17 Persona/addressing
- INTRO_PAIN 段额外加 TL;DR 首句指令 (DECISIONS_v3 §D)
- BRIDGE_TO_PRODUCT 段额外加 Help Don't Sell pattern (DECISIONS_v3 §H.1, 完整例子嵌入 prompt)
- FAQ 段额外指令: 3 个 Q-A, 每答 60-100 字, 用真实 People Also Ask 风格问题

**输出**:

```typescript
type GenSectionOutput = {
  markdown: string;             // 段标题 + 段正文。CTA 段不用 LLM, 由 assemble.ts 代码组装 (inherited_rules §8)
  h2_title: string;             // assemble 阶段做去重 / 长度检查用
  word_count: number;           // LLM 自报, code 复核
};
```

**CTA 例外**: position N-1 且 role = CTA 时**不调 LLM**, 由 `assemble.ts` 用 §8 fixed template + category_slug 组装。这是 code-over-AI 原则。

### 4.5 humanizerL2 (LLM #4, 可选)

**只有 `--l2` flag 才跑**。输入: 完整 article markdown。任务: LLM 给文章打分 + 列出 issues。

```typescript
type HumanizerL2Output = {
  score: number;                // 0-100
  ai_flavor_score: number;      // 0-10, 越低越好
  info_gain_satisfied: boolean;
  info_gain_kind?: "first_hand" | "exclusive_data" | "integrative_insight";
  disparagement_violations: Array<{ snippet: string; reason: string }>;
  issues: Array<{ paragraph_idx: number; issue: string; suggestion: string }>;
};
```

MVP 阶段 L2 是辅助参考, 不是 gating。用户用人眼 review 为主, L2 结果填进 review.md 的扩展维度做交叉验证。

---

## 5. trace.json shape

每次 LLM 调用 append 一条:

```typescript
type TraceEntry = {
  stage: "classify_intent" | "gen_plan" | "gen_section" | "humanizer_l2";
  stage_attempt: number;        // gen_plan 重试时累加, 其他都是 1
  role?: RoleInArc;             // gen_section 时填
  position?: number;            // gen_section 时填
  input: Record<string, unknown>;       // 调用时传入的 vars (不含 prompt 模板字符串)
  prompt_template_name: string;
  rendered_prompt: string;      // 完整 rendered prompt, 含 system + user
  output_raw: string;           // LLM raw text response
  output_parsed?: unknown;      // JSON.parse 成功才有
  parse_error?: string;
  model: string;
  provider: "moonshot" | "deepseek";
  tokens: { prompt: number; completion: number; total: number };
  cost_usd: number;
  duration_ms: number;
  timestamp: string;            // ISO
};

type Trace = TraceEntry[];      // 文件就是这个数组
```

**写入策略**: 每个 LLM 调用结束就 append + flush, 即使脚本中途崩了也能看到部分 trace。

---

## 6. plan.json + humanizer_scan.json

**plan.json**: 就是 `GenPlanOutput` 原样写入, 方便用户单独看 plan 而不用翻 trace.json。

**humanizer_scan.json**:

```typescript
type HumanizerScanResult = {
  word_count: number;           // 全文字数 (剔除标题 / markdown 符号后)
  word_count_ok: boolean;       // ≥ 1500
  zixel_mentions: number;       // "ZIXEL" + "子虔" 大小写不敏感匹配总和
  zixel_mention_ok: boolean;    // ≥ 1
  emoji_found: string[];        // 出现的 emoji, 应空数组
  forbidden_term_hits: Array<{ term: string; category: string; count: number; severity: "WARN" | "BAN" }>;  // 来自 FORBIDDEN_TERMS
  kazik_forbidden_hits: Array<{ term: string; count: number; replacement_hint: string }>;  // 来自 KAZIK_FORBIDDEN_TERMS
  paragraph_count: number;
  paragraph_count_ok: boolean;  // 5-9 段
  overall_ok: boolean;          // 全部 pass (BAN 类禁用词 0 命中, 字数 / mentions / paragraph 全过)
};
```

`overall_ok` 是 sanity flag, 不是 gating — MVP 跑出来无论 ok 与否都把 article 写出来给用户看。

---

## 7. review.md 模板

写到输出目录, 用户手填。完整模板:

```markdown
# Article Review — {keyword}

Generated: {ISO 时间}
Intent: {intent_type}  ({reasoning})
Category: {category}
Flow mode: DIRECTOR
Model used: {provider} / {model}
Total LLM cost: {sum(cost_usd)} USD
Total tokens: {sum(total)} 

---

## 基础维度 (10 项)

- [ ] 字数达标 (1500+): 实际 {word_count}
- [ ] 关键词自然嵌入 (无堆砌): _____
- [ ] ZIXEL/子虔提及 ≥ 1 次: 实际 {zixel_mentions} 次
- [ ] 无明显 AI 味 (主观打 1-5): _____
- [ ] 段落逻辑通顺: _____
- [ ] 信息增益 (一手经验/独家数据/整合性洞察, 至少 1 种): _____
- [ ] Help Don't Sell pattern 在 BRIDGE_TO_PRODUCT 段体现: _____
- [ ] FAQ section 有真实 Q-A (不是 LLM 自造): _____
- [ ] TL;DR 首句独立可读 (脱离上下文不依赖前文): _____
- [ ] 反贬损 (无贬低其他厂商): _____

## 扩展维度 (7 项, 每篇必填)

- [ ] AI 检测分数: ____% (工具: _____, 例 "GPTZero 18%")
- [ ] 段落级质量逐段标注:
    - INTRO_PAIN: ✅ / ❌ (原因: _____)
    - {role 2}: ✅ / ❌
    - {role 3}: ✅ / ❌
    - ... (按 plan 实际 outline 列)
- [ ] 关键词密度: 主关键词出现 ____ 次, 密度 ____% (建议 1-2%, 超 3% 算堆砌)
- [ ] 句长方差: 是否有连续 3 句以上句长相近? _____ (有则指出段落)
- [ ] 禁用词命中:
    - FORBIDDEN_TERMS (扫描结果, BAN 类应为 0): {scan summary}
    - KAZIK_FORBIDDEN_TERMS (扫描结果, 应为 0): {scan summary}
    - 人眼补查 (扫描没扫到但读起来 AI 味的词): _____
- [ ] 信息增益具体形式: _____  (写明是 一手经验/独家数据/整合洞察 哪一种, 出现在哪段)
- [ ] 可读性: 有无连续 3 句以上术语堆叠的段落? _____ (有则指出)

## 发现的具体问题

(列具体段落 + 问题描述, 越具体越有助于下轮调整)

## 决策

[ ] 单篇过关 (不代表收敛) → 换关键词再跑 2-3 篇验证稳定
[ ] 连续 2-3 篇过关 → 进入聚类阶段 (DECISIONS_v3 §F.5)
[ ] 部分维度不行 → 按"调整对象按成本"列调下面项再 re-run:
    - [ ] 调 prompt 措辞: 调哪段哪句 _____
    - [ ] 调 role brief_hint 生成逻辑 (gen_plan prompt): _____
    - [ ] 调 ROLE_WORD_TARGETS: 哪个 role 改成多少 _____
    - [ ] 调 §9 约束表 / MODE_CONSTRAINTS / INTENT_CONSTRAINTS: _____
    - [ ] 加 sub_pattern (operation / diagnosis): _____
    - [ ] 换 model: _____
[ ] 整体不行 → 回到 DECISIONS_v3 §F.2 大改方向

## 下窗口动作

(根据决策, 列具体下窗口该做什么 - 注意 §9 / 字数表 / enum 改动要两 branch 同步)
```

---

## 8. 失败处理表

| 失败模式 | 处理 |
|---|---|
| `MOONSHOT_API_KEY` / `DEEPSEEK_API_KEY` 缺失 | 启动时立刻 exit 1, 提示用户改 `.env.local` |
| LLM 调用网络错误 | 重试 1 次 (3 秒后), 再失败 → 该 stage 标 FAILED, 写 trace, 继续后续 stage (genSection 失败 → 该段 markdown = `> ⚠️ 此段生成失败, 见 trace.json`, 文章会短一段) |
| LLM 输出 JSON 解析失败 | 重试 1 次 (温度 -0.1, prompt 末尾加 "上次输出不是合法 JSON, 这次必须严格 JSON"), 还失败 → 同上 |
| `validateOutline` 重试 3 次都失败 | exit 2, 把最后一次 `validation.reason` 打印, 提示用户看 trace.json 决定调 prompt 还是调约束 |
| SerpAPI 失败 | 无 `--no-serp` → exit 3; 有则继续, gen_plan input 里 competitor_outlines 为空 |
| genSection 字数离 word_target ±30% 以上 | 写 warning 到 trace, 不重试 (字数偏差是 prompt 调优问题, 不是脚本问题) |
| ZIXEL 提及 0 次 | humanizer_scan 标 `zixel_mention_ok=false`, 不阻塞输出 (用户 review 后调 BRIDGE prompt) |
| 总字数 < 1500 | humanizer_scan 标 `word_count_ok=false`, 不阻塞 (用户决定补段还是调 ROLE_WORD_TARGETS) |

---

## 9. 已知不做的事 (避免 scope creep)

| 想做 | 推迟到 | 理由 |
|---|---|---|
| 5 个 intent 全跑 | 阶段 3 工程化 | MVP 验证 1 个 |
| ME mode | 阶段 3 工程化 | DIRECTOR 先 |
| 完整 humanizer L1 15 条 | 阶段 3 工程化 | MVP 用人眼 |
| 抓 SERP 页面 H2 (Path 2) | 阶段 3 工程化 | MVP 用 SerpAPI 标题 + snippet |
| Redis cache | 阶段 3 工程化 | MVP 用文件 |
| Trigger.dev 并发 | 阶段 3 工程化 | MVP 单脚本 |
| Title 规则自动检查 (A19) | 阶段 3 工程化 | MVP 用户 review |
| Disparagement 自动检查 (A20, humanizer rule 28) | 阶段 3 工程化 | MVP 用户 review + L2 LLM 软提示 |
| 信息增益自动检查 (humanizer rule 29) | 阶段 3 工程化 | MVP 用户 review + L2 LLM 软提示 |
| 多关键词聚类差异化 | 阶段 2 聚类 | 阶段 2 在 `mvp/` 基础上扩展, 不重写 |
| seed `mvp/prompts.ts` 进 DB | 阶段 3 工程化 W2 | MVP 跑稳定后再 seed |

---

## 10. 与共享 spec 的对应关系

下面每一项 MVP 实现都映射到 spec 来源, 改动时两 branch 同步:

| 实现位置 | spec 来源 |
|---|---|
| `constants.ts` `ROLE_WORD_TARGETS` | DECISIONS_v3 branch-original §B.5 |
| `constants.ts` `UNIVERSAL_CONSTRAINTS` | DECISIONS_v3 branch-original §B.2 |
| `constants.ts` `MODE_CONSTRAINTS` | DECISIONS_v3 branch-original §B.3 (MVP 只用 DIRECTOR) |
| `constants.ts` `INTENT_CONSTRAINTS` | DECISIONS_v3 branch-original §B.4 |
| `constants.ts` `ZIXEL_FEATURES` | inherited_rules §7 |
| `constants.ts` `FORBIDDEN_TERMS` | inherited_rules §11 (取核心 + BAN 类) |
| `constants.ts` `KAZIK_FORBIDDEN_TERMS` | kazik_adaptation §1.1 |
| `constants.ts` `KAZIK_FORBIDDEN_PUNCTUATION` | kazik_adaptation §1.2 |
| `validate.ts` validateOutline | DECISIONS_v3 branch-original §B.7 |
| `prompts.ts` `INTRO_PAIN` 首句 | DECISIONS_v3 branch-original §D.2 |
| `prompts.ts` `BRIDGE_TO_PRODUCT` Help Don't Sell | DECISIONS_v3 branch-original §H.1 |
| `prompts.ts` 共享 anchors | inherited_rules §1 / §2 / §3.2 / §17 |
| `assemble.ts` CTA template | inherited_rules §8 |
| Category enum | inherited_rules §6 |

**纪律**: 改 `ROLE_WORD_TARGETS` / `UNIVERSAL` / `MODE` / `INTENT_CONSTRAINTS` 任何一项, 同步改 `branch-original/DECISIONS_v3.md` 对应 section + `inherited_rules.md §9` (待 §9 重构落地后)。**不让 MVP 私自分叉 spec**。

---

**END of mvp/run.md**
