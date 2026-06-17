/**
 * Network safety helpers. fetchWithTimeout aborts hung requests; assertPublicHttpUrl
 * blocks SSRF to loopback/private/link-local hosts and non-http(s) schemes before
 * any user-supplied URL is fetched.
 */
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 15000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function assertPublicHttpUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Only http/https URLs are allowed (got ${u.protocol}).`);
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^fc00:/i.test(host) ||
    /^fe80:/i.test(host);
  if (isPrivate) {
    throw new Error(`Refusing to fetch a private/loopback host: ${host}`);
  }
}
