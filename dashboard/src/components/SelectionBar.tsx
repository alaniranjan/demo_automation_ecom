'use client';

import { useEffect, useRef } from 'react';
import { TrashIcon } from './icons';
import { buttonStyles } from './PageHeader';

/** A checkbox that can show "some selected" (indeterminate), for select-all headers. */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      // Inside clickable table rows: ticking a box must not also open the row.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      aria-label={label}
      className="size-4 cursor-pointer accent-[var(--accent)]"
    />
  );
}

/** Select-all checkbox with "Delete selected" and "Delete all shown" buttons above a table. */
export function SelectionBar({
  noun,
  shown,
  selected,
  onToggleAll,
  onDeleteSelected,
  onDeleteAll,
}: {
  /** Plural name of the rows, e.g. "runs". */
  noun: string;
  shown: number;
  selected: number;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/40 px-5 py-2.5">
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
        <Checkbox
          checked={shown > 0 && selected === shown}
          indeterminate={selected > 0 && selected < shown}
          onChange={onToggleAll}
          label={`Select all ${shown} ${noun} shown`}
        />
        {selected > 0 ? `${selected} of ${shown} selected` : `Select all ${shown} shown`}
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={selected === 0}
          onClick={onDeleteSelected}
          className={`${buttonStyles.secondary} h-8 text-xs text-critical-text`}
        >
          <TrashIcon width={13} height={13} /> Delete selected ({selected})
        </button>
        <button
          type="button"
          disabled={shown === 0}
          onClick={onDeleteAll}
          className={`${buttonStyles.secondary} h-8 text-xs text-critical-text`}
        >
          <TrashIcon width={13} height={13} /> Delete all shown ({shown})
        </button>
      </div>
    </div>
  );
}
