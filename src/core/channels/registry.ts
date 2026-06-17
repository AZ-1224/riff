import type { Channel } from "./types.js";
import { exportChannel } from "./export.js";
import { socialChannel } from "./social.js";
import { blogChannel } from "./blog.js";
import { videoChannel } from "./video.js";

export const CHANNELS: Channel[] = [exportChannel, socialChannel, blogChannel, videoChannel];

export function getChannel(name: string): Channel | undefined {
  return CHANNELS.find((c) => c.name === name);
}

/** Default publish set: export always; others only if configured. */
export function defaultChannels(): Channel[] {
  return CHANNELS.filter((c) => c.name === "export" || c.configured());
}
