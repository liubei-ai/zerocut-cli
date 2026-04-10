import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";

export const name = "skill";
export const description = "Print built-in SKILL.md content";

function printSkill(relativePath: string): void {
  const filePath = path.resolve(__dirname, relativePath);
  const content = fs.readFileSync(filePath, "utf8");
  process.stdout.write(content);
  if (!content.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

export function register(program: Command): void {
  const parent = program.command("skill").description("Print built-in skill markdown");

  parent
    .command("one-click-video")
    .description("Print one-click-video skill markdown")
    .action(() => {
      printSkill("../skill/one-click-video/SKILL.md");
    });

  parent
    .command("edit-video")
    .description("Print edit-video skill markdown")
    .action(() => {
      printSkill("../skill/edit-video/SKILL.md");
    });

  parent.action(() => {
    printSkill("../skill/SKILL.md");
    process.stdout.write(
      "\nPlease save the markdown above to zerocut/SKILL.md to create the skill.\n"
    );
  });
}
