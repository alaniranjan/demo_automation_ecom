'use client';

import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import { API_ENDPOINTS } from '@/lib/api-docs';
import { formatRelative } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { Card } from '../Card';
import {
  CalendarClockIcon,
  ChevronIcon,
  HistoryIcon,
  ImagesIcon,
  PieChartIcon,
  PlugIcon,
  ReportIcon,
  SuitesIcon,
} from '../icons';
import { useDashboard } from '../providers/DashboardProvider';

const ACTIONS = [
  { href: '/reports', label: 'View Latest Allure Report', Icon: ReportIcon },
  { href: '/history', label: 'View Execution History', Icon: HistoryIcon },
  { href: '/suites', label: 'Manage Test Suites', Icon: SuitesIcon },
];

export function QuickActions() {
  return (
    <Card title="Quick Actions">
      <ul className="-mx-2 divide-y divide-line">
        {ACTIONS.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex items-center gap-3 rounded-lg px-2 py-3 text-sm text-ink transition-all duration-200 hover:bg-surface-2"
            >
              <Icon width={18} height={18} className="text-ink-2 transition-colors group-hover:text-accent-strong" />
              <span className="flex-1">{label}</span>
              <ChevronIcon className="text-ink-3 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** One shortcut: icon, name and a short live line; the whole item links to the page. */
function Shortcut({
  href,
  title,
  meta,
  Icon,
  iconClass,
}: {
  href: string;
  title: string;
  meta: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClass: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-card transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${iconClass}`}
      >
        <Icon width={18} height={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-3">{meta}</span>
      </span>
    </Link>
  );
}

/** Shortcuts to the other sections, in one row, each with a short line of live data. */
export function FeatureCards() {
  const { results } = useDashboard();
  const now = useNow(60_000);
  const files = results?.tests.reduce((sum, test) => sum + test.attachments.length, 0) ?? 0;
  const summary = results?.summary;
  const runs = results?.runs.length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Shortcut
        href="/reports"
        title="Allure Report"
        meta={
          results?.reports.allure && summary && now !== null
            ? formatRelative(summary.startTime, now)
            : 'Not generated yet'
        }
        Icon={PieChartIcon}
        iconClass="bg-accent-soft text-accent-strong"
      />
      <Shortcut
        href="/artifacts"
        title="Screenshots"
        meta={`${files} file${files === 1 ? '' : 's'}`}
        Icon={ImagesIcon}
        iconClass="bg-serious-soft text-serious-text"
      />
      <Shortcut
        href="/history"
        title="History"
        meta={`${runs} run${runs === 1 ? '' : 's'}`}
        Icon={CalendarClockIcon}
        iconClass="bg-good-soft text-good-text"
      />
      <Shortcut
        href="/api-docs"
        title="API Docs"
        meta={`${API_ENDPOINTS.length} endpoints`}
        Icon={PlugIcon}
        iconClass="bg-warning-soft text-warning-text"
      />
    </div>
  );
}
