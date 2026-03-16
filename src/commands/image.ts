import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getMaterialUri, getSessionFromCommand } from "../services/cerevox";
import type { Session } from "cerevox";
import { createProgressSpinner } from "../utils/progress";

export const name = "image";
export const description = "Image command: create image";

export function register(program: Command): void {
  const parent = program.command("image").description("Create a new image; requires --prompt");

  const allowedTypes = ["seedream", "seedream-pro", "banana", "banana-pro", "wan"] as const;
  type AllowedType = (typeof allowedTypes)[number];

  async function performImageGeneration(
    session: Session,
    {
      prompt,
      type,
      size,
      refsList,
      output,
    }: {
      prompt: string;
      type?: AllowedType;
      size?: string;
      refsList: string[];
      output?: string;
    }
  ): Promise<void> {
    const referenceImages = await Promise.all(
      refsList.map(async (ref) => await getMaterialUri(session, ref))
    );
    const onProgress = createProgressSpinner("inferencing");
    const res = await session.ai.generateImage({
      prompt,
      type,
      size,
      image: referenceImages,
      onProgress,
    });
    process.stdout.write("\n");
    if (output) {
      const dir = process.cwd();
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
  }

  async function imageCreateAction(
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
    const output = typeof opts.output === "string" ? opts.output : undefined;
    await performImageGeneration(session, { prompt, type: typeArg, size, refsList, output });
  }

  // default action on `zerocut image`
  parent
    .option("--prompt <prompt>", "Text prompt for image generation (required)")
    .option("--type <type>", `Generator type: ${allowedTypes.join("|")}`)
    .option("--size <size>", "Image size, e.g., 512x512")
    .option("--refs <refs>", "Comma-separated reference image paths/urls")
    .option("--output <file>", "Output file path")
    .action(imageCreateAction);

  // keep `image create` for compatibility
  parent
    .command("create")
    .description("Create a new image; requires --prompt")
    .option("--prompt <prompt>", "Text prompt for image generation (required)")
    .option("--type <type>", `Generator type: ${allowedTypes.join("|")}`)
    .option("--size <size>", "Image size, e.g., 512x512")
    .option("--refs <refs>", "Comma-separated reference image paths/urls")
    .option("--output <file>", "Output file path")
    .action(imageCreateAction);

  // removed `image edit`
}
