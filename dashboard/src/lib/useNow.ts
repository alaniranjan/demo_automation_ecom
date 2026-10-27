'use client';

import { useEffect, useState } from 'react';

/**
 * Current time, refreshed every `intervalMs`. Null until mounted, because reading the clock
 * during prerendering would bake a stale time into the static shell.
 */
export function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
