import { existsSync } from "node:fs";
import { join } from "node:path";

/** Ort des vorbereiteten Anmeldezustands (nur Testumgebung, nie im Repo). */
export const AUTH_STATE_PATH = join(process.cwd(), "tests", "e2e", ".artifacts", "auth.json");

/** Steht eine Testsitzung zur Verfügung? */
export function hasAuthState(): boolean {
  return existsSync(AUTH_STATE_PATH);
}
