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
import { decodeEntities } from "../util/html.js";

const exec = promisify(execFile);
const EXEC_OPTS = { maxBuffer: 64 * 1024 * 1024, timeout: 120000 };

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
  let prevT = -Infinity;
  let curT = 0;
  for (const raw of vtt.split("\n")) {
    const line = raw.replace(/\r$/, "");
    // Accept 1-2 digit hours and optional milliseconds (VTT spec is lenient).
    const m = line.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.\d{1,3})?\s+-->/);
    if (m) {
      curT = +m[1] * 3600 + +m[2] * 60 + +m[3];
      continue;
    }
    if (!line.trim() || /^(WEBVTT|Kind:|Language:)/.test(line)) continue;
    const text = decodeEntities(line.replace(/<[^>]+>/g, "")).trim();
    if (!text) continue;
    // Only drop a repeat if it's adjacent in time (caption roll-up artifact),
    // not a legitimate repeated phrase later in the transcript.
    if (text === prev && curT - prevT < 1) continue;
    cues.push({ t: curT, text });
    prev = text;
    prevT = curT;
  }
  return cues;
}

export async function ingestYouTube(url: string): Promise<Source> {
  const dir = mkdtempSync(resolve(tmpdir(), "riff-yt-"));
  try {
    // Metadata
    const { stdout: metaRaw } = await exec("yt-dlp", ["--no-warnings", "--dump-single-json", url], EXEC_OPTS);
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
      EXEC_OPTS,
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
