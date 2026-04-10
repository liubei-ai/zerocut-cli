import { Command } from "commander";
import { register as registerHelp } from "../commands/help";
import { register as registerImage } from "../commands/image";
import { register as registerConfig } from "../commands/config";
import { register as registerVideo } from "../commands/video";
import { register as registerMusic } from "../commands/music";
import { register as registerTts } from "../commands/tts";
import { register as registerFfmpeg } from "../commands/ffmpeg";
import { register as registerPandoc } from "../commands/pandoc";
import { register as registerSkill } from "../commands/skill";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function loadBuiltInCommands(program: Command): void {
  registerHelp(program);
  registerConfig(program);
  registerImage(program);
  registerVideo(program);
  registerMusic(program);
  registerTts(program);
  registerFfmpeg(program);
  registerPandoc(program);
  registerSkill(program);
}

export async function loadExternalCommandsAsync(program: Command, dir?: string): Promise<void> {
  const d = dir ?? process.env.ZEROCUT_COMMANDS_DIR;
  if (!d) return;
  if (!fs.existsSync(d)) return;
  const files = fs.readdirSync(d).filter((f) => f.endsWith(".js") || f.endsWith(".cjs"));
  for (const f of files) {
    const full = path.join(d, f);
    try {
      const moduleSpecifier = pathToFileURL(full).href;
      const mod = (await import(moduleSpecifier)) as {
        register?: (p: Command) => void;
        default?: (p: Command) => void;
      };
      const fn = mod.register ?? mod.default;
      if (typeof fn === "function") fn(program);
    } catch {}
  }
}
