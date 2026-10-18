'use client';

import { useRouter } from 'next/navigation';
// Admin alert client state, shared by the whole terminal: one poll feeds the
// F8 panel, the nav badge, the tab-title counter and the WhatsApp-style toasts.
// The provider lives in the terminal shell so switching panels never restarts
// the poll or loses the seen-set that distinguishes "new" from "still there".
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  type AlertCadenceValue,
  type AlertKindValue,
  AlertsFeed,
} from '@/lib/contracts/admin-alerts';
import { type LiveData, useLiveData } from './use-live';

export type AlertToast = {
  key: number;
  kind: AlertKindValue;
  title: string;
  body: string | null;
};

type AlertsContextValue = {
  feed: LiveData<AlertsFeed>;
  toasts: AlertToast[];
  dismissToast: (key: number) => void;
  markAllRead: () => void;
  savingKind: AlertKindValue | null;
  saveSetting: (
    kind: AlertKindValue,
    cadence: AlertCadenceValue,
    minAmountPesewas: number | null,
  ) => Promise<void>;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

const FEED_PATH = '/api/admin/alerts';
const FEED_MS = 15_000;
const TOAST_MS = 6_500;
const MAX_TOASTS = 3;

export function AdminAlertsProvider({ children }: { children: ReactNode }) {
  const feed = useLiveData(FEED_PATH, AlertsFeed, FEED_MS);
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const [savingKind, setSavingKind] = useState<AlertKindValue | null>(null);
  // Null until the first snapshot primes it — otherwise the initial load would
  // toast the entire backlog.
  const seen = useRef<Set<string> | null>(null);
  const toastSeq = useRef(0);

  const dismissToast = useCallback((key: number) => {
    setToasts((current) => current.filter((toast) => toast.key !== key));
  }, []);

  useEffect(() => {
    const data = feed.data;
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.alerts.map((alert) => alert.id));
      return;
    }
    const fresh = data.alerts.filter(
      (alert) => !seen.current?.has(alert.id) && alert.readAt === null,
    );
    for (const alert of data.alerts) seen.current.add(alert.id);
    if (fresh.length === 0) return;
    const added: AlertToast[] = fresh.slice(0, MAX_TOASTS).map((alert) => ({
      key: ++toastSeq.current,
      kind: alert.kind,
      title: alert.title,
      body: alert.body,
    }));
    setToasts((current) => [...current, ...added].slice(-MAX_TOASTS));
    for (const toast of added) {
      window.setTimeout(() => dismissToast(toast.key), TOAST_MS);
    }
  }, [feed.data, dismissToast]);

  // The tab carries the unread count the way a chat app does.
  useEffect(() => {
    const unread = feed.data?.unread ?? 0;
    document.title = unread > 0 ? `(${unread}) Terminal · Tilza` : 'Terminal · Tilza';
    return () => {
      document.title = 'Terminal · Tilza';
    };
  }, [feed.data?.unread]);

  const markAllRead = useCallback(() => {
    void apiFetch('/api/admin/alerts/read', { method: 'POST' })
      .then(() => feed.refresh())
      .catch(() => undefined);
  }, [feed.refresh]);

  const saveSetting = useCallback(
    async (kind: AlertKindValue, cadence: AlertCadenceValue, minAmountPesewas: number | null) => {
      setSavingKind(kind);
      try {
        await apiFetch('/api/admin/alerts/settings', {
          method: 'PUT',
          body: JSON.stringify({ kind, cadence, minAmountPesewas }),
        });
        feed.refresh();
      } catch {
        // The chip stays where the server last said it was on next poll.
      } finally {
        setSavingKind(null);
      }
    },
    [feed.refresh],
  );

  return (
    <AlertsContext.Provider
      value={{ feed, toasts, dismissToast, markAllRead, savingKind, saveSetting }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAdminAlerts(): AlertsContextValue {
  const value = useContext(AlertsContext);
  if (!value) throw new Error('useAdminAlerts must be used inside AdminAlertsProvider');
  return value;
}

/** Per-kind phosphor colour for tags, toasts and badges. */
export const KIND_TONE: Record<AlertKindValue, 'amber' | 'green' | 'red' | 'cyan' | 'text'> = {
  SIGNUP: 'cyan',
  STORE: 'cyan',
  ORDER: 'green',
  PAYMENT: 'amber',
  INCIDENT: 'red',
  FEEDBACK: 'amber',
};

export const KIND_SHORT: Record<AlertKindValue, string> = {
  SIGNUP: 'sign',
  STORE: 'shop',
  ORDER: 'sale',
  PAYMENT: 'pay',
  INCIDENT: 'inc',
  FEEDBACK: 'fb',
};

/**
 * Bottom-right toast stack — new alerts pop in like any chat app's. Clicking
 * one opens the ALERTS panel; each self-dismisses after a moment.
 */
export function AlertToasts() {
  const { toasts, dismissToast } = useAdminAlerts();
  const router = useRouter();
  if (toasts.length === 0) return null;

  const border: Record<AlertKindValue, string> = {
    SIGNUP: 'border-l-[var(--t-cyan)]',
    STORE: 'border-l-[var(--t-cyan)]',
    ORDER: 'border-l-[var(--t-green)]',
    PAYMENT: 'border-l-[var(--t-amber)]',
    INCIDENT: 'border-l-[var(--t-red)]',
    FEEDBACK: 'border-l-[var(--t-amber)]',
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(92vw,340px)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <button
          key={toast.key}
          type="button"
          onClick={() => {
            dismissToast(toast.key);
            router.push('/dashboard/admin/alerts');
          }}
          className={`pointer-events-auto border border-[var(--t-border)] border-l-2 ${border[toast.kind]} bg-[var(--t-card)] px-3 py-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.65)] transition-colors hover:bg-[var(--t-card-hi)]`}
        >
          <span className="flex items-baseline gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.12em] ${TONE_OF[toast.kind]}`}
            >
              {KIND_SHORT[toast.kind]}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--t-bright)]">
              {toast.title}
            </span>
          </span>
          {toast.body && (
            <span className="mt-0.5 block truncate text-[11px] text-[var(--t-dim)]">
              {toast.body}
            </span>
          )}
          <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--t-faint)]">
            Click to open ALERTS
          </span>
        </button>
      ))}
    </div>
  );
}

const TONE_OF: Record<AlertKindValue, string> = {
  SIGNUP: 'text-[var(--t-cyan)]',
  STORE: 'text-[var(--t-cyan)]',
  ORDER: 'text-[var(--t-green)]',
  PAYMENT: 'text-[var(--t-amber)]',
  INCIDENT: 'text-[var(--t-red)]',
  FEEDBACK: 'text-[var(--t-amber)]',
};
