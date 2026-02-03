import type { Command } from "commander";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import { setConfigValueSync } from "../services/config";

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
    .description("Set API key (get one at workspace.zerocut.cn)")
    .action(async (key?: string) => {
      const value = (key ?? (await ask("Enter API key (get one at workspace.zerocut.cn)"))).trim();
      if (value.length === 0) return;
      setConfigValueSync("apiKey", value);
      process.stdout.write("apiKey set\n");
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
}
