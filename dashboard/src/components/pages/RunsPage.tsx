'use client';

import { BrowserPicker, type TestingMode } from '../BrowserPicker';
import { Card } from '../Card';
import { LivePreview } from '../LivePreview';
import { LiveRunCard } from '../LiveRunCard';
import { PageHeader } from '../PageHeader';
import { RunSelector } from '../RunSelector';

const PAGES: Record<TestingMode, { title: string; description: string }> = {
  web: {
    title: 'Web Testing',
    description: 'Run suites on desktop browsers at the window size you choose, then follow the run live.',
  },
  responsive: {
    title: 'Responsive Testing',
    description:
      'Run suites on emulated phones and tablets (screen, pixel density, touch, user agent) and watch them live.',
  },
};

export function RunsPage({ testing }: { testing: TestingMode }) {
  const page = PAGES[testing];
  return (
    <div className="stagger space-y-6">
      <PageHeader title={page.title} description={page.description} />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-4">
          <Card title="Launch a run" subtitle="Suites come from the framework's package.json scripts">
            <RunSelector testing={testing} />
          </Card>
          <BrowserPicker testing={testing} />
        </div>
        <div className="min-w-0 space-y-6 xl:col-span-8">
          <LivePreview />
          <LiveRunCard />
        </div>
      </div>
    </div>
  );
}
