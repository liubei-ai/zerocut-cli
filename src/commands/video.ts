import type { Command } from "commander";
import { getMaterialUri, getSessionFromCommand } from "../services/cerevox";
import fs from "node:fs";
import path from "node:path";
import { createProgressSpinner } from "../utils/progress";

export const name = "video";
export const description = "Video command: create video";

export function register(program: Command): void {
  const parent = program.command("video").description("Create a new video; requires --prompt");

  const allowedTypes = [
    "zerocut3.0",
    "seedance-1.5-pro",
    "vidu",
    "vidu-pro",
    "viduq3",
    "viduq3-turbo",
    "kling",
    "kling-v3",
    "wan",
    "wan-flash",
    "sora2",
    "sora2-pro",
    "veo3.1",
    "veo3.1-pro",
  ] as const;

  async function videoCreateAction(
    this: Command,
    opts: {
      prompt?: string;
      duration?: string;
      type?: string;
      seed?: string;
      firstFrame?: string;
      lastFrame?: string;
      refs?: string;
      resolution?: "720p" | "1080p";
      aspectRatio?: "9:16" | "16:9";
      withAudio?: boolean;
      optimizeCameraMotion?: boolean;
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
    let type = typeof opts.type === "string" ? opts.type.trim() : undefined;
    if (type && !(allowedTypes as readonly string[]).includes(type)) {
      process.stderr.write(
        `Invalid value for --type: ${type}. Allowed: ${allowedTypes.join("|")}\n`
      );
      process.exitCode = 1;
      return;
    }
    if (!type) type = "vidu";
    const durationStr = typeof opts.duration === "string" ? opts.duration.trim() : undefined;
    let duration: number = 0;
    if (durationStr) {
      const n = Number.parseInt(durationStr, 10);
      if (!Number.isFinite(n) || n < 1 || n > 16) {
        process.stderr.write("Invalid value for --duration: must be integer 1-16\n");
        process.exitCode = 1;
        return;
      }
      duration = n;
    }
    if (opts.firstFrame) {
      let typeStr: string = type || "vidu";
      if (typeStr === "wan") type = "wan-flash";
      if (typeStr === "seedance") type = "pro";
      if (typeStr === "sora2") {
        throw new Error("sora2 is not supported first frame");
      }
      // 首尾帧
      const res = await session.ai.framesToVideo({
        type: opts.type as
          | "vidu"
          | "vidu-pro"
          | "wan-flash"
          | "pro"
          | "veo3.1"
          | "veo3.1-pro"
          | "kling",
        prompt,
        start_frame: await getMaterialUri(session, opts.firstFrame),
        end_frame: opts.lastFrame ? await getMaterialUri(session, opts.lastFrame) : undefined,
        duration,
        resolution: opts.resolution,
        aspect_ratio: opts.aspectRatio,
        mute: !opts.withAudio,
        optimizeCameraMotion: opts.optimizeCameraMotion,
        seed: opts.seed ? Number.parseInt(opts.seed, 10) : undefined,
        onProgress: createProgressSpinner("inferencing"),
      });
      process.stdout.write("\n");
      const output = typeof opts.output === "string" ? opts.output : undefined;
      if (output) {
        const dir = process.cwd();
        const url = res.url;
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = path.resolve(dir, output);
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        fs.writeFileSync(filePath, buffer);
        res.output = filePath;
      }
      console.log(res);
    } else {
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
      let typeStr: string = type || "vidu";
      if (typeStr === "seedance") type = "pro";
      if (typeStr === "kling") type = "kling-o1";
      // 多参
      const res = await session.ai.referencesToVideo({
        type: opts.type as
          | "vidu"
          | "vidu-pro"
          | "sora2"
          | "sora2-pro"
          | "wan"
          | "pro"
          | "veo3.1"
          | "veo3.1-pro"
          | "kling",
        prompt,
        duration,
        resolution: opts.resolution,
        aspect_ratio: opts.aspectRatio,
        mute: !opts.withAudio,
        optimizeCameraMotion: opts.optimizeCameraMotion,
        seed: opts.seed ? Number.parseInt(opts.seed, 10) : undefined,
        reference_images: referenceImages,
        onProgress: createProgressSpinner("inferencing"),
      });
      process.stdout.write("\n");
      const output = typeof opts.output === "string" ? opts.output : undefined;
      if (output) {
        const dir = process.cwd();
        const url = res.url;
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = path.resolve(dir, output);
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        fs.writeFileSync(filePath, buffer);
        res.output = filePath;
      }
      console.log(res);
    }
  }

  // default action on `zerocut video`
  parent
    .option("--prompt <prompt>", "Text prompt for video generation (required)")
    .option("--duration <duration>", "Video duration in seconds")
    .option("--type <type>", `Generator type: ${allowedTypes.join("|")} (default: vidu)`)
    .option("--seed <seed>", "Random seed")
    .option("--firstFrame <image>", "First frame image path/url")
    .option("--lastFrame <image>", "Last frame image path/url")
    .option("--refs <refs>", "Comma-separated reference image/video paths/urls")
    .option("--resolution <resolution>", "Resolution, e.g., 720p")
    .option("--aspectRatio <ratio>", "Aspect ratio, e.g., 16:9")
    .option("--withAudio", "Include audio track")
    .option("--optimizeCameraMotion", "Optimize camera motion")
    .option("--output <file>", "Output file path")
    .action(videoCreateAction);

  // keep `video create` for compatibility
  parent
    .command("create")
    .description("Create a new video; requires --prompt")
    .option("--prompt <prompt>", "Text prompt for video generation (required)")
    .option("--duration <duration>", "Video duration in seconds")
    .option("--type <type>", `Generator type: ${allowedTypes.join("|")} (default: vidu)`)
    .option("--seed <seed>", "Random seed")
    .option("--firstFrame <image>", "First frame image path/url")
    .option("--lastFrame <image>", "Last frame image path/url")
    .option("--refs <refs>", "Comma-separated reference image/video paths/urls")
    .option("--resolution <resolution>", "Resolution, e.g., 720p")
    .option("--aspectRatio <ratio>", "Aspect ratio, e.g., 16:9")
    .option("--withAudio", "Include audio track")
    .option("--optimizeCameraMotion", "Optimize camera motion")
    .option("--output <file>", "Output file path")
    .action(videoCreateAction);

  // removed `video edit`
}
