import { loadSource, loadBundle, saveBundle } from "../core/store.js";
import { buildRepegPrompt } from "../core/generate/prompts.js";
import { repegWithLLM } from "../core/generate/llm.js";
import { loadConfig } from "../core/util/config.js";
import { exportChannel } from "../core/channels/export.js";
import { log } from "../core/util/log.js";

interface Args {
  slug?: string;
  trend?: string;
  llm?: boolean;
}

/**
 * Re-peg a bundle's X article to a fresher trend — the "swap the trend on top,
 * fire first" mechanic. Keeps the value body, rewrites only the hook/opening.
 * Agent mode prints a focused prompt; --llm does it via the API in place.
 */
export async function cmdRepeg(args: Args): Promise<void> {
  if (!args.slug || !args.trend) {
    throw new Error('Usage: riff repeg <slug> --trend "Claude Meters launch" [--llm]');
  }
  const bundle = loadBundle(args.slug);
  const source = loadSource(args.slug);
  const useLLM = args.llm || !!loadConfig().anthropicApiKey;

  if (!useLLM) {
    log.info(`Agent-driven re-peg. Feed this to your agent; it returns JSON { hook, trendPeg, body, productMention, cta }.`);
    log.info(`Then run: riff save ${args.slug} <file>  (or paste into bundle.json's xArticle) and: riff publish ${args.slug}`);
    log.out("\n" + buildRepegPrompt({ title: source.title }, bundle.xArticle, args.trend));
    return;
  }

  log.step(`Re-pegging "${args.slug}" → "${args.trend}"`);
  bundle.xArticle = await repegWithLLM(source.title, bundle.xArticle, args.trend);
  bundle.generatedAt = new Date().toISOString();
  saveBundle(args.slug, bundle);
  // Re-render the X article markdown so it's ready to fire.
  await exportChannel.publish(args.slug, bundle);
  log.ok(`Re-pegged to "${bundle.xArticle.trendPeg}". Fire it: .riff/${args.slug}/outputs/x-article.md`);
}
