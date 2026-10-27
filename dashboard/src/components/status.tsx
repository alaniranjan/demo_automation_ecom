import type { ComponentType, SVGProps } from 'react';
import type { TestStatus } from '@/lib/types';
import { CheckCircleIcon, FlakyIcon, SkipIcon, XCircleIcon } from './icons';

interface StatusMeta {
  label: string;
  /** Mark color for charts and swatches (CSS variable). */
  color: string;
  badgeClass: string;
  iconClass: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const STATUS_META: Record<TestStatus, StatusMeta> = {
  passed: {
    label: 'Passed',
    color: 'var(--good)',
    badgeClass: 'bg-good-soft text-good-text',
    iconClass: 'text-good',
    Icon: CheckCircleIcon,
  },
  failed: {
    label: 'Failed',
    color: 'var(--critical)',
    badgeClass: 'bg-critical-soft text-critical-text',
    iconClass: 'text-critical',
    Icon: XCircleIcon,
  },
  flaky: {
    label: 'Flaky',
    color: 'var(--serious)',
    badgeClass: 'bg-serious-soft text-serious-text',
    iconClass: 'text-serious-text',
    Icon: FlakyIcon,
  },
  skipped: {
    label: 'Skipped',
    color: 'var(--warning)',
    badgeClass: 'bg-warning-soft text-warning-text',
    iconClass: 'text-warning-text',
    Icon: SkipIcon,
  },
};

/** Bottom-to-top stacking order for status charts. */
export const STACK_ORDER: readonly TestStatus[] = ['passed', 'flaky', 'failed', 'skipped'];

export function StatusBadge({ status }: { status: TestStatus }) {
  const { label, badgeClass, Icon } = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
      <Icon width={14} height={14} />
      {label}
    </span>
  );
}

export function StatusLegend({ statuses = STACK_ORDER }: { statuses?: readonly TestStatus[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
      {statuses.map((status) => (
        <li key={status} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: STATUS_META[status].color }} />
          {STATUS_META[status].label}
        </li>
      ))}
    </ul>
  );
}
