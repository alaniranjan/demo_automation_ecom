'use client';

import { formatDuration } from '@/lib/format';
import type { StepNode, TestRow } from '@/lib/types';
import { CheckCircleIcon, XCircleIcon } from './icons';
import { useDashboard } from './providers/DashboardProvider';
import { MediaGallery } from './TestMedia';

function Steps({ steps }: { steps: StepNode[] }) {
  return (
    <ol className="space-y-1">
      {steps.map((step, index) => (
        <li key={`${step.title}-${index}`}>
          <div className="flex items-start gap-2 text-sm">
            {step.error ? (
              <XCircleIcon className="mt-0.5 shrink-0 text-critical" aria-label="Failed step" />
            ) : (
              <CheckCircleIcon className="mt-0.5 shrink-0 text-good" aria-label="Passed step" />
            )}
            <span className={`min-w-0 flex-1 ${step.error ? 'text-critical-text' : 'text-ink'}`}>{step.title}</span>
            <span className="shrink-0 text-xs tabular-nums text-ink-3">{formatDuration(step.duration)}</span>
          </div>
          {step.steps.length > 0 && (
            <div className="ml-[7px] mt-1 border-l border-line pl-4">
              <Steps steps={step.steps} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function TestDetails({ test }: { test: TestRow }) {
  const { results } = useDashboard();

  return (
    <div className="space-y-5 px-4 py-4 sm:px-6">
      <p className="font-mono text-xs text-ink-3">
        tests/{test.file}:{test.line} · {test.project}
        {test.retries > 0 && ` · ${test.retries} ${test.retries === 1 ? 'retry' : 'retries'}`}
      </p>

      {test.error && (
        <div className="rounded-xl border border-critical/40 bg-critical-soft p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-critical-text">Error</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-ink">
            {test.error.message}
          </pre>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Steps</p>
        {test.steps.length > 0 ? (
          <Steps steps={test.steps} />
        ) : (
          <p className="text-sm text-ink-3">No test.step() entries were recorded.</p>
        )}
      </div>

      {test.attachments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Attachments</p>
          <MediaGallery
            attachments={test.attachments}
            title={test.title}
            project={results?.catalog?.projects.find((entry) => entry.name === test.project)}
          />
        </div>
      )}
    </div>
  );
}
