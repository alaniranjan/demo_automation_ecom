import fs from 'node:fs/promises';
import path from 'node:path';
import { FRAMEWORK_DIR } from './paths';

/** The framework's git-ignored .env; playwright.config.ts loads it with dotenv. */
const ENV_FILE = path.join(FRAMEWORK_DIR, '.env');
const MOBILE_KEY = 'DEMO_MOBILE';

export interface AccountSettings {
  /** Last 4 digits only; the full number never leaves the server. */
  mobileMasked: string | null;
}

/** "+91 98765 43210", "098765-43210" or "9876543210" -> "9876543210"; null unless it is a valid Indian mobile. */
export function normalizeMobile(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function mask(mobile: string): string {
  return `••••••${mobile.slice(-4)}`;
}

async function readEnvLines(): Promise<string[]> {
  try {
    return (await fs.readFile(ENV_FILE, 'utf8')).split(/\r?\n/);
  } catch {
    return [];
  }
}

export async function readAccountSettings(): Promise<AccountSettings> {
  const line = (await readEnvLines()).find((entry) => entry.startsWith(`${MOBILE_KEY}=`));
  const mobile = line ? normalizeMobile(line.slice(MOBILE_KEY.length + 1).replace(/^["']|["']$/g, '')) : null;
  return { mobileMasked: mobile ? mask(mobile) : null };
}

/** Sets (or, with null, removes) DEMO_MOBILE in .env, keeping every other line as it was. */
export async function writeMobile(mobile: string | null): Promise<AccountSettings> {
  const lines = (await readEnvLines()).filter((entry) => !entry.startsWith(`${MOBILE_KEY}=`));
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  if (mobile) lines.push(`${MOBILE_KEY}=${mobile}`);
  await fs.writeFile(ENV_FILE, lines.length > 0 ? `${lines.join('\n')}\n` : '', { mode: 0o600 });
  return { mobileMasked: mobile ? mask(mobile) : null };
}
