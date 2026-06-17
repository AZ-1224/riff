import type { Bundle } from "../schema.js";

export interface PublishResult {
  channel: string;
  ok: boolean;
  /** Human-readable outcome (URLs created, files written, why skipped). */
  detail: string;
  /** Any artifact references (file paths, remote ids/urls). */
  refs?: string[];
}

export interface Channel {
  /** Stable id used on the CLI: --channel <name>. */
  name: string;
  /** One-line description for `riff channels`. */
  description: string;
  /** True when required secrets are present. */
  configured(): boolean;
  /** Which env vars unlock this channel (shown when not configured). */
  requires: string[];
  /** Ship the relevant slice of the bundle. slug is the workspace key. */
  publish(slug: string, bundle: Bundle): Promise<PublishResult>;
}
