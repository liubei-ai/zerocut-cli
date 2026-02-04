import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getMaterialUri, getSessionFromCommand } from "../services/cerevox";
import { getConfigValue } from "../services/config";

export const name = "image";
export const description = "Image commands: create and edit";

export function register(program: Command): void {
  const parent = program.command("image").description("Image commands: create and edit");

  parent
    .command("create")
    .description("Create a new image; requires --prompt")
    .option("--prompt <prompt>", "Text prompt for image generation (required)")
    .option("--type <type>", "Generator type: seedream|seedream-pro|banana|banana-pro|wan")
    .option("--size <size>", "Image size, e.g., 512x512")
    .option("--refs <refs>", "Comma-separated reference image paths/urls")
    .option("--output <file>", "Output file path")
    .action(async function (
      this: Command,
      opts: { prompt?: string; type?: string; size?: string; refs?: string; output?: string }
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
      const allowedTypes = ["seedream", "seedream-pro", "banana", "banana-pro", "wan"] as const;
      type AllowedType = (typeof allowedTypes)[number];
      const type = typeof opts.type === "string" ? opts.type.trim() : undefined;
      if (type && !(allowedTypes as readonly string[]).includes(type)) {
        process.stderr.write(
          `Invalid value for --type: ${type}. Allowed: ${allowedTypes.join("|")}\n`
        );
        process.exitCode = 1;
        return;
      }
      const typeArg: AllowedType | undefined = (type ?? undefined) as AllowedType | undefined;
      const size = typeof opts.size === "string" ? opts.size : undefined;
      const refsList =
        typeof opts.refs === "string" && opts.refs.length > 0
          ? opts.refs
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];
      const referenceImages = await Promise.all(
        refsList.map(async (ref) => await getMaterialUri(session, ref))
      );
      const output = typeof opts.output === "string" ? opts.output : undefined;
      const frames = ["|", "/", "-", "\\"];
      let si = 0;
      const t0 = Date.now();
      const res = await session.ai.generateImage({
        prompt,
        type: typeArg,
        size,
        image: referenceImages,
        onProgress: () => {
          const f = frames[si++ % frames.length];
          const sec = Math.floor((Date.now() - t0) / 1000);
          process.stdout.write(`\r${f} inferencing... ${sec}s`);
        },
      });
      process.stdout.write("\n");
      console.log(res);
      if (output) {
        const dir = (await getConfigValue("projectDir")) as string;
        const url = res.urls[0];
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = path.resolve(dir, "materials", output);
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
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
