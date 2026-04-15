import { Cerevox, type Session } from "cerevox";
import { createHash } from "node:crypto";
import { getConfigValueSync, setConfigValueSync } from "./config";
import { createReadStream } from "node:fs";
import { resolve, basename } from "node:path";
import { stat } from "node:fs/promises";

export const SESSION_SYMBOL = Symbol("zerocut.session");

export function attachSessionToCommand(cmd: { [k: symbol]: unknown }, session: Session): void {
  cmd[SESSION_SYMBOL] = session as unknown;
}

export function getSessionFromCommand(cmd: { [k: symbol]: unknown }): Session | undefined {
  return cmd[SESSION_SYMBOL] as Session | undefined;
}

export function getApiKey(): string {
  const v = getConfigValueSync("apiKey");
  return typeof v === "string" ? v : "";
}

export function getRegion(): "cn" | "us" {
  const v = getConfigValueSync("region") as "cn" | "us";
  return v;
}

export async function openSession(): Promise<Session> {
  let apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("apiKey is not set");
  }
  const region = getRegion();
  apiKey = region + apiKey.slice(2);
  const cerevox = new Cerevox({
    apiKey,
  });
  const sandboxTtlMs = 90 * 60 * 1000;
  const now = Date.now();
  let sandboxId = getConfigValueSync("sandboxId") as string | undefined;
  const sandboxIdExpireAtRaw = getConfigValueSync("sandboxIdExpireAt");
  const sandboxIdExpireAt =
    typeof sandboxIdExpireAtRaw === "number"
      ? sandboxIdExpireAtRaw
      : typeof sandboxIdExpireAtRaw === "string"
        ? Number.parseInt(sandboxIdExpireAtRaw, 10)
        : NaN;
  if (!Number.isFinite(sandboxIdExpireAt) || now > sandboxIdExpireAt) {
    sandboxId = undefined;
    setConfigValueSync("sandboxId", null);
    setConfigValueSync("sandboxIdExpireAt", null);
  }
  if (sandboxId) {
    try {
      const session = await cerevox.connect(sandboxId, 300_000);
      setConfigValueSync("sandboxId", session.sandbox.sandboxId ?? sandboxId);
      setConfigValueSync("sandboxIdExpireAt", Date.now() + sandboxTtlMs);
      return session;
    } catch {
      sandboxId = undefined;
    }
  }
  const session = await cerevox.launch({ timeout: 120, region });
  sandboxId = session.sandbox.sandboxId!;
  setConfigValueSync("sandboxId", sandboxId);
  setConfigValueSync("sandboxIdExpireAt", Date.now() + sandboxTtlMs);
  return session;
}

export async function closeSession(session: Session) {
  await session.close();
}

async function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

interface GetMaterialUriOptions {
  fileSizeLimit?: number;
}

export async function getMaterialUri(
  session: Session,
  fileName: string,
  options: GetMaterialUriOptions = {}
): Promise<string> {
  const resolvedOptions: Required<GetMaterialUriOptions> = {
    fileSizeLimit: options.fileSizeLimit ?? -1,
  };
  const localPath = resolve(fileName);
  const hash = await computeSha256(localPath);
  const url = session.sandbox.getUrl(
    `/zerocut/${session.terminal.id}/materials/${basename(fileName)}`
  );
  // check url avaliable，用 HEAD 请求检查是否存在
  const res = await fetch(url, {
    method: "HEAD",
  });
  if (res.status === 404 || hash !== res.headers.get("X-Content-Hash")) {
    if (resolvedOptions.fileSizeLimit > 0) {
      const stats = await stat(localPath);
      const fileSizeMb = stats.size / (1024 * 1024);
      if (fileSizeMb > resolvedOptions.fileSizeLimit) {
        throw new Error(
          `文件太大：${fileName} (${fileSizeMb.toFixed(2)}MB)，限制为 ${resolvedOptions.fileSizeLimit}MB`
        );
      }
    }
    const saveToPath = `/home/user/cerevox-zerocut/projects/${session.terminal.id}/materials/${fileName}`;
    const files = session.files;
    await files.upload(localPath, saveToPath, { overwrite: true });
  } else if (res.status > 299) {
    throw new Error(`Failed to get material from ${url}. Details: ${res.statusText}`);
  }
  return url;
}

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

export async function syncToTOS(url: string): Promise<string> {
  const api = "https://api.zerocut.cn/api/v1/upload/material";
  const apiKey = getApiKey();

  const fileRes = await fetch(url);
  if (!fileRes.ok || !fileRes.body) {
    throw new Error("Failed to fetch source file");
  }

  const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mpga": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "video/mp4": "mp4",
    "video/mpeg": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };
  let ext = map[contentType] || "";
  if (!ext) {
    try {
      const u = new URL(url);
      const p = u.pathname;
      const i = p.lastIndexOf(".");
      if (i !== -1 && i < p.length - 1) {
        const e = p.substring(i + 1).toLowerCase();
        if (/^[a-z0-9]{2,5}$/.test(e)) ext = e;
      }
    } catch {}
  }
  if (!ext) ext = "bin";

  const tempPath = join(tmpdir(), `upload-${Date.now()}.${ext}`);

  try {
    await pipeline(fileRes.body as any, createWriteStream(tempPath));

    const fileBuffer = await fs.readFile(tempPath);
    const fileName = `file.${ext}`;
    const file = new File([fileBuffer], fileName, { type: contentType });

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(api, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload to TOS: ${res.statusText}`);
    }

    const result = await res.json();
    return result?.data?.url;
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

export async function runFFMpegCommand(
  session: Session,
  command: string,
  resources: string[] = []
) {
  // 验证命令只能是 ffmpeg 或 ffprobe
  const trimmedCommand = command.trim();
  if (!trimmedCommand.startsWith("ffmpeg") && !trimmedCommand.startsWith("ffprobe")) {
    throw new Error("Only ffmpeg and ffprobe commands are allowed");
  }
  const terminal = session.terminal;
  // 自动添加 -y 参数以避免交互式确认导致命令卡住
  let finalCommand = trimmedCommand;
  if (trimmedCommand.startsWith("ffmpeg") && !trimmedCommand.includes(" -y")) {
    // 在 ffmpeg 后面插入 -y 参数
    finalCommand = trimmedCommand.replace(/^ffmpeg/, "ffmpeg -y");
  }

  // 将 resources 中的文件同步到沙箱 materials 目录
  await Promise.all(
    resources.map((resource) => {
      return getMaterialUri(session, resource);
    })
  );

  // 构建工作目录路径 - materials 目录
  const workDir = `/home/user/cerevox-zerocut/projects/${terminal.id}/materials`;
  // 执行命令，用一个独立的命令行以免影响当前会话的cwd
  const response = await terminal.create().run(finalCommand, {
    cwd: workDir,
  });

  const outputFilePath = trimmedCommand.startsWith("ffmpeg")
    ? (finalCommand.split(" ").pop() || "").replace(/^["']|["']$/g, "")
    : "";
  const sandboxFilePath = join(workDir, outputFilePath);
  let tosUrl: string | undefined;

  // 等待命令完成
  const result = await response.json();
  if (result.exitCode === 0 && outputFilePath) {
    const savePath = join(process.cwd(), basename(outputFilePath));
    const files = session.files;
    await files.download(sandboxFilePath, savePath);
    const sandboxUrl = await getMaterialUri(session, savePath);
    tosUrl = await syncToTOS(sandboxUrl);
  }

  return {
    exitCode: result.exitCode,
    outputFilePath,
    tosUrl,
    data: {
      stdout: result.stdout || (!result.exitCode && result.stderr) || "",
      stderr: result.exitCode ? result.stderr : undefined,
    },
  };
}

function getPandocOutputFilePath(command: string): string {
  const inlineMatch = command.match(/(?:^|\s)--output=("[^"]+"|'[^']+'|[^\s]+)/);
  if (inlineMatch?.[1]) {
    return inlineMatch[1].replace(/^["']|["']$/g, "");
  }
  const outputMatch = command.match(/(?:^|\s)(?:-o|--output)\s+("[^"]+"|'[^']+'|[^\s]+)/);
  if (outputMatch?.[1]) {
    return outputMatch[1].replace(/^["']|["']$/g, "");
  }
  return "";
}

export async function runPandocCommand(
  session: Session,
  command: string,
  resources: string[] = []
) {
  const trimmedCommand = command.trim();
  if (!trimmedCommand.startsWith("pandoc")) {
    throw new Error("Only pandoc command is allowed");
  }
  const terminal = session.terminal;

  await Promise.all(
    resources.map((resource) => {
      return getMaterialUri(session, resource);
    })
  );

  const workDir = `/home/user/cerevox-zerocut/projects/${terminal.id}/materials`;
  const response = await terminal.create().run(trimmedCommand, {
    cwd: workDir,
  });

  const outputFilePath = getPandocOutputFilePath(trimmedCommand);
  const sandboxFilePath = outputFilePath ? join(workDir, outputFilePath) : "";

  const result = await response.json();
  if (result.exitCode === 0 && outputFilePath) {
    const savePath = join(process.cwd(), basename(outputFilePath));
    const files = session.files;
    await files.download(sandboxFilePath, savePath);
  }

  return {
    exitCode: result.exitCode,
    outputFilePath,
    data: {
      stdout: result.stdout || (!result.exitCode && result.stderr) || "",
      stderr: result.exitCode ? result.stderr : undefined,
    },
  };
}
