'use client';

// Local-only persistence for storefront preferences (saved items, recently
// viewed, recent searches). The storefront has no shopper accounts, so this is
// the whole memory: tied to the device, never sent to the server.
//
// SSR-safe by construction: the first render always uses `initial`, and the
// stored value is adopted in an effect. That keeps markup identical on the
// server and the first client render, so hydration never mismatches.
import { useCallback, useEffect, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initial: T,
): readonly [T, (next: T | ((current: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // Malformed or unavailable storage: keep the in-memory value.
    } finally {
      setHydrated(true);
    }
  }, [key]);

  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue((current) => (typeof next === 'function' ? (next as (c: T) => T)(current) : next));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode / quota: the UI still works, it just forgets on reload.
    }
  }, [key, value, hydrated]);

  return [value, update, hydrated] as const;
}
