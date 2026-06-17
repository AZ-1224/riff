#!/usr/bin/env node
/**
 * Riff CLI — one source → every channel.
 *
 *   riff ingest <url>                 pull a YouTube video / article / X post
 *   riff ingest --text < file         ingest pasted text from stdin
 *   riff brief <slug>                 print the prompt for your agent (free, agent-driven)
 *   riff save <slug> [bundle.json]    store the agent's JSON bundle
 *   riff repurpose <slug|url> --llm   self-contained generation (uses ANTHROPIC_API_KEY)
 *   riff publish <slug> [--channel]   render markdown + ship to configured channels
 *   riff init --name ... --url ...    set the product woven into outputs
 *   riff channels                     show channels + which are configured
 */
import { parseArgs } from "node:util";
import { cmdIngest } from "./commands/ingest.js";
import { cmdRepurpose } from "./commands/repurpose.js";
import { cmdBrief } from "./commands/brief.js";
import { cmdSave } from "./commands/save.js";
import { cmdPublish } from "./commands/publish.js";
import { cmdInit, cmdChannels } from "./commands/setup.js";
import { cmdRepeg } from "./commands/repeg.js";
import { cmdStock } from "./commands/stock.js";
import { log, color } from "./core/util/log.js";

const HELP = `${color.bold("riff")} — one source, every channel. Agent-native content repurposing.

${color.bold("Flow")}
  1. riff init --name "Your Product" --url https://you.com --one-liner "what it does"
  2. riff ingest https://youtube.com/watch?v=...        ${color.dim("# or an article URL, or --text")}
  3a. (agent)  riff brief <slug>  →  agent writes JSON  →  riff save <slug> bundle.json
  3b. (auto)   riff repurpose <slug> --llm               ${color.dim("# needs ANTHROPIC_API_KEY")}
  4. riff publish <slug>                                 ${color.dim("# markdown + configured channels")}

${color.bold("Commands")}
  ingest <url|--text>      Pull + extract a source into .riff/<slug>/
  brief <slug>             Print the generation prompt for your own agent (free)
  save <slug> [file]       Store an agent-produced JSON bundle
  repurpose <slug|url>     Generate the bundle  [--llm --trend "..." --publish]
  repeg <slug>             Swap the X article's trend, fire first  [--trend "..." --llm]
  stock                    Stockpile dashboard — what's ready to fire
  publish <slug>           Render markdown + ship  [--channel a,b | --all]
  init                     Set product context  [--name --one-liner --url --cta-link]
  channels                 List channels and their config status

${color.bold("Flags")}  --trend "Claude 4.8 launch"  pegs the X article to a trend
        --llm                        self-contained generation (Anthropic API)
        --publish                    publish right after repurpose
        --channel export,social      restrict publish targets
`;

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    process.stdout.write(HELP + "\n");
    return;
  }

  const { values, positionals } = parseArgs({
    args: argv.slice(1),
    allowPositionals: true,
    options: {
      text: { type: "boolean" },
      title: { type: "string" },
      slug: { type: "string" },
      llm: { type: "boolean" },
      trend: { type: "string" },
      publish: { type: "boolean" },
      channel: { type: "string" },
      all: { type: "boolean" },
      name: { type: "string" },
      "one-liner": { type: "string" },
      url: { type: "string" },
      "cta-link": { type: "string" },
    },
  });

  const p0 = positionals[0];

  switch (cmd) {
    case "ingest":
      await cmdIngest({ input: p0, text: values.text, title: values.title, slug: values.slug });
      break;
    case "brief":
      await cmdBrief({ slug: p0, trend: values.trend });
      break;
    case "save":
      await cmdSave({ slug: p0, file: positionals[1] });
      break;
    case "repurpose":
      await cmdRepurpose({
        target: p0,
        llm: values.llm,
        trend: values.trend,
        publish: values.publish,
        channel: values.channel,
      });
      break;
    case "repeg":
      await cmdRepeg({ slug: p0, trend: values.trend, llm: values.llm });
      break;
    case "stock":
      cmdStock();
      break;
    case "publish":
      await cmdPublish({ slug: p0, channel: values.channel, all: values.all });
      break;
    case "init":
      cmdInit({
        name: values.name,
        oneLiner: values["one-liner"],
        url: values.url,
        ctaLink: values["cta-link"],
      });
      break;
    case "channels":
      cmdChannels();
      break;
    default:
      log.err(`Unknown command: ${cmd}`);
      process.stdout.write("\n" + HELP + "\n");
      process.exitCode = 1;
  }
}

main().catch((e) => {
  log.err(e?.message || String(e));
  process.exitCode = 1;
});
