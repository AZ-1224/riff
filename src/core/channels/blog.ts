/**
 * Blog channel via WordPress REST API. Publishes the SEO article as a draft post.
 * Gated on WORDPRESS_URL + WORDPRESS_USER + WORDPRESS_APP_PASSWORD (an
 * Application Password, not the login password). Posts as "draft" so a human
 * approves before it goes live.
 *
 * Markdown → HTML here is intentionally minimal (headings, bold, lists, links,
 * paragraphs). Swap for a full Markdown lib if you need tables/embeds.
 */
import type { Channel, PublishResult } from "./types.js";
import type { Bundle } from "../schema.js";
import { loadConfig } from "../util/config.js";

function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  const inline = (s: string) =>
    s
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*(?!\*)([^*]+)\*/g, "<em>$1</em>");

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length + 1; // h1 → h2 (title is the post title)
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
    } else if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

export const blogChannel: Channel = {
  name: "blog",
  description: "Publish the SEO article to WordPress (as a draft)",
  requires: ["WORDPRESS_URL", "WORDPRESS_USER", "WORDPRESS_APP_PASSWORD"],
  configured: () => {
    const c = loadConfig();
    return !!(c.wordpressUrl && c.wordpressUser && c.wordpressAppPassword);
  },
  async publish(_slug: string, bundle: Bundle): Promise<PublishResult> {
    const cfg = loadConfig();
    if (!this.configured()) {
      return {
        channel: "blog",
        ok: false,
        detail: `Skipped — set ${this.requires.join(", ")} to enable.`,
      };
    }
    const auth = Buffer.from(`${cfg.wordpressUser}:${cfg.wordpressAppPassword}`).toString("base64");
    const endpoint = `${cfg.wordpressUrl!.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          title: bundle.blog.title,
          slug: bundle.blog.slug,
          status: "draft",
          content: mdToHtml(bundle.blog.bodyMarkdown),
          excerpt: bundle.blog.metaDescription,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return { channel: "blog", ok: false, detail: `WordPress ${res.status}: ${t.slice(0, 200)}` };
      }
      const data: any = await res.json();
      return {
        channel: "blog",
        ok: true,
        detail: `Created WordPress draft: ${data.link || data.id}`,
        refs: [`wp:${data.id}`],
      };
    } catch (e: any) {
      return { channel: "blog", ok: false, detail: `WordPress error: ${e.message}` };
    }
  },
};
