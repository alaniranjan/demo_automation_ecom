'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateTime, formatStartTime } from '@/lib/format';
import type { Attachment, RunRecord, TestStatus } from '@/lib/types';
import { Select } from '../dropdowns';
import { ALL_FOLDERS, folderOptions } from '../folders';
import {
  CameraIcon,
  DownloadIcon,
  ExternalIcon,
  FileIcon,
  HistoryIcon,
  SearchIcon,
  TrashIcon,
  VideoIcon,
} from '../icons';
import { EmptyState, PageHeader, buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { StatusBadge } from '../status';
import { MediaFrame, artifactUrl as url } from '../MediaFrame';
import { mediaLabel } from '../TestMedia';
import { Modal } from '../ui';
import { PageSkeleton } from './PageSkeleton';

type Kind = 'screenshot' | 'video' | 'trace' | 'other';

const KIND_META: Record<Kind, { label: string; Icon: typeof CameraIcon }> = {
  screenshot: { label: 'Screenshots', Icon: CameraIcon },
  video: { label: 'Videos', Icon: VideoIcon },
  trace: { label: 'Traces', Icon: FileIcon },
  other: { label: 'Other', Icon: FileIcon },
};

function kindOf(attachment: Attachment): Kind {
  if (attachment.contentType.startsWith('image/')) return 'screenshot';
  if (attachment.contentType.startsWith('video/')) return 'video';
  if (attachment.name.startsWith('trace') || attachment.contentType.includes('zip')) return 'trace';
  return 'other';
}

/** Value of the run dropdown for the latest results in test-results/. */
const LATEST = 'latest';

interface ArtifactTest {
  title: string;
  feature: string;
  status: TestStatus;
  /** Playwright project (browser or device); missing on runs stored before it was recorded. */
  project?: string | undefined;
  attachments: Attachment[];
}

export function ArtifactsPage() {
  const { results, refresh } = useDashboard();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<string>(ALL_FOLDERS);
  const [runId, setRunId] = useState<string>(LATEST);
  const [storedRun, setStoredRun] = useState<RunRecord | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);

  // Archived media of a stored run comes from /api/runs/{id}.
  useEffect(() => {
    if (runId === LATEST) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingRun(true);
    fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<RunRecord>) : null))
      .then((run) => !cancelled && setStoredRun(run))
      .finally(() => !cancelled && setLoadingRun(false));
    return () => {
      cancelled = true;
    };
  }, [runId, reloadKey]);

  const sourceTests: ArtifactTest[] = useMemo(() => {
    if (runId === LATEST) return results?.tests ?? [];
    const tests = storedRun?.id === runId ? (storedRun.tests ?? []) : [];
    return tests.map((test) => ({
      ...test,
      attachments: test.attachments ?? [],
    }));
  }, [runId, results, storedRun]);

  const artifacts = useMemo(
    () =>
      sourceTests.flatMap((test) =>
        test.attachments.map((attachment) => ({
          attachment,
          test,
          kind: kindOf(attachment),
        })),
      ),
    [sourceTests],
  );

  if (!results) return <PageSkeleton />;
  const projects = results.catalog?.projects ?? [];

  const runOptions = [
    {
      value: LATEST,
      label: 'Latest results',
      description: 'test-results/',
      icon: FileIcon,
    },
    ...[...results.runs].reverse().map((run) => ({
      value: run.id,
      label: run.id,
      description: `${run.suiteLabel} · ${formatStartTime(run.startTime)}`,
      icon: HistoryIcon,
    })),
  ];

  const counts = artifacts.reduce<Record<string, number>>(
    (acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] ?? 0) + 1 }),
    {},
  );
  const needle = query.trim().toLowerCase();
  const visible = artifacts.filter(
    (item) =>
      (kind === 'all' || item.kind === kind) &&
      (folder === ALL_FOLDERS || item.test.feature === folder) &&
      (!needle || `${item.test.title} ${item.test.feature}`.toLowerCase().includes(needle)),
  );
  const visiblePaths = visible.map((item) => item.attachment.path);
  const selectedVisible = visiblePaths.filter((itemPath) => selected.has(itemPath));
  const allVisibleSelected = visiblePaths.length > 0 && selectedVisible.length === visiblePaths.length;

  function toggle(itemPath: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemPath)) next.delete(itemPath);
      else next.add(itemPath);
      return next;
    });
  }

  function askDelete(paths: string[]) {
    setDeleteError(null);
    setPendingDelete(paths);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const response = await fetch('/api/artifacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: pendingDelete }),
    });
    setDeleting(false);
    if (!response.ok) {
      setDeleteError(
        ((await response.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${response.status}`,
      );
      return;
    }
    setSelected((current) => new Set([...current].filter((itemPath) => !pendingDelete.includes(itemPath))));
    setPendingDelete(null);
    if (runId === LATEST) await refresh();
    else setReloadKey((value) => value + 1);
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Artifacts"
        description={
          runId !== LATEST
            ? `Archived screenshots, videos and traces of run ${runId}.`
            : results.summary
              ? `Screenshots, videos and traces from the run on ${formatDateTime(results.summary.startTime)}.`
              : 'Screenshots, videos and traces from the latest run.'
        }
        actions={
          <Select label="Run" value={runId} onChange={setRunId} options={runOptions} className="w-64" align="end" />
        }
      />

      {loadingRun && runId !== LATEST ? (
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-surface" />
      ) : artifacts.length === 0 ? (
        <EmptyState
          title={runId === LATEST ? 'No artifacts in the latest run' : `No archived media for ${runId}`}
          description={
            runId === LATEST
              ? 'No test in the latest run attached a screenshot, video or trace.'
              : 'Media is archived for recent runs only; older runs and runs recorded before archiving keep their results but not their files.'
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="radiogroup" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
              {(['all', 'screenshot', 'video', 'trace', 'other'] as const)
                .filter((option) => option === 'all' || counts[option])
                .map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={kind === option}
                    onClick={() => setKind(option)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-all duration-200 ${
                      kind === option
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-line text-ink-2 hover:bg-surface-2'
                    }`}
                  >
                    {option === 'all' ? 'All' : KIND_META[option].label}
                    <span className="tabular-nums text-ink-3">
                      {option === 'all' ? artifacts.length : counts[option]}
                    </span>
                  </button>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                label="Folder"
                value={folder}
                onChange={setFolder}
                options={folderOptions(results.catalog, results.tests)}
                className="w-48"
                align="end"
              />
              <label className="relative">
                <span className="sr-only">Search by test</span>
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by test"
                  className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 sm:w-60"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    visiblePaths.forEach((itemPath) =>
                      allVisibleSelected ? next.delete(itemPath) : next.add(itemPath),
                    );
                    return next;
                  })
                }
                className="size-4 accent-[var(--accent)]"
              />
              {selectedVisible.length > 0
                ? `${selectedVisible.length} of ${visiblePaths.length} selected`
                : `Select all ${visiblePaths.length} shown`}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={selectedVisible.length === 0}
                onClick={() => askDelete(selectedVisible)}
                className={`${buttonStyles.secondary} text-critical-text`}
              >
                <TrashIcon width={14} height={14} /> Delete selected ({selectedVisible.length})
              </button>
              <button
                type="button"
                disabled={visiblePaths.length === 0}
                onClick={() => askDelete(visiblePaths)}
                className={`${buttonStyles.secondary} text-critical-text`}
              >
                <TrashIcon width={14} height={14} /> Delete all shown ({visiblePaths.length})
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map(({ attachment, test, kind: itemKind }) => {
              const { Icon } = KIND_META[itemKind];
              const project = projects.find((entry) => entry.name === test.project);
              const device = project?.kind === 'device';
              return (
                <figure
                  key={attachment.path}
                  className={`group overflow-hidden rounded-xl border bg-surface shadow-card transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-lg ${
                    selected.has(attachment.path)
                      ? 'border-accent ring-2 ring-accent/30'
                      : 'border-line hover:border-accent/40'
                  }`}
                >
                  <div
                    className={`relative grid place-items-center overflow-hidden bg-surface-2 ${
                      itemKind === 'screenshot' || itemKind === 'video' ? 'px-4 pb-4 pt-10' : 'aspect-video'
                    }`}
                  >
                    {itemKind === 'screenshot' || itemKind === 'video' ? (
                      <div
                        className={device ? '' : 'w-full transition-transform duration-300 group-hover:scale-[1.02]'}
                      >
                        <MediaFrame attachment={attachment} project={project} title={test.title} zoom={0.5} />
                      </div>
                    ) : (
                      <Icon width={36} height={36} className="text-ink-3" />
                    )}
                    <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                      <input
                        type="checkbox"
                        checked={selected.has(attachment.path)}
                        onChange={() => toggle(attachment.path)}
                        aria-label={`Select ${mediaLabel(attachment)} of ${test.title}`}
                        className="size-3.5 accent-[var(--accent)]"
                      />
                      {mediaLabel(attachment)}
                    </label>
                  </div>
                  <figcaption className="space-y-2 p-4">
                    <p className="line-clamp-2 text-sm font-medium text-ink">{test.title}</p>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={test.status} />
                      <span className="truncate text-xs text-ink-3">{test.feature}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <a
                        href={url(attachment.path)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
                      >
                        <ExternalIcon width={13} height={13} /> Open
                      </a>
                      <a
                        href={url(attachment.path)}
                        download
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
                      >
                        <DownloadIcon width={13} height={13} /> Download
                      </a>
                      <button
                        type="button"
                        onClick={() => askDelete([attachment.path])}
                        aria-label={`Delete ${mediaLabel(attachment)} of ${test.title}`}
                        title="Delete"
                        className="inline-flex items-center justify-center rounded-lg border border-line px-2.5 py-1.5 text-critical-text transition-colors hover:border-critical/50 hover:bg-critical-soft"
                      >
                        <TrashIcon width={13} height={13} />
                      </button>
                    </div>
                  </figcaption>
                </figure>
              );
            })}
          </div>
          {visible.length === 0 && <p className="text-center text-sm text-ink-3">No artifacts match these filters.</p>}
        </>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={`Delete ${pendingDelete?.length ?? 0} artifact${pendingDelete?.length === 1 ? '' : 's'}?`}
        size="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setPendingDelete(null)} className={buttonStyles.secondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className={`${buttonStyles.primary} bg-critical hover:bg-critical`}
            >
              <TrashIcon width={14} height={14} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {pendingDelete?.length === 1 ? 'This file' : `These ${pendingDelete?.length ?? 0} files`} will be permanently
          deleted from {runId === LATEST ? 'the latest results' : `run ${runId}`}. The test results themselves are kept.
        </p>
        {deleteError && <p className="mt-3 text-sm text-critical-text">{deleteError}</p>}
      </Modal>
    </div>
  );
}
