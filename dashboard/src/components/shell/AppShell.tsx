'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RunDetailsDialog } from '../RunDetailsDialog';
import { RunCompleteToast } from '../RunCompleteToast';
import { RunDialog } from '../RunDialog';
import { DashboardProvider, useDashboard } from '../providers/DashboardProvider';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function readCollapsed(): boolean {
  return document.documentElement.dataset.sidebar === 'collapsed';
}

function LoadErrorBanner() {
  const { loadError } = useDashboard();
  if (!loadError) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border border-critical/40 bg-critical-soft px-4 py-3 text-sm text-critical-text">
      Could not load results: {loadError}. Retrying automatically.
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // The pre-paint script in the root layout already applied the stored state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !readCollapsed();
    const root = document.documentElement;
    if (next) root.dataset.sidebar = 'collapsed';
    else delete root.dataset.sidebar;
    try {
      localStorage.setItem('sidebar', next ? 'collapsed' : 'expanded');
    } catch {
      // Storage unavailable; the state still applies for this visit.
    }
    setCollapsed(next);
  }

  return (
    <DashboardProvider>
      <div className="min-h-screen">
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <Topbar onOpenMenu={() => setMobileOpen((open) => !open)} />
        <div className="pt-16 transition-[padding] duration-300 ease-smooth lg:pl-64 lg:collapsed:pl-[76px]">
          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <LoadErrorBanner />
            {children}
          </main>
        </div>
        <RunDialog />
        <RunDetailsDialog />
        <RunCompleteToast />
      </div>
    </DashboardProvider>
  );
}
