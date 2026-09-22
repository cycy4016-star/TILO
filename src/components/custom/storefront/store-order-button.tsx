// "Order on Tilo" — the storefront's direct-order island. A visitor picks a
// quantity, drops name + phone + a note, and the order lands straight in the
// shop's dashboard with a live bell notification (plus WhatsApp/SMS stay
// available alongside).
'use client';

import { Check, Minus, PackagePlus, Plus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { formatGhs } from '@/lib/contracts/order';
import { PublicOrderCreate, PublicOrderResult } from '@/lib/contracts/public-store';

export function StoreOrderButton({
  itemId,
  itemName,
  pricePesewas,
  storeName,
  slug,
}: {
  itemId: string;
  itemName: string;
  pricePesewas: number;
  storeName: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = PublicOrderCreate.safeParse({
      itemId,
      quantity,
      customerName: name,
      phone,
      note,
    });
    if (!parsed.success) {
      const messages = Object.values(parsed.error.flatten().fieldErrors).flat();
      setError(messages[0] ?? 'Check the details and try again');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/public/store/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
        schema: PublicOrderResult,
      });
      setDone(true);
      toast.success('Order sent — the shop will confirm shortly');
    } catch (requestError) {
      const cause = (
        requestError as { cause?: { error?: string; errors?: Record<string, string> } }
      ).cause;
      setError(
        cause?.error ?? Object.values(cause?.errors ?? {})[0] ?? 'Could not place the order',
      );
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setDone(false);
    setName('');
    setPhone('');
    setNote('');
    setQuantity(1);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button className="h-11 items-center gap-2 rounded-full bg-amber-950 px-5 font-black uppercase tracking-wide text-amber-50 hover:bg-stone-900">
          <PackagePlus aria-hidden className="size-4" /> Order on Tilo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-black uppercase">Order {itemName}</DialogTitle>
          <DialogDescription>
            {formatGhs(pricePesewas)} each · {storeName} confirms on WhatsApp or SMS.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="grid gap-3 py-6 text-center">
            <span className="mx-auto flex size-16 -rotate-6 items-center justify-center rounded-3xl bg-emerald-600 text-white">
              <Check aria-hidden className="size-8" />
            </span>
            <p className="font-display text-xl font-black uppercase">Order recorded</p>
            <p className="text-sm font-medium text-stone-500">
              {storeName} has been pinged. They&apos;ll reach you to confirm.
            </p>
            <Button
              type="button"
              onClick={close}
              className="mt-2 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
            >
              Keep browsing
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-2xl border-2 border-amber-200 p-3 dark:border-amber-800">
              <span className="text-sm font-black uppercase tracking-wide">{itemName}</span>
              <span className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Fewer"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  className="size-8 rounded-full"
                >
                  <Minus aria-hidden className="size-3.5" />
                </Button>
                <span className="w-8 text-center font-mono text-lg font-black">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="More"
                  onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                  className="size-8 rounded-full"
                >
                  <Plus aria-hidden className="size-3.5" />
                </Button>
              </span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-name">Your name</Label>
              <Input
                id="order-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ama"
                className="rounded-2xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-phone">Phone / WhatsApp number</Label>
              <Input
                id="order-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="024 000 0000"
                className="rounded-2xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-note">Anything to add (optional)</Label>
              <Textarea
                id="order-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Size, colour, pickup time…"
                className="rounded-2xl"
              />
            </div>
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <Button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="h-12 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
            >
              {busy ? 'Sending…' : 'Send order'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
