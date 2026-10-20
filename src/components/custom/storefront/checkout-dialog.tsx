// Checkout: the basket review, the customer details, and the receipt that
// hands the finished order to WhatsApp. One dialog, two states (form —
// receipt) so the customer never loses the order that was just placed.
'use client';

import { Check, Loader2, MessageCircle, Minus, Package, Plus } from 'lucide-react';
import Image from 'next/image';
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
import { waMessageLink } from '@/lib/phone';
import { couponDiscount, couponErrorMessage } from '@/lib/promotions';
import { basketOrderWhatsApp } from '@/lib/whatsapp-templates';

type CheckoutItem = StorePublic['items'][number];

// A placed order, kept in full after the basket is cleared so the confirmation
// can show what was ordered and hand the chat over to WhatsApp.
type ReceiptLine = { name: string; quantity: number; amount: string };
type Receipt = {
  orderNumber: string;
  lines: ReceiptLine[];
  subtotal: string;
  /** Pre-formatted discount, or null when no coupon was used. */
  discount: string | null;
  promoCode: string | null;
  total: string;
  customerName: string;
  customerPhone: string;
  note: string | null;
};

export function CheckoutDialog({
  open,
  onClose,
  storeName,
  contactPhone,
  slug,
  theme,
  lines,
  cart,
  total,
  promotions,
  onQuantityChange,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  storeName: string;
  contactPhone: string | null;
  slug: string;
  /** Shop theme key — the dialog is portaled outside the themed <main>, so it
   *  re-scopes the --tl/brand tokens on itself to stay in the shop's skin. */
  theme: string;
  lines: CheckoutItem[];
  cart: Record<string, number>;
  total: number;
  /** The shop's live promotions — the coupon field previews against these. */
  promotions: StorePublic['promotions'];
  onQuantityChange: (itemId: string, quantity: number) => void;
  onPlaced: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const couponLines = lines.map((item) => ({
    itemId: item.id,
    categoryId: item.categoryId,
    pricePesewas: item.pricePesewas,
    quantity: cart[item.id] ?? 0,
  }));
  // Recomputed on every render, so a code that stops qualifying (a quantity
  // dropped below the minimum) shows its reason instead of silently charging
  // full price. The order route recomputes the same way from the database.
  const couponPreview = appliedCode ? couponDiscount(promotions, appliedCode, couponLines) : null;
  const discountPesewas = couponPreview?.ok ? couponPreview.discountPesewas : 0;
  const payablePesewas = Math.max(0, total - discountPesewas);

  function applyCode() {
    const result = couponDiscount(promotions, codeInput, couponLines);
    if (!result.ok) {
      setAppliedCode(null);
      setCodeError(couponErrorMessage(result));
      return;
    }
    setAppliedCode(result.code);
    setCodeInput(result.code);
    setCodeError(null);
  }

  function removeCode() {
    setAppliedCode(null);
    setCodeInput('');
    setCodeError(null);
  }

  // The hand-off message is built from the receipt, not the live basket — the
  // basket is emptied the moment the order is recorded.
  const waOrderLink =
    receipt && contactPhone
      ? waMessageLink(
          contactPhone,
          basketOrderWhatsApp({
            storeName,
            orderNumber: receipt.orderNumber,
            lines: receipt.lines,
            discountLabel: receipt.promoCode,
            discountAmount: receipt.discount,
            total: receipt.total,
            customerName: receipt.customerName,
            customerPhone: receipt.customerPhone,
            note: receipt.note,
          }),
        )
      : null;

  async function submit() {
    setError(null);
    // A code applied earlier may have stopped qualifying while the basket
    // changed. Block the order rather than charging full price unexpectedly.
    if (appliedCode && couponPreview && !couponPreview.ok) {
      setError(couponErrorMessage(couponPreview));
      return;
    }
    const parsed = PublicOrderCreate.safeParse({
      lines: lines.map((item) => ({ itemId: item.id, quantity: cart[item.id] ?? 1 })),
      customerName: name,
      phone,
      note,
      code: appliedCode ?? undefined,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const message = flat.lines?.[0] ?? Object.values(flat).flat()[0];
      setError(message ?? 'Check the details and try again');
      return;
    }
    // Snapshot the basket before the request: the cart is cleared on success
    // and the confirmation screen still has to show (and forward) the order.
    const snapshot: Receipt = {
      orderNumber: '',
      lines: lines.map((item) => ({
        name: item.name,
        quantity: cart[item.id] ?? 1,
        amount: formatGhs(item.pricePesewas * (cart[item.id] ?? 1)),
      })),
      subtotal: formatGhs(total),
      discount: null,
      promoCode: null,
      total: formatGhs(payablePesewas),
      customerName: name.trim(),
      customerPhone: phone.trim(),
      note: note.trim() || null,
    };
    setBusy(true);
    try {
      const result = await apiFetch(`/api/public/store/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
        schema: PublicOrderResult,
      });
      // The server is authoritative: use its net amount and discount.
      setReceipt({
        ...snapshot,
        orderNumber: result.order.orderNumber,
        discount: result.order.discountPesewas > 0 ? formatGhs(result.order.discountPesewas) : null,
        promoCode: result.order.promoCode,
        total: formatGhs(result.order.amountPesewas ?? payablePesewas),
      });
      onPlaced();
      toast.success(
        contactPhone ? 'Order recorded — send it to the shop on WhatsApp' : 'Order sent',
      );
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
    onClose();
    setReceipt(null);
    setName('');
    setPhone('');
    setNote('');
    setError(null);
    setCodeInput('');
    setAppliedCode(null);
    setCodeError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? undefined : close())}>
      <DialogContent
        data-theme={theme}
        className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-h3 tracking-tight">Your basket</DialogTitle>
          <DialogDescription>
            {contactPhone
              ? `Add your details, then send the order to ${storeName} on WhatsApp.`
              : `Add your details and ${storeName} will confirm the order.`}
          </DialogDescription>
        </DialogHeader>

        {receipt ? (
          <div className="grid gap-4 py-2 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary/10 text-highlight-ink">
              <Check aria-hidden className="size-6" />
            </span>
            <div>
              <p className="font-display text-h4">Order recorded</p>
              <p className="font-mono text-small text-muted-foreground">#{receipt.orderNumber}</p>
            </div>
            <ul className="grid gap-1.5 rounded-lg border border-border p-3 text-left">
              {receipt.lines.map((line, index) => (
                <li
                  key={`${index}-${line.name}`}
                  className="flex items-baseline justify-between gap-3 text-small"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-muted-foreground">{line.quantity}x</span>{' '}
                    {line.name}
                  </span>
                  <span className="shrink-0 font-mono">{line.amount}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-1.5 rounded-lg border border-border p-3 text-left text-small">
              {receipt.discount && (
                <p className="flex items-baseline justify-between gap-3 text-primary">
                  <span>Subtotal</span>
                  <span className="font-mono">{receipt.subtotal}</span>
                </p>
              )}
              {receipt.discount && (
                <p className="flex items-baseline justify-between gap-3 text-primary">
                  <span>Discount{receipt.promoCode ? ` (${receipt.promoCode})` : ''}</span>
                  <span className="font-mono">−{receipt.discount}</span>
                </p>
              )}
              <p
                className={`flex items-baseline justify-between gap-3 font-semibold ${
                  receipt.discount ? 'border-t border-border pt-1.5' : ''
                }`}
              >
                <span>Total</span>
                <span className="font-mono">{receipt.total}</span>
              </p>
            </div>
            <p className="text-small text-muted-foreground">
              {waOrderLink
                ? `${storeName} sees it immediately — send the order on WhatsApp.`
                : `${storeName} has your order and will contact you to confirm.`}
            </p>
            {waOrderLink && (
              <a
                href={waOrderLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-small font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                <MessageCircle aria-hidden className="size-4" /> Send order on WhatsApp
              </a>
            )}
            <Button
              type="button"
              variant={waOrderLink ? 'ghost' : 'default'}
              onClick={close}
              className="font-semibold"
            >
              Keep browsing
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <ul className="grid gap-2">
              {lines.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={64}
                      height={64}
                      sizes="48px"
                      className="size-12 shrink-0 rounded-lg border border-border bg-muted object-cover"
                    />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Package aria-hidden className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold">{item.name}</span>
                    <span className="block text-caption text-muted-foreground">
                      {formatGhs(item.pricePesewas)} each
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`One fewer ${item.name}`}
                      onClick={() => onQuantityChange(item.id, (cart[item.id] ?? 1) - 1)}
                      className="size-8 rounded-md"
                    >
                      <Minus aria-hidden className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center font-mono text-small font-semibold">
                      {cart[item.id]}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`One more ${item.name}`}
                      onClick={() =>
                        onQuantityChange(item.id, Math.min(99, (cart[item.id] ?? 1) + 1))
                      }
                      className="size-8 rounded-md"
                    >
                      <Plus aria-hidden className="size-3.5" />
                    </Button>
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-small font-bold max-[400px]:w-full max-[400px]:text-left">
                    {formatGhs(item.pricePesewas * (cart[item.id] ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 rounded-lg border border-border p-3">
              <Label htmlFor="basket-code" className="text-small font-semibold">
                Promo code <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              {appliedCode ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-small">
                    <Check aria-hidden className="size-4 shrink-0 text-primary" />
                    <span className="font-mono font-semibold">{appliedCode}</span>
                    {couponPreview?.ok && (
                      <span className="truncate text-muted-foreground">{couponPreview.name}</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeCode}
                    className="h-8 shrink-0 px-2 text-small font-semibold"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="basket-code"
                    value={codeInput}
                    onChange={(event) => setCodeInput(event.target.value)}
                    placeholder="WEEKEND10"
                    autoComplete="off"
                    className="rounded-md font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyCode}
                    disabled={!codeInput.trim()}
                    className="shrink-0 font-semibold"
                  >
                    Apply
                  </Button>
                </div>
              )}
              {appliedCode && couponPreview && !couponPreview.ok ? (
                <p role="alert" className="text-caption font-medium text-destructive">
                  {couponErrorMessage(couponPreview)}
                </p>
              ) : codeError ? (
                <p role="alert" className="text-caption font-medium text-destructive">
                  {codeError}
                </p>
              ) : null}
            </div>

            {discountPesewas > 0 ? (
              <div className="grid gap-1.5 rounded-md bg-highlight-wash px-3 py-2 text-small">
                <p className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatGhs(total)}</span>
                </p>
                <p className="flex items-center justify-between text-primary">
                  <span>Discount{appliedCode ? ` (${appliedCode})` : ''}</span>
                  <span className="font-mono">−{formatGhs(discountPesewas)}</span>
                </p>
                <p className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                  <span>Total</span>
                  <span className="font-mono">{formatGhs(payablePesewas)}</span>
                </p>
              </div>
            ) : (
              <p className="flex items-center justify-between rounded-md bg-highlight-wash px-3 py-2 text-small font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatGhs(total)}</span>
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="basket-name">Your name</Label>
              <Input
                id="basket-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ama"
                className="rounded-md"
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
                className="rounded-md"
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
                className="rounded-md"
              />
            </div>
            {error && <p className="text-small font-medium text-destructive">{error}</p>}
            <Button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="h-11 rounded-md bg-primary font-bold text-primary-foreground hover:bg-primary/90"
            >
              {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {busy ? 'Placing order…' : 'Place order'}
            </Button>
            {contactPhone && (
              <p className="text-center text-caption text-muted-foreground">
                You&apos;ll then send it to {storeName} on WhatsApp.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
