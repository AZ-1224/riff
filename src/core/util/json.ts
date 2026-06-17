/**
 * Robust JSON object extraction from model output. Scans for the first balanced
 * top-level {...} respecting string literals and escapes, so content containing
 * "}" (URLs, code blocks, markdown) no longer breaks parsing — the old
 * indexOf/lastIndexOf approach matched the wrong brace.
 */
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("Model returned no JSON object.");

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(raw.slice(start, i + 1));
    }
  }
  throw new Error("Model returned unbalanced JSON (no matching closing brace).");
}
