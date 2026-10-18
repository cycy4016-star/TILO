// The Tilza Terminal chrome: masthead + command line, the live ticker tape,
// the function-key section nav, and the status bar. One overview fetch feeds
// both the tape and the status readout so the console makes a single request
// for its furniture on top of whatever each panel fetches for itself.
//
// Layout: the terminal owns the whole viewport (h-dvh). Masthead, tape, key nav
// and status bar are pinned; the panel area is the only thing that scrolls —
// the way a real terminal behaves.
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AdminOverview } from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import { AdminAlertsProvider, AlertToasts, useAdminAlerts } from '../use-admin-alerts';
import { useLiveData } from '../use-live';
import { ageLabel, Dot, num, TONE } from './primitives';

export const SECTIONS = [
  { code: 'OV', fn: 'F1', href: '/dashboard/admin', label: 'OVERVIEW' },
  { code: 'SH', fn: 'F2', href: '/dashboard/admin/shops', label: 'SHOPS' },
  { code: 'AC', fn: 'F3', href: '/dashboard/admin/users', label: 'ACCOUNTS' },
  { code: 'PR', fn: 'F4', href: '/dashboard/admin/products', label: 'PRODUCTS' },
  { code: 'EV', fn: 'F5', href: '/dashboard/admin/events', label: 'EVENTS' },
  { code: 'HL', fn: 'F6', href: '/dashboard/admin/health', label: 'HEALTH' },
  { code: 'FB', fn: 'F7', href: '/dashboard/admin/feedback', label: 'FEEDBACK' },
  { code: 'AL', fn: 'F8', href: '/dashboard/admin/alerts', label: 'ALERTS' },
  { code: 'RP', fn: 'F9', href: '/dashboard/admin/report', label: 'REPORT' },
  { code: 'VT', fn: 'F10', href: '/dashboard/admin/vault', label: 'VAULT' },
] as const;

const FEED_PATH = '/api/admin/overview?days=14';
const FEED_MS = 15_000;

function Clock() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stamp = (timeZone: string) =>
    now === null
      ? '--:--:--'
      : new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone,
        }).format(new Date(now));

  return (
    <span className="flex shrink-0 items-center gap-3 text-[11px]">
      <span className="flex items-baseline gap-1.5">
        <span className="font-bold text-[var(--t-bright)]">{stamp('Africa/Accra')}</span>
        <span className="text-[10px] text-[var(--t-faint)]">GMT</span>
      </span>
      <span className="hidden items-baseline gap-1.5 sm:flex">
        <span className="text-[var(--t-dim)]">{stamp('UTC')}</span>
        <span className="text-[10px] text-[var(--t-faint)]">UTC</span>
      </span>
    </span>
  );
}

type TapeItem = { k: string; v: string; tone: 'amber' | 'green' | 'red' | 'cyan' | 'text' };

function tape(overview: AdminOverview): TapeItem[] {
  const outstanding = overview.gmvPesewas - overview.paidPesewas;
  return [
    { k: 'TILZA', v: 'TERMINAL', tone: 'amber' },
    { k: 'ACCOUNTS', v: num(overview.users), tone: 'text' },
    { k: 'SHOPS', v: `${overview.activeStores}/${overview.stores}`, tone: 'green' },
    { k: 'ITEMS', v: num(overview.items), tone: 'text' },
    { k: 'ORDERS', v: num(overview.orders), tone: 'text' },
    { k: 'TODAY', v: num(overview.ordersToday), tone: 'cyan' },
    { k: 'GMV', v: formatGhs(overview.gmvPesewas), tone: 'amber' },
    { k: 'COLLECTED', v: formatGhs(overview.paidPesewas), tone: 'green' },
    { k: 'OUTSTANDING', v: formatGhs(outstanding), tone: outstanding > 0 ? 'red' : 'text' },
    { k: 'CUSTOMERS', v: num(overview.customers), tone: 'text' },
    { k: 'LEADS', v: num(overview.leads), tone: 'text' },
    { k: 'INQUIRIES', v: num(overview.inquiries), tone: 'text' },
    {
      k: 'INCIDENTS',
      v: num(overview.errorsOpen),
      tone: overview.errorsOpen > 0 ? 'red' : 'green',
    },
    {
      k: 'FEEDBACK',
      v: num(overview.feedbackNew),
      tone: overview.feedbackNew > 0 ? 'amber' : 'green',
    },
    {
      k: 'SMS',
      v: `${overview.smsSentMonth}/${overview.smsFailedMonth}F`,
      tone: overview.smsFailedMonth > 0 ? 'red' : 'text',
    },
    {
      k: 'PAYSTACK',
      v: `${overview.paymentsSuccess}/${overview.paymentsFailed}F`,
      tone: overview.paymentsFailed > 0 ? 'red' : 'green',
    },
    { k: 'SIGNUPS MTD', v: num(overview.signupsMonth), tone: 'text' },
  ];
}

function Tape({ items }: { items: TapeItem[] }) {
  return (
    <div className="tlz-print-hide relative overflow-hidden border-b border-[var(--t-border)] bg-[var(--t-panel)]">
      <div
        className="tlz-ticker flex w-max items-center gap-8 py-1.5 pl-4 text-[11px] font-bold"
        aria-hidden
      >
        {[0, 1].map((copy) =>
          items.map((item) => (
            <span key={`${copy}-${item.k}`} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[var(--t-faint)]">{item.k}</span>
              <span className={TONE[item.tone]}>{item.v}</span>
              <span className="text-[var(--t-faint)]">·</span>
            </span>
          )),
        )}
      </div>
      <span className="sr-only">{items.map((item) => `${item.k} ${item.v}`).join(', ')}</span>
    </div>
  );
}

function CommandLine() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim().toUpperCase();
      if (!cmd) return;
      const match = SECTIONS.find(
        (section) => section.code === cmd || section.fn === cmd || section.label === cmd,
      );
      if (match) {
        router.push(match.href);
        setNote(null);
        setValue('');
        return;
      }
      if (cmd === 'HELP' || cmd === '?') {
        setNote(SECTIONS.map((section) => `${section.code}:${section.label}`).join('  '));
        return;
      }
      setNote(`NO SUCH FUNCTION — ${cmd} · TYPE HELP`);
    },
    [router],
  );

  // "/" is the terminal's "put the cursor in the command line" key, and
  // Alt+1..7 jumps to a function the way F-keys would on a real desk.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement | null;
        const typing =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable === true;
        if (!typing) {
          event.preventDefault();
          focusInput();
        }
        return;
      }
      if (event.altKey && /^[1-9]$/.test(event.key)) {
        const section = SECTIONS[Number(event.key) - 1];
        if (section) {
          event.preventDefault();
          router.push(section.href);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusInput, router]);

  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        run(value);
      }}
    >
      <label className="sr-only" htmlFor="tlz-command">
        Terminal command
      </label>
      <span
        aria-hidden
        className="flex items-center border border-r-0 border-[var(--t-border)] bg-black px-2.5 py-[5px] text-[12px] font-bold text-[var(--t-amber)]"
      >
        &gt;
      </span>
      <input
        id="tlz-command"
        ref={inputRef}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setValue(event.target.value);
          setNote(null);
        }}
        placeholder="CODE + <GO>   ·   OV  SH  AC  PR  EV  HL  FB  AL  RP  VT   ·   HELP"
        className="min-w-0 flex-1 border border-[var(--t-border)] bg-black px-2.5 py-[5px] text-[12px] text-[var(--t-bright)] placeholder:text-[var(--t-faint)] focus:border-[var(--t-amber)] focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 border border-[var(--t-amber)] bg-[var(--t-amber)] px-3 py-[5px] text-[10px] font-bold uppercase tracking-[0.1em] text-black transition-colors hover:bg-[var(--t-amber-dim)]"
      >
        &lt;GO&gt;
      </button>
      {note && (
        <span className="hidden max-w-xs shrink truncate text-[10px] font-bold text-[var(--t-red)] lg:block">
          {note}
        </span>
      )}
    </form>
  );
}

function FunctionNav() {
  const pathname = usePathname();
  const { feed } = useAdminAlerts();
  const unread = feed.data?.unread ?? 0;

  return (
    <nav
      aria-label="Terminal functions"
      className="tlz-print-hide relative flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-[var(--t-border)] bg-[var(--t-panel)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SECTIONS.map((section) => {
        const active =
          section.href === '/dashboard/admin'
            ? pathname === section.href
            : pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
              active
                ? 'bg-[var(--t-amber)] text-black'
                : 'text-[var(--t-dim)] hover:bg-[var(--t-card-hi)] hover:text-[var(--t-amber)]'
            }`}
          >
            <span className={active ? 'text-black/60' : 'text-[var(--t-amber-dim)]'}>
              {section.fn}
            </span>
            {section.label}
            {section.code === 'AL' && unread > 0 && (
              <span
                className={`ml-0.5 min-w-[16px] rounded-sm px-1 text-center text-[10px] font-bold leading-[14px] ${
                  active ? 'bg-black text-[var(--t-amber)]' : 'bg-[var(--t-red)] text-black'
                }`}
              >
                {unread}
                <span className="sr-only"> unread alerts</span>
              </span>
            )}
          </Link>
        );
      })}
      <span className="ml-auto hidden shrink-0 items-center gap-3 px-4 text-[10px] text-[var(--t-faint)] lg:flex">
        <span>
          <span className="text-[var(--t-amber)]">/</span> COMMAND
        </span>
        <span>
          <span className="text-[var(--t-amber)]">ALT+1..9</span> JUMP
        </span>
      </span>
    </nav>
  );
}

export function TerminalShell({ children }: { children: ReactNode }) {
  // The alert poll lives here so the badge, toasts and tab-title counter keep
  // working across panel navigations without restarting on every route change.
  return (
    <AdminAlertsProvider>
      <TerminalFrame>{children}</TerminalFrame>
    </AdminAlertsProvider>
  );
}

function TerminalFrame({ children }: { children: ReactNode }) {
  const feed = useLiveData(FEED_PATH, AdminOverview, FEED_MS);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const items: TapeItem[] = feed.data
    ? tape(feed.data)
    : [{ k: 'TILZA', v: 'CONNECTING…', tone: 'amber' as const }];

  return (
    <div className="tlz-terminal tlz-scan flex h-dvh flex-col overflow-hidden">
      <h1 className="sr-only">
        Tilza Terminal — platform-wide monitor for every shop, account, incident and event
      </h1>

      <header className="tlz-print-hide flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--t-border)] bg-[var(--t-panel)] px-3 py-2 sm:px-4">
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="text-[15px] font-bold uppercase tracking-[0.22em] text-[var(--t-amber)]">
            Tilza
          </span>
          <span className="text-[15px] font-bold uppercase tracking-[0.22em] text-[var(--t-text)]">
            Terminal
          </span>
          <span className="hidden border-l border-[var(--t-border)] pl-2 text-[10px] tracking-[0.08em] text-[var(--t-faint)] xl:inline">
            PLATFORM-WIDE MONITOR
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <CommandLine />
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <Clock />
          <Link
            href="/dashboard"
            className="hidden border border-[var(--t-border)] px-2.5 py-[5px] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--t-dim)] transition-colors hover:border-current hover:text-[var(--t-amber)] sm:inline-block"
          >
            Exit
          </Link>
        </span>
      </header>

      <Tape items={items} />
      <FunctionNav />

      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">{children}</main>

      <footer className="tlz-print-hide flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--t-border)] bg-[var(--t-panel)] px-3 py-1.5 text-[10px] text-[var(--t-dim)] sm:px-4">
        <span className="flex items-center gap-2">
          <Dot tone={feed.live ? 'green' : 'dim'} pulse={feed.live} />
          <span className={`font-bold tracking-[0.1em] ${feed.live ? TONE.green : TONE.dim}`}>
            {feed.live ? 'LIVE' : 'HELD'}
          </span>
          <span className="text-[var(--t-faint)]">FEED {ageLabel(feed.updatedAt, now)}</span>
          {feed.error && (
            <span className="ml-1 border border-[var(--t-red)] px-1 text-[9px] font-bold text-[var(--t-red)]">
              FEED ERROR
            </span>
          )}
        </span>
        <span className="hidden text-[var(--t-faint)] md:inline">
          EVERY FIGURE IS LIVE FROM THE PLATFORM — NO SAMPLES
        </span>
        <span className="text-[var(--t-faint)]">TILZA TERMINAL · OPERATOR ONLY</span>
      </footer>

      <AlertToasts />
    </div>
  );
}
