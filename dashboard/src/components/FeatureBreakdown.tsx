'use client';

import { useState } from 'react';
import type { FeatureSummary } from '@/lib/types';
import { Card, ViewToggle } from './Card';
import { ChartTooltip } from './ChartTooltip';
import { STACK_ORDER, STATUS_META, StatusLegend } from './status';
import { FeatureName } from './specs';

export function FeatureBreakdown({ features }: { features: FeatureSummary[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...features.map((feature) => feature.total));

  return (
    <Card
      title="Results by feature"
      subtitle="Latest run, grouped by test folder"
      actions={<ViewToggle showTable={showTable} onChange={setShowTable} />}
      className="h-full"
    >
      {showTable ? (
        <table className="w-full text-left text-xs">
          <thead className="text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-medium">Feature</th>
              {STACK_ORDER.map((status) => (
                <th key={status} className="py-2 pr-3 text-right font-medium">
                  {STATUS_META[status].label}
                </th>
              ))}
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-ink-2">
            {features.map((feature) => (
              <tr key={feature.feature} className="border-t border-line">
                <td className="py-2 pr-3 text-ink">
                  <FeatureName feature={feature.feature} />
                </td>
                {STACK_ORDER.map((status) => (
                  <td key={status} className="py-2 pr-3 text-right">
                    {feature.counts[status]}
                  </td>
                ))}
                <td className="py-2 text-right">{feature.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <StatusLegend />
          <ul className="mt-4 space-y-3">
            {features.map((feature) => {
              const segments = STACK_ORDER.filter((status) => feature.counts[status] > 0);
              const passed = feature.counts.passed + feature.counts.flaky;
              return (
                <li
                  key={feature.feature}
                  className="relative grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3"
                  onMouseEnter={() => setHovered(feature.feature)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(feature.feature)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  aria-label={`${feature.feature}: ${passed} of ${feature.total} passed`}
                >
                  <span className="truncate text-sm text-ink-2">
                    <FeatureName feature={feature.feature} />
                  </span>
                  <div className="py-1.5">
                    <div
                      className="flex h-4 gap-[2px] transition-opacity"
                      style={{
                        width: `${(feature.total / max) * 100}%`,
                        opacity: hovered === null || hovered === feature.feature ? 1 : 0.4,
                      }}
                    >
                      {segments.map((status, index) => (
                        <span
                          key={status}
                          className={index === segments.length - 1 ? 'rounded-r-[4px]' : ''}
                          style={{ flexGrow: feature.counts[status], flexBasis: 0, background: STATUS_META[status].color }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-ink-2">
                    <span className="font-medium text-ink">{passed}</span>/{feature.total}
                  </span>
                  {hovered === feature.feature && (
                    <ChartTooltip
                      title={feature.feature}
                      counts={feature.counts}
                      footer={`${feature.total} tests`}
                      style={{ top: '100%', left: '7.5rem', marginTop: 4 }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
