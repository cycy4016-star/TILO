// Transactional email transport. Provider-agnostic behind env.EMAIL_PROVIDER so
// swapping vendors is a config change. Resend is the only wired provider (HTTP
// API, no SDK). Email is OPTIONAL: phone SMS is the primary verification and
// password-reset channel; this is used for reset links and receipts when set.
//
// Never throws — callers always get a result object.
import 'server-only';
import { env } from '@/lib/env';

export type EmailSendResult = {
  ok: boolean;
  providerRef: string | null;
  error: string | null;
};

export function isEmailConfigured(): boolean {
  return env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY);
}

type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

async function sendViaResend({ to, subject, text, html }: EmailInput): Promise<EmailSendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? 'Tilo <no-reply@tilo.app>',
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, providerRef: null, error: `Resend ${res.status}: ${data?.message ?? ''}` };
  }
  return { ok: true, providerRef: data?.id ?? null, error: null };
}

export async function sendEmail(input: EmailInput): Promise<EmailSendResult> {
  try {
    if (!isEmailConfigured()) {
      return { ok: false, providerRef: null, error: 'Email provider not configured' };
    }
    return await sendViaResend(input);
  } catch (error) {
    return {
      ok: false,
      providerRef: null,
      error: error instanceof Error ? error.message : 'Email request failed',
    };
  }
}
