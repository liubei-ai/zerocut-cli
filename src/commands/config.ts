import type { Command } from "commander";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import { readConfigSync, setConfigValueSync } from "../services/config";

export const name = "config";
export const description = "Configuration management";

function expandHome(input: string): string {
  if (!input) return input;
  if (input.startsWith("~")) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

async function ask(question: string, defaults?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = defaults ? `${question} [${defaults}]: ` : `${question}: `;
  const answer = await new Promise<string>((resolve) => rl.question(q, (ans) => resolve(ans)));
  rl.close();
  const trimmed = answer.trim();
  return trimmed.length > 0 ? trimmed : (defaults ?? "");
}

export function register(program: Command): void {
  const parent = program
    .command("config")
    .description("Configuration management: set apiKey and projectDir");

  parent
    .command("apiKey [key]")
    .description(
      "Set API key. If omitted, enter a One-Time Token (OTT) to exchange for an API key."
    )
    .action(async (key?: string) => {
      const direct = typeof key === "string" ? key.trim() : "";
      if (direct.length > 0) {
        setConfigValueSync("apiKey", direct);
        process.stdout.write("apiKey set\n");
        return;
      }
      const ott = (await ask("Enter One-Time Token (OTT)")).trim();
      if (!ott) {
        process.stderr.write("OTT is required when no apiKey is provided\n");
        process.exitCode = 1;
        return;
      }
      try {
        const resp = await fetch(
          "https://resource.zerocut.cn/coze-upload/1m7ozcj5pg/sm7vckqr.png",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ ott }),
          }
        );
        if (!resp.ok) {
          process.stderr.write(`OTT exchange failed: HTTP ${resp.status}\n`);
          process.exitCode = 1;
          return;
        }
        const json = (await resp.json()) as {
          data?: { apiKey?: string };
          [k: string]: unknown;
        };
        const apiKey = json?.data?.apiKey;
        if (typeof apiKey !== "string" || apiKey.length === 0) {
          process.stderr.write("OTT exchange failed: missing data.apiKey in response\n");
          process.exitCode = 1;
          return;
        }
        setConfigValueSync("apiKey", apiKey);
        process.stdout.write("apiKey set via OTT\n");
      } catch (err) {
        process.stderr.write(`OTT exchange failed: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });

  parent
    .command("projectDir [dir]")
    .description("Set project directory (will be created if missing)")
    .action(async (dir?: string) => {
      const placeholder = "~/zerocut-projects/default";
      const value = dir ?? (await ask("Enter project directory", placeholder));
      const target = path.resolve(expandHome(value.trim()));
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
      setConfigValueSync("projectDir", target);
      process.stdout.write("projectDir set\n");
    });

  parent
    .command("region [region]")
    .description("Set region (us|cn; default: us)")
    .action((region?: string) => {
      const allowed = ["us", "cn"] as const;
      const value = (region ?? "us").toLowerCase();
      if (!(allowed as readonly string[]).includes(value)) {
        process.stderr.write(`Invalid region: ${value}. Allowed: us|cn\n`);
        process.exitCode = 1;
        return;
      }
      setConfigValueSync("region", value);
      process.stdout.write("region set\n");
    });

  parent
    .command("list")
    .description("List current configuration values")
    .action(() => {
      const cfg = readConfigSync() as Record<string, unknown>;
      const masked = { ...cfg } as Record<string, unknown>;
      const k = masked.apiKey;
      if (typeof k === "string" && k.length > 0) {
        const visible = k.slice(-4);
        masked.apiKey = `${"*".repeat(Math.max(0, k.length - 4))}${visible}`;
      }
      process.stdout.write(`${JSON.stringify(masked, null, 2)}\n`);
    });
}
