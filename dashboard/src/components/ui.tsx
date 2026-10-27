'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ReactNode } from 'react';
import { CloseIcon } from './icons';

/**
 * Accessible modal on Headless UI's Dialog (focus trap, Escape, outside click, scroll lock).
 * It shares Headless UI's portal layering with the dropdowns, so a dropdown opened inside a modal stays on top.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'max-w-3xl',
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  size?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition duration-200 ease-out data-closed:opacity-0"
      />
      <DialogPanel
        transition
        className={`relative flex max-h-[85vh] w-full ${size} flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl transition duration-200 ease-out data-closed:translate-y-2 data-closed:scale-95 data-closed:opacity-0`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold text-ink">{title}</DialogTitle>
            {subtitle && <div className="mt-0.5 text-sm text-ink-3">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
      </DialogPanel>
    </Dialog>
  );
}
