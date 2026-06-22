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

/**
 * Validate a parsed bundle-like object against the required shape. Returns a list
 * of problems (empty = valid). Shared by `riff save` (agent bundles) and the
 * self-contained LLM generator so both reject malformed output the same way.
 */
export function validateBundle(b: any): string[] {
  const errs: string[] = [];
  if (!b || typeof b !== "object") return ["not a JSON object"];

  const str = (v: any) => typeof v === "string" && v.trim().length > 0;

  const x = b.xArticle;
  if (!x || typeof x !== "object") errs.push("xArticle missing");
  else {
    if (!str(x.hook)) errs.push("xArticle.hook missing/empty");
    if (!str(x.body)) errs.push("xArticle.body missing/empty");
    if (typeof x.productMention !== "string") errs.push("xArticle.productMention must be a string");
    if (!str(x.cta)) errs.push("xArticle.cta missing/empty");
  }

  if (!Array.isArray(b.posts)) errs.push("posts must be an array");
  else
    b.posts.forEach((p: any, i: number) => {
      if (!str(p?.platform)) errs.push(`posts[${i}].platform missing`);
      if (!str(p?.text)) errs.push(`posts[${i}].text missing`);
    });

  const bl = b.blog;
  if (!bl || typeof bl !== "object") errs.push("blog missing");
  else {
    if (!str(bl.title)) errs.push("blog.title missing/empty");
    if (!str(bl.slug)) errs.push("blog.slug missing/empty");
    if (!str(bl.metaDescription)) errs.push("blog.metaDescription missing/empty");
    if (!Array.isArray(bl.keywords)) errs.push("blog.keywords must be an array");
    if (!str(bl.bodyMarkdown)) errs.push("blog.bodyMarkdown missing/empty");
  }

  const v = b.videoScript;
  if (!v || typeof v !== "object") errs.push("videoScript missing");
  else {
    if (!str(v.title)) errs.push("videoScript.title missing/empty");
    if (!str(v.hook)) errs.push("videoScript.hook missing/empty");
    if (typeof v.estDurationSec !== "number") errs.push("videoScript.estDurationSec must be a number");
    if (!Array.isArray(v.segments) || v.segments.length === 0) errs.push("videoScript.segments must be a non-empty array");
    else
      v.segments.forEach((s: any, i: number) => {
        if (!str(s?.say)) errs.push(`videoScript.segments[${i}].say missing`);
        if (!str(s?.screen)) errs.push(`videoScript.segments[${i}].screen missing`);
      });
  }

  return errs;
}
