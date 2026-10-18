// F11 · DOCTOR — the self-check. One button runs every examination a developer
// would run first, and each result is written for someone who has never opened
// a terminal: one plain sentence of what is true, and numbered steps for what
// to do when it is not. The whole report copies as plain text, so "send this
// to whoever supports the platform" is one click away.
'use client';

import { useState } from 'react';
import {
  type AdminDoctor,
  type AdminDoctorCheck,
  AdminDoctor as AdminDoctorSchema,
} from '@/lib/contracts/admin';
import { buildDoctorReport } from '@/lib/doctor-report';
import {
  Dot,
  ErrorState,
  formatStamp,
  LivePill,
  num,
  Panel,
  Stat,
  Tag,
  TButton,
  type Tone,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const STATUS_META: Record<AdminDoctorCheck['status'], { label: string; tone: Tone }> = {
  pass: { label: 'OK', tone: 'green' },
  warn: { label: 'WATCH', tone: 'amber' },
  fail: { label: 'FAULT', tone: 'red' },
};

const VERDICT: Record<
  AdminDoctor['status'],
  { label: string; border: string; text: string; note: (report: AdminDoctor) => string }
> = {
  pass: {
    label: 'All systems go',
    border: 'border-[var(--t-green)] bg-[var(--t-green)]/5',
    text: 'text-[var(--t-green)]',
    note: (report) =>
      `Every one of the ${report.checks.length} checks passed — the platform is in good health.`,
  },
  warn: {
    label: 'Needs attention',
    border: 'border-[var(--t-amber)] bg-[var(--t-amber)]/5',
    text: 'text-[var(--t-amber)]',
    note: (report) =>
      `The platform works. ${report.warnings === 1 ? 'One warning is' : `${report.warnings} warnings are`} worth a look — each row below says what to do.`,
  },
  fail: {
    label: 'Problems found',
    border: 'border-[var(--t-red)] bg-[var(--t-red)]/5',
    text: 'text-[var(--t-red)]',
    note: (report) =>
      `${report.failures === 1 ? 'One fault needs' : `${report.failures} faults need`} fixing. Open each red row below — the steps are written out.`,
  },
};

function CheckRow({ check }: { check: AdminDoctorCheck }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[check.status];
  const expandable = check.actions.length > 0 || Boolean(check.detail);
  const buttonLabel = check.actions.length > 0 ? 'What to do' : 'Reading';

  return (
    <li className="border-b border-[var(--t-grid)] last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-3 py-2.5">
        <span className="flex w-[80px] shrink-0 items-center gap-2 pt-[2px]">
          <Dot tone={meta.tone} />
          <Tag tone={meta.tone}>{meta.label}</Tag>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-[var(--t-bright)]">
            <span className="text-[var(--t-dim)]">{check.area} · </span>
            {check.title}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--t-dim)]">{check.summary}</p>
        </div>
        {expandable && (
          <TButton tone="dim" onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide' : buttonLabel}
          </TButton>
        )}
      </div>
      {open && (
        <div className="border-t border-[var(--t-grid)] bg-[var(--t-well)] px-3 py-3 sm:pl-[92px]">
          {check.actions.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t-amber)]">
                What to do
              </p>
              <ol className="mt-1.5 grid gap-1.5">
                {check.actions.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-2 text-[12px] leading-relaxed text-[var(--t-text)]"
                  >
                    <span className="shrink-0 font-bold text-[var(--t-amber)]">{index + 1}.</span>
                    <span className="min-w-0">{step}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {check.detail && (
            <>
              <p className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t-dim)]">
                Technical reading
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-words border border-[var(--t-border)] bg-[var(--t-panel)] p-2 text-[10px] leading-relaxed text-[var(--t-dim)]">
                {check.detail}
              </pre>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function DoctorPanel() {
  const feed = useLiveData('/api/admin/doctor', AdminDoctorSchema, 60_000);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'blocked'>('idle');
  const [showText, setShowText] = useState(false);
  const doctor = feed.data;
  const reportText = doctor ? buildDoctorReport(doctor) : '';

  const copyReport = async () => {
    if (!doctor) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied('ok');
    } catch {
      // Clipboard can be blocked (http origins, strict browsers) — the text
      // view below is the fallback, so surface it instead of failing silently.
      setCopied('blocked');
      setShowText(true);
    }
    window.setTimeout(() => setCopied('idle'), 4000);
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <span className="text-[11px] text-[var(--t-dim)]">
          THE DOCTOR EXAMINES THE LIVE PLATFORM — EVERY RESULT IS WRITTEN IN PLAIN WORDS, WITH THE
          FIX
        </span>
        <LivePill
          live={feed.live}
          updatedAt={feed.updatedAt}
          onToggle={feed.live ? feed.pause : feed.resume}
          onRefresh={feed.refresh}
        />
      </div>

      {!doctor ? (
        feed.error ? (
          <Panel code="DR" title="System check">
            <ErrorState message="Could not reach the doctor." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="DR" title="System check">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Examining the platform…
            </p>
          </Panel>
        )
      ) : (
        <>
          <div className={`border px-3 py-3 ${VERDICT[doctor.status].border}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p
                className={`text-[13px] font-bold uppercase tracking-[0.18em] ${VERDICT[doctor.status].text}`}
              >
                {VERDICT[doctor.status].label}
              </p>
              <span className="flex items-center gap-2">
                <TButton onClick={() => void copyReport()}>
                  {copied === 'ok' ? 'Copied ✓' : 'Copy report'}
                </TButton>
                <TButton tone="dim" onClick={() => setShowText((value) => !value)}>
                  {showText ? 'Hide text' : 'View text'}
                </TButton>
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--t-text)]">
              {VERDICT[doctor.status].note(doctor)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--t-faint)]">
              Checked {formatStamp(doctor.checkedAt)} · took {doctor.durationMs} ms · this page
              re-examines the platform every minute
            </p>
            {copied === 'blocked' && (
              <p className="mt-1.5 text-[11px] font-bold text-[var(--t-amber)]">
                This browser blocked copying — select the text below and copy it by hand.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 border border-[var(--t-border)] bg-[var(--t-card)]">
            <Stat label="Passed" value={num(doctor.passed)} tone="green" />
            <Stat
              label="Warnings"
              value={num(doctor.warnings)}
              tone={doctor.warnings > 0 ? 'amber' : 'dim'}
            />
            <Stat
              label="Faults"
              value={num(doctor.failures)}
              tone={doctor.failures > 0 ? 'red' : 'dim'}
            />
          </div>

          {showText && (
            <Panel code="RP" title="Copyable report" bodyClassName="p-0">
              <textarea
                readOnly
                value={reportText}
                rows={16}
                aria-label="Doctor report as plain text"
                className="w-full resize-y border-0 bg-[var(--t-well)] p-3 font-mono text-[11px] leading-relaxed text-[var(--t-dim)] focus:outline-none"
              />
            </Panel>
          )}

          <Panel
            code="DR"
            title="System checks"
            right={<span>the doctor only looks — it never changes anything</span>}
            bodyClassName="p-0"
          >
            <ul>
              {doctor.checks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </Panel>

          <p className="text-[10px] text-[var(--t-faint)]">
            Send the copyable report to whoever supports the platform — it contains everything they
            need, in order, without asking you to read a single error message.
          </p>
        </>
      )}
    </div>
  );
}
