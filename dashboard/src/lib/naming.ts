/** Display names derived from data (folder names, script names, hosts), shared by server and client. */

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** "auth/login.spec.ts" -> "Auth", "checkout-flow/x.spec.ts" -> "Checkout flow". */
export function featureFromFile(file: string): string {
  const folder = file.split(/[\\/]/).length > 1 ? (file.split(/[\\/]/)[0] ?? '') : 'General';
  return capitalize(folder.replace(/[-_]+/g, ' '));
}

/** "test" -> "All tests", "test:smoke" -> "Smoke", "test:e2e" -> "E2E", "test:api-contract" -> "Api contract". */
export function labelFromScript(script: string): string {
  if (script === 'test') return 'All tests';
  const name = script.replace(/^test:/, '').replace(/[-_:]+/g, ' ');
  return name.length <= 3 ? name.toUpperCase() : capitalize(name);
}

/** "https://demo.honebi.online" -> "Demo honebi". */
export function projectNameFromUrl(url: string | null, fallback: string): string {
  if (!url) return fallback;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const name = host.split('.').slice(0, -1).join(' ') || host;
    return capitalize(name);
  } catch {
    return fallback;
  }
}
