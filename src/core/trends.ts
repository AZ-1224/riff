/**
 * Trend matching. Given a trend (what's spiking now) and the stockpile of
 * ready bundles, score which article best fits so you can repeg + fire it first.
 * Pure, dependency-free token-overlap scoring — good enough to rank, and you
 * stay in control of the actual fire.
 */
import type { WorkspaceInfo, Trend } from "./store.js";

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "how",
  "he", "she", "it", "with", "at", "by", "this", "that", "you", "your", "i", "we",
  "makes", "month", "selling", "launch", "new", "release", "update",
]);

function tokens(s: string): Set<string> {
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export interface Match {
  slug: string;
  title: string;
  score: number;
  trendPeg?: string;
}

/** Rank ready (bundled) workspaces by relevance to a trend. */
export function matchStockpile(trend: Trend, stock: WorkspaceInfo[]): Match[] {
  const want = tokens([trend.trend, ...(trend.keywords || [])].join(" "));
  return stock
    .filter((w) => w.hasBundle)
    .map((w) => {
      const have = tokens([w.title, w.trendPeg || ""].join(" "));
      let score = 0;
      for (const t of want) if (have.has(t)) score++;
      return { slug: w.slug, title: w.title, score, trendPeg: w.trendPeg };
    })
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
}
