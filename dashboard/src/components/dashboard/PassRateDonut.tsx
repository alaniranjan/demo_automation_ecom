'use client';

import { useState } from 'react';
import { formatPercent } from '@/lib/format';
import type { RunSummary, TestStatus } from '@/lib/types';
import { Card } from '../Card';
import { STATUS_META } from '../status';

const ORDER: readonly TestStatus[] = ['passed', 'flaky', 'failed', 'skipped'];
const SIZE = 164;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

/** Latest run's outcome split as a donut, with the pass rate in the middle. */
export function PassRateDonut({ summary, subtitle = 'Latest run' }: { summary: RunSummary | null; subtitle?: string }) {
  const [hovered, setHovered] = useState<TestStatus | null>(null);
  const counts = summary?.counts;
  const total = summary?.total ?? 0;
  const segments = ORDER.filter((status) => (counts?.[status] ?? 0) > 0);

  const lengths = segments.map((status) => (counts![status] / total) * CIRCUMFERENCE);
  const arcs = segments.map((status, index) => ({
    status,
    dash: Math.max(0, lengths[index]! - (segments.length > 1 ? GAP : 0)),
    // Each arc starts where the previous ones end.
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  const focus = hovered && counts ? { label: STATUS_META[hovered].label, value: counts[hovered] / total } : null;

  return (
    <Card title="Overall Pass Rate" subtitle={subtitle} className="h-full">
      {!summary ? (
        <p className="grid h-48 place-items-center text-center text-sm text-ink-3">No results for this selection in the latest run.</p>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" role="img" aria-label="Outcome split of the latest run">
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--surface-2)" strokeWidth={STROKE} />
              {arcs.map((arc) => (
                <circle
                  key={arc.status}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={STATUS_META[arc.status].color}
                  strokeWidth={hovered === arc.status ? STROKE + 4 : STROKE}
                  strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                  strokeDashoffset={-arc.offset}
                  onMouseEnter={() => setHovered(arc.status)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer transition-[stroke-width] duration-200"
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-ink">
                  {formatPercent(Math.round((focus ? focus.value : summary.passRate) * 1000) / 1000)}
                </p>
                <p className="text-sm text-ink-3">{focus ? focus.label : 'Passed'}</p>
              </div>
            </div>
          </div>

          <ul className="flex w-full flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            {ORDER.filter((status) => status !== 'flaky' || (counts?.flaky ?? 0) > 0).map((status) => (
              <li
                key={status}
                onMouseEnter={() => setHovered(status)}
                onMouseLeave={() => setHovered(null)}
                className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${hovered === status ? 'bg-surface-2' : ''}`}
              >
                <span className="inline-flex items-center gap-2 text-ink-2">
                  <span className="size-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                  {STATUS_META[status].label}
                </span>
                <span className="font-medium tabular-nums text-ink">{counts?.[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
