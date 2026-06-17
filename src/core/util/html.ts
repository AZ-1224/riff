/**
 * Shared HTML helpers. decodeEntities handles named, decimal, and hex entities
 * with codepoint bounds checking; escapeHtml protects raw text before it goes
 * into generated HTML (e.g. the WordPress channel).
 */
function codepoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codepoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => codepoint(parseInt(n, 10)))
    .replace(/&amp;/g, "&"); // decode &amp; last so "&amp;lt;" → "&lt;", not "<"
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
