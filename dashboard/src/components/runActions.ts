import type { Catalog, RunRecord, RunRequest } from '@/lib/types';

/** How to start a run again: the same npm script, or the same spec files. Null if neither exists any more. */
export function rerunRequest(run: Pick<RunRecord, 'suite' | 'args'>, catalog: Catalog | null): RunRequest | null {
  if (!catalog) return null;
  if (catalog.suites.some((suite) => suite.script === run.suite)) return { suite: run.suite };
  const known = new Set(catalog.files.map((file) => file.file));
  const files = run.args.filter((arg) => !arg.startsWith('-') && known.has(arg));
  return run.suite === 'selected' && files.length > 0 ? { files } : null;
}
