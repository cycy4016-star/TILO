// Tilo app code.
//
// Public capability probe for the auth forms. Phone sign-up, the /verify rescue
// ramp and the SMS password reset all die at the same moment: the send, after
// the user has already typed their details. This endpoint lets those forms ask
// up front whether a provider is actually wired up, so an unconfigured
// deployment says so before a send is attempted instead of failing mid-flow.
//
// Returns no secrets — only the capability boolean and the provider's display
// name — so it is safe to expose unauthenticated.
import 'server-only';

import { NextResponse } from 'next/server';
import { isSmsConfigured, smsProviderName } from '@/lib/sms';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    configured: isSmsConfigured(),
    provider: smsProviderName(),
  });
}
