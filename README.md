# Riff

**One source → every channel.** Agent-native content repurposing.

Feed Riff a single source — a YouTube video, an X article, a blog post — and it fans it out into:

- **A trend-pegged X article** (the headline asset; ride the latest release, swap the peg, fire)
- **A week of platform-tailored posts** (X / LinkedIn / Instagram / Threads, with media cues)
- **A real-value SEO blog post** (third person, product woven in — not slop)
- **A split-screen avatar video script** (HeyGen-ready narration + on-screen cue sheet)

Then it **publishes** them: markdown to disk always, plus Postiz (social), WordPress (blog), and HeyGen (video) when configured.

Built the agent-native way — **API → CLI → skill → MCP** — so a human, a Claude Code session, or a ChatGPT user can all drive it.

---

## Why agent-native

The buyer's own agent does the writing. Riff is the deterministic plumbing (ingest, format, publish); the model is the brain. That means **zero token cost to the operator**, installable in one line, and usable from any agent surface:

| Surface | How |
| --- | --- |
| Claude Code / Cursor / local agents | install the **skill** (`npx skills add`) |
| ChatGPT / Claude.ai (no local skills) | the **MCP** server |
| Scripts / cron / unattended | the **CLI** with `--llm` (Anthropic API) |
| Anything | the **public API** |

---

## Quickstart (export-only, zero keys)

```bash
npm install && npm run build
node dist/cli.js init --name "Postiz" --url "https://postiz.com" \
  --one-liner "Run your social on autopilot with AI agents"
node dist/cli.js ingest "https://www.youtube.com/watch?v=FOp280ZAxhg"
# → prints <slug>

# Agent-driven (free): print the prompt, generate, save
node dist/cli.js brief <slug> --trend "Claude Opus 4.8 launch"
#   ...your agent writes the JSON bundle to bundle.json...
node dist/cli.js save <slug> bundle.json

# Or unattended (Anthropic API):
ANTHROPIC_API_KEY=sk-... node dist/cli.js repurpose <slug> --llm

node dist/cli.js publish <slug>
# → .riff/<slug>/outputs/{x-article,posts,blog,video-script}.md
```

After `npm i -g` (or publish to npm) the command is just `riff`.

## Channels

Run `riff channels` to see status.

| Channel | Ships | Unlock with |
| --- | --- | --- |
| `export` | Markdown files (always on) | — |
| `social` | Postiz drafts (30+ platforms) | `POSTIZ_API_KEY` |
| `blog` | WordPress draft post | `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD` |
| `video` | HeyGen avatar short | `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, `HEYGEN_VOICE_ID` (+ `RIFF_HEYGEN_LIVE=1` to spend credits) |

Each channel is one file under `src/core/channels/` — swap `social.ts` to publish via your own pipeline without touching anything else.

## The stack, in build order

1. **API** (`api/server.ts`) — `npm run api`. The foundation; everything else calls it.
2. **CLI** (`riff`) — short commands, less context rot for agents than raw API.
3. **Skill** (`skill/skill.md`) — `npx skills add <repo>`; what local agents install.
4. **MCP** (`mcp/server.ts`) — `npm run mcp`; for remote agents.

## How the bundle is shaped

See `src/core/schema.ts`. One `Source` → one `Bundle` (`xArticle`, `posts[]`, `blog`, `videoScript`). The same shape is produced whether a human agent writes it (via `brief` → `save`) or the API does (`repurpose --llm`).

## Anti-slop

The generation prompt (`src/core/generate/prompts.ts`) hard-bans em-dash spray, "unlock/leverage/delve", hashtag spam, and invented stats. Every claim must trace to the source. That's the moat in a feed full of generated content.

## License

MIT.
