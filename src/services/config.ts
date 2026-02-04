import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { Command } from "commander";
import { openSession, closeSession, attachSessionToCommand, SESSION_SYMBOL } from "./cerevox";

export interface ZerocutConfig {
  apiKey: string;
  projectDir: string;
  region?: "us" | "cn";
}

export function configPath(): string {
  return path.join(os.homedir(), ".zerocut", "config.json");
}

function configFallbackPath(): string {
  return path.join(process.cwd(), ".zerocut", "config.json");
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  try {
    const buf = await fsp.readFile(file, "utf8");
    return JSON.parse(buf);
  } catch {
    return {};
  }
}

function readJsonSync(file: string): Record<string, unknown> {
  try {
    const buf = fs.readFileSync(file, "utf8");
    return JSON.parse(buf);
  } catch {
    return {};
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  const dir = path.dirname(file);
  try {
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== "EPERM" && code !== "EACCES") throw e;
  }
  const fb = configFallbackPath();
  const fdir = path.dirname(fb);
  await fsp.mkdir(fdir, { recursive: true });
  await fsp.writeFile(fb, JSON.stringify(data, null, 2), "utf8");
}

export async function readConfig(): Promise<Partial<ZerocutConfig>> {
  const primary = configPath();
  try {
    await fsp.access(primary);
    return (await readJson(primary)) as Partial<ZerocutConfig>;
  } catch {
    const fb = configFallbackPath();
    try {
      await fsp.access(fb);
      return (await readJson(fb)) as Partial<ZerocutConfig>;
    } catch {
      return {};
    }
  }
}

export function readConfigSync(): Partial<ZerocutConfig> {
  const primary = configPath();
  if (fs.existsSync(primary)) return readJsonSync(primary) as Partial<ZerocutConfig>;
  const fb = configFallbackPath();
  if (fs.existsSync(fb)) return readJsonSync(fb) as Partial<ZerocutConfig>;
  return {};
}

export async function writeConfig(update: Partial<ZerocutConfig>): Promise<Partial<ZerocutConfig>> {
  const file = configPath();
  const current = (await readJson(file)) as Partial<ZerocutConfig>;
  const next = { ...current, ...update } as Partial<ZerocutConfig>;
  await writeJson(file, next);
  return next;
}

function splitKeyPath(key: string): string[] {
  return key
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function deepGet(obj: Record<string, unknown>, segments: string[]): unknown {
  let cur: unknown = obj;
  for (const seg of segments) {
    if (typeof cur !== "object" || cur === null) return undefined;
    const rec = cur as Record<string, unknown>;
    cur = rec[seg];
  }
  return cur;
}

function deepSet(obj: Record<string, unknown>, segments: string[], value: unknown): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (isLast) {
      cur[seg] = value as unknown;
    } else {
      const next = cur[seg];
      if (typeof next !== "object" || next === null) {
        const created: Record<string, unknown> = {};
        cur[seg] = created;
        cur = created;
      } else {
        cur = next as Record<string, unknown>;
      }
    }
  }
}

export function getConfigValueSync(key: string): unknown {
  const primary = configPath();
  const fb = configFallbackPath();
  const data = fs.existsSync(primary)
    ? (readJsonSync(primary) as Record<string, unknown>)
    : fs.existsSync(fb)
      ? (readJsonSync(fb) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  return deepGet(data, splitKeyPath(key));
}

export async function getConfigValue(key: string): Promise<unknown> {
  const primary = configPath();
  try {
    await fsp.access(primary);
    const data = (await readJson(primary)) as Record<string, unknown>;
    return deepGet(data, splitKeyPath(key));
  } catch {
    const fb = configFallbackPath();
    try {
      await fsp.access(fb);
      const data = (await readJson(fb)) as Record<string, unknown>;
      return deepGet(data, splitKeyPath(key));
    } catch {
      return undefined;
    }
  }
}

function writeJsonSync(file: string, data: unknown): void {
  const dir = path.dirname(file);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    return;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== "EPERM" && code !== "EACCES") throw e;
  }
  const fb = configFallbackPath();
  const fdir = path.dirname(fb);
  fs.mkdirSync(fdir, { recursive: true });
  fs.writeFileSync(fb, JSON.stringify(data, null, 2), "utf8");
}

export function setConfigValueSync(key: string, value: unknown): void {
  const file = configPath();
  const data = readJsonSync(file) as Record<string, unknown>;
  deepSet(data, splitKeyPath(key), value);
  writeJsonSync(file, data);
}

export async function setConfigValue(key: string, value: unknown): Promise<void> {
  const file = configPath();
  const data = (await readJson(file)) as Record<string, unknown>;
  deepSet(data, splitKeyPath(key), value);
  await writeJson(file, data);
}

export async function ensureConfig(): Promise<boolean> {
  const apiKey = getConfigValueSync("apiKey");
  const projectDir = getConfigValueSync("projectDir");
  const region = getConfigValueSync("region");
  const missing: string[] = [];
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) missing.push("apiKey");
  if (typeof projectDir !== "string" || projectDir.trim().length === 0) missing.push("projectDir");
  if (missing.length > 0) {
    process.stderr.write(
      `Missing required configuration: ${missing.join(", ")}\nConfigure using:\n  zerocut config apiKey <key>\n  zerocut config projectDir <dir>\n`
    );
    return false;
  }
  if (region !== "us" && region !== "cn") {
    setConfigValueSync("region", "us");
  }
  return true;
}

export function applyConfigInterceptor(program: Command): void {
  program.hook("preAction", async (thisCommand, actionCommand) => {
    const current = (actionCommand ?? thisCommand) as Command;
    const name = current?.name?.();
    const parentName = current?.parent?.name?.();
    if (name === "help" || name === "config" || parentName === "config") return;
    const ok = await ensureConfig();
    if (!ok) {
      process.exit(1);
      return;
    }
    const session = await openSession();
    if (actionCommand) {
      attachSessionToCommand(actionCommand as unknown as Record<symbol, unknown>, session);
    }
  });
  program.hook("postAction", async (thisCommand, actionCommand) => {
    const name = actionCommand?.name?.() ?? thisCommand?.name?.();
    if (name === "help") return;
    try {
      const cmd = (actionCommand ?? thisCommand) as Command & {
        [SESSION_SYMBOL]?: import("cerevox").Session;
      };
      const session = cmd?.[SESSION_SYMBOL];
      if (session) await closeSession(session);
      process.exit(0);
    } catch {}
  });
}
