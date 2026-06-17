/**
 * The Riff data model. One ingested Source fans out into one Bundle of outputs.
 * These shapes are the contract shared by: the agent-driven skill, the
 * self-contained --llm generator, the CLI, the public API, and the MCP server.
 */

export type SourceType = "youtube" | "article" | "text";

export interface Source {
  type: SourceType;
  /** Original URL, or "stdin"/"file" for raw text. */
  url: string;
  title: string;
  author?: string;
  /** Full plain-text body / transcript. */
  text: string;
  /** Optional timestamped transcript segments (YouTube). */
  segments?: { t: number; text: string }[];
  durationSec?: number;
  fetchedAt: string;
}

export interface SocialPost {
  platform: "x" | "linkedin" | "instagram" | "threads" | "tiktok" | "youtube-short";
  /** Ready-to-post text. For X this may be a single post or one node of a thread. */
  text: string;
  /** If part of a thread, 1-based position; otherwise omitted. */
  threadOrder?: number;
  /** Suggested media: "clip:00:30-00:48", "screenshot:dashboard", "avatar-video". */
  mediaHint?: string;
}

/** The trend-jacking long-form X post — Riff's headline asset. */
export interface XArticle {
  /** Scroll-stopping first line. */
  hook: string;
  /** The body, newline-separated, no hashtags-as-spam. */
  body: string;
  /** Soft, credible product mention (one line). */
  productMention: string;
  /** Closing call to action + link placeholder {{LINK}}. */
  cta: string;
  /** Which current trend/release this is pegged to (for the pre-write stockpile). */
  trendPeg?: string;
}

export interface BlogPost {
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  /** Third-person, real-value SEO article in Markdown. */
  bodyMarkdown: string;
}

export interface VideoSegment {
  /** What the avatar says aloud. */
  say: string;
  /** What's on the other half of the split screen: screenshot/clip/b-roll cue. */
  screen: string;
}

export interface VideoScript {
  title: string;
  estDurationSec: number;
  /** Hook line for the first 2 seconds. */
  hook: string;
  segments: VideoSegment[];
}

export interface Bundle {
  source: Pick<Source, "type" | "url" | "title">;
  product?: ProductContext;
  xArticle: XArticle;
  posts: SocialPost[];
  blog: BlogPost;
  videoScript: VideoScript;
  generatedAt: string;
  /** "agent" (buyer's agent wrote it) or "llm" (self-contained API run). */
  engine: "agent" | "llm";
}

/** The seller's product, woven into outputs as a soft mention. Configured per workspace. */
export interface ProductContext {
  name: string;
  oneLiner: string;
  url: string;
  /** Optional affiliate/UTM link used in CTAs. */
  ctaLink?: string;
}

/** JSON Schema for the Bundle generation — fed to the LLM / agent to force structure. */
export const BUNDLE_OUTPUT_SHAPE = {
  xArticle: {
    hook: "string — scroll-stopping first line, no clickbait lies",
    body: "string — the value, plain text, line breaks, no hashtag spam",
    productMention: "string — one credible line mentioning the product naturally",
    cta: "string — closing CTA, use {{LINK}} where the link goes",
    trendPeg: "string — the trend/release this rides (e.g. 'Claude Opus 4.8 launch')",
  },
  posts: "array of { platform, text, threadOrder?, mediaHint? } — a week of tailored posts",
  blog: {
    title: "string",
    slug: "string-kebab-case",
    metaDescription: "string <=155 chars",
    keywords: "array of string",
    bodyMarkdown: "string — third-person SEO article, real value, product woven in",
  },
  videoScript: {
    title: "string",
    estDurationSec: "number 20-60",
    hook: "string — first 2 seconds",
    segments: "array of { say, screen } — split-screen avatar script",
  },
} as const;
