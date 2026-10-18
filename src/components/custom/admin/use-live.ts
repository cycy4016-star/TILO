'use client';

// Live data for the ops console. One small hook owns the fetch, an optional
// auto-refresh pulse (paused while the tab is hidden so a backgrounded console
// is not hammering the API) and a manual refresh. Deliberately dependency-free
// — no SWR, no react-query — so the console keeps using the app's native-fetch
// transport (src/lib/api-client) and nothing else has to change.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ZodType } from 'zod';
import { apiFetch } from '@/lib/api-client';

export type LiveData<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
  live: boolean;
  /** Epoch ms of the last successful fetch, or null before the first one. */
  updatedAt: number | null;
  pause: () => void;
  resume: () => void;
  refresh: () => void;
};

export function useLiveData<T>(path: string, schema: ZodType<T>, intervalMs = 20_000): LiveData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const hasLoaded = useRef(false);
  // Monotonic request id: a newer fetch (filter change, pulse) always wins and
  // a slow stale response can never overwrite fresher data on screen.
  const requestSeq = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      const id = ++requestSeq.current;
      if (!quiet) {
        setLoading(true);
        setError(false);
      }
      try {
        const next = await apiFetch(path, { schema });
        if (id !== requestSeq.current) return;
        setData(next);
        setUpdatedAt(Date.now());
        setError(false);
        hasLoaded.current = true;
      } catch {
        // A failed background refresh keeps the last good snapshot on screen;
        // only a failure before any data has arrived is worth a full error state.
        if (id !== requestSeq.current) return;
        if (!hasLoaded.current) setError(true);
      } finally {
        if (id === requestSeq.current) setLoading(false);
      }
    },
    [path, schema],
  );

  // Initial load, and an immediate silent reload whenever the path changes
  // (range, filters). `load` closes over `path`, so a filter click re-runs this
  // effect at once instead of waiting for the pulse.
  useEffect(() => {
    void load(true);
  }, [load]);

  // The refresh pulse. Quiet so the panel never flashes a skeleton mid-session.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [live, intervalMs, load]);

  // Catch up the moment the operator returns to the tab.
  useEffect(() => {
    if (!live) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [live, load]);

  return {
    data,
    loading,
    error,
    live,
    updatedAt,
    pause: () => setLive(false),
    resume: () => setLive(true),
    refresh: () => void load(true),
  };
}
