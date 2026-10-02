// The public storefront's catalogue grid + basket.
//
// Client component so one basket can span every card on the page — the server
// page hands over already-grouped shelves (label = category name, null =
// uncategorised) and this component owns the add/checkout flow on top.
'use client';

import {
  Check,
  MessageCircle,
  MessageSquareText,
  Minus,
  Package,
  Percent,
  Plus,
  ShoppingCart,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { formatGhs } from '@/lib/contracts/order';
import { PublicOrderCreate, PublicOrderResult } from '@/lib/contracts/public-store';
import type { StorePublic } from '@/lib/contracts/store';
import { smsLink, waMessageLink } from '@/lib/phone';
import { itemDiscountPercent } from '@/lib/promotions';
import { orderRequestSms } from '@/lib/sms-templates';

type CatalogItem = StorePublic['items'][number];

// One shelf as the server hands it over. `label: null` is the uncategorised
// bucket (or a shop with no categories at all) — those render without a heading
// so a shop that never sets one up looks exactly as it did before.
export type CatalogGroup = { label: string | null; items: CatalogItem[] };

const kindLabels: Record<'PRODUCT' | 'SERVICE', string> = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
};

export function StoreCatalog({
  slug,
  storeName,
  contactPhone,
  pro,
  groups,
}: {
  slug: string;
  storeName: string;
  contactPhone: string | null;
  pro: boolean;
  groups: CatalogGroup[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lines = groups.flatMap((group) => group.items).filter((item) => (cart[item.id] ?? 0) > 0);
  const count = lines.reduce((sum, item) => sum + (cart[item.id] ?? 0), 0);
  const total = lines.reduce((sum, item) => sum + item.pricePesewas * (cart[item.id] ?? 0), 0);

  function setQuantity(itemId: string, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[itemId];
      else next[itemId] = quantity;
      return next;
    });
  }

  function checkout() {
    setError(null);
    setDone(null);
    setOpen(true);
  }

  async function submit() {
    setError(null);
    const parsed = PublicOrderCreate.safeParse({
      lines: lines.map((item) => ({ itemId: item.id, quantity: cart[item.id] })),
      customerName: name,
      phone,
      note,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const message = flat.lines?.[0] ?? Object.values(flat).flat()[0];
      setError(message ?? 'Check the details and try again');
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch(`/api/public/store/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
        schema: PublicOrderResult,
      });
      setDone(result.order.orderNumber);
      setCart({});
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
    setDone(null);
    setName('');
    setPhone('');
    setNote('');
    setError(null);
  }

  function renderItem(item: CatalogItem, index: number) {
    const discount = itemDiscountPercent(item);
    const qty = cart[item.id] ?? 0;
    const orderLink = contactPhone
      ? waMessageLink(
          contactPhone,
          `Hi ${storeName}! Please, add for me: ${item.name} — ${
            discount != null
              ? `${formatGhs(item.pricePesewas)}, was ${formatGhs(item.compareAtPricePesewas ?? 0)} (${discount}% off)`
              : formatGhs(item.pricePesewas)
          }.`,
        )
      : null;
    const smsHref = contactPhone
      ? smsLink(
          contactPhone,
          orderRequestSms({
            storeName,
            itemName: item.name,
            priceGhs: formatGhs(item.pricePesewas),
            quantity: Math.max(1, qty),
          }),
        )
      : null;

    return (
      <article
        key={item.id}
        className={`flex flex-col border-2 bg-white dark:bg-stone-900 ${
          pro
            ? 'rounded-2xl border-[var(--tl-200)] p-6'
            : `rounded-[1.75rem] border-amber-950 p-6 shadow-[5px_5px_0_0_#451a03] ${
                index % 2 === 1 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
              }`
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={`flex size-12 items-center justify-center rounded-2xl text-white ${
              pro ? 'bg-[var(--tl-700)]' : 'bg-gradient-to-br from-amber-500 to-amber-400'
            }`}
          >
            {item.kind === 'SERVICE' ? (
              <Wrench aria-hidden className="size-5" />
            ) : (
              <Package aria-hidden className="size-5" />
            )}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider ${
              pro
                ? 'bg-primary/10 text-primary'
                : 'bg-amber-100 font-black text-amber-800 dark:bg-stone-800 dark:text-amber-300'
            }`}
          >
            {kindLabels[item.kind]}
          </span>
        </div>
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="mt-4 aspect-[4/3] w-full rounded-2xl border-2 border-amber-100 object-cover dark:border-stone-800"
          />
        )}
        <h2
          className={`mt-4 ${
            pro
              ? 'text-xl font-semibold'
              : 'font-display text-xl font-black uppercase tracking-tight'
          }`}
        >
          {item.name}
        </h2>
        {item.description && (
          <p className="mt-1 flex-1 text-sm font-medium leading-relaxed text-stone-600 dark:text-stone-300">
            {item.description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={
                  pro
                    ? 'text-xl font-bold text-[var(--tl-900)]'
                    : 'font-mono text-xl font-black text-amber-950 dark:text-amber-50'
                }
              >
                {formatGhs(item.pricePesewas)}
              </span>
              {discount != null && (
                <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white">
                  <Percent aria-hidden className="mr-0.5 inline size-3" />
                  {discount}% off
                </span>
              )}
            </span>
            {discount != null && (
              <span className="text-sm font-medium text-stone-400 line-through">
                {formatGhs(item.compareAtPricePesewas ?? 0)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {qty === 0 ? (
            <Button
              type="button"
              onClick={() => setQuantity(item.id, 1)}
              className="h-11 items-center gap-2 rounded-full font-semibold"
            >
              <ShoppingCart aria-hidden className="size-4" /> Add to basket
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-full border-2 border-current/30 px-2 py-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`One fewer ${item.name}`}
                onClick={() => setQuantity(item.id, qty - 1)}
                className="size-8 rounded-full"
              >
                <Minus aria-hidden className="size-3.5" />
              </Button>
              <span className="min-w-8 text-center font-mono text-lg font-semibold">{qty}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`One more ${item.name}`}
                onClick={() => setQuantity(item.id, Math.min(99, qty + 1))}
                className="size-8 rounded-full"
              >
                <Plus aria-hidden className="size-3.5" />
              </Button>
              <span className="flex-1 text-right text-xs font-semibold uppercase tracking-wider">
                in basket
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.name} from the basket`}
                onClick={() => setQuantity(item.id, 0)}
                className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-red-50"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {orderLink && (
              <a
                href={orderLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-emerald-700 bg-emerald-600 px-4 font-bold uppercase tracking-wide text-white transition-colors hover:bg-emerald-500"
              >
                <MessageCircle aria-hidden className="size-4" /> WhatsApp
              </a>
            )}
            {smsHref && (
              <a
                href={smsHref}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 font-bold uppercase tracking-wide transition-colors ${
                  pro
                    ? 'border border-[var(--tl-700)] text-[var(--tl-800)] hover:bg-[var(--tl-100)]'
                    : 'border-2 border-amber-950 font-black text-amber-950 hover:bg-amber-100 dark:text-amber-50'
                }`}
              >
                <MessageSquareText aria-hidden className="size-4" /> SMS
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <div className={`grid gap-8 ${count > 0 ? 'pb-24' : ''}`}>
        {groups.map((group) => (
          <section key={group.label ?? '__uncategorised'}>
            {group.label && (
              <h2 className={`text-2xl ${pro ? 'font-bold' : 'font-display font-black uppercase'}`}>
                {group.label}
              </h2>
            )}
            <div className={`grid gap-4 sm:grid-cols-2 ${group.label ? 'mt-3' : ''}`}>
              {group.items.map((item, index) => renderItem(item, index))}
            </div>
          </section>
        ))}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {count} {count === 1 ? 'item' : 'items'} in your basket
              </span>
              <span className="block font-mono text-lg font-bold">{formatGhs(total)}</span>
            </span>
            <Button
              type="button"
              onClick={checkout}
              className="h-12 shrink-0 items-center gap-2 rounded-full px-6 font-semibold"
            >
              <ShoppingCart aria-hidden className="size-4" /> Checkout
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Your basket</DialogTitle>
            <DialogDescription>{storeName} confirms on WhatsApp or SMS.</DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="grid gap-3 py-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Check aria-hidden className="size-6" />
              </span>
              <p className="text-lg font-semibold">Order recorded</p>
              <p className="text-sm text-muted-foreground">
                {storeName} has your order and will contact you to confirm.
              </p>
              <p className="font-mono text-sm text-muted-foreground">#{done}</p>
              <Button type="button" onClick={close} className="mt-2 font-semibold">
                Keep browsing
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <ul className="grid gap-2">
                {lines.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatGhs(item.pricePesewas)} each
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`One fewer ${item.name}`}
                        onClick={() => setQuantity(item.id, (cart[item.id] ?? 1) - 1)}
                        className="size-8 rounded-full"
                      >
                        <Minus aria-hidden className="size-3.5" />
                      </Button>
                      <span className="w-6 text-center font-mono text-sm font-semibold">
                        {cart[item.id]}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`One more ${item.name}`}
                        onClick={() => setQuantity(item.id, Math.min(99, (cart[item.id] ?? 1) + 1))}
                        className="size-8 rounded-full"
                      >
                        <Plus aria-hidden className="size-3.5" />
                      </Button>
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-sm font-bold">
                      {formatGhs(item.pricePesewas * (cart[item.id] ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatGhs(total)}</span>
              </p>
              <div className="grid gap-2">
                <Label htmlFor="basket-name">Your name</Label>
                <Input
                  id="basket-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ama"
                  className="rounded-lg"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="basket-phone">Phone / WhatsApp number</Label>
                <Input
                  id="basket-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="024 000 0000"
                  className="rounded-lg"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="basket-note">Anything to add (optional)</Label>
                <Textarea
                  id="basket-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Size, colour, pickup time…"
                  className="rounded-lg"
                />
              </div>
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              <Button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="h-12 font-semibold"
              >
                {busy ? 'Sending…' : 'Send order'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
