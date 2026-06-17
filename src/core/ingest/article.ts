/**
 * Article / web-page ingest. Fetches HTML and does a lightweight readability
 * extract (no heavy deps): strips scripts/styles/nav, pulls <article> or <main>
 * or the densest text block, decodes entities, collapses whitespace.
 */
import type { Source } from "../schema.js";
import { decodeEntities } from "../util/html.js";
import { fetchWithTimeout, assertPublicHttpUrl } from "../util/net.js";

function stripTags(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? decodeEntities(t[1].trim()) : "Untitled";
}

export async function ingestArticle(url: string): Promise<Source> {
  assertPublicHttpUrl(url);
  const res = await fetchWithTimeout(
    url,
    { headers: { "user-agent": "Mozilla/5.0 (riff content ingest)" }, redirect: "follow" },
    15000,
  );
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${url}`);
  const html = await res.text();

  const title = extractTitle(html);

  // Prefer semantic containers. If none match, use an empty string rather than
  // the full document (avoids extracting <head>/scripts as junk); the length
  // guard below then reports a clear error.
  const container =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html.match(/<body[\s\S]*?<\/body>/i)?.[0] ||
    "";

  const cleaned = container
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");

  const text = decodeEntities(stripTags(cleaned))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text.length < 200) {
    throw new Error(
      `Extracted too little text (${text.length} chars) from ${url}. ` +
        "The page may be JS-rendered. Paste the text instead: riff ingest --text < file",
    );
  }

  return {
    type: "article",
    url,
    title,
    text,
    fetchedAt: new Date().toISOString(),
  };
}

export function ingestText(text: string, title = "Pasted text"): Source {
  return {
    type: "text",
    url: "text",
    title,
    text: text.trim(),
    fetchedAt: new Date().toISOString(),
  };
}
