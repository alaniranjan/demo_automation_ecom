'use client';

import { useState } from 'react';
import { formatDay, formatStartTime, formatTime } from '@/lib/format';
import type { RunRecord } from '@/lib/types';
import { useElementWidth } from '@/lib/useElementWidth';
import { Card, ViewToggle } from '../Card';

const HEIGHT = 230;
const MARGIN = { top: 12, right: 16, bottom: 30, left: 36 };
const MIN_LABEL_GAP = 72;

const SERIES = [
  { key: 'passed', label: 'Passed', color: 'var(--good)', value: (run: RunRecord) => run.counts.passed + run.counts.flaky },
  { key: 'failed', label: 'Failed', color: 'var(--critical)', value: (run: RunRecord) => run.counts.failed },
  { key: 'skipped', label: 'Skipped', color: 'var(--warning)', value: (run: RunRecord) => run.counts.skipped },
] as const;

function niceMax(value: number): { max: number; step: number } {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  const step = steps.find((candidate) => candidate * 4 >= value) ?? Math.ceil(value / 4 / 1000) * 1000;
  return { max: Math.max(step, Math.ceil(value / step) * step), step };
}

/** Passed, failed and skipped counts per run, newest on the right, with a hover crosshair. */
export function TrendChart({ runs, limit = 14, title = 'Test Results Trend' }: { runs: RunRecord[]; limit?: number; title?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const data = runs.slice(-limit);

  const { max, step } = niceMax(Math.max(1, ...data.flatMap((run) => SERIES.map((series) => series.value(run)))));
  const ticks = Array.from({ length: max / step + 1 }, (_, index) => index * step);
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) => MARGIN.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => MARGIN.top + plotHeight - (value / max) * plotHeight;
  const sameDay = data.length > 0 && data.every((run) => formatDay(run.startTime) === formatDay(data[0]!.startTime));
  const label = (run: RunRecord) => (sameDay ? formatTime(run.startTime) : formatDay(run.startTime));
  // Keep labels at least MIN_LABEL_GAP apart, always including the newest run.
  const labelIndexes: number[] = [];
  for (let index = data.length - 1; index >= 0; index -= 1) {
    const last = labelIndexes.at(-1);
    if (last === undefined || x(last) - x(index) >= MIN_LABEL_GAP) labelIndexes.push(index);
  }
  const anchorFor = (index: number) =>
    data.length > 1 && index === data.length - 1 ? 'end' : index === 0 && data.length > 1 ? 'start' : 'middle';
  const hoveredRun = hovered === null ? undefined : data[hovered];

  return (
    <Card
      title={title}
      subtitle={`Last ${data.length} run${data.length === 1 ? '' : 's'}${sameDay && data[0] ? ` · ${formatDay(data[0].startTime)}` : ''}`}
      actions={
        <div className="flex items-center gap-4">
          <ul className="hidden items-center gap-4 text-xs text-ink-2 sm:flex" aria-label="Legend">
            {SERIES.map((series) => (
              <li key={series.key} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: series.color }} />
                {series.label}
              </li>
            ))}
          </ul>
          <ViewToggle showTable={showTable} onChange={setShowTable} />
        </div>
      }
      className="h-full"
    >
      {showTable ? (
        <div className="max-h-60 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-ink-3">
              <tr>
                <th className="py-2 pr-3 font-medium">Run</th>
                {SERIES.map((series) => (
                  <th key={series.key} className="py-2 pr-3 text-right font-medium">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-ink-2">
              {[...data].reverse().map((run) => (
                <tr key={run.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-mono text-ink">{run.id}</td>
                  {SERIES.map((series) => (
                    <td key={series.key} className="py-2 pr-3 text-right">
                      {series.value(run)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.length === 0 ? (
        <p className="grid h-56 place-items-center text-sm text-ink-3">The trend appears once runs are recorded.</p>
      ) : (
        <div
          ref={ref}
          className="relative"
          onMouseLeave={() => setHovered(null)}
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const relative = event.clientX - bounds.left - MARGIN.left;
            const index = data.length <= 1 ? 0 : Math.round((relative / Math.max(1, plotWidth)) * (data.length - 1));
            setHovered(Math.min(data.length - 1, Math.max(0, index)));
          }}
        >
          {width > 0 && (
            <svg width={width} height={HEIGHT} role="img" aria-label="Passed, failed and skipped tests per run">
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke={tick === 0 ? 'var(--baseline)' : 'var(--grid)'}
                    shapeRendering="crispEdges"
                  />
                  <text x={MARGIN.left - 10} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
                    {tick}
                  </text>
                </g>
              ))}

              {hovered !== null && (
                <line x1={x(hovered)} x2={x(hovered)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--baseline)" />
              )}

              {SERIES.map((series) => (
                <g key={series.key}>
                  <polyline
                    points={data.map((run, index) => `${x(index)},${y(series.value(run))}`).join(' ')}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {data.map((run, index) => (
                    <circle
                      key={run.id}
                      cx={x(index)}
                      cy={y(series.value(run))}
                      r={hovered === index ? 5 : 4}
                      fill={series.color}
                      stroke="var(--surface)"
                      strokeWidth={2}
                      style={{ transition: 'r 120ms' }}
                    />
                  ))}
                </g>
              ))}

              {labelIndexes.map((index) => (
                <text key={data[index]!.id} x={x(index)} y={HEIGHT - 8} textAnchor={anchorFor(index)} className="fill-ink-3 text-[11px]">
                  {label(data[index]!)}
                </text>
              ))}
            </svg>
          )}

          {hoveredRun && hovered !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 w-52 rounded-xl border border-line bg-surface p-3 text-xs shadow-xl"
              style={{ top: MARGIN.top, left: x(hovered) + 14 > width - 214 ? x(hovered) - 222 : x(hovered) + 14 }}
            >
              <p className="font-mono font-semibold text-ink">{hoveredRun.id}</p>
              <p className="mb-2 text-ink-3">{formatStartTime(hoveredRun.startTime)}</p>
              {SERIES.map((series) => (
                <p key={series.key} className="flex items-center justify-between gap-3 py-0.5">
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <span className="size-2.5 rounded-full" style={{ background: series.color }} />
                    {series.label}
                  </span>
                  <span className="font-medium tabular-nums text-ink">{series.value(hoveredRun)}</span>
                </p>
              ))}
              <p className="mt-2 border-t border-line pt-2 text-ink-3">{hoveredRun.suiteLabel}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
