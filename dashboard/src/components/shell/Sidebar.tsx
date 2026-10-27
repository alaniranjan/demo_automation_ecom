'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { APP_NAME } from '@/lib/app';
import { useDashboard } from '../providers/DashboardProvider';
import { CodeIcon, DevicesIcon, FolderIcon, HistoryIcon, HomeIcon, ImagesIcon, MonitorIcon, PanelLeftIcon, ReportIcon, SettingsIcon, SuitesIcon } from '../icons';

interface NavLink {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface NavSection {
  title: string;
  links: NavLink[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    links: [
      { href: '/', label: 'Dashboard', Icon: HomeIcon },
      { href: '/suites', label: 'Test Suites', Icon: SuitesIcon },
    ],
  },
  { title: 'Web Testing', links: [{ href: '/runs', label: 'Desktop Browsers', Icon: MonitorIcon }] },
  { title: 'Responsive Testing', links: [{ href: '/responsive', label: 'Mobile & Tablet', Icon: DevicesIcon }] },
  { title: 'UI Testing', links: [{ href: '/visual', label: 'Visual Testing', Icon: ImagesIcon }] },
  {
    title: 'Results',
    links: [
      { href: '/history', label: 'Execution History', Icon: HistoryIcon },
      { href: '/reports', label: 'Allure Reports', Icon: ReportIcon },
      { href: '/artifacts', label: 'Artifacts', Icon: FolderIcon },
    ],
  },
  {
    title: 'System',
    links: [
      { href: '/api-docs', label: 'API Documentation', Icon: CodeIcon },
      { href: '/settings', label: 'Settings', Icon: SettingsIcon },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  link,
  active,
  badge,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  badge?: ReactNode;
  onNavigate: () => void;
}) {
  const { href, label, Icon } = link;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-all duration-200 ease-smooth lg:collapsed:justify-center lg:collapsed:px-0 ${
        active
          ? 'bg-sidebar-active font-medium text-accent-strong'
          : 'text-sidebar-ink-2 hover:translate-x-0.5 hover:bg-sidebar-2 hover:text-sidebar-ink lg:collapsed:hover:translate-x-0'
      }`}
    >
      <Icon
        width={19}
        height={19}
        className="shrink-0 transition-transform duration-200 ease-smooth group-hover:scale-110"
      />
      <span className="truncate lg:collapsed:hidden">{label}</span>
      {badge && (
        <span className="ml-auto lg:collapsed:absolute lg:collapsed:right-1.5 lg:collapsed:top-1.5">{badge}</span>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full z-50 ml-3 hidden -translate-x-1 whitespace-nowrap rounded-md bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink opacity-0 shadow-lg ring-1 ring-line transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 lg:collapsed:block"
      >
        {label}
      </span>
    </Link>
  );
}

function CountBadge({ value, tone = 'neutral' }: { value: number; tone?: 'neutral' | 'critical' }) {
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums lg:collapsed:h-2 lg:collapsed:min-w-2 lg:collapsed:px-0 lg:collapsed:text-[0px] ${
        tone === 'critical'
          ? 'bg-critical text-white'
          : 'bg-sidebar-2 text-sidebar-ink-2 ring-1 ring-sidebar-line lg:collapsed:bg-accent lg:collapsed:ring-0'
      }`}
    >
      {value}
    </span>
  );
}

function LiveDot() {
  return (
    <span className="relative flex size-2.5" aria-label="Run in progress">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
      <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
    </span>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
  collapsed: boolean;
}

export function Sidebar({ mobileOpen, onCloseMobile, onToggleCollapsed, collapsed }: SidebarProps) {
  const pathname = usePathname();
  const { results, activeRun, backendOnline } = useDashboard();
  const failed = results?.summary?.counts.failed ?? 0;
  const runCount = results?.runs.length ?? 0;
  const artifactCount = results?.tests.reduce((sum, test) => sum + test.attachments.length, 0) ?? 0;
  const meta = results?.meta;
  const playwrightVersion = results?.catalog?.playwrightVersion;

  const badges: Record<string, ReactNode> = {
    '/runs': activeRun ? <LiveDot /> : undefined,
    '/responsive': activeRun ? <LiveDot /> : undefined,
    '/suites': failed > 0 ? <CountBadge value={failed} tone="critical" /> : undefined,
    '/history': runCount > 0 ? <CountBadge value={runCount} /> : undefined,
    '/artifacts': artifactCount > 0 ? <CountBadge value={artifactCount} /> : undefined,
  };

  return (
    <>
      <div
        className={`fixed inset-0 top-16 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={`fixed bottom-0 left-0 top-16 z-30 flex w-64 flex-col border-r border-sidebar-line bg-sidebar text-sidebar-ink transition-[width,transform] duration-300 ease-smooth lg:translate-x-0 lg:collapsed:w-[76px] ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        aria-label="Sidebar"
      >
        <nav
          aria-label="Main navigation"
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 lg:collapsed:overflow-visible"
        >
          <div className="space-y-5 lg:collapsed:space-y-3">
            {NAV_SECTIONS.map((section, index) => (
              <section key={section.title} aria-labelledby={`nav-${index}`}>
                <h2
                  id={`nav-${index}`}
                  className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-ink-2/70 lg:collapsed:sr-only"
                >
                  {section.title}
                </h2>
                {index > 0 && (
                  <hr className="mx-auto mb-3 hidden w-8 border-sidebar-line lg:collapsed:block" aria-hidden="true" />
                )}
                <ul className="space-y-1">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <NavItem
                        link={link}
                        active={isActive(pathname, link.href)}
                        badge={badges[link.href]}
                        onNavigate={onCloseMobile}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </nav>

        <div className="border-t border-sidebar-line p-3">
          <div className="px-2 pb-3 pt-1 lg:collapsed:hidden">
            <p className="flex items-center gap-2 text-sm text-sidebar-ink">
              <HomeIcon width={14} height={14} className="text-good" />
              {APP_NAME} <span className="text-sidebar-ink-2">v{meta?.version ?? '…'}</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-sidebar-ink-2">
              <span
                className={`size-2 rounded-full ${backendOnline === false ? 'bg-critical' : 'bg-good'}`}
                aria-hidden="true"
              />
              Playwright {playwrightVersion ?? '…'} · Node {meta?.nodeVersion.replace(/^v/, '') ?? '…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            className="hidden h-9 w-full items-center gap-3 rounded-lg px-3 text-xs font-medium text-sidebar-ink-2 transition-colors duration-200 hover:bg-sidebar-2 hover:text-sidebar-ink lg:flex lg:collapsed:justify-center lg:collapsed:px-0"
          >
            <PanelLeftIcon className="shrink-0 transition-transform duration-300 lg:collapsed:rotate-180" />
            <span className="lg:collapsed:hidden">Collapse sidebar</span>
            <span className="sr-only hidden lg:collapsed:inline">Expand sidebar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
