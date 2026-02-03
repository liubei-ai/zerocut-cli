import { Cerevox, type Session } from "cerevox";
import { getConfigValueSync, setConfigValueSync } from "./config";

export const SESSION_SYMBOL = Symbol("zerocut.session");

export function attachSessionToCommand(cmd: { [k: symbol]: unknown }, session: Session): void {
  cmd[SESSION_SYMBOL] = session as unknown;
}

export function getSessionFromCommand(cmd: { [k: symbol]: unknown }): Session | undefined {
  return cmd[SESSION_SYMBOL] as Session | undefined;
}

export function getApiKey(): string {
  const v = getConfigValueSync("apiKey");
  return typeof v === "string" ? v : "";
}

export async function openSession(): Promise<Session> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("apiKey is not set");
  }
  const cerevox = new Cerevox({
    apiKey,
  });
  let sandboxId = getConfigValueSync("sandboxId") as string | undefined;
  if (sandboxId) {
    try {
      return await cerevox.connect(sandboxId, 300_000);
    } catch {
      sandboxId = undefined;
    }
  }
  const session = await cerevox.launch({ timeout: 60 });
  sandboxId = session.sandbox.sandboxId!;
  setConfigValueSync("sandboxId", sandboxId);
  return session;
}

export async function closeSession(session: Session) {
  await session.close();
}
