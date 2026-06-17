import { readFileSync } from "node:fs";
import { loadSource, saveBundle, loadProduct, assertSafeSlug } from "../core/store.js";
import { validateBundle, type Bundle } from "../core/schema.js";
import { extractJson } from "../core/util/json.js";
import { log } from "../core/util/log.js";

interface Args {
  slug?: string;
  file?: string;
}

/** Store an agent-produced JSON bundle (from `riff brief`). Reads file arg or stdin. */
export async function cmdSave(args: Args): Promise<void> {
  if (!args.slug) throw new Error("Usage: riff save <slug> [bundle.json]   (or pipe JSON via stdin)");
  assertSafeSlug(args.slug);
  const raw = args.file ? readFileSync(args.file, "utf8") : readFileSync(0, "utf8");
  if (!raw.trim()) throw new Error("No JSON provided (give a file path or pipe via stdin).");

  // Tolerate fenced or prose-wrapped JSON; balanced-brace extraction.
  let parsed: any;
  try {
    parsed = extractJson(raw);
  } catch (e: any) {
    throw new Error(`Could not parse JSON: ${e.message}`);
  }

  const errs = validateBundle(parsed);
  if (errs.length) throw new Error("Invalid bundle:\n  - " + errs.join("\n  - "));

  const source = loadSource(args.slug);
  const bundle: Bundle = {
    source: { type: source.type, url: source.url, title: source.title },
    product: loadProduct(),
    xArticle: parsed.xArticle,
    posts: parsed.posts,
    blog: parsed.blog,
    videoScript: parsed.videoScript,
    generatedAt: new Date().toISOString(),
    engine: "agent",
  };
  saveBundle(args.slug, bundle);
  log.ok(`Saved agent bundle → .riff/${args.slug}/bundle.json`);
  log.info(`Next: riff publish ${args.slug}`);
}
