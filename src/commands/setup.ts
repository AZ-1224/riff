import { saveConfig, loadProduct } from "../core/store.js";
import { CHANNELS } from "../core/channels/registry.js";
import { log, color } from "../core/util/log.js";

interface InitArgs {
  name?: string;
  oneLiner?: string;
  url?: string;
  ctaLink?: string;
}

/** Configure the product woven into every bundle. Stored in .riff/config.json. */
export function cmdInit(args: InitArgs): void {
  if (!args.name || !args.url) {
    throw new Error(
      'Usage: riff init --name "Postiz" --one-liner "Run social on autopilot with AI agents" --url https://postiz.com [--cta-link https://postiz.pro/you]',
    );
  }
  saveConfig({
    name: args.name,
    oneLiner: args.oneLiner || "",
    url: args.url,
    ctaLink: args.ctaLink || args.url,
  });
  log.ok(`Saved product context for "${args.name}" → .riff/config.json`);
  log.info("It will be woven into every X article, blog post, and video as a soft mention.");
}

/** List channels and whether they're configured. */
export function cmdChannels(): void {
  const product = loadProduct();
  log.out(color.bold("\nProduct: ") + (product ? `${product.name} (${product.url})` : color.dim("none — run: riff init")));
  log.out(color.bold("\nChannels:"));
  for (const c of CHANNELS) {
    const status = c.configured() ? color.green("● ready") : color.dim("○ not configured");
    log.out(`  ${status}  ${color.cyan(c.name.padEnd(8))} ${c.description}`);
    if (!c.configured() && c.requires.length) {
      log.out(`           ${color.dim("needs: " + c.requires.join(", "))}`);
    }
  }
  log.out("");
}
