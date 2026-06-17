import { loadBundle } from "../core/store.js";
import { CHANNELS, getChannel, defaultChannels } from "../core/channels/registry.js";
import { log, color } from "../core/util/log.js";

interface Args {
  slug?: string;
  channel?: string; // comma-separated; omitted = default set
  all?: boolean;
}

export async function cmdPublish(args: Args): Promise<void> {
  if (!args.slug) throw new Error("Usage: riff publish <slug> [--channel export,social,blog,video]");
  const bundle = loadBundle(args.slug);

  let channels;
  if (args.all) {
    channels = CHANNELS;
  } else if (args.channel) {
    channels = args.channel.split(",").map((n) => {
      const c = getChannel(n.trim());
      if (!c) throw new Error(`Unknown channel "${n.trim()}". Known: ${CHANNELS.map((x) => x.name).join(", ")}`);
      return c;
    });
  } else {
    channels = defaultChannels();
  }

  log.step(`Publishing "${args.slug}" → ${channels.map((c) => c.name).join(", ")}`);
  for (const ch of channels) {
    const r = await ch.publish(args.slug, bundle);
    if (r.ok) log.ok(`${ch.name}: ${r.detail}`);
    else log.warn(`${ch.name}: ${r.detail}`);
  }
  log.info(`Outputs in ${color.cyan(`.riff/${args.slug}/outputs/`)}`);
}
