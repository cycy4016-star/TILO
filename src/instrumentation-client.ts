// Browser counterpart to src/instrumentation.ts. Top-level code here runs once
// the HTML has loaded, before React hydrates, and installs the two global
// listeners that catch what an error boundary never sees:
//
//   - `error`         — a throw inside an event handler, a bad callback
//   - `unhandledrejection` — a promise nobody caught (a failed fetch, a
//     Paystack callback that never resolved, …)
//
// Reports are fire-and-forget into the same AppLog ledger the server writes to.
// Everything here is wrapped: a broken reporter must never break the page.
import { reportClientError } from '@/lib/telemetry-client';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Resource load failures (a 404'd image, a blocked script) also surface as
    // `error`, but with `target` set to the element. Those are not app faults.
    if (event.target !== window && (event.target as EventTarget | null) != null) return;
    const error = event.error instanceof Error ? event.error : null;
    reportClientError({
      message: error?.message || event.message || 'Uncaught error',
      stack: error?.stack,
      url: window.location.href,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const error = reason instanceof Error ? reason : null;
    reportClientError({
      message:
        error?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection'),
      stack: error?.stack,
      url: window.location.href,
    });
  });
}
