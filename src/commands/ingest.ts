import { readFileSync } from "node:fs";
import { ingest, ingestText } from "../core/ingest/index.js";
import { saveSource, slugify } from "../core/store.js";
import { log } from "../core/util/log.js";

interface Args {
  input?: string;
  text?: boolean;
  title?: string;
  slug?: string;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export async function cmdIngest(args: Args): Promise<string> {
  let source;
  if (args.text) {
    const body = readStdin();
    if (!body.trim()) throw new Error("--text given but stdin was empty. Pipe text in: riff ingest --text < notes.txt");
    source = ingestText(body, args.title || "Pasted text");
  } else {
    if (!args.input) throw new Error("Usage: riff ingest <url>   (or)   riff ingest --text < file");
    log.step(`Ingesting ${args.input}`);
    source = await ingest(args.input);
  }

  const slug = args.slug || slugify(source.title);
  saveSource(slug, source);
  log.ok(`Ingested "${source.title}" (${source.text.length} chars) → .riff/${slug}/source.json`);
  log.info(`Next: riff repurpose ${slug}   (add --llm for unattended, or let your agent generate — see skill.md)`);
  return slug;
}
