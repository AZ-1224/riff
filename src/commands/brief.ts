import { loadSource, loadProduct } from "../core/store.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../core/generate/prompts.js";
import { log } from "../core/util/log.js";

interface Args {
  slug?: string;
  trend?: string;
}

/**
 * Agent-driven mode. Prints the exact prompt (system + user, including the
 * ingested source) so the buyer's own agent — Claude Code, Cursor, ChatGPT —
 * can generate the bundle for free, then store it with `riff save`.
 */
export async function cmdBrief(args: Args): Promise<void> {
  if (!args.slug) throw new Error("Usage: riff brief <slug> [--trend \"...\"]");
  const source = loadSource(args.slug);
  const product = loadProduct();

  log.info("Feed everything below to your agent. It must return ONE JSON object, then run: riff save " + args.slug);
  log.out("\n===== SYSTEM =====\n");
  log.out(SYSTEM_PROMPT);
  log.out("\n===== USER =====\n");
  log.out(buildUserPrompt(source, product, args.trend));
}
