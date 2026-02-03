import { Command } from "commander";
import readline from "node:readline";
import { loadBuiltInCommands, loadExternalCommandsAsync } from "./services/commandLoader";
import { applyConfigInterceptor } from "./services/config";

export function createProgram(): Command {
  const program = new Command();
  program.name("zerocut").description("Zerocut CLI");

  loadBuiltInCommands(program);
  applyConfigInterceptor(program);
  return program;
}

export async function run(
  argv: string[],
  opts?: { prompt?: () => Promise<"foo" | "help"> }
): Promise<void> {
  const args = argv.slice(2);
  const program = createProgram();
  await loadExternalCommandsAsync(program);

  if (args.length === 0) {
    const names = program.commands.map((c) => c.name());
    const action = await (opts?.prompt ? opts.prompt() : promptChoice(names));
    await program.parseAsync([argv[0] ?? "node", argv[1] ?? "zerocut", action]);
    return;
  }

  await program.parseAsync(argv);
}

export async function promptChoice(options: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const question = (q: string) =>
    new Promise<string>((resolve) => {
      rl.question(q, (answer) => resolve(answer));
    });
  const answer = (await question(`Choose an action (${options.join("/")}): `)).trim().toLowerCase();
  rl.close();
  return options.includes(answer) ? answer : "help";
}
