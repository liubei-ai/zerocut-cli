import type { Command } from "commander";
import { getMaterialUri, getSessionFromCommand, syncToTOS } from "../services/cerevox";
import fs from "node:fs";
import path from "node:path";
import { createProgressSpinner } from "../utils/progress";

export const name = "video";
export const description = "Video command: create video";

function resolveResultUrl(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  if (typeof record.url === "string" && record.url.length > 0) {
    return record.url;
  }
  const data = record.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.url === "string" && dataRecord.url.length > 0) {
      return dataRecord.url;
    }
  }
  return undefined;
}

export function register(program: Command): void {
  const avatarModels = ["zerocut-avatar-1.0", "zerocut-avatar-1.5"] as const;
  const mvModels = ["zerocut-mv-1.0"] as const;
  const parent = program.command("video").description("Create a new video; requires --prompt");

  const allowedTypes = [
    "zerocut3.0",
    "zerocut3.0-pro",
    "zerocut3.0-pro-fast",
    "zerocut3.0-turbo",
    "seedance-1.5-pro",
    "seedance-2.0",
    "seedance-2.0-fast",
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
    ...avatarModels,
    ...mvModels,
  ] as const;

  async function videoCreateAction(
    this: Command,
    opts: {
      prompt?: string;
      duration?: string;
      model?: string;
      sourceVideo?: string;
      seed?: string;
      firstFrame?: string;
      lastFrame?: string;
      storyboard?: string;
      persons?: string;
      refs?: string;
      resolution?: "720p" | "1080p";
      aspectRatio?: "9:16" | "16:9" | "1:1";
      withAudio?: boolean;
      withBGM?: string;
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
    let model = typeof opts.model === "string" ? opts.model.trim() : undefined;
    if (model && !(allowedTypes as readonly string[]).includes(model)) {
      process.stderr.write(
        `Invalid value for --model: ${model}. Allowed: ${allowedTypes.join("|")}\n`
      );
      process.exitCode = 1;
      return;
    }
    if (!model) model = "vidu";
    const durationStr = typeof opts.duration === "string" ? opts.duration.trim() : undefined;
    const sourceVideo = typeof opts.sourceVideo === "string" ? opts.sourceVideo.trim() : undefined;
    let duration: number = 0;
    const durationRange = ((): { min: number; max: number } => {
      if ((avatarModels as readonly string[]).includes(model)) {
        return { min: 5, max: 240 };
      }
      if ((mvModels as readonly string[]).includes(model)) {
        return { min: 1, max: 240 };
      }
      return { min: 1, max: 16 };
    })();
    if (durationStr) {
      const n = Number.parseInt(durationStr, 10);
      if (!Number.isFinite(n) || n < durationRange.min || n > durationRange.max) {
        process.stderr.write(
          `Invalid value for --duration: model ${model} supports integer ${durationRange.min}-${durationRange.max}\n`
        );
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
    let withBGM = true;
    if (typeof opts.withBGM === "string") {
      const withBGMRaw = opts.withBGM.trim().toLowerCase();
      if (withBGMRaw === "true") {
        withBGM = true;
      } else if (withBGMRaw === "false") {
        withBGM = false;
      } else {
        process.stderr.write("Invalid value for --withBGM: expected true|false\n");
        process.exitCode = 1;
        return;
      }
    }
    const images: {
      type: "first_frame" | "last_frame" | "reference" | "storyboard" | "person";
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
    if (opts.storyboard) {
      images.push({
        type: "storyboard",
        url: await getMaterialUri(session, opts.storyboard),
      });
    }
    const personList =
      typeof opts.persons === "string" && opts.persons.length > 0
        ? opts.persons
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
    for (const person of personList) {
      images.push({
        type: "person",
        url: await getMaterialUri(session, person),
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
    const request = {
      prompt,
      model: model as unknown as Parameters<typeof session.ai.generateVideo>[0]["model"],
      duration: duration || undefined,
      resolution: opts.resolution,
      aspect_ratio: aspectRatio,
      mute: !(opts.withAudio ?? true),
      bgm: withBGM,
      optimize_camera: opts.optimizeCameraMotion,
      seed: opts.seed ? Number.parseInt(opts.seed, 10) : undefined,
      images: images.length > 0 ? images : undefined,
      videos: sourceVideo
        ? [
            {
              type: "base",
              url: await getMaterialUri(session, sourceVideo),
            },
          ]
        : undefined,
      onProgress: createProgressSpinner("inferencing"),
      timeout: 7_200_000,
    } as unknown as Parameters<typeof session.ai.generateVideo>[0];
    const res = await session.ai.generateVideo(request);
    const initialUrl = resolveResultUrl(res);
    try {
      if (initialUrl) {
        const tosUrl = await syncToTOS(initialUrl);
        if (tosUrl) {
          (res as Record<string, unknown>).url = tosUrl;
        }
      }
    } catch {}
    process.stdout.write("\n");
    const output = typeof opts.output === "string" ? opts.output : undefined;
    if (output) {
      const dir = process.cwd();
      const url = resolveResultUrl(res);
      if (!url) {
        process.stderr.write(
          "Cannot save --output because no video URL was returned. Please retry later or run without --output to inspect raw response.\n"
        );
        process.exitCode = 1;
        console.log(res);
        return;
      }
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
    .option(
      "--duration <duration>",
      "Video duration in seconds (default models: 1-16, avatar: 5-240, mv: 1-240)"
    )
    .option("--model <model>", `Video model: ${allowedTypes.join("|")} (default: vidu)`)
    .option("--sourceVideo <video>", "Base video path/url for edit mode (requires --duration 3-10)")
    .option("--seed <seed>", "Random seed")
    .option("--firstFrame <image>", "First frame image path/url")
    .option("--lastFrame <image>", "Last frame image path/url")
    .option("--storyboard <image>", "Storyboard image path/url")
    .option("--persons <persons>", "Comma-separated person image paths/urls")
    .option("--refs <refs>", "Comma-separated reference image/video paths/urls")
    .option("--resolution <resolution>", "Resolution, e.g., 720p")
    .option("--aspectRatio <ratio>", "Aspect ratio: 9:16|16:9|1:1")
    .option("--withAudio", "Include audio track")
    .option("--withBGM <withBGM>", "Include background music: true|false (default: true)")
    .option("--optimizeCameraMotion", "Optimize camera motion")
    .option("--output <file>", "Output file path")
    .action(videoCreateAction);

  // keep `video create` for compatibility
  parent
    .command("create")
    .description("Create a new video; requires --prompt")
    .option("--prompt <prompt>", "Text prompt for video generation (required)")
    .option(
      "--duration <duration>",
      "Video duration in seconds (default models: 1-16, avatar: 5-240, mv: 1-240)"
    )
    .option("--model <model>", `Video model: ${allowedTypes.join("|")} (default: vidu)`)
    .option("--sourceVideo <video>", "Base video path/url for edit mode (requires --duration 3-10)")
    .option("--seed <seed>", "Random seed")
    .option("--firstFrame <image>", "First frame image path/url")
    .option("--lastFrame <image>", "Last frame image path/url")
    .option("--storyboard <image>", "Storyboard image path/url")
    .option("--persons <persons>", "Comma-separated person image paths/urls")
    .option("--refs <refs>", "Comma-separated reference image/video paths/urls")
    .option("--resolution <resolution>", "Resolution, e.g., 720p")
    .option("--aspectRatio <ratio>", "Aspect ratio: 9:16|16:9|1:1")
    .option("--withAudio", "Include audio track")
    .option("--withBGM <withBGM>", "Include background music: true|false (default: true)")
    .option("--optimizeCameraMotion", "Optimize camera motion")
    .option("--output <file>", "Output file path")
    .action(videoCreateAction);

  // removed `video edit`
}
