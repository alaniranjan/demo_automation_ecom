'use client';

import { useState } from 'react';
import { API_ENDPOINTS, type ApiEndpoint } from '@/lib/api-docs';
import { PlayIcon } from '../icons';
import { PageHeader } from '../PageHeader';

const METHOD_STYLES: Record<ApiEndpoint['method'], string> = {
  GET: 'bg-good-soft text-good-text',
  POST: 'bg-accent-soft text-accent-strong',
  DELETE: 'bg-critical-soft text-critical-text',
};

const PREVIEW_LIMIT = 4000;

function Endpoint({ endpoint }: { endpoint: ApiEndpoint }) {
  const [response, setResponse] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function tryIt() {
    if (!endpoint.tryPath) return;
    setLoading(true);
    const started = performance.now();
    try {
      const result = await fetch(endpoint.tryPath, { cache: 'no-store' });
      const text = JSON.stringify(await result.json(), null, 2);
      setResponse({ status: result.status, ms: Math.round(performance.now() - started), body: text });
    } catch (error) {
      setResponse({ status: 0, ms: Math.round(performance.now() - started), body: String(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-xl border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:border-accent/30 hover:shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-md px-2 py-1 font-mono text-xs font-semibold ${METHOD_STYLES[endpoint.method]}`}>{endpoint.method}</span>
        <code className="font-mono text-sm text-ink">{endpoint.path}</code>
        <span className="text-sm text-ink-3">· {endpoint.summary}</span>
        {endpoint.tryPath && (
          <button
            type="button"
            onClick={() => void tryIt()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-all duration-200 hover:border-accent/50 hover:bg-surface-2 disabled:opacity-50"
          >
            <PlayIcon width={11} height={11} /> {loading ? 'Calling…' : 'Try it'}
          </button>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{endpoint.description}</p>
      {endpoint.body && (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-console p-3 font-mono text-xs text-console-ink">{endpoint.body}</pre>
      )}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {endpoint.responses.map((item) => (
          <li key={item} className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2">
            {item}
          </li>
        ))}
      </ul>
      {response && (
        <div className="animate-enter mt-4">
          <p className="mb-1.5 text-xs text-ink-3">
            Response <span className={response.status >= 200 && response.status < 300 ? 'text-good-text' : 'text-critical-text'}>{response.status}</span> in{' '}
            {response.ms} ms
          </p>
          <pre className="max-h-72 overflow-auto rounded-lg bg-console p-3 font-mono text-xs text-console-ink">
            {response.body.length > PREVIEW_LIMIT ? `${response.body.slice(0, PREVIEW_LIMIT)}\n… (${response.body.length - PREVIEW_LIMIT} more characters)` : response.body}
          </pre>
        </div>
      )}
    </article>
  );
}

export function ApiDocsPage() {
  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="API Documentation"
        description={`${API_ENDPOINTS.length} endpoints served by this dashboard's backend. Read-only endpoints can be called live.`}
      />
      <div className="space-y-4">
        {API_ENDPOINTS.map((endpoint) => (
          <Endpoint key={`${endpoint.method} ${endpoint.path}`} endpoint={endpoint} />
        ))}
      </div>
    </div>
  );
}
