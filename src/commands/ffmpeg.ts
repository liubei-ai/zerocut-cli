import type { Command } from "commander";
import { getSessionFromCommand, runFFMpegCommand } from "../services/cerevox";

export const name = "ffmpeg";
export const description = "Run ffmpeg in sandbox";

export function register(program: Command): void {
  program
    .command("ffmpeg")
    .description("Run ffmpeg command in sandbox")
    .allowUnknownOption(true)
    .option("--args <args...>", "Arguments passed to ffmpeg")
    .option("--resources <resources...>", "Resource files/urls to sync into sandbox")
    .action(async function (
      this: Command,
      opts: {
        args?: string[];
        resources?: string[];
      }
    ) {
      const session = getSessionFromCommand(this as unknown as Record<symbol, unknown>);
      if (!session) {
        process.stderr.write("No active session\n");
        return;
      }
      const args = Array.isArray(opts.args) ? opts.args : [];
      if (args.length === 0) {
        process.stderr.write("Missing required option: --args\n");
        process.exitCode = 1;
        return;
      }
      const command = `ffmpeg ${args.join(" ")}`;
      const resources = Array.isArray(opts.resources) ? opts.resources : [];
      const res = await runFFMpegCommand(session, command, resources);
      console.log(res);
    });
}
