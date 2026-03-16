import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";

export const name = "skill";
export const description = "Print built-in SKILL.md content";

export function register(program: Command): void {
  program
    .command("skill")
    .description("Print built-in skill markdown")
    .action(() => {
      const filePath = path.resolve(__dirname, "../skill/SKILL.md");
      const content = fs.readFileSync(filePath, "utf8");
      process.stdout.write(content);
      if (!content.endsWith("\n")) {
        process.stdout.write("\n");
      }
    });
}
