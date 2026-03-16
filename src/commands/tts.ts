import type { Command } from "commander";
import { getSessionFromCommand, syncToTOS } from "../services/cerevox";
import fs from "node:fs";
import path from "node:path";

export const name = "tts";
export const description = "TTS command: create speech audio";

export function register(program: Command): void {
  const parent = program.command("tts").description("Create speech audio; requires --text");

  async function ttsCreateAction(
    this: Command,
    opts: {
      prompt?: string;
      text?: string;
      voiceId?: string;
      output?: string;
    }
  ) {
    const session = getSessionFromCommand(this as unknown as Record<symbol, unknown>);
    if (!session) {
      process.stderr.write("No active session\n");
      return;
    }
    const text = typeof opts.text === "string" ? opts.text : undefined;
    if (!text || text.trim().length === 0) {
      process.stderr.write("Missing required option: --text\n");
      process.exitCode = 1;
      return;
    }
    const prompt = typeof opts.prompt === "string" ? opts.prompt : undefined;
    const voiceId = typeof opts.voiceId === "string" ? opts.voiceId : undefined;
    const res = await session.ai.textToSpeech({
      prompt,
      text,
      voiceId,
    });
    try {
      if (res?.url) {
        const tosUrl = await syncToTOS(res.url as string);
        if (tosUrl) {
          res.url = tosUrl;
        }
      }
    } catch (ex: unknown) {
      console.log((ex as Error).message);
    }
    const output = typeof opts.output === "string" ? opts.output : undefined;
    if (output) {
      const dir = process.cwd();
      const url = res.url;
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const filePath = path.resolve(dir, output);
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      fs.writeFileSync(filePath, buffer);
      res.output = filePath;
    }
    console.log(res);
  }

  parent
    .option("--prompt <prompt>", "Prompt for speech style/context")
    .option("--text <text>", "Text to synthesize (required)")
    .option("--voiceId <voiceId>", "Voice ID")
    .option("--output <file>", "Output file path")
    .action(ttsCreateAction);

  parent
    .command("create")
    .description("Create speech audio; requires --text")
    .option("--prompt <prompt>", "Prompt for speech style/context")
    .option("--text <text>", "Text to synthesize (required)")
    .option("--voiceId <voiceId>", "Voice ID")
    .option("--output <file>", "Output file path")
    .action(ttsCreateAction);
}
