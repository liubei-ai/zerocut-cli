import { Command } from "commander";
import { register as registerHelp } from "../commands/help";
import { register as registerImage } from "../commands/image";
import { register as registerConfig } from "../commands/config";
import fs from "node:fs";
import path from "node:path";

export function loadBuiltInCommands(program: Command): void {
  registerHelp(program);
  registerConfig(program);
  registerImage(program);
}

export async function loadExternalCommandsAsync(program: Command, dir?: string): Promise<void> {
  const d = dir ?? process.env.ZEROCUT_COMMANDS_DIR;
  if (!d) return;
  if (!fs.existsSync(d)) return;
  const files = fs.readdirSync(d).filter((f) => f.endsWith(".js") || f.endsWith(".cjs"));
  for (const f of files) {
    const full = path.join(d, f);
    try {
      const mod = (await import(full)) as {
        register?: (p: Command) => void;
        default?: (p: Command) => void;
      };
      const fn = mod.register ?? mod.default;
      if (typeof fn === "function") fn(program);
    } catch {}
  }
}
