/**
 * Social channel via Postiz (Nevo's own scheduler — 30+ platforms, has an API).
 * Schedules the bundle's posts. Gated on POSTIZ_API_KEY. The HTTP shape follows
 * Postiz's public API; if your Postiz instance differs, this is the one adapter
 * to adjust. Self-host base URL via POSTIZ_BASE_URL.
 *
 * Adapter pattern: swap this file to publish via your own pipeline
 * (passion-berry / loyalty) without touching the rest of Riff.
 */
import type { Channel, PublishResult } from "./types.js";
import type { Bundle } from "../schema.js";
import { loadConfig } from "../util/config.js";
import { injectLinks, campaignFromTrend } from "../util/links.js";

export const socialChannel: Channel = {
  name: "social",
  description: "Schedule the weekly posts via Postiz (30+ platforms)",
  requires: ["POSTIZ_API_KEY"],
  configured: () => !!loadConfig().postizApiKey,
  async publish(_slug: string, bundle: Bundle): Promise<PublishResult> {
    const cfg = loadConfig();
    if (!cfg.postizApiKey) {
      return {
        channel: "social",
        ok: false,
        detail: "Skipped — set POSTIZ_API_KEY (and optionally POSTIZ_BASE_URL) to enable.",
      };
    }

    const refs: string[] = [];
    const errors: string[] = [];
    const base = bundle.product?.ctaLink || bundle.product?.url;
    const campaign = campaignFromTrend(bundle.xArticle.trendPeg);
    // One scheduled post per bundle post. Postiz expects a list of integration
    // targets; we leave `integrations` empty so the user's default channels apply.
    for (const post of bundle.posts) {
      try {
        const content = injectLinks(post.text, base, { source: post.platform, campaign });
        const res = await fetch(`${cfg.postizBaseUrl}/public/v1/posts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: cfg.postizApiKey,
          },
          body: JSON.stringify({
            type: "draft", // draft, not auto-fire — review before publish
            content,
            tags: [`riff`, post.platform],
          }),
        });
        if (!res.ok) {
          errors.push(`${post.platform}: ${res.status}`);
        } else {
          const data: any = await res.json().catch(() => ({}));
          refs.push(data.id ? `postiz:${data.id}` : `postiz:${post.platform}`);
        }
      } catch (e: any) {
        errors.push(`${post.platform}: ${e.message}`);
      }
    }

    return {
      channel: "social",
      ok: errors.length === 0,
      detail: errors.length
        ? `Created ${refs.length} drafts; ${errors.length} failed (${errors.join("; ")})`
        : `Created ${refs.length} Postiz drafts (review then schedule)`,
      refs,
    };
  },
};
