import type { Command } from "commander";
import { getMaterialUri, getSessionFromCommand, syncToTOS } from "../services/cerevox";
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
      video?: string;
      seed?: string;
      firstFrame?: string;
      lastFrame?: string;
      refs?: string;
      resolution?: "720p" | "1080p";
      aspectRatio?: "9:16" | "16:9" | "1:1";
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
    let model = typeof opts.video === "string" ? opts.video.trim() : undefined;
    if (model && !(allowedTypes as readonly string[]).includes(model)) {
      process.stderr.write(
        `Invalid value for --video: ${model}. Allowed: ${allowedTypes.join("|")}\n`
      );
      process.exitCode = 1;
      return;
    }
    if (!model) model = "vidu";
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
    const allowedAspectRatios = ["9:16", "16:9", "1:1"] as const;
    const ar = typeof opts.aspectRatio === "string" ? opts.aspectRatio : undefined;
    if (ar && !(allowedAspectRatios as readonly string[]).includes(ar)) {
      process.stderr.write(
        `Invalid value for --aspectRatio: ${ar}. Allowed: ${allowedAspectRatios.join("|")}\n`
      );
      process.exitCode = 1;
      return;
    }
    const aspectRatio = ar as (typeof allowedAspectRatios)[number] | undefined;
    const images: {
      type: "first_frame" | "last_frame" | "reference" | "storyboard";
      url: string;
      name?: string;
    }[] = [];
    if (opts.firstFrame) {
      images.push({
        type: "first_frame",
        url: await getMaterialUri(session, opts.firstFrame),
      });
    }
    if (opts.lastFrame) {
      images.push({
        type: "last_frame",
        url: await getMaterialUri(session, opts.lastFrame),
      });
    }
    const refsList =
      typeof opts.refs === "string" && opts.refs.length > 0
        ? opts.refs
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
    for (const ref of refsList) {
      images.push({
        type: "reference",
        url: await getMaterialUri(session, ref),
      });
    }
    const res = await session.ai.generateVideo({
      prompt,
      model: model as (typeof allowedTypes)[number],
      duration: duration || undefined,
      resolution: opts.resolution,
      aspect_ratio: aspectRatio,
      mute: !opts.withAudio,
      optimize_camera: opts.optimizeCameraMotion,
      seed: opts.seed ? Number.parseInt(opts.seed, 10) : undefined,
      images: images.length > 0 ? images : undefined,
      onProgress: createProgressSpinner("inferencing"),
    });
    try {
      if (res?.url) {
        const tosUrl = await syncToTOS(res.url as string);
        if (tosUrl) {
          res.url = tosUrl;
        }
      }
    } catch {}
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

  // default action on `zerocut video`
  parent
    .option("--prompt <prompt>", "Text prompt for video generation (required)")
    .option("--duration <duration>", "Video duration in seconds")
    .option("--video <video>", `Video model: ${allowedTypes.join("|")} (default: vidu)`)
    .option("--seed <seed>", "Random seed")
    .option("--firstFrame <image>", "First frame image path/url")
    .option("--lastFrame <image>", "Last frame image path/url")
    .option("--refs <refs>", "Comma-separated reference image/video paths/urls")
    .option("--resolution <resolution>", "Resolution, e.g., 720p")
    .option("--aspectRatio <ratio>", "Aspect ratio: 9:16|16:9|1:1")
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
    .option("--video <video>", `Video model: ${allowedTypes.join("|")} (default: vidu)`)
    .option("--seed <seed>", "Random seed")
    .option("--firstFrame <image>", "First frame image path/url")
    .option("--lastFrame <image>", "Last frame image path/url")
    .option("--refs <refs>", "Comma-separated reference image/video paths/urls")
    .option("--resolution <resolution>", "Resolution, e.g., 720p")
    .option("--aspectRatio <ratio>", "Aspect ratio: 9:16|16:9|1:1")
    .option("--withAudio", "Include audio track")
    .option("--optimizeCameraMotion", "Optimize camera motion")
    .option("--output <file>", "Output file path")
    .action(videoCreateAction);

  // removed `video edit`
}
