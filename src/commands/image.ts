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

  const allowedModels = ["seedream", "seedream-pro", "banana", "banana-pro", "wan"] as const;
  type AllowedModel = (typeof allowedModels)[number];
  const allowedAspectRatios = [
    "1:1",
    "3:4",
    "4:3",
    "16:9",
    "9:16",
    "2:3",
    "3:2",
    "21:9",
    "1:4",
    "4:1",
    "1:8",
    "8:1",
  ] as const;
  type AllowedAspectRatio = (typeof allowedAspectRatios)[number];
  const allowedResolutions = ["1K", "2K", "4K"] as const;
  type AllowedResolution = (typeof allowedResolutions)[number];

  async function performImageGeneration(
    session: Session,
    {
      prompt,
      model,
      aspectRatio,
      resolution,
      refsList,
      output,
    }: {
      prompt: string;
      model?: AllowedModel;
      aspectRatio?: AllowedAspectRatio;
      resolution?: AllowedResolution;
      refsList: string[];
      output?: string;
    }
  ): Promise<void> {
    const referenceImages = await Promise.all(
      refsList.map(async (ref) => ({ url: await getMaterialUri(session, ref) }))
    );
    const onProgress = createProgressSpinner("inferencing");
    const payload: Record<string, unknown> = {
      model: model || "seedream-5l",
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      reference_images: referenceImages,
      onProgress,
    };
    const res = await (session.ai.generateImage as (arg: Record<string, unknown>) => Promise<any>)(
      payload
    );
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
    opts: {
      prompt?: string;
      model?: string;
      aspectRatio?: string;
      resolution?: string;
      refs?: string;
      output?: string;
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
    const model = typeof opts.model === "string" ? opts.model.trim() : undefined;
    if (model && !(allowedModels as readonly string[]).includes(model)) {
      process.stderr.write(
        `Invalid value for --model: ${model}. Allowed: ${allowedModels.join("|")}\n`
      );
      process.exitCode = 1;
      return;
    }
    const modelArg: AllowedModel | undefined = (model ?? undefined) as AllowedModel | undefined;
    const aspectRatio =
      typeof opts.aspectRatio === "string"
        ? (opts.aspectRatio.trim() as AllowedAspectRatio)
        : undefined;
    if (aspectRatio && !(allowedAspectRatios as readonly string[]).includes(aspectRatio)) {
      process.stderr.write(
        `Invalid value for --aspectRatio: ${aspectRatio}. Allowed: ${allowedAspectRatios.join("|")}\n`
      );
      process.exitCode = 1;
      return;
    }
    const resolution =
      typeof opts.resolution === "string"
        ? (opts.resolution.trim() as AllowedResolution)
        : undefined;
    if (resolution && !(allowedResolutions as readonly string[]).includes(resolution)) {
      process.stderr.write(
        `Invalid value for --resolution: ${resolution}. Allowed: ${allowedResolutions.join("|")}\n`
      );
      process.exitCode = 1;
      return;
    }
    const refsList =
      typeof opts.refs === "string" && opts.refs.length > 0
        ? opts.refs
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
    const output = typeof opts.output === "string" ? opts.output : undefined;
    await performImageGeneration(session, {
      prompt,
      model: modelArg,
      aspectRatio,
      resolution,
      refsList,
      output,
    });
  }

  // default action on `zerocut image`
  parent
    .option("--prompt <prompt>", "Text prompt for image generation (required)")
    .option("--model <model>", `Generator model: ${allowedModels.join("|")}`)
    .option("--aspectRatio <ratio>", `Aspect ratio: ${allowedAspectRatios.join("|")}`)
    .option("--resolution <resolution>", `Resolution: ${allowedResolutions.join("|")}`)
    .option("--refs <refs>", "Comma-separated reference image paths/urls")
    .option("--output <file>", "Output file path")
    .action(imageCreateAction);

  // keep `image create` for compatibility
  parent
    .command("create")
    .description("Create a new image; requires --prompt")
    .option("--prompt <prompt>", "Text prompt for image generation (required)")
    .option("--model <model>", `Generator model: ${allowedModels.join("|")}`)
    .option("--aspectRatio <ratio>", `Aspect ratio: ${allowedAspectRatios.join("|")}`)
    .option("--resolution <resolution>", `Resolution: ${allowedResolutions.join("|")}`)
    .option("--refs <refs>", "Comma-separated reference image paths/urls")
    .option("--output <file>", "Output file path")
    .action(imageCreateAction);

  // removed `image edit`
}
