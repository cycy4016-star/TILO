// route error boundary (Client Component). The user sees a retry button; the
// operator gets the failure filed in the AppLog ledger behind /dashboard/admin.

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { reportClientError } from '@/lib/telemetry-client';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A render error does not reliably reach window.onerror, so the boundary is
    // the only place this one gets reported.
    reportClientError({
      message: error.message || 'Route render failed',
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="container mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">An unexpected error occurred. Please try again.</p>
      <Button onClick={() => reset()}>Try again</Button>
    </main>
  );
}
