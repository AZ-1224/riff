/**
 * Export channel — always available, zero keys. Renders the bundle into clean,
 * paste-ready Markdown files under .riff/<slug>/outputs/. This is the fastest
 * path to value: ingest → repurpose → export, then copy outputs anywhere.
 */
import type { Channel, PublishResult } from "./types.js";
import type { Bundle } from "../schema.js";
import { writeOutput } from "../store.js";
import { injectLinks, campaignFromTrend } from "../util/links.js";

function renderXArticle(b: Bundle): string {
  const x = b.xArticle;
  const base = b.product?.ctaLink || b.product?.url;
  const campaign = campaignFromTrend(x.trendPeg);
  const cta = injectLinks(x.cta, base, { source: "x", campaign });
  return [
    `# X Article${x.trendPeg ? `  ·  trend: ${x.trendPeg}` : ""}`,
    ``,
    `**Hook**`,
    x.hook,
    ``,
    `**Body**`,
    injectLinks(x.body, base, { source: "x", campaign }),
    ``,
    x.productMention ? `**Product line**\n${x.productMention}\n` : ``,
    `**CTA**`,
    cta,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

function renderPosts(b: Bundle): string {
  const base = b.product?.ctaLink || b.product?.url;
  const campaign = campaignFromTrend(b.xArticle.trendPeg);
  const lines = ["# Weekly posts", ""];
  const byPlatform = new Map<string, typeof b.posts>();
  for (const p of b.posts) {
    if (!byPlatform.has(p.platform)) byPlatform.set(p.platform, []);
    byPlatform.get(p.platform)!.push(p);
  }
  for (const [platform, posts] of byPlatform) {
    lines.push(`## ${platform}`, "");
    posts
      .sort((a, c) => (a.threadOrder ?? 0) - (c.threadOrder ?? 0))
      .forEach((p, i) => {
        lines.push(`**${p.threadOrder ? `${p.threadOrder}/` : `#${i + 1}`}**  ${p.mediaHint ? `_(${p.mediaHint})_` : ""}`);
        lines.push(
          injectLinks(p.text, base, { source: platform, campaign, content: p.threadOrder ? String(p.threadOrder) : undefined }),
          "",
        );
      });
  }
  return lines.join("\n");
}

function renderBlog(b: Bundle): string {
  const bl = b.blog;
  const base = b.product?.ctaLink || b.product?.url;
  return [
    `---`,
    `title: ${bl.title}`,
    `slug: ${bl.slug}`,
    `description: ${bl.metaDescription}`,
    `keywords: ${(bl.keywords || []).join(", ")}`,
    `---`,
    ``,
    injectLinks(bl.bodyMarkdown, base, { source: "blog", campaign: campaignFromTrend(b.xArticle.trendPeg) }),
  ].join("\n");
}

function renderVideo(b: Bundle): string {
  const v = b.videoScript;
  const lines = [
    `# ${v.title}`,
    `_~${v.estDurationSec}s · split-screen avatar_`,
    ``,
    `**HOOK (0-2s):** ${v.hook}`,
    ``,
    `| Avatar says | On screen |`,
    `| --- | --- |`,
  ];
  for (const s of v.segments) {
    lines.push(`| ${s.say.replace(/\|/g, "\\|")} | ${s.screen.replace(/\|/g, "\\|")} |`);
  }
  return lines.join("\n");
}

export const exportChannel: Channel = {
  name: "export",
  description: "Render the bundle to Markdown files on disk (no keys needed)",
  requires: [],
  configured: () => true,
  async publish(slug: string, bundle: Bundle): Promise<PublishResult> {
    const refs = [
      writeOutput(slug, "x-article.md", renderXArticle(bundle)),
      writeOutput(slug, "posts.md", renderPosts(bundle)),
      writeOutput(slug, "blog.md", renderBlog(bundle)),
      writeOutput(slug, "video-script.md", renderVideo(bundle)),
    ];
    return {
      channel: "export",
      ok: true,
      detail: `Wrote ${refs.length} markdown files to .riff/${slug}/outputs/`,
      refs,
    };
  },
};
