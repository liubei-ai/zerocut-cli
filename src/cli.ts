import { Command } from "commander";
import { loadBuiltInCommands, loadExternalCommandsAsync } from "./services/commandLoader";
import { applyConfigInterceptor } from "./services/config";

export function createProgram(): Command {
  const program = new Command();
  program.name("zerocut").description("Zerocut CLI");

  loadBuiltInCommands(program);
  applyConfigInterceptor(program);
  return program;
}

export async function run(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const program = createProgram();
  await loadExternalCommandsAsync(program);

  if (args.length === 0) {
    await program.parseAsync([argv[0] ?? "node", argv[1] ?? "zerocut", "help"]);
    return;
  }

  await program.parseAsync(argv);
}
