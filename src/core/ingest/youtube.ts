/**
 * YouTube ingest via yt-dlp. Pulls native captions (free) into a timestamped
 * transcript + metadata. No audio download — captions only.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { Source } from "../schema.js";

const exec = promisify(execFile);

export function isYouTube(url: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
}

interface VttCue {
  t: number;
  text: string;
}

function parseVtt(vtt: string): VttCue[] {
  const cues: VttCue[] = [];
  let prev = "";
  let curT = 0;
  for (const raw of vtt.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = line.match(/^(\d{2}):(\d{2}):(\d{2})\.\d{3}\s+-->/);
    if (m) {
      curT = +m[1] * 3600 + +m[2] * 60 + +m[3];
      continue;
    }
    if (!line.trim() || /^(WEBVTT|Kind:|Language:)/.test(line)) continue;
    const text = line
      .replace(/<[^>]+>/g, "")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .trim();
    if (!text || text === prev) continue;
    cues.push({ t: curT, text });
    prev = text;
  }
  return cues;
}

export async function ingestYouTube(url: string): Promise<Source> {
  const dir = mkdtempSync(resolve(tmpdir(), "riff-yt-"));
  try {
    // Metadata
    const { stdout: metaRaw } = await exec("yt-dlp", ["--no-warnings", "--dump-single-json", url], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const meta = JSON.parse(metaRaw);

    // Captions (manual first, then auto-generated)
    await exec(
      "yt-dlp",
      [
        "--no-warnings",
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en.*,en",
        "--sub-format",
        "vtt",
        "-o",
        resolve(dir, "sub"),
        url,
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    ).catch(() => {
      /* captions may be absent; handled below */
    });

    const vttFile = readdirSync(dir).find((f) => f.endsWith(".vtt"));
    const segments = vttFile ? parseVtt(readFileSync(resolve(dir, vttFile), "utf8")) : [];
    const text = segments.map((s) => s.text).join(" ").trim() || meta.description || "";

    if (!text) {
      throw new Error(
        "No captions found for this video and no description fallback. " +
          "Try a video with subtitles, or ingest a transcript directly with: riff ingest --text < file",
      );
    }

    return {
      type: "youtube",
      url,
      title: meta.title || "Untitled",
      author: meta.channel || meta.uploader,
      text,
      segments: segments.length ? segments : undefined,
      durationSec: meta.duration,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
