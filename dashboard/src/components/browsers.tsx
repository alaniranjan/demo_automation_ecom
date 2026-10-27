'use client';

import { useState, type SVGProps } from 'react';
import type { ProjectInfo, RunRecord, RunTarget } from '@/lib/types';

type IconProps = SVGProps<SVGSVGElement>;

/** Simplified browser marks (not official logos) so each browser is recognisable at a glance. */
function ChromeMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 1a11 11 0 0 1 9.53 5.5H12a5.5 5.5 0 0 0-4.76 2.75L3.47 6.5A11 11 0 0 1 12 1Z" fill="#ea4335" />
      <path d="M21.53 6.5A11 11 0 0 1 12 23l4.76-8.25A5.5 5.5 0 0 0 17.5 12a5.5 5.5 0 0 0-.74-2.75Z" fill="#fbbc04" />
      <path d="M12 23A11 11 0 0 1 3.47 6.5l4.77 8.25A5.5 5.5 0 0 0 12 17.5h4.76Z" fill="#34a853" />
      <circle cx="12" cy="12" r="5" fill="#fff" />
      <circle cx="12" cy="12" r="4" fill="#4285f4" />
    </svg>
  );
}

function FirefoxMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="11" fill="#592acb" />
      <path
        d="M21.5 9.5A10 10 0 1 1 6 3.5c-.5 1.5-.2 3 .7 4 .8-2 2.6-3.3 4.8-3.6-1 1.7-.8 3.3.5 4.5 1.6 1.5 4.3.9 4.5-1.6 1.6.6 2.9 1.4 5 2.7Z"
        fill="#ff7139"
      />
      <circle cx="12" cy="13" r="4.5" fill="#ffbd4f" />
    </svg>
  );
}

function WebkitMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="11" fill="#1a8cff" />
      <circle cx="12" cy="12" r="9" fill="#e9f3ff" />
      <path d="m12 4.5 2 7.5-2 7.5-2-7.5Z" fill="#ff3b30" transform="rotate(45 12 12)" />
      <path d="m12 4.5 2 7.5H10Z" fill="#ff3b30" transform="rotate(45 12 12)" />
      <path d="m12 19.5-2-7.5h4Z" fill="#8e8e93" transform="rotate(45 12 12)" />
    </svg>
  );
}

function GenericMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

const MARKS: Record<string, (props: IconProps) => React.JSX.Element> = {
  chrome: ChromeMark,
  firefox: FirefoxMark,
  webkit: WebkitMark,
};

const NAMES: Record<string, { label: string; detail: string }> = {
  chrome: { label: 'Chrome', detail: 'Google Chrome' },
  firefox: { label: 'Firefox', detail: "Playwright's Firefox build" },
  webkit: { label: 'WebKit', detail: 'Safari engine' },
};

export function browserName(key: string): string {
  return NAMES[key]?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function browserDetail(project: Pick<ProjectInfo, 'name' | 'browserName' | 'channel'>): string {
  return (
    NAMES[project.name]?.detail ??
    `${project.browserName ?? 'browser'} engine${project.channel ? ` · ${project.channel}` : ''}`
  );
}

export function BrowserIcon({ browser, ...props }: { browser: string } & IconProps) {
  const Mark = MARKS[browser] ?? GenericMark;
  return <Mark {...props} />;
}

/** Phone or tablet glyph, tinted by OS (Android green, iOS graphite); not an official logo. */
export function DeviceGlyph({ project, ...props }: { project: Pick<ProjectInfo, 'category' | 'os'> } & IconProps) {
  const tablet = /tablet|ipad/i.test(project.category ?? '');
  const android = project.os === 'Android';
  const body = android ? '#3ddc84' : '#8e8e93';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {tablet ? (
        <>
          <rect x="3.5" y="2.5" width="17" height="19" rx="2.5" fill={body} />
          <rect x="5" y="4.5" width="14" height="15" rx="1" fill="#0b1220" />
          <circle cx="12" cy="3.5" r="0.6" fill="#0b1220" />
        </>
      ) : (
        <>
          <rect x="6" y="1.5" width="12" height="21" rx="3" fill={body} />
          <rect x="7.3" y="3" width="9.4" height="18" rx="2" fill="#0b1220" />
          {android ? (
            <circle cx="12" cy="4.4" r="0.7" fill={body} />
          ) : (
            <rect x="10.2" y="3.7" width="3.6" height="1.2" rx="0.6" fill={body} />
          )}
        </>
      )}
    </svg>
  );
}

/** Icon for any run target: a browser mark for desktop browsers, a device glyph for emulated devices. */
export function TargetIcon({
  name,
  projects,
  ...props
}: { name: string; projects: readonly ProjectInfo[] } & IconProps) {
  const project = projects.find((entry) => entry.name === name);
  return project?.kind === 'device' ? (
    <DeviceGlyph project={project} {...props} />
  ) : (
    <BrowserIcon browser={name} {...props} />
  );
}

/** Display name of a run target from the catalog (e.g. "iPhone 17 Pro"), falling back to the browser name. */
export function targetLabel(name: string, projects: readonly ProjectInfo[]): string {
  return projects.find((entry) => entry.name === name)?.label ?? browserName(name);
}

/** The browser a project's version number belongs to: the desktop browser, or the engine inside an emulated device. */
function engineName(name: string, project: ProjectInfo | undefined): string {
  if (project?.channel === 'chrome') return 'Chrome';
  if (project?.browserName === 'firefox') return 'Firefox';
  if (project?.browserName === 'webkit') return 'WebKit';
  if (project?.browserName === 'chromium') return 'Chromium';
  return browserName(name);
}

/** "v155.0.8059.85" for a desktop browser; "iOS 18.7 · WebKit 27.2" for a device. */
export function targetVersion(target: RunTarget, projects: readonly ProjectInfo[]): string | undefined {
  const project = projects.find((entry) => entry.name === target.project);
  if (project?.kind !== 'device') return target.version && `v${target.version}`;
  const engine = target.version && `${engineName(target.project, project)} ${target.version}`;
  return [target.os, engine].filter(Boolean).join(' · ') || undefined;
}

/** The browsers and devices a run used: icon, name and version, the first `max` listed and the rest counted. */
export function RunTargets({
  run,
  projects,
  max = 2,
}: {
  run: Pick<RunRecord, 'projects' | 'targets'>;
  projects: readonly ProjectInfo[];
  max?: number;
}) {
  const targets: RunTarget[] = run.targets?.length ? run.targets : run.projects.map((project) => ({ project }));
  const [expanded, setExpanded] = useState(false);
  const hidden = expanded ? 0 : Math.max(0, targets.length - max);

  return (
    <ul className="space-y-1.5">
      {targets.slice(0, targets.length - hidden).map((target) => {
        const version = targetVersion(target, projects);
        return (
          <li key={target.project} className="flex items-center gap-2">
            <TargetIcon name={target.project} projects={projects} width={18} height={18} className="shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] text-ink">{targetLabel(target.project, projects)}</span>
              {version && <span className="block truncate text-[11px] tabular-nums text-ink-3">{version}</span>}
            </span>
          </li>
        );
      })}
      {targets.length > max && (
        <li className="pl-6.5">
          {/* Inside clickable table rows: toggling the list must not also open the row. */}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className="rounded text-[11px] font-medium text-accent-strong hover:underline"
          >
            {expanded ? 'Show less' : `+${hidden} more`}
          </button>
        </li>
      )}
    </ul>
  );
}
