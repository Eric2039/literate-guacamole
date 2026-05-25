// mvp/assemble.ts — assemble final article markdown + write outputs
//
// CTA section is code-composed (not LLM); see buildCtaMarkdown in constants.

import * as fs from "node:fs";
import * as path from "node:path";
import { buildCtaMarkdown } from "./constants";
import type { IntentType, RoleInArc } from "./constants";

export type AssembledSection = {
  role: RoleInArc;
  position: number;
  h2_title: string;
  markdown: string;          // full markdown including the ## heading line
  word_count: number;
};

export type Frontmatter = {
  keyword: string;
  intent_type: IntentType;
  flow_mode: "DIRECTOR";
  category: string;
  scenario: string;
  thesis_summary: string;
  thesis_feature_id: string;
  differentiation_strategy: string;
  generated_at: string;
  model: string;
  provider: string;
};

export function assembleArticle(
  fm: Frontmatter,
  sections: AssembledSection[],
): string {
  // EEAT timestamp at top — inherited_rules.md §16
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const timestamp = `> 最后更新:${year} 年 ${month} 月`;

  const yamlFm = [
    "---",
    `keyword: ${JSON.stringify(fm.keyword)}`,
    `intent_type: ${fm.intent_type}`,
    `flow_mode: ${fm.flow_mode}`,
    `category: ${JSON.stringify(fm.category)}`,
    `thesis_feature_id: ${JSON.stringify(fm.thesis_feature_id)}`,
    `differentiation_strategy: ${fm.differentiation_strategy}`,
    `generated_at: ${fm.generated_at}`,
    `model: ${fm.model}`,
    `provider: ${fm.provider}`,
    "---",
  ].join("\n");

  // Body — sort by position, join with blank line
  const body = sections
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(s => s.markdown.trim())
    .join("\n\n");

  return `${yamlFm}\n\n${timestamp}\n\n${body}\n`;
}

// Code-generated CTA section (no LLM call) — see code-over-AI rule.
export function buildCtaSection(category: string, position: number): AssembledSection {
  const text = buildCtaMarkdown(category);
  return {
    role: "CTA",
    position,
    h2_title: "下一步",
    markdown: `## 下一步\n\n${text}`,
    word_count: text.length,
  };
}

// Slug for output directory
export function makeSlug(keyword: string): string {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const safe = keyword
    .slice(0, 20)
    .replace(/[\s\/\\:*?"<>|]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe}-${ts}`;
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function writeText(file: string, content: string): void {
  fs.writeFileSync(file, content, "utf8");
}

export function joinOut(outDir: string, slug: string, ...rest: string[]): string {
  return path.join(outDir, slug, ...rest);
}
