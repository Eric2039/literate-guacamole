// mvp/run.ts — MVP main script (Phase 1)
//
// Usage:
//   pnpm tsx mvp/run.ts "<keyword>" [--no-serp] [--l2] [--out-dir=output]
//
// Spec: mvp/run.md
// Pipeline: parseArgs → classifyIntent → fetchSerpOutlines → genPlan (validate, retry ≤3)
//           → genSection × N (parallel ≤ 4) → assemble → quickHumanizerScan → (--l2) humanizerL2
//           → write all outputs
//
// ⚠️ MVP-ONLY exemption: hardcoded prompts/constants. See constants.ts header.

import * as fs from "node:fs";
import * as path from "node:path";

import {
  CATEGORIES,
  FORBIDDEN_COMPETITORS,
  fallbackCategory,
  INTENT_CONSTRAINTS,
  ROLE_WORD_TARGETS,
  ZIXEL_FEATURES,
} from "./constants";
import type { IntentType, ProductFeature, RoleInArc } from "./constants";
import {
  assembleArticle,
  buildCtaSection,
  ensureDir,
  joinOut,
  makeSlug,
  writeJson,
  writeText,
} from "./assemble";
import type { AssembledSection } from "./assemble";
import { quickHumanizerScan } from "./humanizer-scan";
import { callLLMWithFallback } from "./llm";
import type { Provider } from "./llm";
import {
  buildClassifyIntentPrompt,
  buildGenPlanPrompt,
  buildGenSectionPrompt,
  buildHumanizerL2Prompt,
} from "./prompts";
import { fetchSerpOutlines } from "./serp";
import { validateOutline } from "./validate";
import type { SuggestedSlot } from "./validate";

// ---------------------------------------------------------------------------
// .env.local loader (no dotenv dependency; MVP keeps deps tight)
// ---------------------------------------------------------------------------

function loadDotEnvLocal(): void {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, rawV] = m;
    if (process.env[k]) continue; // don't override existing
    const v = rawV.replace(/^["']|["']$/g, "");
    process.env[k] = v;
  }
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

type CliArgs = {
  keyword: string;
  noSerp: boolean;
  l2: boolean;
  outDir: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const positional = args.filter(a => !a.startsWith("--"));
  const flags = new Set(args.filter(a => a.startsWith("--") && !a.includes("=")));
  const kv = new Map<string, string>();
  for (const a of args) {
    if (a.startsWith("--") && a.includes("=")) {
      const [k, v] = a.slice(2).split("=", 2);
      kv.set(k, v);
    }
  }
  const keyword = positional[0];
  if (!keyword) {
    console.error("Usage: pnpm tsx mvp/run.ts \"<keyword>\" [--no-serp] [--l2] [--out-dir=mvp/output]");
    process.exit(1);
  }
  return {
    keyword,
    noSerp: flags.has("--no-serp"),
    l2: flags.has("--l2"),
    outDir: kv.get("out-dir") ?? path.join("mvp", "output"),
  };
}

// ---------------------------------------------------------------------------
// Trace
// ---------------------------------------------------------------------------

type TraceEntry = {
  stage: "classify_intent" | "gen_plan" | "gen_section" | "humanizer_l2";
  stage_attempt: number;
  role?: RoleInArc;
  position?: number;
  input: Record<string, unknown>;
  prompt_template_name: string;
  rendered_prompt: string;
  output_raw: string;
  output_parsed?: unknown;
  parse_error?: string;
  model: string;
  provider: Provider;
  tokens: { prompt: number; completion: number; total: number };
  cost_usd: number;
  duration_ms: number;
  timestamp: string;
};

class Trace {
  private entries: TraceEntry[] = [];
  constructor(private file: string) {}
  append(e: TraceEntry): void {
    this.entries.push(e);
    writeJson(this.file, this.entries);
  }
  totalCost(): number {
    return this.entries.reduce((s, e) => s + e.cost_usd, 0);
  }
  totalTokens(): number {
    return this.entries.reduce((s, e) => s + e.tokens.total, 0);
  }
}

// ---------------------------------------------------------------------------
// Stage runners
// ---------------------------------------------------------------------------

type ClassifyResult = {
  intent_type: IntentType;
  scenario: string;
  category: string;
  reasoning: string;
};

async function runClassifyIntent(keyword: string, trace: Trace): Promise<ClassifyResult> {
  const prompt = buildClassifyIntentPrompt({ keyword });
  const result = await callLLMWithFallback(prompt, { parseRetry: true, temperature: 0.3 });
  trace.append({
    stage: "classify_intent",
    stage_attempt: 1,
    input: { keyword },
    prompt_template_name: "CLASSIFY_INTENT",
    rendered_prompt: prompt,
    output_raw: result.raw,
    output_parsed: result.parsed,
    parse_error: result.parseError,
    model: result.model,
    provider: result.provider,
    tokens: result.tokens,
    cost_usd: result.cost_usd,
    duration_ms: result.duration_ms,
    timestamp: new Date().toISOString(),
  });

  if (!result.parsed) {
    throw new Error(`classifyIntent JSON parse failed: ${result.parseError}`);
  }
  const p = result.parsed as Partial<ClassifyResult>;
  const intent_type = p.intent_type;
  if (!intent_type || !["learn", "solve", "choose", "replace", "understand"].includes(intent_type)) {
    throw new Error(`classifyIntent returned invalid intent_type: ${intent_type}`);
  }
  const category = p.category && CATEGORIES.includes(p.category) ? p.category : fallbackCategory(intent_type);
  return {
    intent_type,
    scenario: p.scenario ?? "(no scenario)",
    category,
    reasoning: p.reasoning ?? "",
  };
}

type GenPlanResult = {
  thesis_feature_id: string;
  thesis_summary: string;
  differentiation_strategy: string;
  suggested_outline: SuggestedSlot[];
  serp_gap_notes?: string;
};

async function runGenPlan(
  args: {
    keyword: string;
    intent: ClassifyResult;
    competitor_outlines: Array<{ rank: number; title: string; snippet: string }>;
  },
  trace: Trace,
): Promise<GenPlanResult> {
  const required = INTENT_CONSTRAINTS[args.intent.intent_type].required_roles;
  const forbidden = INTENT_CONSTRAINTS[args.intent.intent_type].forbidden_roles;

  let lastReason: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const prompt = buildGenPlanPrompt({
      keyword: args.keyword,
      intent_type: args.intent.intent_type,
      flow_mode: "DIRECTOR",
      competitor_outlines: args.competitor_outlines,
      product_features: ZIXEL_FEATURES,
      forbidden_competitors: FORBIDDEN_COMPETITORS,
      retry_reason: lastReason,
      required_roles: required,
      forbidden_roles: forbidden,
    });
    const result = await callLLMWithFallback(prompt, { parseRetry: true, temperature: 0.7, maxTokens: 3000 });
    trace.append({
      stage: "gen_plan",
      stage_attempt: attempt,
      input: { keyword: args.keyword, intent_type: args.intent.intent_type, retry_reason: lastReason ?? null },
      prompt_template_name: "GEN_PLAN_DIRECTOR",
      rendered_prompt: prompt,
      output_raw: result.raw,
      output_parsed: result.parsed,
      parse_error: result.parseError,
      model: result.model,
      provider: result.provider,
      tokens: result.tokens,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      timestamp: new Date().toISOString(),
    });

    if (!result.parsed) {
      lastReason = `JSON parse failed: ${result.parseError}`;
      continue;
    }
    const plan = result.parsed as GenPlanResult;
    if (!plan.suggested_outline || !Array.isArray(plan.suggested_outline)) {
      lastReason = "suggested_outline missing or not array";
      continue;
    }
    const validation = validateOutline(plan.suggested_outline, args.intent.intent_type, "DIRECTOR");
    if (validation.ok) {
      return plan;
    }
    lastReason = validation.reason;
    console.warn(`[gen_plan attempt ${attempt}] validation failed: ${validation.reason}`);
  }
  console.error(`gen_plan failed after 3 attempts. Last reason: ${lastReason}`);
  process.exit(2);
}

type SectionResult = {
  role: RoleInArc;
  position: number;
  h2_title: string;
  markdown: string;
  word_count: number;
};

async function runGenSection(
  args: {
    slot: SuggestedSlot;
    position: number;
    total: number;
    keyword: string;
    intent: ClassifyResult;
    plan: GenPlanResult;
    thesis_feature: ProductFeature;
  },
  trace: Trace,
): Promise<SectionResult | null> {
  const [word_min, word_max] = ROLE_WORD_TARGETS[args.slot.role];
  const prompt = buildGenSectionPrompt({
    role: args.slot.role,
    brief_hint: args.slot.brief_hint,
    word_target: args.slot.estimated_words,
    word_min,
    word_max,
    keyword: args.keyword,
    intent_type: args.intent.intent_type,
    flow_mode: "DIRECTOR",
    thesis_summary: args.plan.thesis_summary,
    thesis_feature: args.thesis_feature,
    product_features: ZIXEL_FEATURES,
    position: args.position,
    total: args.total,
    scenario: args.intent.scenario,
    category: args.intent.category,
    serp_gap_notes: args.plan.serp_gap_notes,
  });

  try {
    const result = await callLLMWithFallback(prompt, { parseRetry: true, temperature: 0.85, maxTokens: 2000 });
    trace.append({
      stage: "gen_section",
      stage_attempt: 1,
      role: args.slot.role,
      position: args.position,
      input: { role: args.slot.role, brief_hint: args.slot.brief_hint, word_target: args.slot.estimated_words },
      prompt_template_name: "GEN_SECTION",
      rendered_prompt: prompt,
      output_raw: result.raw,
      output_parsed: result.parsed,
      parse_error: result.parseError,
      model: result.model,
      provider: result.provider,
      tokens: result.tokens,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      timestamp: new Date().toISOString(),
    });

    if (!result.parsed) {
      console.warn(`[gen_section ${args.slot.role}@${args.position}] JSON parse failed, section will be marked FAILED in article`);
      return null;
    }
    const p = result.parsed as Partial<SectionResult>;
    if (!p.markdown) return null;
    return {
      role: args.slot.role,
      position: args.position,
      h2_title: p.h2_title ?? "",
      markdown: p.markdown,
      word_count: p.word_count ?? 0,
    };
  } catch (e) {
    const msg = (e as Error).message;
    console.warn(`[gen_section ${args.slot.role}@${args.position}] ERROR: ${msg.slice(0, 200)}`);
    // Record failure to trace so user can see what died and why
    trace.append({
      stage: "gen_section",
      stage_attempt: 1,
      role: args.slot.role,
      position: args.position,
      input: { role: args.slot.role, brief_hint: args.slot.brief_hint, word_target: args.slot.estimated_words },
      prompt_template_name: "GEN_SECTION",
      rendered_prompt: prompt,
      output_raw: "",
      output_parsed: null,
      parse_error: `CALL_FAILED: ${msg}`,
      model: "(failed)",
      provider: "moonshot",
      tokens: { prompt: 0, completion: 0, total: 0 },
      cost_usd: 0,
      duration_ms: 0,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

async function runHumanizerL2(
  fullMarkdown: string,
  keyword: string,
  intent: IntentType,
  trace: Trace,
): Promise<unknown> {
  const prompt = buildHumanizerL2Prompt({ full_markdown: fullMarkdown, keyword, intent_type: intent });
  const result = await callLLMWithFallback(prompt, { parseRetry: true, temperature: 0.3, maxTokens: 2000 });
  trace.append({
    stage: "humanizer_l2",
    stage_attempt: 1,
    input: { keyword, intent_type: intent },
    prompt_template_name: "HUMANIZER_L2",
    rendered_prompt: prompt,
    output_raw: result.raw,
    output_parsed: result.parsed,
    parse_error: result.parseError,
    model: result.model,
    provider: result.provider,
    tokens: result.tokens,
    cost_usd: result.cost_usd,
    duration_ms: result.duration_ms,
    timestamp: new Date().toISOString(),
  });
  return result.parsed;
}

// ---------------------------------------------------------------------------
// Parallel with bounded concurrency (avoid Moonshot rate limit)
// ---------------------------------------------------------------------------

async function parallelMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Thesis feature lookup
// ---------------------------------------------------------------------------

function findThesisFeature(id: string): ProductFeature {
  // id format: "<product> · <feature_name>"
  const parts = id.split(/\s*·\s*/);
  if (parts.length === 2) {
    const [product, featureName] = parts;
    const match = ZIXEL_FEATURES.find(f => f.product === product && f.feature_name === featureName);
    if (match) return match;
  }
  // Fallback: try to match by feature_name only
  const byName = ZIXEL_FEATURES.find(f => id.includes(f.feature_name));
  if (byName) return byName;
  // Last resort: first LEAD feature
  const lead = ZIXEL_FEATURES.find(f => f.priority === "LEAD");
  return lead ?? ZIXEL_FEATURES[0];
}

// ---------------------------------------------------------------------------
// Review.md template
// ---------------------------------------------------------------------------

function buildReviewTemplate(args: {
  keyword: string;
  intent: ClassifyResult;
  plan: GenPlanResult;
  scanWordCount: number;
  scanZixelMentions: number;
  scanForbidden: string;
  scanKazik: string;
  cost: number;
  tokens: number;
  model: string;
  provider: Provider;
}): string {
  const outlineLines = args.plan.suggested_outline
    .map((s, i) => `    - ${i + 1}. ${s.role}: ✅ / ❌ (原因: _____)`)
    .join("\n");

  return `# Article Review — ${args.keyword}

Generated: ${new Date().toISOString()}
Intent: ${args.intent.intent_type}  (${args.intent.reasoning})
Category: ${args.intent.category}
Flow mode: DIRECTOR
Model used: ${args.provider} / ${args.model}
Total LLM cost: ${args.cost.toFixed(4)} USD
Total tokens: ${args.tokens}

---

## 基础维度 (10 项)

- [ ] 字数达标 (1500+): 实际 ${args.scanWordCount}
- [ ] 关键词自然嵌入 (无堆砌): _____
- [ ] ZIXEL/子虔提及 ≥ 1 次: 实际 ${args.scanZixelMentions} 次
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
${outlineLines}
- [ ] 关键词密度: 主关键词出现 ____ 次, 密度 ____% (建议 1-2%, 超 3% 算堆砌)
- [ ] 句长方差: 是否有连续 3 句以上句长相近? _____ (有则指出段落)
- [ ] 禁用词命中:
    - FORBIDDEN_TERMS (扫描结果, BAN 类应为 0): ${args.scanForbidden}
    - KAZIK_FORBIDDEN_TERMS (扫描结果, 应为 0): ${args.scanKazik}
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
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const slug = makeSlug(args.keyword);
  const outRoot = path.resolve(args.outDir, slug);
  ensureDir(outRoot);

  const tracePath = path.join(outRoot, "trace.json");
  const trace = new Trace(tracePath);

  console.log(`▶ Keyword: ${args.keyword}`);
  console.log(`▶ Output:  ${outRoot}`);

  // Step 1: classify intent
  console.log(`\n[1/${args.l2 ? 5 : 4}] classifyIntent ...`);
  const intent = await runClassifyIntent(args.keyword, trace);
  console.log(`    intent=${intent.intent_type}  category=${intent.category}`);

  // Step 2: SERP outlines
  console.log(`\n[2/${args.l2 ? 5 : 4}] fetchSerpOutlines ...`);
  let competitor_outlines: Awaited<ReturnType<typeof fetchSerpOutlines>>["outlines"] = [];
  try {
    const serp = await fetchSerpOutlines(args.keyword, args.noSerp);
    competitor_outlines = serp.outlines;
    if (serp.outlines.length > 0) {
      writeJson(path.join(outRoot, "serp_cache.json"), serp.outlines);
    }
    console.log(`    ${serp.outlines.length} outlines  (from_cache=${serp.from_cache})`);
  } catch (e) {
    if (args.noSerp) {
      console.warn(`    SerpAPI skipped (--no-serp).`);
    } else {
      console.error(`    SerpAPI error: ${(e as Error).message}`);
      process.exit(3);
    }
  }

  // Step 3: gen_plan with validate + retry
  console.log(`\n[3/${args.l2 ? 5 : 4}] genPlan ...`);
  const plan = await runGenPlan({
    keyword: args.keyword,
    intent,
    competitor_outlines,
  }, trace);
  writeJson(path.join(outRoot, "plan.json"), plan);
  console.log(`    outline: ${plan.suggested_outline.map(s => s.role).join(" → ")}`);
  console.log(`    thesis: ${plan.thesis_feature_id}`);

  const thesisFeature = findThesisFeature(plan.thesis_feature_id);

  // Step 4: gen_section × N (parallel ≤ 4, CTA is code-generated)
  console.log(`\n[4/${args.l2 ? 5 : 4}] genSection × ${plan.suggested_outline.length} ...`);
  const llmSlots = plan.suggested_outline
    .map((slot, idx) => ({ slot, idx }))
    .filter(({ slot }) => slot.role !== "CTA");

  const llmResults = await parallelMap(llmSlots, 2, async ({ slot, idx }) => {
    const r = await runGenSection({
      slot,
      position: idx,
      total: plan.suggested_outline.length,
      keyword: args.keyword,
      intent,
      plan,
      thesis_feature: thesisFeature,
    }, trace);
    console.log(`    ✓ ${slot.role}@${idx}  ${r ? `${r.word_count}字` : "FAILED"}`);
    return { idx, slot, result: r };
  });

  const assembledSections: AssembledSection[] = [];
  for (const { idx, slot, result } of llmResults) {
    if (result) {
      assembledSections.push(result);
    } else {
      assembledSections.push({
        role: slot.role,
        position: idx,
        h2_title: `(${slot.role} 段生成失败)`,
        markdown: `## (${slot.role} 段生成失败)\n\n> ⚠️ 此段生成失败, 见 trace.json。brief_hint: ${slot.brief_hint}`,
        word_count: 0,
      });
    }
  }

  // CTA code-generated
  const ctaIdxInPlan = plan.suggested_outline.findIndex(s => s.role === "CTA");
  if (ctaIdxInPlan >= 0) {
    assembledSections.push(buildCtaSection(intent.category, ctaIdxInPlan));
    console.log(`    ✓ CTA@${ctaIdxInPlan}  (code-generated)`);
  }

  // Step 5: assemble
  const articleMd = assembleArticle({
    keyword: args.keyword,
    intent_type: intent.intent_type,
    flow_mode: "DIRECTOR",
    category: intent.category,
    scenario: intent.scenario,
    thesis_summary: plan.thesis_summary,
    thesis_feature_id: plan.thesis_feature_id,
    differentiation_strategy: plan.differentiation_strategy,
    generated_at: new Date().toISOString(),
    model: process.env.DEFAULT_MODEL ?? "moonshot-v1-32k",
    provider: (process.env.DEFAULT_PROVIDER as Provider) ?? "moonshot",
  }, assembledSections);
  writeText(path.join(outRoot, "article.md"), articleMd);

  // Step 6: humanizer scan
  const scan = quickHumanizerScan(articleMd);
  writeJson(path.join(outRoot, "humanizer_scan.json"), scan);
  console.log(`\n  humanizer scan: word_count=${scan.word_count} (ok=${scan.word_count_ok})  zixel=${scan.zixel_mentions}  emoji=${scan.emoji_found.length}  forbidden_BAN=${scan.forbidden_term_hits.filter(h => h.severity === "BAN").length}  kazik=${scan.kazik_forbidden_hits.length}  paragraphs=${scan.paragraph_count}  overall_ok=${scan.overall_ok}`);

  // Step 7: optional L2
  if (args.l2) {
    console.log(`\n[5/5] humanizerL2 ...`);
    try {
      const l2 = await runHumanizerL2(articleMd, args.keyword, intent.intent_type, trace);
      writeJson(path.join(outRoot, "humanizer_l2.json"), l2);
    } catch (e) {
      console.warn(`    humanizerL2 error: ${(e as Error).message}`);
    }
  }

  // Step 8: review.md template
  const banHits = scan.forbidden_term_hits.filter(h => h.severity === "BAN");
  const scanForbiddenSummary = banHits.length === 0
    ? "0 BAN 命中"
    : `${banHits.length} BAN 命中: ${banHits.map(h => `${h.term}×${h.count}`).join(", ")}`;
  const scanKazikSummary = scan.kazik_forbidden_hits.length === 0
    ? "0 命中"
    : `${scan.kazik_forbidden_hits.length} 命中: ${scan.kazik_forbidden_hits.map(h => `${h.term}×${h.count}`).join(", ")}`;

  writeText(path.join(outRoot, "review.md"), buildReviewTemplate({
    keyword: args.keyword,
    intent,
    plan,
    scanWordCount: scan.word_count,
    scanZixelMentions: scan.zixel_mentions,
    scanForbidden: scanForbiddenSummary,
    scanKazik: scanKazikSummary,
    cost: trace.totalCost(),
    tokens: trace.totalTokens(),
    model: process.env.DEFAULT_MODEL ?? "moonshot-v1-32k",
    provider: (process.env.DEFAULT_PROVIDER as Provider) ?? "moonshot",
  }));

  console.log(`\n✅ Done.`);
  console.log(`   Article: ${joinOut(args.outDir, slug, "article.md")}`);
  console.log(`   Review:  ${joinOut(args.outDir, slug, "review.md")}`);
  console.log(`   Trace:   ${joinOut(args.outDir, slug, "trace.json")}`);
  console.log(`   Cost:    ${trace.totalCost().toFixed(4)} USD  (${trace.totalTokens()} tokens)`);
}

main().catch(e => {
  console.error(`\n❌ Fatal: ${(e as Error).stack ?? (e as Error).message}`);
  process.exit(1);
});
