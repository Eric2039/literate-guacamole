// mvp/llm.ts — LLM provider wrapper (Moonshot + DeepSeek)
//
// MVP scope: single function callLLM(prompt, opts) → returns parsed + raw + tokens + cost.
// Providers expose OpenAI-compatible Chat Completions endpoints, so one client serves both.

export type Provider = "moonshot" | "deepseek";

const ENDPOINTS: Record<Provider, string> = {
  moonshot: "https://api.moonshot.cn/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
};

// Approximate per-1k-token pricing in USD (MVP estimate; refresh from provider docs).
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "moonshot-v1-32k": { input: 0.0034, output: 0.0034 },
  "moonshot-v1-128k": { input: 0.0084, output: 0.0084 },
  "deepseek-chat":    { input: 0.00027, output: 0.0011 },
};

export type CallLLMOptions = {
  provider?: Provider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
};

export type CallLLMResult = {
  raw: string;
  parsed: unknown | null;
  parseError?: string;
  tokens: { prompt: number; completion: number; total: number };
  cost_usd: number;
  duration_ms: number;
  model: string;
  provider: Provider;
};

function defaultProvider(): Provider {
  return (process.env.DEFAULT_PROVIDER as Provider) ?? "moonshot";
}

function defaultModel(provider: Provider): string {
  if (process.env.DEFAULT_MODEL) return process.env.DEFAULT_MODEL;
  return provider === "moonshot" ? "moonshot-v1-32k" : "deepseek-chat";
}

function apiKey(provider: Provider): string {
  const key = provider === "moonshot"
    ? process.env.MOONSHOT_API_KEY
    : process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error(`Missing API key for ${provider}. Set ${provider === "moonshot" ? "MOONSHOT_API_KEY" : "DEEPSEEK_API_KEY"} in .env.local`);
  return key;
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rate = COST_PER_1K[model] ?? { input: 0.003, output: 0.003 };
  return (promptTokens / 1000) * rate.input + (completionTokens / 1000) * rate.output;
}

function tryParseJson(raw: string): { parsed: unknown | null; error?: string } {
  // Strip optional ```json fences if model ignored instructions
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1];
  // Try to find first { ... last } if there's preamble/postamble
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return { parsed: JSON.parse(cleaned) };
  } catch (e) {
    return { parsed: null, error: (e as Error).message };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function isRetryableHttp(status: number): boolean {
  // 408 timeout, 429 rate limit, 500-599 server errors
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

export async function callLLM(prompt: string, opts: CallLLMOptions = {}): Promise<CallLLMResult> {
  const provider = opts.provider ?? defaultProvider();
  const model = opts.model ?? defaultModel(provider);
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 4096;
  const url = ENDPOINTS[provider];
  const key = apiKey(provider);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  // Network/HTTP retry: 2 attempts with backoff on retryable errors
  const MAX_ATTEMPTS = 2;
  const t0 = Date.now();
  let lastErr: Error | null = null;
  let resp: Response | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastErr = new Error(`LLM network error (${provider}/${model}, attempt ${attempt}): ${(e as Error).message}`);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1500 * attempt);
        continue;
      }
      throw lastErr;
    }

    if (resp.ok) {
      lastErr = null;
      break;
    }

    const errText = await resp.text().catch(() => "<no body>");
    lastErr = new Error(`LLM HTTP ${resp.status} (${provider}/${model}, attempt ${attempt}): ${errText.slice(0, 500)}`);
    if (attempt < MAX_ATTEMPTS && isRetryableHttp(resp.status)) {
      await sleep(2000 * attempt);
      continue;
    }
    throw lastErr;
  }

  if (!resp || !resp.ok) {
    throw lastErr ?? new Error("LLM call failed for unknown reason");
  }

  const duration = Date.now() - t0;

  const json = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const raw = json.choices?.[0]?.message?.content ?? "";
  const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const cost_usd = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);

  const { parsed, error } = tryParseJson(raw);

  return {
    raw,
    parsed,
    parseError: error,
    tokens: {
      prompt: usage.prompt_tokens,
      completion: usage.completion_tokens,
      total: usage.total_tokens,
    },
    cost_usd,
    duration_ms: duration,
    model,
    provider,
  };
}

// Retry once on parse failure with lower temperature.
export async function callLLMWithParseRetry(
  prompt: string,
  opts: CallLLMOptions = {},
): Promise<CallLLMResult> {
  const first = await callLLM(prompt, opts);
  if (first.parsed) return first;
  const retryPrompt = `${prompt}\n\n⚠️ 上次输出不是合法 JSON, 这次必须严格 JSON, 不要任何额外字符。`;
  const retry = await callLLM(retryPrompt, {
    ...opts,
    temperature: Math.max(0, (opts.temperature ?? 0.7) - 0.1),
  });
  return retry;
}

// Provider fallback wrapper: try primary, then fall back to the other provider if its key is set.
// `parseRetry: true` also retries on JSON parse failure.
export async function callLLMWithFallback(
  prompt: string,
  opts: CallLLMOptions & { parseRetry?: boolean } = {},
): Promise<CallLLMResult & { used_fallback: boolean; fallback_reason?: string }> {
  const primary = opts.provider ?? defaultProvider();
  const alternate: Provider = primary === "moonshot" ? "deepseek" : "moonshot";
  const altKeyEnvVar = alternate === "moonshot" ? "MOONSHOT_API_KEY" : "DEEPSEEK_API_KEY";
  const altKeyAvailable = !!process.env[altKeyEnvVar];

  try {
    const r = opts.parseRetry
      ? await callLLMWithParseRetry(prompt, opts)
      : await callLLM(prompt, opts);
    return { ...r, used_fallback: false };
  } catch (e) {
    const primaryErr = (e as Error).message;
    if (!altKeyAvailable) {
      throw new Error(`${primaryErr}\n(no fallback: ${altKeyEnvVar} not set)`);
    }
    console.warn(`  ↳ ${primary} failed, falling back to ${alternate}: ${primaryErr.slice(0, 150)}`);
    const altOpts: CallLLMOptions = {
      ...opts,
      provider: alternate,
      model: undefined, // let alternate provider's default model kick in
    };
    const r = opts.parseRetry
      ? await callLLMWithParseRetry(prompt, altOpts)
      : await callLLM(prompt, altOpts);
    return { ...r, used_fallback: true, fallback_reason: primaryErr.slice(0, 300) };
  }
}
