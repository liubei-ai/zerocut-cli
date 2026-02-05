import type { Command } from "commander";
import { getMaterialUri, getSessionFromCommand } from "../services/cerevox";
import { getConfigValue } from "../services/config";
import fs from "node:fs";
import path from "node:path";
import { createProgressSpinner } from "../utils/progress";

export const name = "video";
export const description = "Video commands: create and edit";

export function register(program: Command): void {
  const parent = program.command("video").description("Video commands: create and edit");

  const allowedTypes = [
    "sora2",
    "sora2-pro",
    "veo3.1",
    "veo3.1-pro",
    "wan",
    "vidu",
    "vidu-pro",
    "seedance",
    "kling",
  ] as const;

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
    .action(async function (
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
          const dir = (await getConfigValue("projectDir")) as string;
          const url = res.url;
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
            | "kling-o1",
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
          const dir = (await getConfigValue("projectDir")) as string;
          const url = res.url;
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
    });

  parent
    .command("edit")
    .description("Edit an existing video by applying modifications")
    .option("--source <source>", "Original video path/url (required)")
    .option("--prompt <prompt>", "Text prompt for video editing (required)")
    .option("--type <type>", `Edit type: ${["edit", "lipsync", "extend", "upscale"].join("|")}`)
    .option("--duration <duration>", "Target duration in seconds")
    .option("--resolution <resolution>", `Resolution: ${["720p", "1080p", "2K", "4K"].join("|")}`)
    .option("--refs <refs>", "Comma-separated reference assets")
    .option("--output <file>", "Output file path")
    .action(async function (
      this: Command,
      opts: {
        source?: string;
        prompt?: string;
        type?: string;
        duration?: string;
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
      const source = typeof opts.source === "string" ? opts.source.trim() : undefined;
      if (!source || source.length === 0) {
        process.stderr.write("Missing required option: --source\n");
        process.exitCode = 1;
        return;
      }
      const prompt = typeof opts.prompt === "string" ? opts.prompt : undefined;
      if (!prompt || prompt.trim().length === 0) {
        process.stderr.write("Missing required option: --prompt\n");
        process.exitCode = 1;
        return;
      }
      const type = typeof opts.type === "string" ? opts.type.trim() : undefined;
      const allowedEditTypes = ["edit", "lipsync", "extend", "upscale"] as const;
      if (type && !(allowedEditTypes as readonly string[]).includes(type)) {
        process.stderr.write(
          `Invalid value for --type: ${type}. Allowed: ${allowedEditTypes.join("|")}\n`
        );
        process.exitCode = 1;
        return;
      }
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
      const refsList =
        typeof opts.refs === "string" && opts.refs.length > 0
          ? opts.refs
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];
      refsList.unshift(source);
      const resolution = typeof opts.resolution === "string" ? opts.resolution.trim() : undefined;
      const allowedResolutions = ["720p", "1080p", "2K", "4K"] as const;
      if (resolution && !(allowedResolutions as readonly string[]).includes(resolution)) {
        process.stderr.write(
          `Invalid value for --resolution: ${resolution}. Allowed: ${allowedResolutions.join("|")}\n`
        );
        process.exitCode = 1;
        return;
      }
      if (type === "extend" && (resolution === "2K" || resolution === "4K")) {
        throw new Error("Extend type only supports 720p resolution or 1080p resolution");
      }
      if (type === "upscale" && resolution === "720p") {
        throw new Error("720p resolution is not supported for upscale type");
      }
      let referenceImageUrls: string[] | undefined = undefined;
      if (refsList) {
        const tasks = refsList.map(async (file) => {
          return await getMaterialUri(session, file);
        });
        referenceImageUrls = await Promise.all(tasks);
      }
      const videoUrl = await getMaterialUri(session, source);

      let res: any = {};
      if (type === "edit") {
        if (!prompt) {
          throw new Error("prompt is required for edit type");
        }
        res = await session.ai.editVideo({
          videoUrl,
          prompt,
          referenceImages: referenceImageUrls,
          onProgress: createProgressSpinner("inferencing"),
        });
      } else if (type === "lipsync") {
        // 调用AI的lipSync方法，使用处理后的音频
        const { audio: audioUrl } = await session.ai.splitVideoAndAudio({
          videoUrl,
        });
        res = await session.ai.lipSync({
          videoUrl,
          audioUrl,
          audioInMs: 0,
          pad_audio: false,
          onProgress: createProgressSpinner("inferencing"),
        });
      } else if (type === "extend") {
        res = await session.ai.extendVideo({
          video_url: videoUrl,
          resolution: resolution || "720p",
          prompt,
          duration: duration || 5,
          end_frame: referenceImageUrls?.[0],
          onProgress: createProgressSpinner("inferencing"),
        });
      } else if (type === "upscale") {
        res = await session.ai.upscaleVideo({
          video_url: videoUrl,
          resolution,
          onProgress: createProgressSpinner("inferencing"),
        });
      }
      process.stdout.write("\n");
      const output = typeof opts.output === "string" ? opts.output : undefined;
      if (output) {
        const dir = (await getConfigValue("projectDir")) as string;
        const url = res.url;
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
}
