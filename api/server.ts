/**
 * Riff public API — the foundation of the agent stack (API → CLI → skill → MCP).
 * Native http, no framework. Optional bearer auth via RIFF_API_KEY.
 *
 *   POST /ingest        { url } | { text, title }      → { slug }
 *   GET  /brief/:slug   ?trend=...                      → { system, user }
 *   POST /bundle/:slug  <agent JSON bundle>             → { ok }
 *   POST /repurpose/:slug { trend?, llm? }              → { bundle }   (llm needs ANTHROPIC_API_KEY)
 *   POST /publish/:slug { channels?: string[] }         → { results }
 *   GET  /channels                                      → [ { name, configured } ]
 *
 * Start: npm run api   (PORT=8787 by default)
 */
import { createServer } from "node:http";
import { ingest } from "../src/core/ingest/index.js";
import { ingestText } from "../src/core/ingest/index.js";
import {
  saveSource,
  loadSource,
  saveBundle,
  loadBundle,
  slugify,
  loadProduct,
  assertSafeSlug,
  NotFoundError,
} from "../src/core/store.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../src/core/generate/prompts.js";
import { generateWithLLM } from "../src/core/generate/llm.js";
import { CHANNELS, getChannel, defaultChannels } from "../src/core/channels/registry.js";
import type { Bundle } from "../src/core/schema.js";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.RIFF_API_KEY;

function authed(req: any): boolean {
  if (!API_KEY) return true; // open if no key configured
  const h = req.headers["authorization"] || "";
  return h === `Bearer ${API_KEY}` || h === API_KEY;
}

class BadRequest extends Error {}

function body(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c: any) => (d += c));
    req.on("end", () => {
      if (!d) return resolve({});
      try {
        resolve(JSON.parse(d));
      } catch {
        reject(new BadRequest("Malformed JSON body."));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const send = (code: number, obj: any) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  try {
    if (!authed(req)) return send(401, { error: "unauthorized" });
    const url = new URL(req.url!, `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const m = req.method;
    // Validate any slug in the URL path before it reaches the store (400, not 500).
    const slugParam = (s: string | undefined): string => {
      try {
        assertSafeSlug(s);
        return s as string;
      } catch (e: any) {
        throw new BadRequest(e.message);
      }
    };
    if (["brief", "bundle", "repurpose", "publish"].includes(parts[0]) && parts[1]) parts[1] = slugParam(parts[1]);

    if (m === "GET" && parts[0] === "channels") {
      return send(200, CHANNELS.map((c) => ({ name: c.name, description: c.description, configured: c.configured() })));
    }

    if (m === "POST" && parts[0] === "ingest") {
      const b = await body(req);
      const source = b.url ? await ingest(b.url) : ingestText(b.text || "", b.title);
      const slug = b.slug ? slugParam(b.slug) : slugify(source.title);
      saveSource(slug, source);
      return send(200, { slug, title: source.title, chars: source.text.length });
    }

    if (m === "GET" && parts[0] === "brief" && parts[1]) {
      const source = loadSource(parts[1]);
      return send(200, {
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(source, loadProduct(), url.searchParams.get("trend") || undefined),
      });
    }

    if (m === "POST" && parts[0] === "bundle" && parts[1]) {
      const parsed = await body(req);
      const source = loadSource(parts[1]);
      const bundle: Bundle = {
        source: { type: source.type, url: source.url, title: source.title },
        product: loadProduct(),
        xArticle: parsed.xArticle,
        posts: parsed.posts || [],
        blog: parsed.blog,
        videoScript: parsed.videoScript,
        generatedAt: new Date().toISOString(),
        engine: "agent",
      };
      saveBundle(parts[1], bundle);
      return send(200, { ok: true, slug: parts[1] });
    }

    if (m === "POST" && parts[0] === "repurpose" && parts[1]) {
      const b = await body(req);
      const source = loadSource(parts[1]);
      const bundle = await generateWithLLM(source, loadProduct(), b.trend);
      saveBundle(parts[1], bundle);
      return send(200, { bundle });
    }

    if (m === "POST" && parts[0] === "publish" && parts[1]) {
      const b = await body(req);
      const bundle = loadBundle(parts[1]);
      const chans = b.channels?.length
        ? b.channels.map((n: string) => getChannel(n)).filter(Boolean)
        : defaultChannels();
      const results = [];
      for (const c of chans) results.push(await c.publish(parts[1], bundle));
      return send(200, { results });
    }

    send(404, { error: "not found" });
  } catch (e: any) {
    if (e instanceof BadRequest) return send(400, { error: e.message });
    if (e instanceof NotFoundError) return send(404, { error: e.message });
    send(500, { error: e?.message || String(e) });
  }
});

server.listen(PORT, () => {
  if (API_KEY) {
    console.error(`riff api on http://localhost:${PORT} (auth on)`);
  } else {
    console.error(
      `riff api on http://localhost:${PORT} (OPEN — no auth). Set RIFF_API_KEY and do NOT expose this port publicly; bind to localhost or put it behind an authenticated proxy.`,
    );
  }
});
