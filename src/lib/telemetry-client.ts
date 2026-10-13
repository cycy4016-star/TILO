// Browser-side error reporting. Lives in the page bundle, so it must never
// import anything server-only (Prisma, next/headers, …).
//
// Delivery is best-effort by design: a report that fails to send is dropped,
// never surfaced to the user, never retried into a loop. `sendBeacon` is
// preferred because it survives the page being torn down mid-navigation —
// which is exactly when a crash report matters most.
const ENDPOINT = '/api/telemetry/client';

export type ClientErrorReport = {
  message: string;
  stack?: string;
  digest?: string;
  /** Full page URL, so the operator sees where it happened. */
  url?: string;
  /** React component stack, when the error came out of a render. */
  componentStack?: string;
};

/** Queue a report to the platform error ledger. Safe to call anywhere. */
export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ClientErrorReport = {
      message: report.message.slice(0, 600),
      url: (report.url ?? window.location.href).slice(0, 300),
      stack: report.stack?.slice(0, 6000),
      digest: report.digest?.slice(0, 200),
      componentStack: report.componentStack?.slice(0, 6000),
    };
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never be the thing that breaks the page.
  }
}
