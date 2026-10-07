// Tilo app code.
'use client';

import { MessageCircleX } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSmsStatus } from '@/lib/sms-status-client';

/**
 * Inline warning for the forms that MUST send an SMS to get anywhere: phone
 * sign-up, the /verify rescue ramp and the SMS password reset. Renders only
 * when the deployment has no provider configured — the state that otherwise
 * surfaces as a failed send after the user has already typed everything in.
 *
 * Returns null while the probe is in flight and whenever SMS is available, so
 * a healthy deployment renders no extra chrome at all.
 */
export function SmsNotice() {
  const status = useSmsStatus();
  if (status === null || status.configured) return null;

  return (
    <Alert variant="destructive" className="rounded-xl">
      <MessageCircleX aria-hidden className="size-4" />
      <AlertDescription>
        Text verification isn&apos;t available on this deployment yet — the SMS provider isn&apos;t
        configured, so confirmation codes can&apos;t be sent.
      </AlertDescription>
    </Alert>
  );
}
