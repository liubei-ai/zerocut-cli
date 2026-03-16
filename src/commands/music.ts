import type { Command } from "commander";
import { getSessionFromCommand } from "../services/cerevox";
import { createProgressSpinner } from "../utils/progress";

export const name = "music";
export const description = "Music command: create music";

export function register(program: Command): void {
  const parent = program.command("music").description("Create a new music; requires --prompt");

  async function musicCreateAction(
    this: Command,
    opts: {
      prompt?: string;
    }
  ) {
    const session = getSessionFromCommand(this as unknown as Record<symbol, unknown>);
    if (!session) {
      process.stderr.write("No active session\n");
      return;
    }
    const prompt = typeof opts.prompt === "string" ? opts.prompt : undefined;
    if (!prompt || prompt.trim().length === 0) {
      process.stderr.write("Missing required option: --prompt\n");
      process.exitCode = 1;
      return;
    }
    const res = await session.ai.generateMusic({
      prompt,
      onProgress: createProgressSpinner("inferencing"),
    });
    process.stdout.write("\n");
    console.log(res);
  }

  parent
    .option("--prompt <prompt>", "Text prompt for music generation (required)")
    .action(musicCreateAction);

  parent
    .command("create")
    .description("Create a new music; requires --prompt")
    .option("--prompt <prompt>", "Text prompt for music generation (required)")
    .action(musicCreateAction);
}
