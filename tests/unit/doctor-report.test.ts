// The doctor's paper trail: verdict wording, tags, numbered steps and the
// technical detail line — the exact text an operator would paste to support.
import { describe, expect, it } from 'vitest';
import type { AdminDoctor } from '@/lib/contracts/admin';
import { buildDoctorReport, doctorVerdict } from '@/lib/doctor-report';

const base: AdminDoctor = {
  checkedAt: '2026-10-18T15:40:00.000Z',
  durationMs: 214,
  status: 'warn',
  passed: 8,
  warnings: 2,
  failures: 0,
  checks: [
    {
      id: 'db',
      area: 'DB',
      title: 'Database',
      status: 'pass',
      summary: 'The database answered in 23 ms.',
      detail: null,
      actions: [],
    },
    {
      id: 'signups',
      area: 'SGN',
      title: 'Sign-ups',
      status: 'warn',
      summary: 'Only 3 of 20 sign-up slots are left.',
      detail: 'SIGNUP_LIMIT=20 · accounts: 17',
      actions: ['Open Railway → tilo → Variables.', 'Raise SIGNUP_LIMIT.'],
    },
  ],
};

describe('doctor report', () => {
  it('leads with the verdict, the moment and the tallies', () => {
    const text = buildDoctorReport(base);
    expect(text).toContain('TILZA DOCTOR — SYSTEM REPORT');
    expect(text).toContain(`Checked ${new Date(base.checkedAt).toUTCString()} · took 214 ms`);
    expect(text).toContain('VERDICT: NEEDS ATTENTION — 8 checks ok · 2 warnings · 0 faults');
  });

  it('tags every check and writes its sentence on the same line', () => {
    const text = buildDoctorReport(base);
    expect(text).toContain('[OK]    DB · Database — The database answered in 23 ms.');
    expect(text).toContain('[WATCH] SGN · Sign-ups — Only 3 of 20 sign-up slots are left.');
  });

  it('numbers the steps and keeps the technical detail last', () => {
    const text = buildDoctorReport(base);
    expect(text).toContain('        1. Open Railway → tilo → Variables.');
    expect(text).toContain('        2. Raise SIGNUP_LIMIT.');
    expect(text).toContain('Technical detail: SIGNUP_LIMIT=20 · accounts: 17');
  });

  it('singularises the tallies honestly', () => {
    const text = buildDoctorReport({
      ...base,
      status: 'fail',
      passed: 1,
      warnings: 1,
      failures: 1,
    });
    expect(text).toContain('VERDICT: PROBLEMS FOUND — 1 check ok · 1 warning · 1 fault');
  });

  it('maps each status to its plain verdict word', () => {
    expect(doctorVerdict({ status: 'pass' })).toBe('ALL SYSTEMS GO');
    expect(doctorVerdict({ status: 'warn' })).toBe('NEEDS ATTENTION');
    expect(doctorVerdict({ status: 'fail' })).toBe('PROBLEMS FOUND');
  });
});
