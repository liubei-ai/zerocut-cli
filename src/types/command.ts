import type { Command } from "commander";

export interface CommandModule {
  name: string;
  description?: string;
  register: (program: Command) => void;
}
