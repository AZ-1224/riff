import { ingest } from "../core/ingest/index.js";
import { saveSource, loadSource, saveBundle, slugify, loadProduct } from "../core/store.js";
import { generateWithLLM } from "../core/generate/llm.js";
import { loadConfig } from "../core/util/config.js";
import { log } from "../core/util/log.js";
import { cmdPublish } from "./publish.js";

interface Args {
  target?: string; // slug or url
  llm?: boolean;
  trend?: string;
  publish?: boolean;
  channel?: string;
}

export async function cmdRepurpose(args: Args): Promise<void> {
  if (!args.target) throw new Error("Usage: riff repurpose <slug|url> [--llm] [--trend \"...\"] [--publish]");

  // Resolve to a slug + source. If a URL, ingest first.
  let slug = args.target;
  if (/^https?:\/\//.test(args.target)) {
    log.step(`Ingesting ${args.target}`);
    const source = await ingest(args.target);
    slug = slugify(source.title);
    saveSource(slug, source);
    log.ok(`Ingested → .riff/${slug}/`);
  }

  const source = loadSource(slug);
  const product = loadProduct();
  const useLLM = args.llm || !!loadConfig().anthropicApiKey;

  if (!useLLM) {
    log.warn("No ANTHROPIC_API_KEY and --llm not set — this is the agent-driven path.");
    log.info(`Have your agent generate the bundle:`);
    log.info(`  1. riff brief ${slug}      → prints the prompt + source`);
    log.info(`  2. agent writes the JSON bundle`);
    log.info(`  3. riff save ${slug} <file>  → validates & stores it`);
    log.info(`Then: riff publish ${slug}`);
    log.info(`(Or run unattended: ANTHROPIC_API_KEY=... riff repurpose ${slug} --llm)`);
    return;
  }

  log.step(`Generating bundle with ${loadConfig().anthropicModel}${args.trend ? ` (trend: ${args.trend})` : ""}`);
  const bundle = await generateWithLLM(source, product, args.trend);
  saveBundle(slug, bundle);
  log.ok(
    `Bundle ready: X article + ${bundle.posts.length} posts + SEO blog + ${bundle.videoScript.segments.length}-segment video script`,
  );

  if (args.publish) {
    await cmdPublish({ slug, channel: args.channel });
  } else {
    log.info(`Next: riff publish ${slug}   (writes markdown; ships to configured channels)`);
  }
}
