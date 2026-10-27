'use client';

import { useEffect, useState } from 'react';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

type Theme = 'system' | 'light' | 'dark';

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'dark', label: 'Dark theme', Icon: MoonIcon },
  { value: 'light', label: 'Light theme', Icon: SunIcon },
  { value: 'system', label: 'System theme', Icon: MonitorIcon },
];

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'system' ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

/** Stamps data-theme on <html> (read by globals.css) and remembers the choice. Dark is the default. */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
}

export function ThemeToggle() {
  // null until the stored value is read on the client, so the server render never guesses.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  return (
    <div role="radiogroup" aria-label="Color theme" className="flex rounded-lg border border-line bg-surface p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={`rounded-md p-1.5 transition-colors ${
            theme === value ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink'
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
