// Client-side fetch of the shop's name — needed to sign SMS templates from
// any dashboard island without threading a prop through every page.
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { StorePayload } from '@/lib/contracts/store';

export function useStoreName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/store', { schema: StorePayload })
      .then((store) => {
        if (!cancelled) setName(store.name);
      })
      .catch(() => {
        // The "+" buttons simply wait for the next mount; nothing to show yet.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return name;
}
