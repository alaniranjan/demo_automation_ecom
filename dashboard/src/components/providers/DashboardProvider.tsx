'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LiveState, ResultsPayload, RunPhase, RunRequest, RunState, RunStatePayload } from '@/lib/types';

const RESULTS_REFRESH_MS = 15_000;
const RUN_POLL_ACTIVE_MS = 1_000;
const RUN_POLL_IDLE_MS = 3_000;
/** Hosted, run state comes from the GitHub API, which changes slowly and is rate limited. */
const CLOUD_POLL_ACTIVE_MS = 2_000;
const CLOUD_POLL_IDLE_MS = 10_000;
const HEALTH_POLL_MS = 10_000;
const MAX_CONSOLE_LINES = 3000;

export function isBusyPhase(phase: RunPhase | undefined): boolean {
  return phase === 'running' || phase === 'reporting';
}

/** The run currently executing, whether started here or from a terminal. */
export interface ActiveRun {
  runId: string | null;
  label: string;
  startedAt: string;
  source: 'dashboard' | 'terminal';
  phase: RunPhase;
}

interface DashboardContextValue {
  results: ResultsPayload | null;
  loadError: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  backendOnline: boolean | null;
  run: RunState | null;
  live: LiveState | null;
  activeRun: ActiveRun | null;
  lines: string[];
  /** A dashboard-started run is executing (so it can be cancelled). */
  busy: boolean;
  /** Resolves to an error message, or null when the run started. */
  startRun: (request: RunRequest) => Promise<string | null>;
  cancelRun: () => Promise<void>;
  runDialogOpen: boolean;
  setRunDialogOpen: (open: boolean) => void;
  viewedRunId: string | null;
  viewRun: (runId: string | null) => void;
  /** Browsers every run uses (keys from catalog.projects); remembered per viewer. */
  selectedBrowsers: string[];
  /** Emulated devices every run uses (keys from catalog.projects of kind "device"); remembered per viewer. */
  selectedDevices: string[];
  setSelectedDevices: (devices: string[]) => void;
  setSelectedBrowsers: (browsers: string[]) => void;
  /** Resolves to an error message, or null when the install started. */
  installBrowser: (browser: string) => Promise<string | null>;
  /** Stream the browser into the dashboard while tests run; remembered per viewer. */
  livePreview: boolean;
  setLivePreview: (enabled: boolean) => void;
  /** Browser window size key (catalog.recordingSizes); remembered per viewer. */
  selectedSize: string;
  setSelectedSize: (size: string) => void;
  /** The run that just finished, for the completion notification; null once dismissed. */
  completedRun: CompletedRun | null;
  dismissCompletedRun: () => void;
}

export interface CompletedRun {
  runId: string;
  /** Final phase for dashboard runs; 'finished' for terminal runs (the stored counts say how it went). */
  phase: RunPhase | 'finished';
  /** Increments per completion so the same toast can show again for a new run. */
  sequence: number;
}

const BROWSERS_KEY = 'run-browsers';
const DEVICES_KEY = 'run-devices';
const PREVIEW_KEY = 'live-preview';
const SIZE_KEY = 'run-size';

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used inside <DashboardProvider>');
  return context;
}

/** Owns all polling, so every page and the shell share one view of results, live runs and backend health. */
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [viewedRunId, viewRun] = useState<string | null>(null);
  const [selectedBrowsers, setSelectedBrowsersState] = useState<string[]>([]);
  const [selectedDevicesChoice, setSelectedDevicesState] = useState<string[]>([]);
  const [livePreview, setLivePreviewState] = useState(true);
  const [sizeChoice, setSizeChoice] = useState<string | null>(null);
  const [completedRun, setCompletedRun] = useState<CompletedRun | null>(null);

  const offsetRef = useRef(0);
  const runIdRef = useRef(-1);
  const activeRef = useRef(false);
  const cloudRef = useRef(false);
  const lastActiveRef = useRef<{ runId: string | null; source: 'dashboard' | 'terminal' }>({
    runId: null,
    source: 'dashboard',
  });
  const completionCount = useRef(0);
  const wakeRef = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/results', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as ResultsPayload;
      cloudRef.current = payload.meta.mode === 'cloud';
      setResults(payload);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const interval = setInterval(refresh, RESULTS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    async function check() {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        setBackendOnline(response.ok);
      } catch {
        setBackendOnline(false);
      }
    }
    void check();
    const interval = setInterval(check, HEALTH_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Poll run state: every second while anything is running, every few seconds otherwise,
  // so runs started from a terminal or another tab show up too.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      clearTimeout(timer);
      try {
        const response = await fetch(`/api/run?offset=${offsetRef.current}&runId=${runIdRef.current}`, {
          cache: 'no-store',
        });
        const data = (await response.json()) as RunStatePayload;
        if (cancelled) return;

        if (data.id !== runIdRef.current) {
          runIdRef.current = data.id;
          setLines(data.log.slice(-MAX_CONSOLE_LINES));
        } else if (data.log.length > 0) {
          setLines((previous) => [...previous, ...data.log].slice(-MAX_CONSOLE_LINES));
        }
        offsetRef.current = data.offset + data.log.length;

        const dashboardBusy = isBusyPhase(data.phase);
        const active = dashboardBusy || Boolean(data.live?.active);
        if (active) {
          const runId = dashboardBusy ? data.runId : data.liveRunId;
          if (runId) lastActiveRef.current = { runId, source: dashboardBusy ? 'dashboard' : 'terminal' };
          else if (dashboardBusy) lastActiveRef.current = { runId: null, source: 'dashboard' };
        }
        if (activeRef.current && !active) {
          const { runId, source } = lastActiveRef.current;
          const phase = data.phase;
          // Refresh first so the finished run is stored before the notification links to it.
          void refresh().then(() => {
            if (!runId) return;
            completionCount.current += 1;
            setCompletedRun({
              runId,
              phase: source === 'dashboard' ? phase : 'finished',
              sequence: completionCount.current,
            });
          });
        }
        activeRef.current = active;

        setRun({
          id: data.id,
          runId: data.runId,
          label: data.label,
          suite: data.suite,
          phase: data.phase,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
          exitCode: data.exitCode,
          logLength: data.logLength,
          preview: data.preview,
        });
        setLive(data.live);
        setLiveRunId(data.liveRunId);
      } catch {
        // Server restarting or offline; try again on the next tick.
      } finally {
        const [activeMs, idleMs] = cloudRef.current
          ? [CLOUD_POLL_ACTIVE_MS, CLOUD_POLL_IDLE_MS]
          : [RUN_POLL_ACTIVE_MS, RUN_POLL_IDLE_MS];
        if (!cancelled) timer = setTimeout(poll, activeRef.current ? activeMs : idleMs);
      }
    }

    wakeRef.current = () => void poll();
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(BROWSERS_KEY) ?? '[]');
      if (Array.isArray(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedBrowsersState(stored.filter((item): item is string => typeof item === 'string'));
      }
      const storedDevices: unknown = JSON.parse(localStorage.getItem(DEVICES_KEY) ?? '[]');
      if (Array.isArray(storedDevices))
        setSelectedDevicesState(storedDevices.filter((item): item is string => typeof item === 'string'));
    } catch {
      // Storage unavailable; the default browser is used.
    }
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(PREVIEW_KEY) === 'off') setLivePreviewState(false);
    } catch {
      // Storage unavailable; preview stays on.
    }
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSizeChoice(localStorage.getItem(SIZE_KEY));
    } catch {
      // Storage unavailable; the framework default size is used.
    }
  }, []);

  const setSelectedSize = useCallback((size: string) => {
    setSizeChoice(size);
    try {
      localStorage.setItem(SIZE_KEY, size);
    } catch {
      // Keep the choice for this visit only.
    }
  }, []);

  // A remembered size the framework still supports, else the framework's default.
  const selectedSize = useMemo(() => {
    const catalog = results?.catalog;
    if (!catalog) return sizeChoice ?? '';
    return catalog.recordingSizes.some((size) => size.key === sizeChoice) ? sizeChoice! : catalog.defaultRecordingSize;
  }, [results, sizeChoice]);

  const dismissCompletedRun = useCallback(() => setCompletedRun(null), []);

  const setLivePreview = useCallback((enabled: boolean) => {
    setLivePreviewState(enabled);
    try {
      localStorage.setItem(PREVIEW_KEY, enabled ? 'on' : 'off');
    } catch {
      // Keep the choice for this visit only.
    }
  }, []);

  const setSelectedBrowsers = useCallback((browsers: string[]) => {
    setSelectedBrowsersState(browsers);
    try {
      localStorage.setItem(BROWSERS_KEY, JSON.stringify(browsers));
    } catch {
      // Keep the choice for this visit only.
    }
  }, []);

  // Only browsers that exist and are installed; falls back to the framework's first (default) browser.
  const setSelectedDevices = useCallback((devices: string[]) => {
    setSelectedDevicesState(devices);
    try {
      localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
    } catch {
      // Keep the choice for this visit only.
    }
  }, []);

  // Only installed targets that still exist. With no device selected, at least one desktop browser stays selected
  // (falling back to the framework's first one).
  const effectiveDevices = useMemo(() => {
    const projects = results?.catalog?.projects ?? [];
    return selectedDevicesChoice.filter((name) =>
      projects.some((project) => project.name === name && project.kind === 'device' && project.installed),
    );
  }, [results, selectedDevicesChoice]);

  const effectiveBrowsers = useMemo(() => {
    const desktop = (results?.catalog?.projects ?? []).filter((project) => project.kind === 'desktop');
    const usable = selectedBrowsers.filter((name) =>
      desktop.some((project) => project.name === name && project.installed),
    );
    if (usable.length > 0 || effectiveDevices.length > 0) return usable;
    return desktop.slice(0, 1).map((project) => project.name);
  }, [results, selectedBrowsers, effectiveDevices]);

  const installBrowser = useCallback(async (browser: string) => {
    const response = await fetch('/api/browsers/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browser }),
    });
    wakeRef.current();
    if (response.ok) return null;
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return body.error ?? `Could not start the install (HTTP ${response.status})`;
  }, []);

  const startRun = useCallback(
    async (request: RunRequest) => {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          browsers: effectiveBrowsers,
          devices: effectiveDevices,
          preview: livePreview,
          ...(selectedSize ? { size: selectedSize } : {}),
          ...request,
        }),
      });
      wakeRef.current();
      if (response.ok) return null;
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      return body.error ?? `Could not start the run (HTTP ${response.status})`;
    },
    [effectiveBrowsers, effectiveDevices, livePreview, selectedSize],
  );

  const cancelRun = useCallback(async () => {
    await fetch('/api/run', { method: 'DELETE' });
    wakeRef.current();
  }, []);

  const busy = isBusyPhase(run?.phase);
  const activeRun = useMemo<ActiveRun | null>(() => {
    if (busy && run?.startedAt) {
      return {
        runId: run.runId,
        label: run.label ?? 'Run',
        startedAt: run.startedAt,
        source: 'dashboard',
        phase: run.phase,
      };
    }
    if (live?.active) {
      return {
        runId: liveRunId,
        label: 'Terminal run',
        startedAt: live.startedAt,
        source: 'terminal',
        phase: 'running',
      };
    }
    return null;
  }, [busy, run, live, liveRunId]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      results,
      loadError,
      refreshing,
      refresh,
      backendOnline,
      run,
      live,
      activeRun,
      lines,
      busy,
      startRun,
      cancelRun,
      runDialogOpen,
      setRunDialogOpen,
      viewedRunId,
      viewRun,
      selectedBrowsers: effectiveBrowsers,
      selectedDevices: effectiveDevices,
      setSelectedDevices,
      setSelectedBrowsers,
      installBrowser,
      livePreview,
      setLivePreview,
      selectedSize,
      setSelectedSize,
      completedRun,
      dismissCompletedRun,
    }),
    [
      results,
      loadError,
      refreshing,
      refresh,
      backendOnline,
      run,
      live,
      activeRun,
      lines,
      busy,
      startRun,
      cancelRun,
      runDialogOpen,
      viewedRunId,
      effectiveBrowsers,
      effectiveDevices,
      setSelectedDevices,
      setSelectedBrowsers,
      installBrowser,
      livePreview,
      setLivePreview,
      selectedSize,
      setSelectedSize,
      completedRun,
      dismissCompletedRun,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
