import { createElement, type ComponentType, type SVGProps } from 'react';
import type { StatusCounts, TestStatus } from '@/lib/types';
import { FileIcon, LayersIcon, PlayCircleIcon, RouteIcon, ShieldIcon, TerminalIcon, ZapIcon } from './icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Picks an icon from the suite's script name; unknown suites get a generic play icon. */
export function suiteIcon(script: string | null | undefined): IconComponent {
  const name = (script ?? '').toLowerCase();
  if (name === 'test') return LayersIcon;
  if (name === 'selected') return FileIcon;
  if (name === 'custom') return TerminalIcon;
  if (name.includes('smoke')) return ZapIcon;
  if (name.includes('regression')) return ShieldIcon;
  if (name.includes('e2e') || name.includes('end')) return RouteIcon;
  return PlayCircleIcon;
}

export function SuiteIcon({ script, ...props }: { script: string | null | undefined } & SVGProps<SVGSVGElement>) {
  // The icon components are module-level constants, so selecting one per render is safe.
  return createElement(suiteIcon(script), props);
}

/** A run's overall outcome: any failure fails it; otherwise flaky beats passed. */
export function runOutcome(entry: { counts: StatusCounts }): TestStatus {
  if (entry.counts.failed > 0) return 'failed';
  if (entry.counts.flaky > 0) return 'flaky';
  if (entry.counts.passed === 0 && entry.counts.skipped > 0) return 'skipped';
  return 'passed';
}

export function passRateOf(entry: { counts: StatusCounts; total: number }): number {
  const executed = entry.total - entry.counts.skipped;
  return executed === 0 ? 0 : (entry.counts.passed + entry.counts.flaky) / executed;
}
