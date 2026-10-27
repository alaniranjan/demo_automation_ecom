'use client';

import { useRouter } from 'next/navigation';
import { BrowserPicker } from './BrowserPicker';
import { useDashboard } from './providers/DashboardProvider';
import { RunSelector } from './RunSelector';
import { Modal } from './ui';

/** "Run Selected Tests": pick a suite or spec files, start, then follow the run on the Web Testing page. */
export function RunDialog() {
  const { runDialogOpen, setRunDialogOpen, results } = useDashboard();
  const router = useRouter();

  return (
    <Modal
      open={runDialogOpen}
      onClose={() => setRunDialogOpen(false)}
      title="Run selected tests"
      subtitle={`${results?.catalog?.total ?? '…'} tests available in ${results?.meta.name ?? 'the framework'}`}
      size="max-w-xl"
    >
      <div className="mb-5">
        <BrowserPicker compact />
      </div>
      <RunSelector
        initialMode="files"
        onStarted={() => {
          setRunDialogOpen(false);
          router.push('/runs');
        }}
      />
    </Modal>
  );
}
