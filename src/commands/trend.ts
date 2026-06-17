import { loadTrends, saveTrends, listWorkspaces, type Trend } from "../core/store.js";
import { matchStockpile } from "../core/trends.js";
import { cmdRepeg } from "./repeg.js";
import { log, color } from "../core/util/log.js";

interface Args {
  add?: string;
  remove?: string;
  fire?: string;
  keywords?: string;
  eta?: string;
  llm?: boolean;
}

/**
 * Trend watchlist + fire planner. Track the releases you expect to spike, and
 * Riff tells you which stockpiled article to repeg + fire the moment one lands.
 *
 *   riff trend                                  list watchlist + best matches
 *   riff trend --add "Claude Meters launch" --keywords claude,meters --eta 2026-06-24
 *   riff trend --fire "Claude Meters launch" [--llm]   repeg best match + mark fired
 *   riff trend --remove "Claude Meters launch"
 */
export async function cmdTrend(args: Args): Promise<void> {
  let trends = loadTrends();
  const stock = listWorkspaces();

  if (args.add) {
    if (trends.some((t) => t.trend.toLowerCase() === args.add!.toLowerCase())) {
      log.warn(`Already watching "${args.add}".`);
    } else {
      const t: Trend = {
        trend: args.add,
        keywords: args.keywords ? args.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        status: "pending",
        eta: args.eta,
        addedAt: new Date().toISOString(),
      };
      trends.push(t);
      saveTrends(trends);
      log.ok(`Watching "${args.add}"${args.eta ? ` (eta ${args.eta})` : ""}.`);
    }
  }

  if (args.remove) {
    const before = trends.length;
    trends = trends.filter((t) => t.trend.toLowerCase() !== args.remove!.toLowerCase());
    saveTrends(trends);
    log[before === trends.length ? "warn" : "ok"](
      before === trends.length ? `Not watching "${args.remove}".` : `Removed "${args.remove}".`,
    );
  }

  if (args.fire) {
    const t = trends.find((x) => x.trend.toLowerCase() === args.fire!.toLowerCase());
    if (!t) throw new Error(`Not watching "${args.fire}". Add it first: riff trend --add "${args.fire}"`);
    const matches = matchStockpile(t, stock);
    const best = matches[0];
    if (!best || best.score === 0) {
      throw new Error(
        `No stockpiled article matches "${args.fire}". Ingest + generate one first, then: riff trend --fire "${args.fire}"`,
      );
    }
    log.step(`Best match for "${t.trend}": ${best.slug} (score ${best.score})`);
    await cmdRepeg({ slug: best.slug, trend: t.trend, llm: args.llm });
    t.status = "fired";
    t.firedSlug = best.slug;
    saveTrends(trends);
    log.ok(`Marked "${t.trend}" fired → ${best.slug}. Post: .riff/${best.slug}/outputs/x-article.md`);
    return;
  }

  // Default / after mutations: show the watchlist with match plan.
  if (!trends.length) {
    log.info('Watchlist empty. Add one: riff trend --add "Claude Meters launch" --keywords claude,meters');
    return;
  }
  log.out(color.bold(`\nTrend watchlist (${trends.length})\n`));
  for (const t of trends) {
    const tag =
      t.status === "fired" ? color.dim("✓ fired") : color.yellow("◷ pending");
    log.out(`  ${tag}  ${color.bold(t.trend)}${t.eta ? color.dim(`  eta ${t.eta}`) : ""}`);
    if (t.status === "fired") {
      log.out(`     ${color.dim("fired →")} ${t.firedSlug}`);
      continue;
    }
    const best = matchStockpile(t, stock)[0];
    if (best && best.score > 0) {
      log.out(`     ${color.green("→ fire:")} riff trend --fire "${t.trend}" --llm   ${color.dim(`(matches ${best.slug}, score ${best.score})`)}`);
    } else {
      log.out(`     ${color.dim("no stockpiled article matches yet — ingest one")}`);
    }
  }
  log.out("");
}
