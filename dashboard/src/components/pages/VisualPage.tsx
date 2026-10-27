'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Attachment, RunRecord, RunTestRecord } from '@/lib/types';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Card } from '../Card';
import { artifactUrl } from '../MediaFrame';
import { PageHeader, buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { CheckCircleIcon, ChevronIcon, EyeIcon, ImagesIcon, PlayIcon, RefreshIcon, XCircleIcon } from '../icons';
import { TestCaseTitle, splitTestTitle } from '../specs';
import { PageSkeleton } from './PageSkeleton';

const VISUAL_PROJECT = 'visual';

type Verdict = 'unchanged' | 'changed' | 'no-baseline' | 'skipped' | 'not-run';

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  unchanged: { label: 'Unchanged', className: 'bg-good-soft text-good-text' },
  changed: { label: 'UI changed', className: 'bg-critical-soft text-critical-text' },
  'no-baseline': { label: 'No baseline', className: 'bg-warning-soft text-warning-text' },
  skipped: { label: 'Skipped', className: 'bg-surface-2 text-ink-3' },
  'not-run': { label: 'Not run yet', className: 'bg-surface-2 text-ink-3' },
};

interface BaselineFile {
  name: string;
  kind: 'screenshot' | 'structure';
  updatedAt: string;
}

function verdictOf(test: RunTestRecord | undefined): Verdict {
  if (!test) return 'not-run';
  if (test.status === 'passed' || test.status === 'flaky') return 'unchanged';
  if (test.status === 'skipped') return 'skipped';
  return /snapshot doesn't exist|missing/i.test(test.error ?? '') ? 'no-baseline' : 'changed';
}

/** "header-diff.png (attempt 2)" -> 2; names without a suffix come from a run without retries. */
function attemptOf(attachment: Attachment): number {
  return Number(attachment.name.match(/\(attempt (\d+)\)$/)?.[1] ?? 1);
}

/** Only the final attempt's media: what the comparison concluded with. */
function finalAttempt(attachments: readonly Attachment[] = []): Attachment[] {
  const last = Math.max(1, ...attachments.map(attemptOf));
  return attachments.filter((item) => attemptOf(item) === last);
}

/** Playwright attaches "<name>-expected.png", "<name>-actual.png" and "<name>-diff.png" for a mismatch. */
function comparisonImages(attachments: readonly Attachment[] = []) {
  const media = finalAttempt(attachments);
  const find = (kind: string) =>
    media.find((item) => new RegExp(`-${kind}\\.png( \\(attempt \\d+\\))?$`).test(item.name) && item.contentType.startsWith('image/'));
  return { expected: find('expected'), actual: find('actual'), diff: find('diff') };
}

/** Plain-language reason for a failed check. */
function explain(error: string | undefined): string {
  if (/toHaveScreenshot/.test(error ?? '')) return 'This screen no longer matches the approved design.';
  if (/toMatchAriaSnapshot/.test(error ?? '')) return 'Menu names, links or buttons differ from the approved structure.';
  if (/snapshot doesn't exist/i.test(error ?? '')) return 'No approved baseline yet for this screen.';
  return 'The screen could not be compared (it did not load as expected).';
}

/** First lines of a mismatch: "65806 pixels (ratio 0.04 of all image pixels) are different." or the ARIA text diff. */
function summarizeError(error: string | undefined): string {
  return (error ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter((line) => line.trim()).slice(0, 12).join('\n');
}

/** Drag to reveal the new screenshot over the approved one. */
function CompareSlider({ before, after }: { before: string; after: string }) {
  const [position, setPosition] = useState(50);
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-line bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="Current UI" className="block w-full" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Approved UI" className="block h-full max-w-none object-cover object-left" style={{ width: `${10000 / Math.max(position, 1)}%` }} />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${position}%` }} />
        <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">Approved (old)</span>
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">Current (new)</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Compare approved and current UI"
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}

function Shot({ label, attachment }: { label: string; attachment?: Attachment }) {
  if (!attachment) return null;
  const url = artifactUrl(attachment.path);
  return (
    <figure className="min-w-0 space-y-1.5">
      <figcaption className="text-xs font-medium text-ink-2">{label}</figcaption>
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-auto rounded-lg border border-line bg-surface-2">
        {/* Full width, stacked: thin strips (header) stay readable and full pages scroll inside the frame. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="block max-h-[70vh] w-full object-contain object-left-top" loading="lazy" />
      </a>
    </figure>
  );
}

function ChangeDetails({ test }: { test: RunTestRecord }) {
  const { expected, actual, diff } = comparisonImages(test.attachments);
  const videos = finalAttempt(test.attachments).filter((item) => item.contentType.startsWith('video/'));
  const [view, setView] = useState<'side' | 'slider'>('side');

  return (
    <div className="animate-enter space-y-4 border-t border-line bg-surface-2/40 px-5 py-4">
      <div className="rounded-lg border border-critical/30 bg-critical-soft p-3 text-critical-text">
        <p className="text-sm font-medium">{explain(test.error)}</p>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-xs opacity-80">{summarizeError(test.error)}</pre>
      </div>

      {expected && actual && (
        <>
          <div className="flex gap-1">
            {(['side', 'slider'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === mode ? 'bg-accent text-on-accent' : 'bg-surface text-ink-2 hover:text-ink'}`}
              >
                {mode === 'side' ? 'Old · New · Difference' : 'Slider'}
              </button>
            ))}
          </div>
          {view === 'side' ? (
            <div className="space-y-4">
              <Shot label="Approved UI (old)" attachment={expected} />
              <Shot label="Current UI (new)" attachment={actual} />
              <Shot label="Difference (changes in red)" attachment={diff} />
            </div>
          ) : (
            <CompareSlider before={artifactUrl(expected.path)} after={artifactUrl(actual.path)} />
          )}
        </>
      )}

      {videos.map((video) => (
        <figure key={video.path} className="space-y-1.5">
          <figcaption className="text-xs font-medium text-ink-2">Video of the check</figcaption>
          <video src={artifactUrl(video.path)} controls preload="metadata" className="w-full max-w-3xl rounded-lg border border-line bg-black" />
        </figure>
      ))}
    </div>
  );
}

export function VisualPage() {
  const { results, startRun, activeRun } = useDashboard();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [baselines, setBaselines] = useState<BaselineFile[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalog = results?.catalog ?? null;
  const visualFiles = useMemo(
    () => (catalog?.files ?? []).filter((file) => file.tests.some((test) => test.project === VISUAL_PROJECT)),
    [catalog],
  );
  const checks = useMemo(
    () =>
      visualFiles
        .flatMap((file) => file.tests.filter((test) => test.project === VISUAL_PROJECT))
        .sort((a, b) => (splitTestTitle(a.title).id ?? a.title).localeCompare(splitTestTitle(b.title).id ?? b.title)),
    [visualFiles],
  );

  // Latest UI comparison (approve runs only refresh baselines, so they are not "results").
  const latestRunId = useMemo(
    () =>
      (results?.runs ?? [])
        .filter((entry) => entry.projects.includes(VISUAL_PROJECT) && !/^approve ui baseline/i.test(entry.suiteLabel))
        .reduce<RunRecord | null>((newest, entry) => (!newest || entry.startTime > newest.startTime ? entry : newest), null)
        ?.id ?? null,
    [results?.runs],
  );

  useEffect(() => {
    if (!latestRunId) return;
    fetch(`/api/runs/${encodeURIComponent(latestRunId)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<RunRecord>) : null))
      .then(setRun)
      .catch(() => setRun(null));
  }, [latestRunId]);

  useEffect(() => {
    fetch('/api/visual/baselines', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ files: BaselineFile[] }>)
      .then((payload) => setBaselines(payload.files))
      .catch(() => setBaselines([]));
  }, [results?.runs]);

  if (!results) return <PageSkeleton />;

  const outcome = new Map((run?.tests ?? []).map((test) => [`${test.file}::${test.title}`, test]));
  const verdicts = checks.map((check) => ({ check, test: outcome.get(`${check.file}::${check.title}`) }));
  const count = (verdict: Verdict) => verdicts.filter(({ test }) => verdictOf(test) === verdict).length;
  const files = visualFiles.map((file) => file.file);
  const busy = Boolean(activeRun);
  const screenshots = baselines.filter((file) => file.kind === 'screenshot');
  const approvedAt = baselines.reduce<string | null>((latest, file) => (!latest || file.updatedAt > latest ? file.updatedAt : latest), null);

  async function compare(updateSnapshots: boolean) {
    if (
      updateSnapshots &&
      !window.confirm('Approve the current UI as the new baseline? Every screen captured now becomes the "old UI" that later runs compare against.')
    ) {
      return;
    }
    setError(await startRun({ files, ...(updateSnapshots ? { updateSnapshots: true } : {}) }));
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Visual Testing"
        description="Compares each screen with its approved design (old UI) and flags anything changed or missing. Only changed screens keep their old, new and difference screenshots and a video."
        actions={
          <>
            <button type="button" onClick={() => void compare(true)} disabled={busy || files.length === 0} className={buttonStyles.secondary}>
              <RefreshIcon width={14} height={14} /> Approve current UI
            </button>
            <button type="button" onClick={() => void compare(false)} disabled={busy || files.length === 0} className={buttonStyles.primary}>
              <PlayIcon width={14} height={14} /> Run UI comparison
            </button>
          </>
        }
      />

      {error && <p className="rounded-lg bg-critical-soft px-4 py-2 text-sm text-critical-text">{error}</p>}
      {busy && (
        <p className="rounded-lg bg-accent-soft px-4 py-2 text-sm text-accent-strong">
          {activeRun?.label ?? 'A run'} is in progress. <Link href="/runs" className="font-medium underline">Watch it live</Link>; results appear here when it finishes.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Screens checked', value: checks.length, Icon: EyeIcon, tone: 'text-accent-strong' },
          { label: 'Unchanged', value: count('unchanged'), Icon: CheckCircleIcon, tone: 'text-good-text' },
          { label: 'UI changed', value: count('changed'), Icon: XCircleIcon, tone: 'text-critical-text' },
          { label: 'Approved baselines', value: screenshots.length, Icon: ImagesIcon, tone: 'text-ink-2' },
        ].map(({ label, value, Icon, tone }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">{label}</span>
              <Icon width={16} height={16} className={tone} />
            </div>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
          </Card>
        ))}
      </div>

      <Card
        flush
        title="Screens"
        subtitle={
          run
            ? `Last comparison ${formatRelative(run.startTime)} (${run.id}) · baseline approved ${approvedAt ? formatDateTime(approvedAt) : '—'}`
            : 'No comparison yet: click "Run UI comparison".'
        }
      >
        <ul className="divide-y divide-line border-t border-line">
          {verdicts.map(({ check, test }) => {
            const verdict = verdictOf(test);
            const key = `${check.file}::${check.title}`;
            const open = expanded === key;
            const canOpen = verdict === 'changed' || verdict === 'no-baseline';
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => setExpanded(open ? null : key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm enabled:hover:bg-surface-2/60"
                >
                  <ChevronIcon className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-90' : ''} ${canOpen ? '' : 'opacity-0'}`} />
                  <span className="flex min-w-0 flex-1">
                    <TestCaseTitle title={check.title} file={check.file} />
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT[verdict].className}`}>
                    {VERDICT[verdict].label}
                  </span>
                </button>
                {open && test && <ChangeDetails test={test} />}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Approved UI (baselines)" subtitle="The old UI every comparison is measured against. Approving the current UI replaces these.">
        {screenshots.length === 0 ? (
          <p className="text-sm text-ink-3">No baselines yet: click &ldquo;Approve current UI&rdquo; to capture them.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {screenshots.map((file) => {
              const url = `/api/visual/baselines?name=${encodeURIComponent(file.name)}&v=${encodeURIComponent(file.updatedAt)}`;
              return (
                <a key={file.name} href={url} target="_blank" rel="noreferrer" className="group block min-w-0">
                  <span className="block h-36 overflow-hidden rounded-lg border border-line bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={file.name} loading="lazy" className="h-full w-full object-contain object-top transition-transform duration-300 group-hover:scale-[1.02]" />
                  </span>
                  <span className="mt-1.5 block truncate font-mono text-xs text-ink-2">{file.name}</span>
                  <span className="block text-[11px] text-ink-3">{formatDateTime(file.updatedAt)}</span>
                </a>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
