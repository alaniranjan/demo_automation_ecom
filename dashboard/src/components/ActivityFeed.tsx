'use client';

import Link from 'next/link';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { ActivityEvent, ActivityType, LiveState } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { Card } from './Card';
import { ArrowRightIcon, CheckCircleIcon, FlakyIcon, MinusCircleIcon, PlayIcon, StopIcon, TrashIcon, XCircleIcon } from './icons';
import { useDashboard } from './providers/DashboardProvider';

type FeedType = ActivityType | 'test.passed' | 'test.skipped';

interface FeedItem {
  id: string;
  type: FeedType;
  time: string;
  title: string;
  detail?: string;
  runId?: string;
}

const ICONS: Record<FeedType, { Icon: typeof CheckCircleIcon; className: string }> = {
  'run.started': { Icon: PlayIcon, className: 'bg-accent text-on-accent' },
  'run.passed': { Icon: CheckCircleIcon, className: 'bg-good text-white' },
  'run.failed': { Icon: XCircleIcon, className: 'bg-critical text-white' },
  'run.cancelled': { Icon: StopIcon, className: 'bg-neutral text-white' },
  'run.deleted': { Icon: TrashIcon, className: 'bg-neutral text-white' },
  'artifacts.deleted': { Icon: TrashIcon, className: 'bg-neutral text-white' },
  'test.passed': { Icon: CheckCircleIcon, className: 'bg-good text-white' },
  'test.failed': { Icon: XCircleIcon, className: 'bg-critical text-white' },
  'test.flaky': { Icon: FlakyIcon, className: 'bg-serious text-white' },
  'test.skipped': { Icon: MinusCircleIcon, className: 'bg-warning text-white' },
};

export function ActivityIcon({ type }: { type: FeedType }) {
  const { Icon, className } = ICONS[type];
  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full ${className}`} aria-hidden="true">
      <Icon width={14} height={14} />
    </span>
  );
}

/** Stored activity plus test outcomes streaming from the run that is executing right now. */
export function buildFeed(activity: ActivityEvent[], live: LiveState | null): FeedItem[] {
  const liveItems: FeedItem[] = live?.active
    ? live.events.map((event, index) => ({
        id: `live-${event.time}-${index}`,
        type: `test.${event.status}` as FeedType,
        time: event.time,
        title: `Test ${event.title} ${event.status}`,
        detail: event.file,
      }))
    : [];
  return [...liveItems, ...activity].sort((a, b) => b.time.localeCompare(a.time));
}

export function ActivityList({ items, limit }: { items: FeedItem[]; limit?: number }) {
  const now = useNow(30_000);
  const { viewRun } = useDashboard();
  const visible = limit ? items.slice(0, limit) : items;

  if (visible.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-3">No activity yet. Start a run to see events here.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {visible.map((item) => (
        <li key={item.id} className="group flex gap-3 py-3 transition-colors first:pt-0 last:pb-0">
          <ActivityIcon type={item.type} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">
              {item.runId && item.type.startsWith('run.') ? (
                <button type="button" onClick={() => viewRun(item.runId!)} className="text-left hover:text-accent-strong hover:underline">
                  {item.title}
                </button>
              ) : (
                item.title
              )}
            </p>
            <p className="truncate text-xs text-ink-3" title={formatDateTime(item.time)}>
              {now !== null ? formatRelative(item.time, now) : formatDateTime(item.time)}
              {item.detail && ` · ${item.detail}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LatestActivityCard({ limit = 5 }: { limit?: number }) {
  const { results, live } = useDashboard();
  const items = buildFeed(results?.activity ?? [], live);

  return (
    <Card
      title="Latest Activity"
      actions={
        <Link href="/history#activity" className="inline-flex items-center gap-1 text-sm font-medium text-accent-strong hover:underline">
          View All <ArrowRightIcon width={13} height={13} />
        </Link>
      }
    >
      <ActivityList items={items} limit={limit} />
    </Card>
  );
}
