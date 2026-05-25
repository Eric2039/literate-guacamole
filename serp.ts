// mvp/serp.ts — SerpAPI client + file cache
//
// MVP: hit Baidu via SerpAPI, cache results to mvp/cache/serp/{sha256(keyword)}.json
// for SERP_CACHE_TTL_HOURS (default 24h).

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export type CompetitorOutline = {
  rank: number;
  title: string;
  snippet: string;
  url: string;
};

const CACHE_DIR = path.join("mvp", "cache", "serp");

function cacheKey(keyword: string): string {
  return createHash("sha256").update(keyword).digest("hex").slice(0, 32);
}

function cachePath(keyword: string): string {
  return path.join(CACHE_DIR, `${cacheKey(keyword)}.json`);
}

function ttlMs(): number {
  const hrs = parseInt(process.env.SERP_CACHE_TTL_HOURS ?? "24", 10);
  return hrs * 60 * 60 * 1000;
}

export type SerpFetchResult = {
  outlines: CompetitorOutline[];
  from_cache: boolean;
  raw?: unknown;
};

export async function fetchSerpOutlines(
  keyword: string,
  noSerp = false,
): Promise<SerpFetchResult> {
  if (noSerp) return { outlines: [], from_cache: false };

  const file = cachePath(keyword);
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs < ttlMs()) {
      const cached = JSON.parse(fs.readFileSync(file, "utf8"));
      return { outlines: cached.outlines, from_cache: true, raw: cached.raw };
    }
  }

  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("Missing SERPAPI_KEY in .env.local (use --no-serp to skip)");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "baidu");
  url.searchParams.set("q", keyword);
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", key);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.text().catch(() => "<no body>");
    throw new Error(`SerpAPI HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }
  const json = await resp.json() as {
    organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
  };

  const outlines: CompetitorOutline[] = (json.organic_results ?? [])
    .slice(0, 10)
    .map((r, i) => ({
      rank: i + 1,
      title: r.title ?? "",
      snippet: r.snippet ?? "",
      url: r.link ?? "",
    }))
    .filter(o => o.title.length > 0);

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ keyword, fetched_at: new Date().toISOString(), outlines, raw: json }, null, 2), "utf8");

  return { outlines, from_cache: false, raw: json };
}
