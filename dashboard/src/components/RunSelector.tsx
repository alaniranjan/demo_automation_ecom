'use client';

import { useMemo, useState } from 'react';
import type { RunRequest } from '@/lib/types';
import { Select } from './dropdowns';
import { ALL_FOLDERS, folderOptions } from './folders';
import { CheckCircleIcon, FileIcon, LayersIcon, PlayIcon } from './icons';
import { FeatureName, SpecBadges, SpecName, confirmRealOrder } from './specs';
import { buttonStyles } from './PageHeader';
import { useDashboard } from './providers/DashboardProvider';
import { targetLabel } from './browsers';
import type { TestingMode } from './BrowserPicker';
import { SuiteIcon } from './suites';

type Mode = 'suites' | 'files';

/** Choose a suite (npm script) or individual spec files from the framework's catalog, then start a run. */
export function RunSelector({
  onStarted,
  initialMode = 'suites',
  testing,
}: {
  onStarted?: () => void;
  initialMode?: Mode;
  /** Runs only desktop browsers (web) or only devices (responsive); otherwise everything selected. */
  testing?: TestingMode | undefined;
}) {
  const { results, busy, activeRun, startRun, selectedBrowsers, selectedDevices } = useDashboard();
  const browsers = testing === 'responsive' ? [] : selectedBrowsers;
  const devices = testing === 'web' ? [] : selectedDevices;
  const targets = [...browsers, ...devices];
  const browserCount = targets.length;
  const onBrowsers =
    browserCount === 1
      ? `on ${targetLabel(targets[0]!, results?.catalog?.projects ?? [])}`
      : `on ${browserCount} targets`;
  const catalog = results?.catalog ?? null;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [suite, setSuite] = useState<string | null>(null);
  const [files, setFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [folder, setFolder] = useState<string>(ALL_FOLDERS);

  const selectedSuite = catalog?.suites.find((definition) => definition.script === suite) ?? catalog?.suites[0];
  const byFeature = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof catalog>['files']>();
    for (const file of catalog?.files ?? []) groups.set(file.feature, [...(groups.get(file.feature) ?? []), file]);
    return [...groups];
  }, [catalog]);
  const selectedTests = (catalog?.files ?? [])
    .filter((file) => files.has(file.file))
    .reduce((sum, file) => sum + file.tests.length, 0);

  if (results?.meta.canRun === false) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface-2/40 p-4 text-sm text-ink-2">
        <p className="font-medium text-ink">View-only dashboard</p>
        <p className="mt-1 text-xs text-ink-3">
          Tests run on GitHub Actions on every push to main, and their results appear here.
        </p>
        {results.meta.ciUrl && (
          <a
            href={results.meta.ciUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-accent-strong hover:underline"
          >
            Open the workflow on GitHub ↗
          </a>
        )}
      </div>
    );
  }

  if (!catalog) {
    // Hosted, the catalog is published by GitHub Actions; until then there is nothing to wait for.
    if (results?.meta.mode === 'cloud') {
      return (
        <div className="rounded-xl border border-dashed border-line bg-surface-2/40 p-4 text-sm text-ink-2">
          <p className="font-medium text-ink">No test catalog published yet</p>
          <p className="mt-1 text-xs text-ink-3">
            GitHub Actions publishes the suites, spec files, browsers and devices after its next run (needs the{' '}
            <code className="font-mono">BLOB_READ_WRITE_TOKEN</code> repository secret).
          </p>
          {results.meta.ciUrl && (
            <a
              href={results.meta.ciUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-accent-strong hover:underline"
            >
              Open the workflow on GitHub ↗
            </a>
          )}
        </div>
      );
    }
    return <p className="text-sm text-ink-3">Reading the test catalog from the framework…</p>;
  }

  function toggleFile(file: string) {
    setFiles((current) => {
      const next = new Set(current);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }

  function toggleFeature(featureFiles: string[]) {
    setFiles((current) => {
      const next = new Set(current);
      const allSelected = featureFiles.every((file) => next.has(file));
      featureFiles.forEach((file) => (allSelected ? next.delete(file) : next.add(file)));
      return next;
    });
  }

  async function start() {
    const request: RunRequest | null =
      mode === 'suites'
        ? selectedSuite
          ? { suite: selectedSuite.script }
          : null
        : files.size > 0
          ? { files: [...files] }
          : null;
    if (!request) return;
    if ('files' in request && !confirmRealOrder((catalog?.files ?? []).filter((file) => request.files.includes(file.file)))) return;
    setPending(true);
    const message = await startRun(testing ? { browsers, devices, ...request } : request);
    setPending(false);
    setError(message);
    if (!message) onStarted?.();
  }

  const blocked = busy || Boolean(activeRun);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Run by" className="grid grid-cols-2 rounded-xl bg-surface-2 p-1">
        {(
          [
            ['suites', 'Suites', LayersIcon],
            ['files', 'Spec files', FileIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
              mode === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
            }`}
          >
            <Icon width={15} height={15} /> {label}
          </button>
        ))}
      </div>

      {mode === 'suites' ? (
        <fieldset className="space-y-2" disabled={blocked}>
          <legend className="sr-only">Suite</legend>
          {catalog.suites.map((definition) => {
            const isSelected = selectedSuite?.script === definition.script;
            return (
              <label
                key={definition.script}
                className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-200 ease-smooth has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                  isSelected
                    ? 'border-accent bg-accent-soft'
                    : 'border-line hover:-translate-y-px hover:border-accent/40 hover:shadow-md'
                }`}
              >
                <input
                  type="radio"
                  name="suite"
                  checked={isSelected}
                  onChange={() => setSuite(definition.script)}
                  className="sr-only"
                />
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-lg transition-colors duration-200 ${
                    isSelected ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2 group-hover:text-accent-strong'
                  }`}
                >
                  <SuiteIcon script={definition.script} width={18} height={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{definition.label}</span>
                  <span className="block truncate font-mono text-xs text-ink-3">npm run {definition.script}</span>
                </span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-ink-2">
                  {definition.count} {definition.count === 1 ? 'test' : 'tests'}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <div className="space-y-3">
          <Select
            label="Folder"
            value={folder}
            onChange={setFolder}
            options={folderOptions(catalog)}
            className="w-full"
          />
          <fieldset className="max-h-80 space-y-4 overflow-y-auto pr-1" disabled={blocked}>
            <legend className="sr-only">Spec files</legend>
            {byFeature
              .filter(([feature]) => folder === ALL_FOLDERS || feature === folder)
              .map(([feature, featureFiles]) => {
                const names = featureFiles.map((file) => file.file);
                const allSelected = names.every((name) => files.has(name));
                return (
                  <div key={feature}>
                    <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleFeature(names)}
                        className="size-3.5 accent-[var(--accent)]"
                      />
                      <FeatureName feature={feature} />
                    </label>
                    <div className="space-y-1.5">
                      {featureFiles.map((file) => (
                        <label
                          key={file.file}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-all duration-200 ${
                            files.has(file.file) ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={files.has(file.file)}
                            onChange={() => toggleFile(file.file)}
                            className="size-4 accent-[var(--accent)]"
                          />
                          <span className="min-w-0 flex-1">
                            <SpecName file={file.file} />
                          </span>
                          <SpecBadges file={file} />
                          <span className="text-xs tabular-nums text-ink-3">{file.tests.length} tests</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
          </fieldset>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void start()}
          disabled={blocked || pending || browserCount === 0 || (mode === 'files' && files.size === 0)}
          className={`${buttonStyles.primary} flex-1 py-2.5`}
        >
          <PlayIcon width={14} height={14} />
          {browserCount === 0
            ? `Select a ${testing === 'web' ? 'browser' : 'device'} to run on`
            : mode === 'suites'
              ? `Run ${selectedSuite?.label ?? ''} ${onBrowsers} (${(selectedSuite?.count ?? 0) * browserCount})`
              : files.size > 0
                ? `Run ${files.size} file${files.size === 1 ? '' : 's'} ${onBrowsers} (${selectedTests * browserCount} tests)`
                : 'Select spec files'}
        </button>
      </div>
      {blocked && (
        <p className="flex items-center gap-2 text-xs text-ink-3">
          <CheckCircleIcon width={14} height={14} className="text-accent" /> A run is in progress; you can start another
          when it finishes.
        </p>
      )}
      {error && <p className="text-sm text-critical-text">{error}</p>}
    </div>
  );
}
