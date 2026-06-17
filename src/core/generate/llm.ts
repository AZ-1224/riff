/**
 * Self-contained generator (--llm mode). Calls the Anthropic Messages API via
 * fetch (no SDK dep, so `npx riffkit` stays zero-install). Used for unattended
 * / cron runs. The default product path is agent-driven (see skill.md),
 * where the buyer's own agent does this reasoning for free.
 */
import type { Source, Bundle, ProductContext, XArticle } from "../schema.js";
import { validateBundle } from "../schema.js";
import { SYSTEM_PROMPT, buildUserPrompt, buildRepegPrompt } from "./prompts.js";
import { loadConfig } from "../util/config.js";
import { extractJson } from "../util/json.js";
import { fetchWithTimeout } from "../util/net.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

async function anthropic(system: string, user: string, maxTokens: number): Promise<string> {
  const cfg = loadConfig();
  if (!cfg.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Either export it for --llm mode, or use the default " +
        "agent-driven flow (let Claude Code / your agent generate).",
    );
  }
  const res = await fetchWithTimeout(
    ANTHROPIC_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.anthropicApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model: cfg.anthropicModel, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    },
    120000,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
  }
  const data: any = await res.json();
  return (data.content || []).map((b: any) => b.text || "").join("");
}

/** Re-peg an existing X article to a new trend (self-contained mode). */
export async function repegWithLLM(
  sourceTitle: string,
  current: XArticle,
  newTrend: string,
): Promise<XArticle> {
  const text = await anthropic(
    SYSTEM_PROMPT,
    buildRepegPrompt({ title: sourceTitle }, current, newTrend),
    3000,
  );
  const p = extractJson(text);
  const keep = (v: any, fallback: string) => (typeof v === "string" && v.trim() ? v : fallback);
  return {
    hook: keep(p.hook, current.hook),
    body: keep(p.body, current.body),
    productMention: typeof p.productMention === "string" ? p.productMention : current.productMention,
    cta: keep(p.cta, current.cta),
    trendPeg: keep(p.trendPeg, newTrend),
  };
}

export async function generateWithLLM(
  source: Source,
  product?: ProductContext,
  trendPeg?: string,
): Promise<Bundle> {
  const text = await anthropic(SYSTEM_PROMPT, buildUserPrompt(source, product, trendPeg), 8000);
  const parsed = extractJson(text);

  const errs = validateBundle(parsed);
  if (errs.length) {
    throw new Error("Model returned an incomplete bundle:\n  - " + errs.join("\n  - "));
  }

  return {
    source: { type: source.type, url: source.url, title: source.title },
    product,
    xArticle: parsed.xArticle,
    posts: parsed.posts || [],
    blog: parsed.blog,
    videoScript: parsed.videoScript,
    generatedAt: new Date().toISOString(),
    engine: "llm",
  };
}
