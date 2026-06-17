/**
 * Workspace store. Each ingested source gets a slug folder under .riff/:
 *   .riff/<slug>/source.json     ← ingested source
 *   .riff/<slug>/bundle.json     ← generated outputs
 *   .riff/<slug>/outputs/...      ← human-readable exports (markdown)
 * .riff/config.json holds the ProductContext for this workspace.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Source, Bundle, ProductContext } from "./schema.js";

const ROOT = () => resolve(process.cwd(), ".riff");

export interface WorkspaceInfo {
  slug: string;
  title: string;
  hasBundle: boolean;
  trendPeg?: string;
  posts?: number;
  published: boolean;
}

/** List every ingested workspace (for `riff stock`). */
export function listWorkspaces(): WorkspaceInfo[] {
  const root = ROOT();
  if (!existsSync(root)) return [];
  const out: WorkspaceInfo[] = [];
  for (const name of readdirSync(root)) {
    const dir = resolve(root, name);
    if (!statSync(dir).isDirectory()) continue;
    if (!existsSync(resolve(dir, "source.json"))) continue;
    const source: Source = JSON.parse(readFileSync(resolve(dir, "source.json"), "utf8"));
    const bundlePath = resolve(dir, "bundle.json");
    let trendPeg: string | undefined;
    let posts: number | undefined;
    const hasBundle = existsSync(bundlePath);
    if (hasBundle) {
      try {
        const b: Bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
        trendPeg = b.xArticle?.trendPeg;
        posts = b.posts?.length;
      } catch {
        /* ignore */
      }
    }
    out.push({
      slug: name,
      title: source.title,
      hasBundle,
      trendPeg,
      posts,
      published: existsSync(resolve(dir, "outputs", "x-article.md")),
    });
  }
  return out;
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

export function workspaceDir(slug: string): string {
  return resolve(ROOT(), slug);
}

export function ensureWorkspace(slug: string): string {
  const dir = workspaceDir(slug);
  mkdirSync(resolve(dir, "outputs"), { recursive: true });
  return dir;
}

export function saveSource(slug: string, source: Source): void {
  ensureWorkspace(slug);
  writeFileSync(resolve(workspaceDir(slug), "source.json"), JSON.stringify(source, null, 2));
}

export function loadSource(slug: string): Source {
  const p = resolve(workspaceDir(slug), "source.json");
  if (!existsSync(p)) throw new Error(`No ingested source for "${slug}". Run: riff ingest <url> first.`);
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveBundle(slug: string, bundle: Bundle): void {
  ensureWorkspace(slug);
  writeFileSync(resolve(workspaceDir(slug), "bundle.json"), JSON.stringify(bundle, null, 2));
}

export function loadBundle(slug: string): Bundle {
  const p = resolve(workspaceDir(slug), "bundle.json");
  if (!existsSync(p)) throw new Error(`No bundle for "${slug}". Run: riff repurpose ${slug} first.`);
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveConfig(product: ProductContext): void {
  mkdirSync(ROOT(), { recursive: true });
  writeFileSync(resolve(ROOT(), "config.json"), JSON.stringify({ product }, null, 2));
}

export function loadProduct(): ProductContext | undefined {
  const p = resolve(ROOT(), "config.json");
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8")).product;
  } catch {
    return undefined;
  }
}

export function writeOutput(slug: string, filename: string, content: string): string {
  ensureWorkspace(slug);
  const p = resolve(workspaceDir(slug), "outputs", filename);
  writeFileSync(p, content);
  return p;
}
