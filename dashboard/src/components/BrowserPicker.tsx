'use client';

import { useState } from 'react';
import type { ProjectInfo } from '@/lib/types';
import { BrowserIcon, DeviceGlyph } from './browsers';
import { Card } from './Card';
import { Select } from './dropdowns';
import { CheckIcon, MonitorIcon } from './icons';
import { PreviewToggle } from './LivePreview';
import { useDashboard } from './providers/DashboardProvider';

const DESKTOP = 'Desktop';

/** Web testing runs desktop browsers only; responsive testing runs emulated phones and tablets only. */
export type TestingMode = 'web' | 'responsive';

function Tile({
  project,
  selected,
  compact,
  onToggle,
}: {
  project: ProjectInfo;
  selected: boolean;
  compact: boolean;
  onToggle: () => void;
}) {
  const device = project.kind === 'device';
  const iconSize = compact ? 22 : 28;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={project.label}
      disabled={!project.installed}
      onClick={onToggle}
      title={
        project.installed
          ? project.label
          : `${project.label} needs ${project.channel ?? project.browserName}, which is not installed`
      }
      className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 transition-all duration-200 ease-smooth disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? 'min-w-18 py-2' : device ? 'w-26 py-2.5' : 'w-22 py-2.5'
      } ${
        selected
          ? 'border-accent bg-accent-soft shadow-sm ring-1 ring-accent/30'
          : 'border-line bg-surface enabled:hover:-translate-y-0.5 enabled:hover:border-accent/40 enabled:hover:shadow-md'
      }`}
    >
      {device ? (
        <DeviceGlyph
          project={project}
          width={iconSize}
          height={iconSize}
          className="transition-transform duration-200 group-enabled:group-hover:scale-110"
        />
      ) : (
        <BrowserIcon
          browser={project.name}
          width={iconSize}
          height={iconSize}
          className="transition-transform duration-200 group-enabled:group-hover:scale-110"
        />
      )}
      <span className={`max-w-full truncate text-xs font-medium ${selected ? 'text-ink' : 'text-ink-2'}`}>
        {project.label}
      </span>
      {device && project.viewport && !compact && (
        <span className="text-[10px] tabular-nums text-ink-3">
          {project.viewport.width}×{project.viewport.height}
        </span>
      )}
      {selected && (
        <span className="animate-enter absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-on-accent">
          <CheckIcon width={10} height={10} />
        </span>
      )}
    </button>
  );
}

/**
 * Where tests run: desktop browsers and emulated phones/tablets, grouped in tabs (from the framework's catalog).
 * Every run executes each test once per selected target; at least one target always stays selected.
 */
export function BrowserPicker({ compact = false, testing }: { compact?: boolean; testing?: TestingMode | undefined }) {
  const {
    results,
    selectedBrowsers,
    setSelectedBrowsers,
    selectedDevices,
    setSelectedDevices,
    selectedSize,
    setSelectedSize,
  } = useDashboard();
  const [tabChoice, setTab] = useState(DESKTOP);
  const projects = results?.catalog?.projects ?? [];
  const desktop = projects.filter((project) => project.kind === 'desktop');
  const devices = projects.filter((project) => project.kind === 'device');
  const deviceCategories = [...new Set(devices.map((project) => project.category ?? 'Devices'))];
  const categories =
    testing === 'web' ? [DESKTOP] : testing === 'responsive' ? deviceCategories : [DESKTOP, ...deviceCategories];
  const tab = categories.includes(tabChoice) ? tabChoice : (categories[0] ?? DESKTOP);
  const visible = tab === DESKTOP ? desktop : devices.filter((project) => (project.category ?? 'Devices') === tab);
  const total = selectedBrowsers.length + selectedDevices.length;

  function toggle(project: ProjectInfo) {
    if (project.kind === 'device') {
      const next = selectedDevices.includes(project.name)
        ? selectedDevices.filter((name) => name !== project.name)
        : [...selectedDevices, project.name];
      // Responsive testing may start with no device; the launch button waits for one.
      if (testing === 'responsive' || next.length + selectedBrowsers.length > 0) setSelectedDevices(next);
    } else {
      const next = selectedBrowsers.includes(project.name)
        ? selectedBrowsers.filter((name) => name !== project.name)
        : [...selectedBrowsers, project.name];
      if (next.length + (testing === 'web' ? 0 : selectedDevices.length) > 0) setSelectedBrowsers(next);
    }
  }

  const countIn = (category: string) =>
    category === DESKTOP
      ? selectedBrowsers.length
      : selectedDevices.filter((name) => devices.find((project) => project.name === name)?.category === category)
          .length;

  const sizeOptions = (results?.catalog?.recordingSizes ?? []).map((size) => ({
    value: size.key,
    label: `${size.width} × ${size.height}`,
    description: size.label,
    icon: MonitorIcon,
  }));

  if (projects.length === 0) return null;

  const tabs = categories.length > 1 && (
    <div
      role="tablist"
      aria-label="Target type"
      className="-mx-1 flex flex-wrap gap-x-1 gap-y-1 border-b border-line px-1"
    >
      {categories.map((category) => {
        const count = countIn(category);
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={tab === category}
            onClick={() => setTab(category)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 pb-2 pt-1 text-xs font-medium transition-colors ${
              tab === category ? 'text-ink' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {category}
            {count > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-on-accent">
                {count}
              </span>
            )}
            <span
              className={`absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent transition-transform duration-200 ${
                tab === category ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );

  const tiles = (
    <div role="group" aria-label={tab === DESKTOP ? 'Browsers' : `${tab} devices`} className="flex flex-wrap gap-2">
      {visible.map((project) => (
        <Tile
          key={project.name}
          project={project}
          compact={compact}
          selected={(project.kind === 'device' ? selectedDevices : selectedBrowsers).includes(project.name)}
          onToggle={() => toggle(project)}
        />
      ))}
    </div>
  );

  const deviceNote = tab !== DESKTOP && visible[0] && (
    <p className="text-xs text-ink-3">
      Emulates each device&apos;s screen, pixel density, touch and user agent · runs in{' '}
      {visible[0].os === 'Android' ? 'Chrome' : 'WebKit (Safari engine)'}
    </p>
  );

  const sizeSelect = tab === DESKTOP && sizeOptions.length > 0 && (
    <Select
      label="Browser size"
      value={selectedSize}
      onChange={setSelectedSize}
      options={sizeOptions}
      icon={MonitorIcon}
      className="w-60"
    />
  );

  if (compact) {
    return (
      <fieldset className="space-y-3">
        <legend className="sr-only">Targets</legend>
        {tabs}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tiles}
          <div className="flex flex-wrap items-center gap-2">
            {sizeSelect}
            <PreviewToggle size="sm" />
          </div>
        </div>
      </fieldset>
    );
  }

  return (
    <Card
      title={testing === 'web' ? 'Browsers' : testing === 'responsive' ? 'Devices' : 'Browsers & devices'}
      subtitle={
        testing === 'web'
          ? `${selectedBrowsers.length} selected · desktop window size below`
          : testing === 'responsive'
            ? selectedDevices.length > 0
              ? `${selectedDevices.length} selected`
              : 'Select one or more phones or tablets'
            : `${total} selected · ${selectedBrowsers.length} browser${selectedBrowsers.length === 1 ? '' : 's'}, ${selectedDevices.length} device${
                selectedDevices.length === 1 ? '' : 's'
              }`
      }
      actions={<PreviewToggle size="sm" />}
    >
      <div className="space-y-4">
        {tabs}
        {tiles}
        {deviceNote}
        {sizeSelect && <div className="border-t border-line pt-4">{sizeSelect}</div>}
      </div>
    </Card>
  );
}
