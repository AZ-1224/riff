/**
 * Link tracking. Every {{LINK}} in a bundle resolves to the product's CTA link
 * with per-channel UTM params, so you can see in analytics WHICH channel and
 * WHICH trend-peg drove signups. This is how the distribution game is measured —
 * Nevo runs everything on tracked links.
 *
 * Disable entirely with RIFF_NO_UTM=1 (resolves {{LINK}} to the bare base URL).
 */

export interface LinkOpts {
  /** utm_source — the channel/platform: "x", "linkedin", "blog", "wordpress". */
  source: string;
  /** utm_medium — defaults to "riff". */
  medium?: string;
  /** utm_campaign — usually the trend peg slug. */
  campaign?: string;
  /** utm_content — e.g. thread position, for A/B granularity. */
  content?: string;
}

export function trackedLink(base: string, o: LinkOpts): string {
  try {
    const u = new URL(base);
    u.searchParams.set("utm_source", o.source);
    u.searchParams.set("utm_medium", o.medium || "riff");
    if (o.campaign) u.searchParams.set("utm_campaign", o.campaign);
    if (o.content) u.searchParams.set("utm_content", o.content);
    return u.toString();
  } catch {
    return base; // not a URL (e.g. a handle) — leave as-is
  }
}

/** Replace every {{LINK}} token in `text` with a tracked link (or bare/empty). */
export function injectLinks(text: string, base: string | undefined, o: LinkOpts): string {
  if (!text) return text;
  if (!base) return text.replace(/\{\{LINK\}\}/g, "");
  if (process.env.RIFF_NO_UTM === "1") return text.replace(/\{\{LINK\}\}/g, base);
  return text.replace(/\{\{LINK\}\}/g, trackedLink(base, o));
}

export function campaignFromTrend(trendPeg?: string): string {
  return (
    (trendPeg || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "riff"
  );
}
