import fs from 'node:fs';
import path from 'node:path';

/** Signed-in browser session saved by `npm run auth:login` and reused by `npm run test:order`. Git-ignored. */
export const AUTH_FILE = path.join('playwright', '.auth', 'user.json');

export function hasSavedSession(): boolean {
  return fs.existsSync(AUTH_FILE);
}
