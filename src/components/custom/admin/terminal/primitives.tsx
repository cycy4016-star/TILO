// Presentation primitives for the Tilza Terminal: the warm ink-on-white building
// blocks every ops panel is assembled from. They are pure — no data fetching,
// no hooks except LivePill — so they stay reusable across sections.
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export const TONE = {
  amber: 'text-[var(--t-amber)]',
  green: 'text-[var(--t-green)]',
  red: 'text-[var(--t-red)]',
  cyan: 'text-[var(--t-cyan)]',
  dim: 'text-[var(--t-dim)]',
  faint: 'text-[var(--t-faint)]',
  text: 'text-[var(--t-text)]',
  bright: 'text-[var(--t-bright)]',
} as const;

export type Tone = keyof typeof TONE;

const BG = {
  amber: 'bg-[var(--t-amber)]',
  green: 'bg-[var(--t-green)]',
  red: 'bg-[var(--t-red)]',
  cyan: 'bg-[var(--t-cyan)]',
  dim: 'bg-[var(--t-dim)]',
  faint: 'bg-[var(--t-faint)]',
  text: 'bg-[var(--t-text)]',
  bright: 'bg-[var(--t-bright)]',
} as const;

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function formatStamp(value: string) {
  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

/** "3s ago" / "4m ago" — the terminal's usual way to say how fresh a row is. */
export function ageLabel(fromMs: number | null | undefined, now: number | null) {
  if (fromMs == null || now == null) return '—';
  const secs = Math.max(0, Math.round((now - fromMs) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Right-aligned money so every column of figures lines up like a tape. */
export function num(value: number) {
  return new Intl.NumberFormat('en-GH').format(value);
}

export function Panel({
  code,
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  code?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col border border-[var(--t-border)] bg-[var(--t-card)] ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--t-border)] bg-[var(--t-panel)] px-3 py-2">
        <h2 className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={`size-2 shrink-0 ${BG.amber}`} />
          {code && <span className="text-[11px] font-bold text-[var(--t-dim)]">{code}</span>}
          <span className="truncate text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--t-amber)]">
            {title}
          </span>
        </h2>
        {right && (
          <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--t-dim)]">
            {right}
          </div>
        )}
      </header>
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName || 'p-3'}`}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'bright',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1.5 border-l border-[var(--t-grid)] px-3 py-2.5 first:border-l-0">
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--t-dim)]">
        {label}
      </span>
      <span className={`truncate text-[18px] font-bold leading-none ${TONE[tone]}`}>{value}</span>
      {sub !== undefined && (
        <span className="truncate text-[11px] text-[var(--t-faint)]">{sub}</span>
      )}
    </div>
  );
}

export function Kv({ k, v, tone = 'text' }: { k: string; v: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--t-grid)] py-1.5 last:border-b-0">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[var(--t-dim)]">
        {k}
      </span>
      <span className={`min-w-0 truncate text-right text-[12px] ${TONE[tone]}`}>{v}</span>
    </div>
  );
}

export function Tag({ children, tone = 'dim' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-block min-w-max shrink-0 whitespace-nowrap border border-current px-1.5 py-[2px] text-[10px] font-bold uppercase leading-none tracking-[0.08em] ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'green', pulse = false }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-[6px] shrink-0 rounded-full ${BG[tone]} ${
        pulse ? 'tlz-blink' : ''
      }`}
    />
  );
}

/**
 * The terminal's sparkline: a run of block glyphs rather than an SVG, so the
 * chart is real text you can read, copy and screenshot like everything else.
 */
const GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

export function Spark({
  values,
  tone = 'green',
  title = 'Daily series',
}: {
  values: number[];
  tone?: Tone;
  title?: string;
}) {
  if (values.length === 0) return <span className={TONE.faint}>—</span>;
  const max = Math.max(1, ...values);
  const text = values
    .map((value) => GLYPHS[Math.min(GLYPHS.length - 1, Math.round((value / max) * 7))])
    .join('');
  return (
    <span
      title={title}
      role="img"
      aria-label={`${title}: ${values.join(', ')}`}
      className={TONE[tone]}
    >
      {text}
    </span>
  );
}

/** Horizontal fill bar — used for mix breakdowns and ranked lists. */
export function Bar({ value, max, tone = 'green' }: { value: number; max: number; tone?: Tone }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span
      className="block h-[6px] w-full min-w-8 border border-[var(--t-grid)] bg-[var(--t-card-hi)]"
      role="img"
      aria-label={`${value} of ${max}`}
    >
      <span className={`block h-full ${BG[tone]}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * Trend — the panel's area chart. An SVG polyline with a phosphor-tinted fill,
 * drawn from `currentColor` so it inherits whichever tone it is set to. The
 * axis-less shape is deliberate: the table under it carries the exact numbers,
 * the chart carries the direction.
 */
export function Trend({
  values,
  tone = 'green',
  height = 48,
  title = 'Trend',
}: {
  values: number[];
  tone?: Tone;
  height?: number;
  title?: string;
}) {
  if (values.length === 0) return <span className={TONE.faint}>—</span>;
  const width = 240;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * width : width / 2;
    const y = height - 3 - (value / max) * (height - 8);
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${title}: ${values.join(', ')}`}
      className={`h-12 w-full ${TONE[tone]}`}
    >
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** A dense monospace table. Columns carry the header + alignment; rows are children. */
export function DataTable({
  columns,
  children,
  empty,
}: {
  columns: { key: string; label: string; right?: boolean }[];
  children: ReactNode;
  empty?: ReactNode;
}) {
  if (!children || (Array.isArray(children) && children.length === 0)) {
    return (
      <div className="p-3">
        <p className="border border-dashed border-[var(--t-border)] px-3 py-10 text-center text-[12px] text-[var(--t-faint)]">
          {empty ?? 'No rows.'}
        </p>
      </div>
    );
  }
  return (
    // Wide ledgers scroll sideways on phones instead of crushing the columns;
    // the min-width keeps the tape's column rhythm on every viewport.
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="bg-[var(--t-card-hi)]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`sticky top-0 z-[1] whitespace-nowrap border-b border-[var(--t-border)] bg-[var(--t-card-hi)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-dim)] ${
                  column.right ? 'text-right' : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={`border-b border-[var(--t-grid)] transition-colors last:border-b-0 hover:bg-[var(--t-card-hi)] ${className}`}
    >
      {children}
    </tr>
  );
}

export function Cell({
  children,
  right = false,
  tone,
  className = '',
}: {
  children: ReactNode;
  right?: boolean;
  tone?: Tone;
  className?: string;
}) {
  return (
    <td
      className={`max-w-0 truncate px-3 py-2 ${right ? 'text-right' : 'text-left'} ${
        tone ? TONE[tone] : ''
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function TButton({
  children,
  onClick,
  disabled = false,
  tone = 'amber',
  active = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: Tone;
  active?: boolean;
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center gap-1 border px-2.5 py-[4px] text-[10px] font-bold uppercase tracking-[0.08em] transition-colors disabled:opacity-40';
  const look = active
    ? `border-current bg-[var(--t-amber)] text-[var(--t-on-accent)]`
    : `border-[var(--t-border)] ${TONE[tone]} hover:border-current hover:bg-[var(--t-card-hi)]`;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

export function TChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
        active
          ? 'border-[var(--t-amber)] bg-[var(--t-amber)] text-[var(--t-on-accent)]'
          : 'border-[var(--t-border)] text-[var(--t-dim)] hover:border-[var(--t-amber-dim)] hover:text-[var(--t-amber)]'
      }`}
    >
      {children}
    </button>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  onSubmit,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  onSubmit: () => void;
  label: string;
}) {
  return (
    <form
      className="flex min-w-0 items-stretch gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor={`tlz-search-${label}`}>
        {label}
      </label>
      <span
        aria-hidden
        className="flex items-center border border-r-0 border-[var(--t-border)] bg-[var(--t-input)] px-2.5 text-[12px] font-bold text-[var(--t-amber)]"
      >
        &gt;
      </span>
      <input
        id={`tlz-search-${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border border-[var(--t-border)] bg-[var(--t-input)] px-2.5 py-[5px] text-[12px] text-[var(--t-bright)] placeholder:text-[var(--t-faint)] focus:border-[var(--t-amber)] focus:outline-none"
      />
      <TButton type="submit">Go</TButton>
    </form>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="p-3">
      <div className="border border-dashed border-[var(--t-border)] px-4 py-12 text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--t-dim)]">
          {title}
        </p>
        {hint && <p className="mt-1.5 text-[12px] text-[var(--t-faint)]">{hint}</p>}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-[var(--t-red)] bg-[var(--t-red)]/5 px-4 py-12 text-center">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--t-red)]">
        Feed error
      </p>
      <p className="text-[12px] text-[var(--t-dim)]">{message}</p>
      <TButton onClick={onRetry} tone="red">
        Retry &lt;GO&gt;
      </TButton>
    </div>
  );
}

/** The panel-local live readout: pulsing dot, age, pause/resume, refresh. */
export function LivePill({
  live,
  updatedAt,
  onToggle,
  onRefresh,
}: {
  live: boolean;
  updatedAt: number | null;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const age = ageLabel(updatedAt, now);

  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em]">
        <Dot tone={live ? 'green' : 'dim'} pulse={live} />
        <span className={live ? TONE.green : TONE.dim}>{live ? 'Live' : 'Held'}</span>
        <span className="text-[var(--t-faint)]">{age}</span>
      </span>
      <TButton onClick={onToggle} tone="dim" active={false}>
        {live ? 'Hold' : 'Run'}
      </TButton>
      <TButton onClick={onRefresh} tone="amber">
        ↻
      </TButton>
    </span>
  );
}
