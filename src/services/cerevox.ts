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
  let sandboxId = getConfigValueSync("sandboxId") as string | undefined;
  if (sandboxId) {
    try {
      return await cerevox.connect(sandboxId, 300_000);
    } catch {
      sandboxId = undefined;
    }
  }
  const session = await cerevox.launch({ timeout: 60, region });
  sandboxId = session.sandbox.sandboxId!;
  setConfigValueSync("sandboxId", sandboxId);
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
    await files.upload(localPath, saveToPath);
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
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "video/mp4": "mp4",
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

  const tempPath = join(tmpdir(), `upload-${Date.now()}.bin`);

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
