/**
 * Video channel via HeyGen. Turns the videoScript into a split-screen avatar
 * short. Gated on HEYGEN_API_KEY (and costs credits). This is the highest-effort
 * channel; it's wired as a real call but defaults to a dry-run that just reports
 * the payload unless RIFF_HEYGEN_LIVE=1, so you don't burn credits by accident.
 *
 * HeyGen needs an avatar_id + voice_id from your account; set HEYGEN_AVATAR_ID
 * and HEYGEN_VOICE_ID. The split-screen B-roll (screen cues) is assembled
 * downstream in your editor — Riff produces the narration video + the cue sheet.
 */
import type { Channel, PublishResult } from "./types.js";
import type { Bundle } from "../schema.js";
import { loadConfig, env } from "../util/config.js";

export const videoChannel: Channel = {
  name: "video",
  description: "Generate a split-screen avatar short via HeyGen",
  requires: ["HEYGEN_API_KEY", "HEYGEN_AVATAR_ID", "HEYGEN_VOICE_ID"],
  configured: () => !!(loadConfig().heygenApiKey && env("HEYGEN_AVATAR_ID") && env("HEYGEN_VOICE_ID")),
  async publish(_slug: string, bundle: Bundle): Promise<PublishResult> {
    const cfg = loadConfig();
    if (!this.configured()) {
      return {
        channel: "video",
        ok: false,
        detail: `Skipped — set ${this.requires.join(", ")} to enable.`,
      };
    }

    const narration = bundle.videoScript.segments.map((s) => s.say).join(" ");
    const payload = {
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: env("HEYGEN_AVATAR_ID"), avatar_style: "normal" },
          voice: { type: "text", input_text: narration, voice_id: env("HEYGEN_VOICE_ID") },
        },
      ],
      dimension: { width: 720, height: 1280 }, // vertical short
      title: bundle.videoScript.title,
    };

    // Safety: don't spend credits unless explicitly opted in.
    if (env("RIFF_HEYGEN_LIVE") !== "1") {
      return {
        channel: "video",
        ok: true,
        detail:
          "Dry run (set RIFF_HEYGEN_LIVE=1 to actually render). Narration + cue sheet are in outputs/video-script.md.",
        refs: [`heygen-dry:${bundle.videoScript.title}`],
      };
    }

    try {
      const res = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": cfg.heygenApiKey! },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return { channel: "video", ok: false, detail: `HeyGen ${res.status}: ${t.slice(0, 200)}` };
      }
      const data: any = await res.json();
      const id = data?.data?.video_id || data?.video_id;
      return {
        channel: "video",
        ok: true,
        detail: `HeyGen render queued: video_id=${id}. Poll status in HeyGen, then composite the split-screen with the cue sheet.`,
        refs: [`heygen:${id}`],
      };
    } catch (e: any) {
      return { channel: "video", ok: false, detail: `HeyGen error: ${e.message}` };
    }
  },
};
