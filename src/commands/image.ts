import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getSessionFromCommand } from "../services/cerevox";
import { getConfigValue } from "../services/config";

export const name = "image";
export const description = "Image commands: create and edit";

export function register(program: Command): void {
  const parent = program.command("image").description("Image commands: create and edit");

  parent
    .command("create")
    .description("Create a new image; requires --prompt")
    .option("--prompt <prompt>", "Text prompt for image generation (required)")
    .option("--size <size>", "Image size, e.g., 512x512")
    .option("--refs <refs>", "Comma-separated reference image paths/urls")
    .option("--output <file>", "Output file path")
    .action(async function (
      this: Command,
      opts: { prompt?: string; size?: string; refs?: string; output?: string }
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
      const size = typeof opts.size === "string" ? opts.size : undefined;
      const refsList =
        typeof opts.refs === "string" && opts.refs.length > 0
          ? opts.refs
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];
      const output = typeof opts.output === "string" ? opts.output : undefined;
      const res = await session.ai.generateImage({
        prompt,
        size,
        image: refsList,
      });
      if (output) {
        const dir = (await getConfigValue("projectDir")) as string;
        const url = res.urls[0];
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = path.resolve(dir, output);
        fs.writeFileSync(filePath, buffer);
        res.output = filePath;
      }
      console.log(res);
    });

  parent
    .command("edit")
    .description("Edit an existing image by applying modifications")
    .action(async () => {
      console.log("image edit");
    });
}
