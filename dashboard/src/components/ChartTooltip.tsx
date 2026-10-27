import type { CSSProperties } from 'react';
import type { StatusCounts } from '@/lib/types';
import { STACK_ORDER, STATUS_META } from './status';

interface ChartTooltipProps {
  title: string;
  counts: StatusCounts;
  footer?: string;
  style?: CSSProperties;
}

/** Hover card listing every status for one mark, so values are never read from color alone. */
export function ChartTooltip({ title, counts, footer, style }: ChartTooltipProps) {
  return (
    <div
      role="tooltip"
      style={style}
      className="pointer-events-none absolute z-10 w-48 rounded-xl border border-line bg-surface p-3 text-xs shadow-lg"
    >
      <p className="mb-2 font-semibold text-ink">{title}</p>
      <ul className="space-y-1">
        {[...STACK_ORDER].reverse().map((status) => (
          <li key={status} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-ink-2">
              <span className="size-2.5 rounded-[3px]" style={{ background: STATUS_META[status].color }} />
              {STATUS_META[status].label}
            </span>
            <span className="font-medium tabular-nums text-ink">{counts[status]}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-2 border-t border-line pt-2 text-ink-3">{footer}</p>}
    </div>
  );
}
