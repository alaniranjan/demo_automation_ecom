'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { APP_NAME, APP_TAGLINE } from '@/lib/app';
import { formatRelative } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { ActivityIcon } from '../ActivityFeed';
import { BellIcon, ChevronDownIcon, GlobeIcon, MenuIcon, SettingsIcon, ShieldCheckIcon } from '../icons';
import { useDashboard } from '../providers/DashboardProvider';
import { ThemeToggle } from '../ThemeToggle';
import { Dropdown } from '../dropdowns';

const SEEN_KEY = 'activity-seen';

function ProjectSelector() {
  const { results } = useDashboard();
  const meta = results?.meta;
  const projects = results?.catalog?.projects ?? [];

  return (
    <Dropdown
      label="Project"
      align="left"
      width="w-80"
      trigger={
        <span className="flex h-10 min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors duration-200 hover:border-accent/50 sm:min-w-56">
          <GlobeIcon className="shrink-0 text-ink-2" />
          <span className="truncate font-medium">{meta?.projectName ?? 'Loading…'}</span>
          <ChevronDownIcon className="ml-auto shrink-0 text-ink-3" />
        </span>
      }
    >
      {() =>
        meta ? (
          <div className="space-y-3 p-4 text-sm">
            <div>
              <p className="text-xs text-ink-3">Project</p>
              <p className="font-semibold text-ink">{meta.projectName}</p>
            </div>
            {meta.baseURL && (
              <div>
                <p className="text-xs text-ink-3">Base URL</p>
                <a href={meta.baseURL} target="_blank" rel="noreferrer" className="break-all text-accent-strong hover:underline">
                  {meta.baseURL}
                </a>
              </div>
            )}
            <div>
              <p className="text-xs text-ink-3">Browsers</p>
              <p className="text-ink">{projects.map((project) => project.name).join(', ') || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-ink-3">Framework</p>
              <p className="font-mono text-xs text-ink-2">
                {meta.name}@{meta.version}
              </p>
            </div>
          </div>
        ) : (
          <p className="p-4 text-sm text-ink-3">Loading project…</p>
        )
      }
    </Dropdown>
  );
}

function Notifications() {
  const { results } = useDashboard();
  const now = useNow(30_000);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const activity = results?.activity ?? [];

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeenAt(localStorage.getItem(SEEN_KEY));
    } catch {
      // Storage unavailable: everything counts as unread this visit.
    }
  }, []);

  const unread = activity.filter((event) => !seenAt || event.time > seenAt).length;

  function markRead() {
    const latest = activity[0]?.time ?? new Date().toISOString();
    setSeenAt(latest);
    try {
      localStorage.setItem(SEEN_KEY, latest);
    } catch {
      // Ignore; the badge resets on reload.
    }
  }

  return (
    <Dropdown
      label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      width="w-80"
      trigger={
        <span className="relative grid size-10 place-items-center rounded-lg text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink">
          <BellIcon width={18} height={18} />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markRead} className="text-xs font-medium text-accent-strong hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {activity.slice(0, 10).map((event) => (
              <li key={event.id} className={`flex gap-3 px-4 py-3 ${!seenAt || event.time > seenAt ? 'bg-accent-soft/40' : ''}`}>
                <ActivityIcon type={event.type} />
                <div className="min-w-0 text-sm">
                  <p className="truncate text-ink">{event.title}</p>
                  <p className="truncate text-xs text-ink-3">
                    {event.detail ? `${event.detail} · ` : ''}
                    {now !== null && formatRelative(event.time, now)}
                  </p>
                </div>
              </li>
            ))}
            {activity.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">No activity yet.</li>}
          </ul>
          <Link href="/history" onClick={close} className="block border-t border-line px-4 py-2.5 text-center text-sm text-accent-strong hover:bg-surface-2">
            View execution history
          </Link>
        </div>
      )}
    </Dropdown>
  );
}

function UserMenu() {
  const { results } = useDashboard();
  const user = results?.meta.user ?? '';

  return (
    <Dropdown
      label="Account"
      width="w-64"
      trigger={
        <span className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition-colors duration-200 hover:bg-surface-2">
          <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold uppercase text-on-accent">
            {user.charAt(0) || '·'}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium text-ink md:block">{user}</span>
          <ChevronDownIcon className="hidden text-ink-3 md:block" />
        </span>
      }
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">{user}</p>
            <p className="text-xs text-ink-3">Local operator</p>
          </div>
          <div className="px-4 py-3">
            <p className="mb-2 text-xs text-ink-3">Theme</p>
            <ThemeToggle />
          </div>
          <div className="border-t border-line py-1">
            <Link href="/settings" onClick={close} className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-surface-2">
              <SettingsIcon width={15} height={15} /> Settings
            </Link>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function BackendStatus() {
  const { backendOnline } = useDashboard();
  if (backendOnline === null) return null;
  return (
    <span className="hidden items-center gap-2 text-sm text-ink-2 md:inline-flex" role="status">
      <span className="relative flex size-2.5">
        {backendOnline && <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-50" />}
        <span className={`relative inline-flex size-2.5 rounded-full ${backendOnline ? 'bg-good' : 'bg-critical'}`} />
      </span>
      Backend {backendOnline ? 'Online' : 'Offline'}
    </span>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-sidebar-line bg-sidebar/95 backdrop-blur-md">
      <div className="flex h-full shrink-0 items-center gap-3 px-4 transition-[width] duration-300 ease-smooth lg:w-64 lg:border-r lg:border-sidebar-line lg:px-5 lg:collapsed:w-[76px] lg:collapsed:justify-center lg:collapsed:px-0">
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 rounded-lg p-2 text-sidebar-ink-2 transition-colors hover:bg-sidebar-2 hover:text-sidebar-ink lg:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon width={20} height={20} />
        </button>
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#3b8bff] to-[#1d5fd6] text-white shadow-lg shadow-[#2f7cf6]/30">
            <ShieldCheckIcon width={22} height={22} />
          </span>
          <span className="hidden min-w-0 sm:block lg:collapsed:hidden">
            <span className="block truncate text-base font-bold tracking-wide text-sidebar-ink">{APP_NAME}</span>
            <span className="block truncate text-xs text-sidebar-ink-2">{APP_TAGLINE}</span>
          </span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-6">
        <ProjectSelector />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <BackendStatus />
          <Notifications />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
