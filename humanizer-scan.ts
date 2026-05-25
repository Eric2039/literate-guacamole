// mvp/humanizer-scan.ts — quickHumanizerScan (L1 minimal, 6 items)
//
// Spec: branch-mvp/DECISIONS_v3.md §C.6
// Items:
//   1. word count ≥ 1500
//   2. ZIXEL / 子虔 mention ≥ 1
//   3. no emoji
//   4. no FORBIDDEN_TERMS (full list from constants, BAN-severity 0 hits gating)
//   5. no KAZIK_FORBIDDEN_TERMS (kazik §1.1)
//   6. paragraph count 5-9

import { FORBIDDEN_TERMS, KAZIK_FORBIDDEN_TERMS } from "./constants";
import type { ForbiddenTerm } from "./constants";

export type HumanizerScanResult = {
  word_count: number;
  word_count_ok: boolean;
  zixel_mentions: number;
  zixel_mention_ok: boolean;
  emoji_found: string[];
  forbidden_term_hits: Array<{ term: string; category: ForbiddenTerm["category"]; count: number; severity: ForbiddenTerm["severity"] }>;
  kazik_forbidden_hits: Array<{ term: string; count: number; replacement_hint: string }>;
  paragraph_count: number;
  paragraph_count_ok: boolean;
  overall_ok: boolean;
};

// Strip markdown to count content chars only
function stripMarkdown(md: string): string {
  return md
    .replace(/^#+\s.*$/gm, "")              // headings
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")   // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text
    .replace(/[`*_~>#\-]/g, "")             // common md syntax chars
    .replace(/\s+/g, "");                   // whitespace
}

function countContentChars(md: string): number {
  // Count Chinese chars + ASCII letters/digits as 1 each
  const stripped = stripMarkdown(md);
  return stripped.length;
}

function countParagraphs(md: string): number {
  // Count H2 sections; FAQ counted once even though it has H3 subheadings
  return (md.match(/^##\s+/gm) ?? []).length;
}

// Emoji ranges (approximate; covers most cases)
const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}]/gu;

export function quickHumanizerScan(markdown: string): HumanizerScanResult {
  const word_count = countContentChars(markdown);
  const word_count_ok = word_count >= 1500;

  const zixelMatches = markdown.match(/ZIXEL|子虔|Zixel|zixel/g) ?? [];
  const zixel_mentions = zixelMatches.length;
  const zixel_mention_ok = zixel_mentions >= 1;

  const emojiMatches = markdown.match(EMOJI_REGEX) ?? [];
  const emoji_found = Array.from(new Set(emojiMatches));

  // FORBIDDEN_TERMS — substring match. Body-only would be cleaner but MVP scans whole md.
  const forbidden_term_hits: HumanizerScanResult["forbidden_term_hits"] = [];
  for (const { term, category, severity } of FORBIDDEN_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = markdown.match(new RegExp(escaped, "g"));
    if (matches && matches.length > 0) {
      forbidden_term_hits.push({ term, category, count: matches.length, severity });
    }
  }

  // KAZIK_FORBIDDEN_TERMS
  const kazik_forbidden_hits: HumanizerScanResult["kazik_forbidden_hits"] = [];
  for (const { term, replacement_hint } of KAZIK_FORBIDDEN_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = markdown.match(new RegExp(escaped, "g"));
    if (matches && matches.length > 0) {
      kazik_forbidden_hits.push({ term, count: matches.length, replacement_hint });
    }
  }

  const paragraph_count = countParagraphs(markdown);
  const paragraph_count_ok = paragraph_count >= 5 && paragraph_count <= 9;

  const hasBan = forbidden_term_hits.some(h => h.severity === "BAN");
  const overall_ok = word_count_ok
    && zixel_mention_ok
    && emoji_found.length === 0
    && !hasBan
    && kazik_forbidden_hits.length === 0
    && paragraph_count_ok;

  return {
    word_count,
    word_count_ok,
    zixel_mentions,
    zixel_mention_ok,
    emoji_found,
    forbidden_term_hits,
    kazik_forbidden_hits,
    paragraph_count,
    paragraph_count_ok,
    overall_ok,
  };
}
