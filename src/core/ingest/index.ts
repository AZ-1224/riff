/** Ingest dispatch: pick the right extractor by source. */
import type { Source } from "../schema.js";
import { isYouTube, ingestYouTube } from "./youtube.js";
import { ingestArticle, ingestText } from "./article.js";

export { ingestText };

export async function ingest(input: string): Promise<Source> {
  if (isYouTube(input)) return ingestYouTube(input);
  if (/^https?:\/\//.test(input)) return ingestArticle(input);
  // Treat as raw text.
  return ingestText(input);
}
