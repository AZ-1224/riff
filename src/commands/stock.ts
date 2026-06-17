import { listWorkspaces } from "../core/store.js";
import { log, color } from "../core/util/log.js";

/**
 * The stockpile dashboard. Shows every ingested source, whether a bundle is
 * ready, its current trend peg, and whether it's been rendered. This is the
 * "what can I fire the moment a trend lands" view.
 */
export function cmdStock(): void {
  const ws = listWorkspaces();
  if (!ws.length) {
    log.info("Stockpile empty. Start one: riff ingest <url>");
    return;
  }
  log.out(color.bold(`\nStockpile (${ws.length})\n`));
  for (const w of ws) {
    const state = !w.hasBundle
      ? color.yellow("◷ needs bundle")
      : w.published
        ? color.green("● ready to fire")
        : color.cyan("◐ bundle saved");
    log.out(`  ${state}  ${color.bold(w.slug)}`);
    log.out(`     ${color.dim(w.title.slice(0, 70))}`);
    if (w.hasBundle) {
      log.out(
        `     ${color.dim("trend:")} ${w.trendPeg || color.dim("none")}   ${color.dim("posts:")} ${w.posts ?? 0}`,
      );
    }
  }
  log.out("");
  log.info('Swap a trend before firing: riff repeg <slug> --trend "next release" --llm');
}
