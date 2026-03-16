import type { Command } from "commander";
import { getSessionFromCommand, runPandocCommand } from "../services/cerevox";

export const name = "pandoc";
export const description = "Run pandoc in sandbox";

export function register(program: Command): void {
  program
    .command("pandoc")
    .description("Run pandoc command in sandbox")
    .allowUnknownOption(true)
    .option("--args <args...>", "Arguments passed to pandoc")
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
      const command = `pandoc ${args.join(" ")}`;
      const resources = Array.isArray(opts.resources) ? opts.resources : [];
      const res = await runPandocCommand(session, command, resources);
      console.log(res);
    });
}
