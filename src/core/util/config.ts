/**
 * Config + secret loading. Keys come from env (or a .env file in cwd).
 * Nothing here is ever logged. Channels self-report whether they're configured.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] === undefined) {
      process.env[k] = raw.replace(/^["']|["']$/g, "");
    }
  }
}
loadDotenv();

export const env = (k: string): string | undefined => process.env[k];

export interface RiffConfig {
  anthropicApiKey?: string;
  anthropicModel: string;
  // channel secrets
  postizApiKey?: string;
  postizBaseUrl: string;
  wordpressUrl?: string;
  wordpressUser?: string;
  wordpressAppPassword?: string;
  heygenApiKey?: string;
}

export function loadConfig(): RiffConfig {
  return {
    anthropicApiKey: env("ANTHROPIC_API_KEY"),
    anthropicModel: env("RIFF_MODEL") || "claude-opus-4-8",
    postizApiKey: env("POSTIZ_API_KEY"),
    postizBaseUrl: env("POSTIZ_BASE_URL") || "https://api.postiz.com",
    wordpressUrl: env("WORDPRESS_URL"),
    wordpressUser: env("WORDPRESS_USER"),
    wordpressAppPassword: env("WORDPRESS_APP_PASSWORD"),
    heygenApiKey: env("HEYGEN_API_KEY"),
  };
}
