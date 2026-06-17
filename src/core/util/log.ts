/** Minimal structured logger. Quiet by default; RIFF_DEBUG=1 for verbose. */
const DEBUG = process.env.RIFF_DEBUG === "1";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

export const log = {
  info: (msg: string) => console.error(c.dim("riff") + " " + msg),
  step: (msg: string) => console.error(c.cyan("→") + " " + msg),
  ok: (msg: string) => console.error(c.green("✓") + " " + msg),
  warn: (msg: string) => console.error(c.yellow("!") + " " + msg),
  err: (msg: string) => console.error(c.red("✗") + " " + msg),
  debug: (msg: string) => DEBUG && console.error(c.dim("· " + msg)),
  /** Data goes to stdout so it can be piped/captured; logs go to stderr. */
  out: (s: string) => process.stdout.write(s + "\n"),
};

export { c as color };
