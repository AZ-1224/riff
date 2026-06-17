/**
 * Riff MCP server (stdio, newline-delimited JSON-RPC 2.0). Minimal, dependency-free.
 * Exposes Riff to remote agents (ChatGPT, Claude.ai) that can't run local skills.
 *
 * Tools:
 *   riff_ingest   { url? , text? , title? }     → { slug }
 *   riff_brief    { slug, trend? }              → { system, user }   (agent generates)
 *   riff_save     { slug, bundle }              → { ok }
 *   riff_repurpose{ slug, trend? }              → { bundle }         (needs ANTHROPIC_API_KEY)
 *   riff_publish  { slug, channels? }           → { results }
 *   riff_channels {}                            → channel list
 *
 * Start: npm run mcp   (then point your MCP client at this process over stdio)
 */
import { createInterface } from "node:readline";
import { ingest, ingestText } from "../src/core/ingest/index.js";
import { saveSource, loadSource, saveBundle, loadBundle, slugify, loadProduct, NotFoundError } from "../src/core/store.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../src/core/generate/prompts.js";
import { generateWithLLM } from "../src/core/generate/llm.js";
import { CHANNELS, getChannel, defaultChannels } from "../src/core/channels/registry.js";
import type { Bundle } from "../src/core/schema.js";

const TOOLS = [
  {
    name: "riff_ingest",
    description: "Ingest a source (YouTube/article/X URL, or raw text) into a Riff workspace.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, text: { type: "string" }, title: { type: "string" } },
    },
  },
  {
    name: "riff_brief",
    description: "Get the generation prompt + ingested source so YOU (the agent) can write the bundle JSON.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, trend: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "riff_save",
    description: "Save the bundle JSON you generated (keys: xArticle, posts, blog, videoScript).",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, bundle: { type: "object" } },
      required: ["slug", "bundle"],
    },
  },
  {
    name: "riff_repurpose",
    description: "Self-contained generation via Anthropic API (needs ANTHROPIC_API_KEY). Returns the bundle.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, trend: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "riff_publish",
    description: "Render markdown + ship the bundle to channels (export always; social/blog/video if configured).",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, channels: { type: "array", items: { type: "string" } } },
      required: ["slug"],
    },
  },
  { name: "riff_channels", description: "List channels and whether each is configured.", inputSchema: { type: "object", properties: {} } },
];

async function callTool(name: string, args: any): Promise<any> {
  switch (name) {
    case "riff_ingest": {
      const source = args.url ? await ingest(args.url) : ingestText(args.text || "", args.title);
      const slug = slugify(source.title);
      saveSource(slug, source);
      return { slug, title: source.title, chars: source.text.length };
    }
    case "riff_brief": {
      const source = loadSource(args.slug);
      return { system: SYSTEM_PROMPT, user: buildUserPrompt(source, loadProduct(), args.trend) };
    }
    case "riff_save": {
      const source = loadSource(args.slug);
      const p = args.bundle;
      const bundle: Bundle = {
        source: { type: source.type, url: source.url, title: source.title },
        product: loadProduct(),
        xArticle: p.xArticle,
        posts: p.posts || [],
        blog: p.blog,
        videoScript: p.videoScript,
        generatedAt: new Date().toISOString(),
        engine: "agent",
      };
      saveBundle(args.slug, bundle);
      return { ok: true };
    }
    case "riff_repurpose": {
      const source = loadSource(args.slug);
      const bundle = await generateWithLLM(source, loadProduct(), args.trend);
      saveBundle(args.slug, bundle);
      return { bundle };
    }
    case "riff_publish": {
      const bundle = loadBundle(args.slug);
      const chans = args.channels?.length ? args.channels.map(getChannel).filter(Boolean) : defaultChannels();
      const results = [];
      for (const c of chans) results.push(await c.publish(args.slug, bundle));
      return { results };
    }
    case "riff_channels":
      return CHANNELS.map((c) => ({ name: c.name, description: c.description, configured: c.configured() }));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reply(id: any, result?: any, error?: any) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, ...(error ? { error } : { result }) }) + "\n");
}

/** Validate required args for a tool; returns a missing-field name or null. */
function missingRequired(name: string, args: any): string | null {
  const tool = TOOLS.find((t) => t.name === name);
  const required: string[] = (tool?.inputSchema as any)?.required || [];
  for (const k of required) {
    if (args == null || args[k] === undefined || args[k] === null) return k;
  }
  return null;
}

/** Sanitize errors before returning to a client — no filesystem paths / internals. */
function clientError(e: any): string {
  if (e instanceof NotFoundError) return "Resource not found.";
  const msg = String(e?.message || e);
  if (/ENOENT|no such file/i.test(msg)) return "Resource not found.";
  if (/^Invalid slug/.test(msg)) return msg; // safe, user-facing
  if (/Anthropic API/.test(msg)) return "Generation failed (upstream model error).";
  return "Internal error.";
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      // Echo the client's requested protocol version when provided (negotiation).
      const requested = params?.protocolVersion;
      return reply(id, {
        protocolVersion: typeof requested === "string" ? requested : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "riff", version: "0.1.0" },
      });
    }
    if (method === "tools/list") return reply(id, { tools: TOOLS });
    if (method === "tools/call") {
      const args = params?.arguments || {};
      const missing = missingRequired(params?.name, args);
      if (missing) {
        return reply(id, undefined, { code: -32602, message: `Invalid params: missing required field "${missing}".` });
      }
      const out = await callTool(params.name, args);
      return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
    }
    if (method === "notifications/initialized" || id === undefined) return; // notification, no reply
    reply(id, undefined, { code: -32601, message: `Method not found: ${method}` });
  } catch (e: any) {
    if (id === undefined) return; // never reply to a notification
    reply(id, undefined, { code: -32000, message: clientError(e) });
  }
});
rl.on("error", (err) => {
  console.error("riff mcp stdin error:", err?.message || err);
  process.exit(1);
});

console.error("riff mcp server ready (stdio)");
