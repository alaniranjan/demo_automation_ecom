'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { formatDuration } from '@/lib/format';
import { Card } from '../Card';
import { AccountSettings } from '../AccountSettings';
import { DatabaseIcon, DownloadIcon, PhoneIcon, ServerIcon, SettingsIcon, SuitesIcon } from '../icons';
import { PageHeader, buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { ThemeToggle } from '../ThemeToggle';
import { PageSkeleton } from './PageSkeleton';

interface Health {
  status: string;
  startedAt: string;
  uptimeSeconds: number;
  runnerBusy: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="min-w-0 break-all text-sm text-ink sm:text-right">{children}</dd>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-accent-strong">{icon}</span>
      {children}
    </span>
  );
}

export function SettingsPage() {
  const { results, backendOnline } = useDashboard();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((response) => response.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  if (!results) return <PageSkeleton />;
  const { meta, catalog } = results;

  return (
    <div className="stagger space-y-6">
      <PageHeader title="Settings" description="Appearance, the customer account used for signed-in tests, framework configuration and backend storage." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={<SectionTitle icon={<SettingsIcon width={16} height={16} />}>Appearance</SectionTitle>}>
          <dl>
            <Row label="Theme">
              <span className="inline-flex">
                <ThemeToggle />
              </span>
            </Row>
            <Row label="Sidebar">Collapse it with the button at the bottom of the sidebar</Row>
          </dl>
        </Card>

        {!backendOnline ? null : (
          <Card title={<SectionTitle icon={<PhoneIcon width={16} height={16} />}>Customer account</SectionTitle>}>
            <AccountSettings />
          </Card>
        )}

        <Card title={<SectionTitle icon={<ServerIcon width={16} height={16} />}>Backend</SectionTitle>}>
          <dl>
            <Row label="Status">
              <span className={backendOnline ? 'text-good-text' : 'text-critical-text'}>{backendOnline ? 'Online' : 'Offline'}</span>
            </Row>
            <Row label="Uptime">{health ? formatDuration(health.uptimeSeconds * 1000) : '-'}</Row>
            <Row label="Runner">{health?.runnerBusy ? 'Busy' : 'Idle'}</Row>
            <Row label="Node.js">{meta.nodeVersion}</Row>
            <Row label="Operator">{meta.user}</Row>
          </dl>
        </Card>

        <Card title={<SectionTitle icon={<SuitesIcon width={16} height={16} />}>Framework</SectionTitle>}>
          <dl>
            <Row label="Package">
              <span className="font-mono">
                {meta.name}@{meta.version}
              </span>
            </Row>
            {meta.description && <Row label="Description">{meta.description}</Row>}
            <Row label="Project">{meta.projectName}</Row>
            <Row label="Base URL">{meta.baseURL ?? '-'}</Row>
            <Row label="Playwright">{catalog?.playwrightVersion ?? '-'}</Row>
            <Row label="Workers">{catalog?.workers ?? '-'}</Row>
            {catalog?.projects.map((project) => (
              <Row key={project.name} label={`Project "${project.name}"`}>
                {project.browserName ?? 'browser'} · {project.retries} retries · {formatDuration(project.timeout)} timeout
              </Row>
            ))}
            <Row label="Location">
              <span className="font-mono text-xs">{meta.frameworkDir}</span>
            </Row>
          </dl>
        </Card>

        <Card title={<SectionTitle icon={<DatabaseIcon width={16} height={16} />}>Data & storage</SectionTitle>}>
          <dl>
            <Row label="Store file">
              <span className="font-mono text-xs">{meta.storeFile}</span>
            </Row>
            <Row label="Runs stored">
              {results.runs.length} of {meta.maxRuns} max
            </Row>
            <Row label="Activity entries">{results.activity.length} shown</Row>
            <Row label="Suites (package.json)">
              <span className="flex flex-wrap justify-end gap-1">
                {catalog?.suites.map((suite) => (
                  <span key={suite.script} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                    {suite.script}
                  </span>
                ))}
              </span>
            </Row>
          </dl>
          {/* A file download from the API, not a page navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/runs?download=1" className={`${buttonStyles.secondary} mt-4`}>
            <DownloadIcon width={14} height={14} /> Export history JSON
          </a>
        </Card>
      </div>
    </div>
  );
}
