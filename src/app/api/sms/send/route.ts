// Owner SMS dispatch: compose a TILO-branded message and send it straight to
// a customer's phone. Every send goes through the SmsUsage ledger (the
// "SMS this month" card) and raises a bell notification on the result.
import 'server-only';

import { NextResponse } from 'next/server';
import { SmsDispatch, SmsDispatchResult } from '@/lib/contracts/sms';
import { notify } from '@/lib/notify';
import { requireAuth } from '@/lib/require-auth';
import { sendSms } from '@/lib/sms';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = SmsDispatch.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(fieldErrors)) {
        const message = messages[0];
        if (message) errors[field] = message;
      }
      return NextResponse.json({ errors }, { status: 400 });
    }

    const { to, message, template } = parsed.data;
    const result = await sendSms(to, message, 'MANUAL');

    await notify({
      kind: result.ok ? 'SMS_SENT' : 'SMS_FAILED',
      title: result.ok
        ? `SMS sent${template ? ` — ${template}` : ''}`
        : `SMS failed${template ? ` — ${template}` : ''}`,
      message: `${to} · ${message}${result.ok ? '' : ` · ${result.error ?? 'provider error'}`}`,
    });

    return NextResponse.json(
      SmsDispatchResult.parse({
        ok: result.ok,
        providerRef: result.providerRef,
        error: result.error,
      }),
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
