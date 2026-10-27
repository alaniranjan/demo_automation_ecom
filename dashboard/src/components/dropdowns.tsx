'use client';

/**
 * The dashboard's dropdown components, built on Headless UI (keyboard navigation, focus management,
 * screen-reader roles and anchored positioning) and styled with the design tokens:
 *
 * - Select:     pick one value (filters such as folder, tag, suite, sort)
 * - ActionMenu: a list of actions (row "⋮" menus)
 * - Dropdown:   a free-form panel (project details, notifications, account)
 */

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSeparator,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { CheckIcon, ChevronDownIcon } from './icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const panelClass =
  'z-60 rounded-xl border border-line bg-surface shadow-2xl shadow-black/30 outline-none [--anchor-gap:6px] [--anchor-padding:8px] ' +
  'origin-top transition duration-150 ease-out data-closed:-translate-y-1 data-closed:scale-95 data-closed:opacity-0';

// ---------------------------------------------------------------- Select

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Count shown on the right, e.g. number of tests. */
  count?: number;
  /** Colored dot (CSS color) before the label, e.g. a status color. */
  dot?: string;
  icon?: IconComponent;
}

interface SelectProps<T extends string> {
  /** Accessible name, and the muted prefix shown inside the button ("Folder: Auth"). */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  icon?: IconComponent;
  /** Hide the "Label:" prefix in the button. */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
  align?: 'start' | 'end';
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  icon: Icon,
  hideLabel = false,
  disabled = false,
  className = '',
  align = 'start',
}: SelectProps<T>) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <ListboxButton
        aria-label={`${label}: ${selected?.label ?? ''}`}
        className={`group inline-flex h-9 min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-all duration-200 ease-smooth hover:border-accent/50 hover:bg-surface-2 focus:outline-none data-focus:outline-2 data-focus:outline-accent data-open:border-accent data-open:ring-2 data-open:ring-accent/20 data-disabled:opacity-50 ${className}`}
      >
        {Icon && <Icon width={15} height={15} className="shrink-0 text-ink-3 transition-colors group-hover:text-accent-strong" />}
        {selected?.dot && (
          <span className="size-2 shrink-0 rounded-full" style={{ background: selected.dot }} aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">
          {!hideLabel && <span className="text-ink-3">{label}: </span>}
          {selected?.label}
        </span>
        <ChevronDownIcon
          width={15}
          height={15}
          className="ml-auto shrink-0 text-ink-3 transition-transform duration-200 group-data-open:rotate-180"
        />
      </ListboxButton>
      <ListboxOptions
        anchor={`bottom ${align}`}
        transition
        className={`${panelClass} max-h-72 w-(--button-width) min-w-52 overflow-y-auto p-1`}
      >
        {options.map((option) => (
          <ListboxOption
            key={option.value}
            value={option.value}
            className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 transition-colors duration-100 select-none data-focus:bg-surface-2 data-focus:text-ink data-selected:text-ink"
          >
            {option.icon && (
              <option.icon width={15} height={15} className="shrink-0 text-ink-3 group-data-selected:text-accent-strong" />
            )}
            {option.dot && (
              <span className="size-2 shrink-0 rounded-full" style={{ background: option.dot }} aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate group-data-selected:font-medium">{option.label}</span>
              {option.description && <span className="block truncate text-xs text-ink-3">{option.description}</span>}
            </span>
            {option.count !== undefined && (
              <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-ink-3 group-data-focus:bg-surface">
                {option.count}
              </span>
            )}
            <CheckIcon width={15} height={15} className="shrink-0 text-accent-strong opacity-0 group-data-selected:opacity-100" />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

// ---------------------------------------------------------------- ActionMenu

export interface ActionItem {
  label: string;
  icon?: IconComponent;
  onSelect?: () => void;
  href?: string;
  /** Plain <a> (for API downloads) instead of a client-side Link. */
  download?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Draw a separator above this item. */
  separated?: boolean;
}

export function ActionMenu({ label, trigger, items }: { label: string; trigger: ReactNode; items: ActionItem[] }) {
  const itemClass = (tone: ActionItem['tone']) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100 data-focus:bg-surface-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 ${
      tone === 'danger' ? 'text-critical-text' : 'text-ink'
    }`;

  return (
    <Menu>
      <MenuButton
        aria-label={label}
        className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none data-focus:outline-2 data-focus:outline-accent data-open:bg-surface-2 data-open:text-ink"
      >
        {trigger}
      </MenuButton>
      <MenuItems anchor="bottom end" transition className={`${panelClass} w-52 p-1`}>
        {items.map((item) => {
          const content = (
            <>
              {item.icon && <item.icon width={15} height={15} className="shrink-0 text-ink-3" />}
              {item.label}
            </>
          );
          return (
            <div key={item.label}>
              {item.separated && <MenuSeparator className="my-1 h-px bg-line" />}
              <MenuItem disabled={item.disabled ?? false}>
                {item.href && item.download ? (
                  <a href={item.href} className={itemClass(item.tone)}>
                    {content}
                  </a>
                ) : item.href ? (
                  <Link href={item.href} className={itemClass(item.tone)}>
                    {content}
                  </Link>
                ) : (
                  <button type="button" onClick={item.onSelect} className={itemClass(item.tone)}>
                    {content}
                  </button>
                )}
              </MenuItem>
            </div>
          );
        })}
      </MenuItems>
    </Menu>
  );
}

// ---------------------------------------------------------------- Dropdown (popover)

export function Dropdown({
  trigger,
  label,
  align = 'right',
  width = 'w-64',
  children,
}: {
  trigger: ReactNode;
  label: string;
  align?: 'left' | 'right';
  width?: string;
  children: (close: () => void) => ReactNode;
}) {
  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={label}
        className="group flex items-center rounded-lg focus:outline-none data-focus:outline-2 data-focus:outline-accent"
      >
        {trigger}
      </PopoverButton>
      <PopoverPanel
        anchor={align === 'right' ? 'bottom end' : 'bottom start'}
        transition
        className={`${panelClass} ${width} overflow-hidden`}
      >
        {({ close }) => <>{children(() => close())}</>}
      </PopoverPanel>
    </Popover>
  );
}
