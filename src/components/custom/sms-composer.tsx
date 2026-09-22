// "Send an SMS" composer — opens from the customer list or a customer's
// detail. Picks a TILO template or writes free text, shows the credit cost,
// and dispatches straight from the platform (Arkesel). Every send lands in
// the SMS ledger and rings the bell with the result.
'use client';

import { MessageSquareMore, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { SmsDispatch, SmsDispatchResult } from '@/lib/contracts/sms';
import { type ManageContext, SMS_TEMPLATES, type SmsTemplateKey } from '@/lib/sms-templates';

const MAX_CHARS = 320;
const creditsFor = (length: number) => Math.max(1, Math.ceil(length / 160));

export function SmsComposer({
  phone,
  customerName,
  storeName,
  trigger,
  defaultMessage,
  templateKey,
}: {
  phone: string;
  customerName: string;
  storeName: string;
  trigger: React.ReactNode;
  defaultMessage?: string;
  templateKey?: SmsTemplateKey | 'order-confirm';
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState<string | null>(templateKey ?? null);
  const [message, setMessage] = useState<string>(() => defaultMessage ?? '');
  const [error, setError] = useState<string | null>(null);

  const context: ManageContext = { storeName, customerName };

  function applyTemplate(key: SmsTemplateKey) {
    setTemplate(key);
    const entry = SMS_TEMPLATES.find((candidate) => candidate.key === key);
    if (entry) setMessage(entry.build(context));
    setError(null);
  }

  async function send() {
    setError(null);
    const parsed = SmsDispatch.safeParse({ to: phone, message, template });
    if (!parsed.success) {
      const messages = Object.values(parsed.error.flatten().fieldErrors).flat();
      setError(messages[0] ?? 'Fix the message first');
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
        schema: SmsDispatchResult,
      });
      if (!result.ok) {
        setError(result.error ?? 'The message could not be sent');
        return;
      }
      toast.success(`Message sent to ${phone}`);
      setMessage('');
      setTemplate(null);
      setOpen(false);
    } catch (requestError) {
      const cause = (
        requestError as { cause?: { error?: string; errors?: Record<string, string> } }
      ).cause;
      setError(
        cause?.error ?? Object.values(cause?.errors ?? {})[0] ?? 'Could not send the message',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : setOpen(false))}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display font-black uppercase">
            <MessageSquareMore aria-hidden className="size-4" /> Text {customerName}
          </DialogTitle>
          <DialogDescription>
            Sends from {storeName}&apos;s number to {phone}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={template === null ? 'default' : 'outline'}
              onClick={() => {
                setTemplate(null);
                setMessage('');
              }}
              className="rounded-full text-xs font-black uppercase tracking-wide"
            >
              Custom
            </Button>
            {SMS_TEMPLATES.map((entry) => (
              <Button
                key={entry.key}
                type="button"
                size="sm"
                variant={template === entry.key ? 'default' : 'outline'}
                onClick={() => applyTemplate(entry.key)}
                className="rounded-full text-xs font-black uppercase tracking-wide"
              >
                {entry.label}
              </Button>
            ))}
          </div>

          <Textarea
            rows={5}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (event.target.value !== '' && event.target.value.length <= MAX_CHARS)
                setTemplate(null);
            }}
            placeholder={`Hello ${customerName}! ${storeName} here — want to order this week?`}
            className="rounded-2xl font-medium"
            maxLength={MAX_CHARS}
          />
          <div className="flex items-center justify-between text-xs font-bold text-stone-400">
            <span>
              {message.length}/{MAX_CHARS}
            </span>
            <span>
              ~{creditsFor(message.length)} SMS credit{creditsFor(message.length) === 1 ? '' : 's'}
            </span>
          </div>

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="h-11 gap-2 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
          >
            <Send aria-hidden className="size-4" /> {busy ? 'Sending…' : 'Send message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
