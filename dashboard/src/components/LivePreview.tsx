'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatDuration } from '@/lib/format';
import type { LiveRunningTest, ProjectInfo } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { TargetIcon, targetLabel } from './browsers';
import { Card } from './Card';
import { DeviceFrame } from './DeviceFrame';
import { Select } from './dropdowns';
import { EyeIcon, EyeOffIcon, LoaderIcon } from './icons';
import { useDashboard } from './providers/DashboardProvider';

const FRAME_REFRESH_MS = 400;
const FRAME_RETRY_MS = 900;
/** Value of the "Watching" dropdown that follows whichever test started most recently. */
const FOLLOW_NEWEST = 'newest';
const ZOOM_OPTIONS = [
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
  { value: '1.25', label: '125%' },
];

/** The eye switch: on streams the browser into the dashboard, off runs tests in the background with logs only. */
export function PreviewToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { livePreview, setLivePreview } = useDashboard();
  const Icon = livePreview ? EyeIcon : EyeOffIcon;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={livePreview}
      onClick={() => setLivePreview(!livePreview)}
      title={
        livePreview
          ? 'Live preview on: the browser is shown while tests run'
          : 'Live preview off: tests run in the background'
      }
      className={`inline-flex items-center gap-2 rounded-lg border font-medium transition-all duration-200 ${
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'
      } ${
        livePreview
          ? 'border-accent bg-accent-soft text-accent-strong'
          : 'border-line text-ink-3 hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <Icon width={size === 'sm' ? 14 : 16} height={size === 'sm' ? 14 : 16} />
      Live preview {livePreview ? 'on' : 'off'}
    </button>
  );
}

/** Polls the latest snapshot of one worker slot; keeps showing the previous frame until the next one loads. */
function FrameImage({
  slot,
  title,
  className = 'aspect-video w-full',
}: {
  slot: number;
  title: string;
  className?: string;
}) {
  const [tick, setTick] = useState(0);
  const [hasFrame, setHasFrame] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const next = (delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTick((value) => value + 1), delay);
  };

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {/* Frames are JPEG snapshots served by the dashboard's backend, so next/image does not apply. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/live/frame?slot=${slot}&t=${tick}`}
        alt={`Live view: ${title}`}
        onLoad={() => {
          setHasFrame(true);
          next(FRAME_REFRESH_MS);
        }}
        onError={() => next(FRAME_RETRY_MS)}
        className={`size-full object-contain transition-opacity duration-300 ${hasFrame ? 'opacity-100' : 'opacity-0'}`}
      />
      {!hasFrame && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/60">
          <span className="inline-flex items-center gap-2">
            <LoaderIcon width={16} height={16} className="animate-spin [animation-duration:2.5s]" /> Waiting for the
            first frame…
          </span>
        </div>
      )}
      <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-critical px-2 py-0.5 text-[11px] font-semibold text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
      </span>
    </div>
  );
}

/** The watched test: a phone/tablet frame for emulated devices, otherwise a desktop browser window. */
function BrowserWindow({
  test,
  now,
  projects,
  zoom,
}: {
  test: LiveRunningTest;
  now: number | null;
  projects: readonly ProjectInfo[];
  zoom: number;
}) {
  const project = projects.find((entry) => entry.name === test.project);
  const label = targetLabel(test.project, projects);
  const elapsed = now === null ? null : formatDuration(Math.max(0, now - new Date(test.startedAt).getTime()));

  if (project?.kind === 'device') {
    return (
      <figure className="animate-enter flex flex-col items-center gap-4 rounded-xl bg-[radial-gradient(circle_at_50%_30%,var(--surface-2),transparent_70%)] py-6">
        {/* Keyed by test so switching tests (or a slot moving to its next test) starts with a fresh frame. */}
        <DeviceFrame project={project} zoom={zoom}>
          <FrameImage key={test.id} slot={test.parallelIndex} title={test.title} className="size-full" />
        </DeviceFrame>
        <figcaption className="max-w-full space-y-1 px-3 text-center">
          <p className="truncate text-sm font-medium text-ink">{test.title}</p>
          <p className="flex items-center justify-center gap-1.5 truncate text-xs text-ink-3">
            <TargetIcon name={test.project} projects={projects} width={14} height={14} />
            {label} · {project.os} · {project.viewport?.width}×{project.viewport?.height}
            {elapsed && ` · ${elapsed}`}
          </p>
          <p className="truncate font-mono text-xs text-ink-3">{test.step ?? 'Starting'}</p>
          <p className="truncate font-mono text-[11px] text-ink-3/80">{test.url ?? 'about:blank'}</p>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="animate-enter overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <TargetIcon name={test.project} projects={projects} width={15} height={15} className="ml-1 shrink-0" />
        <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-2">
          {test.url ?? 'about:blank'}
        </span>
        {elapsed && <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{elapsed}</span>}
      </div>
      {/* Keyed by test so switching tests (or a slot moving to its next test) starts with a fresh frame. */}
      <FrameImage key={test.id} slot={test.parallelIndex} title={test.title} />
      <figcaption className="space-y-0.5 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-ink">{test.title}</p>
        <p className="truncate font-mono text-xs text-ink-3">
          {label} · {test.step ?? 'Starting'}
        </p>
      </figcaption>
    </figure>
  );
}

function Banner({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface-2/40 px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-3">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink-3">{text}</p>
      </div>
    </div>
  );
}

/**
 * One live frame of a running test, following the newest test by default; the "Watching" dropdown switches to any
 * other running test. Shows a banner when there is nothing to show.
 */
export function LivePreview() {
  const { livePreview, activeRun, run, live, results } = useDashboard();
  const now = useNow(1000);
  const [watching, setWatching] = useState<string>(FOLLOW_NEWEST);
  const [zoom, setZoom] = useState('1');
  const projects = results?.catalog?.projects ?? [];
  const running = (live?.active ? live.running : []).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  // A watched test that has finished falls back to following the newest one that has opened a page.
  const current = running.find((test) => test.id === watching) ?? running.find((test) => test.url) ?? running[0];
  // Dashboard runs say whether they stream frames; terminal runs stream only if started with LIVE_PREVIEW=1.
  const runStreams = activeRun?.source === 'terminal' || Boolean(run?.preview);

  let body: ReactNode;
  if (!livePreview) {
    body = (
      <Banner
        icon={<EyeOffIcon width={22} height={22} />}
        title="Live preview is off"
        text="Tests run in the background; follow them in the live logs below. Turn on the eye to watch the browser here."
      />
    );
  } else if (!activeRun) {
    body = (
      <Banner
        icon={<EyeIcon width={22} height={22} />}
        title="No preview"
        text="Nothing is running. Start a run to watch the browser live here."
      />
    );
  } else if (activeRun.phase === 'reporting') {
    body = (
      <Banner
        icon={<LoaderIcon width={22} height={22} />}
        title="Tests finished"
        text="Generating the Allure report…"
      />
    );
  } else if (!runStreams && results?.meta.mode === 'cloud') {
    // Hosted, the stream starts once the GitHub runner has set up and opened its tunnel.
    body = (
      <Banner
        icon={<LoaderIcon width={22} height={22} className="animate-spin [animation-duration:2.5s]" />}
        title="Preparing the GitHub Actions runner…"
        text="The preview appears once the runner has installed the browsers and started the tests (about a minute). Runs started with live preview off, or by a push to main, have no preview."
      />
    );
  } else if (!runStreams) {
    body = (
      <Banner
        icon={<EyeOffIcon width={22} height={22} />}
        title="No preview for this run"
        text="This run started with live preview off. The preview appears from the next run."
      />
    );
  } else if (!current) {
    body = (
      <Banner
        icon={<LoaderIcon width={22} height={22} className="animate-spin [animation-duration:2.5s]" />}
        title="Starting browsers…"
        text="The preview appears as soon as the first test opens a page."
      />
    );
  } else {
    body = <BrowserWindow test={current} now={now} projects={projects} zoom={Number(zoom)} />;
  }

  const options = [
    { value: FOLLOW_NEWEST, label: 'Newest test (auto)', description: 'Follows the latest test that opened a page' },
    ...running.map((test) => ({ value: test.id, label: test.title, description: targetLabel(test.project, projects) })),
  ];

  return (
    <Card
      title="Live preview"
      subtitle={
        livePreview ? (current ? `${running.length} test${running.length === 1 ? '' : 's'} running` : 'On') : 'Off'
      }
      actions={
        livePreview &&
        current && (
          <div className="flex flex-wrap items-center gap-2">
            {projects.find((entry) => entry.name === current.project)?.kind === 'device' && (
              <Select
                label="Zoom"
                value={zoom}
                onChange={setZoom}
                options={ZOOM_OPTIONS}
                className="w-32"
                align="end"
              />
            )}
            {running.length > 1 && (
              <Select
                label="Watching"
                value={running.some((test) => test.id === watching) ? watching : FOLLOW_NEWEST}
                onChange={setWatching}
                options={options}
                className="w-64"
                align="end"
              />
            )}
          </div>
        )
      }
    >
      {body}
    </Card>
  );
}
