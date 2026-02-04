import { Cerevox, type Session } from "cerevox";
import { createHash } from "node:crypto";
import { getConfigValueSync, setConfigValueSync } from "./config";
import { createReadStream } from "node:fs";
import { resolve, basename } from "node:path";

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

export async function getMaterialUri(session: Session, fileNameOrUrl: string) {
  if (fileNameOrUrl.startsWith("http://") || fileNameOrUrl.startsWith("https://")) {
    return fileNameOrUrl;
  }
  const fileName = fileNameOrUrl;
  const projectLocalDir = getConfigValueSync("projectDir") as string;
  const localPath = resolve(projectLocalDir, "materials", fileName);
  const hash = await computeSha256(localPath);
  const url = session.sandbox.getUrl(
    `/zerocut/${session.terminal.id}/materials/${basename(fileName)}`
  );
  // check url avaliable，用 HEAD 请求检查是否存在
  const res = await fetch(url, {
    method: "HEAD",
  });
  if (res.status === 404 || hash !== res.headers.get("X-Content-Hash")) {
    const saveToPath = `/home/user/cerevox-zerocut/projects/${session.terminal.id}/materials/${fileName}`;
    const files = session.files;
    await files.upload(localPath, saveToPath);
  } else if (res.status > 299) {
    throw new Error(
      `Failed to get material url: ${url}，请先上传素材(upload-custom-materials)到沙箱`
    );
  }
  return url;
}
