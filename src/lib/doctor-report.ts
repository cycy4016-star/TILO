// The doctor's paper trail: turn a run into a plain-text report the operator
// can copy, paste into a message and send to whoever supports the platform —
// no screenshots, no terminal scrollback, no developer needed to read it.
//
// Pure on purpose: no Prisma, no DOM. The console formats it for the clipboard,
// the unit tests pin its wording, and a future mail/SMS path can reuse it.
import type { AdminDoctor, AdminDoctorCheck } from '@/lib/contracts/admin';

const VERDICT: Record<AdminDoctor['status'], string> = {
  pass: 'ALL SYSTEMS GO',
  warn: 'NEEDS ATTENTION',
  fail: 'PROBLEMS FOUND',
};

const TAG: Record<AdminDoctorCheck['status'], string> = {
  pass: '[OK]   ',
  warn: '[WATCH]',
  fail: '[FAULT]',
};

function count(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : `${singular}s`}`;
}

export function doctorVerdict(report: Pick<AdminDoctor, 'status'>): string {
  return VERDICT[report.status];
}

/** One incident-free transcript of the whole run. Stable line format. */
export function buildDoctorReport(report: AdminDoctor): string {
  const lines: string[] = [];
  lines.push('TILZA DOCTOR — SYSTEM REPORT');
  lines.push(`Checked ${new Date(report.checkedAt).toUTCString()} · took ${report.durationMs} ms`);
  lines.push(
    `VERDICT: ${VERDICT[report.status]} — ${count(report.passed, 'check')} ok · ${count(report.warnings, 'warning')} · ${count(report.failures, 'fault')}`,
  );

  for (const check of report.checks) {
    lines.push('');
    lines.push(`${TAG[check.status]} ${check.area} · ${check.title} — ${check.summary}`);
    if (check.actions.length > 0) {
      lines.push('        What to do:');
      check.actions.forEach((action, index) => {
        lines.push(`        ${index + 1}. ${action}`);
      });
    }
    if (check.detail) lines.push(`        Technical detail: ${check.detail}`);
  }

  return lines.join('\n');
}
