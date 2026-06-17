---
name: riff
description: One source → every channel. Turn a YouTube video, X article, or blog post into a trend-pegged X article, a week of platform posts, an SEO blog post, and a split-screen avatar video script — then publish them. Use when the user wants to repurpose content, write an X article from a video, generate social posts, draft an SEO article from a source, or fan one piece of content out across channels.
---

# Riff — agent-native content repurposing

You are driving **Riff**, a CLI that turns one source into a full multi-channel content bundle. You (the agent) are the brain: Riff handles ingest and publishing deterministically; **you do the writing**.

## Install (once)

```bash
npx skills add https://github.com/AZ-1224/riff
# Riff CLI auto-installs from npm if missing:
npm i -g riffkit   # provides the `riff` command
```

## The flow

1. **Set the product** (once per workspace) — what gets softly woven into every output:
   ```bash
   riff init --name "Postiz" --url "https://postiz.com" --one-liner "Run your social on autopilot with AI agents" --cta-link "https://postiz.pro/you"
   ```

2. **Ingest the source** — a YouTube URL, an article/X URL, or pasted text:
   ```bash
   riff ingest "https://www.youtube.com/watch?v=XXXX"
   # → prints a <slug>. Source saved to .riff/<slug>/source.json
   ```

3. **Generate the bundle — THIS IS YOUR JOB.** Get the prompt + source, then write the JSON yourself (no API key needed — you are the model):
   ```bash
   riff brief <slug> --trend "Claude Opus 4.8 launch"
   ```
   Read the printed SYSTEM and USER blocks. Produce **one JSON object** with exactly these keys:
   - `xArticle`: `{ hook, body, productMention, cta, trendPeg }` — the trend-pegged long X post (the headline asset)
   - `posts`: array of `{ platform, text, threadOrder?, mediaHint? }` — 6–9 posts across x/linkedin/instagram/threads
   - `blog`: `{ title, slug, metaDescription, keywords[], bodyMarkdown }` — a real-value third-person SEO article
   - `videoScript`: `{ title, estDurationSec, hook, segments[ { say, screen } ] }` — split-screen avatar short

   Write it to a file and store it:
   ```bash
   riff save <slug> bundle.json
   ```

4. **Publish** — render markdown + ship to every configured channel:
   ```bash
   riff publish <slug>
   ```

## Generation rules (follow the brief's SYSTEM block exactly)

- Write like a sharp human operator. **No AI-slop tells**: no em-dash spray, no "unlock/leverage/delve", no hashtag spam, no emoji confetti.
- **Every claim traces to the source.** Never invent stats, quotes, or outcomes.
- The **X article rides a trend** (`trendPeg`). Hook honestly, deliver the value in tight lines, one credible product line, CTA with `{{LINK}}`. Keep a stockpile: pre-write articles, swap `trendPeg` for the next big release, fire when it lands.
- The **product mention is ONE line**, earned by the surrounding value. Never a hard sell.
- The **blog post** is real value in third person, product woven into the narrative — not something a ChatGPT search would surface.

## Channels

Run `riff channels` to see what's configured.
- `export` — always on, writes markdown to `.riff/<slug>/outputs/` (x-article.md, posts.md, blog.md, video-script.md).
- `social` — schedules posts as Postiz drafts (`POSTIZ_API_KEY`).
- `blog` — posts the SEO article to WordPress as a draft (`WORDPRESS_URL` + `WORDPRESS_USER` + `WORDPRESS_APP_PASSWORD`).
- `video` — renders a HeyGen avatar short (`HEYGEN_API_KEY` + `HEYGEN_AVATAR_ID` + `HEYGEN_VOICE_ID`; dry-run unless `RIFF_HEYGEN_LIVE=1`).

Publish a subset: `riff publish <slug> --channel export,social`.

## Unattended mode (no agent in the loop)

For cron / autonomous pipelines, skip steps 3 and let Riff call the model itself:
```bash
ANTHROPIC_API_KEY=sk-... riff repurpose <slug> --trend "..." --llm --publish
```
