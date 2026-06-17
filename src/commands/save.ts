import { readFileSync } from "node:fs";
import { loadSource, saveBundle, loadProduct } from "../core/store.js";
import type { Bundle } from "../core/schema.js";
import { log } from "../core/util/log.js";

interface Args {
  slug?: string;
  file?: string;
}

function validate(b: any): string[] {
  const errs: string[] = [];
  if (!b || typeof b !== "object") return ["not a JSON object"];
  if (!b.xArticle?.hook) errs.push("xArticle.hook missing");
  if (!b.xArticle?.body) errs.push("xArticle.body missing");
  if (!Array.isArray(b.posts)) errs.push("posts must be an array");
  if (!b.blog?.title || !b.blog?.bodyMarkdown) errs.push("blog.title / blog.bodyMarkdown missing");
  if (!b.videoScript?.segments || !Array.isArray(b.videoScript.segments))
    errs.push("videoScript.segments must be an array");
  return errs;
}

/** Store an agent-produced JSON bundle (from `riff brief`). Reads file arg or stdin. */
export async function cmdSave(args: Args): Promise<void> {
  if (!args.slug) throw new Error("Usage: riff save <slug> [bundle.json]   (or pipe JSON via stdin)");
  const raw = args.file ? readFileSync(args.file, "utf8") : readFileSync(0, "utf8");
  if (!raw.trim()) throw new Error("No JSON provided (give a file path or pipe via stdin).");

  // Tolerate fenced or prose-wrapped JSON.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch (e: any) {
    throw new Error(`Could not parse JSON: ${e.message}`);
  }

  const errs = validate(parsed);
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
