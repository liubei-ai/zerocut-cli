import type { Command } from "commander";
import readline from "node:readline";
import { readConfigSync, setConfigValueSync } from "../services/config";

export const name = "config";
export const description = "Configuration management";

async function ask(question: string, defaults?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = defaults ? `${question} [${defaults}]: ` : `${question}: `;
  const answer = await new Promise<string>((resolve) => rl.question(q, (ans) => resolve(ans)));
  rl.close();
  const trimmed = answer.trim();
  return trimmed.length > 0 ? trimmed : (defaults ?? "");
}

async function exchangeOttAndSave(ott: string, region: "cn" | "us"): Promise<void> {
  const base = region === "cn" ? "https://api2.zerocut.cn" : "https://api2.zerocut.art";
  const resp = await fetch(`${base}/api/open/ott/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ott }),
  });
  if (!resp.ok) {
    process.stderr.write(`OTT exchange failed: HTTP ${resp.status}\n`);
    process.exitCode = 1;
    return;
  }
  const json = (await resp.json()) as { data?: { apiKey?: string } };
  const apiKey = json?.data?.apiKey;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    process.stderr.write("OTT exchange failed: missing data.apiKey in response\n");
    process.exitCode = 1;
    return;
  }
  setConfigValueSync("apiKey", apiKey);
  setConfigValueSync("region", region);
  process.stdout.write("apiKey set via OTT\n");
}

export function register(program: Command): void {
  const parent = program
    .command("config")
    .description("Configuration management: set key, projectDir, and region")
    .option("--ott <token>", "One-Time Token (OTT) for fetching API key")
    .option("--region <region>", "Region for OTT exchange: cn|us")
    .action(async function (this: Command, opts: { ott?: string; region?: string }) {
      const cfg = readConfigSync() as { region?: unknown };
      const regionInput = typeof opts.region === "string" ? opts.region.trim().toLowerCase() : "";
      let region: "cn" | "us";
      if (regionInput === "cn" || regionInput === "us") {
        region = regionInput;
      } else if (regionInput.length > 0) {
        process.stderr.write("Invalid --region. Allowed: cn|us\n");
        process.exitCode = 1;
        return;
      } else {
        const defaultRegion = cfg.region === "cn" || cfg.region === "us" ? cfg.region : "us";
        const regionAnswer = (await ask("Choose region (cn/us)", defaultRegion))
          .trim()
          .toLowerCase();
        if (regionAnswer !== "cn" && regionAnswer !== "us") {
          process.stderr.write("Invalid region. Allowed: cn|us\n");
          process.exitCode = 1;
          return;
        }
        region = regionAnswer;
      }
      const ott = typeof opts.ott === "string" ? opts.ott.trim() : "";
      const ottValue = ott.length > 0 ? ott : (await ask("Enter One-Time Token (OTT)")).trim();
      if (!ottValue) {
        process.stderr.write("OTT is required\n");
        process.exitCode = 1;
        return;
      }
      try {
        await exchangeOttAndSave(ottValue, region);
      } catch (err) {
        process.stderr.write(`OTT exchange failed: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });

  parent
    .command("key [key]")
    .description(
      "Set API key. If omitted, exchange via One-Time Token (OTT) after choosing region."
    )
    .action(async (key?: string) => {
      const direct = typeof key === "string" ? key.trim() : "";
      if (direct.length > 0) {
        setConfigValueSync("apiKey", direct);
        process.stdout.write("apiKey set\n");
        return;
      }
      const region = (await ask("Choose region (cn/us)", "us")).trim().toLowerCase();
      if (region !== "cn" && region !== "us") {
        process.stderr.write("Invalid region. Allowed: cn|us\n");
        process.exitCode = 1;
        return;
      }
      const ott = (await ask("Enter One-Time Token (OTT)")).trim();
      if (!ott) {
        process.stderr.write("OTT is required when no apiKey is provided\n");
        process.exitCode = 1;
        return;
      }
      try {
        await exchangeOttAndSave(ott, region);
      } catch (err) {
        process.stderr.write(`OTT exchange failed: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
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
