import type { Command } from "commander";

export const name = "help";
export const description = "Show help";

export function register(program: Command): void {
  program
    .command("help")
    .description("Show help")
    .action(() => {
      program.outputHelp();
    });
}
