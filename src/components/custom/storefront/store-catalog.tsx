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
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ShareSheet } from '@/components/custom/share-sheet';
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
import { CATEGORY_ICONS } from '@/lib/category-icons';
import { formatGhs } from '@/lib/contracts/order';
import type { PromotionSummary } from '@/lib/contracts/promotion';
import { PublicOrderCreate, PublicOrderResult } from '@/lib/contracts/public-store';
import type { StorePublic } from '@/lib/contracts/store';
import { smsLink, waMessageLink } from '@/lib/phone';
import { itemDiscountPercent, promosForItem } from '@/lib/promotions';
import { productShareMessage } from '@/lib/share';
import { orderRequestSms } from '@/lib/sms-templates';
import { basketOrderWhatsApp, itemOrderWhatsApp } from '@/lib/whatsapp-templates';

type CatalogItem = StorePublic['items'][number];

// One shelf as the server hands it over. `label: null` is the uncategorised
// bucket (or a shop with no categories at all) — those render without a heading
// so a shop that never sets one up looks exactly as it did before.
export type CatalogGroup = {
  label: string | null;
  icon: string | null;
  coverUrl: string | null;
  items: CatalogItem[];
};

const kindLabels: Record<'PRODUCT' | 'SERVICE', string> = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
};

// A placed order, kept in full after the basket is cleared so the confirmation
// can show what was ordered and hand the chat over to WhatsApp.
type ReceiptLine = { name: string; quantity: number; amount: string };
type Receipt = {
  orderNumber: string;
  lines: ReceiptLine[];
  total: string;
  customerName: string;
  customerPhone: string;
  note: string | null;
};

// Text search covers the item itself and the shelf it sits on, so typing a
// category name brings back everything filed under it.
function matches(item: CatalogItem, needle: string, category: string | null): boolean {
  if (!needle) return true;
  return (
    item.name.toLowerCase().includes(needle) ||
    (item.description ?? '').toLowerCase().includes(needle) ||
    (category ?? '').toLowerCase().includes(needle)
  );
}

export function StoreCatalog({
  slug,
  storeName,
  contactPhone,
  groups,
  promotions,
  storeUrl,
}: {
  slug: string;
  storeName: string;
  contactPhone: string | null;
  groups: CatalogGroup[];
  promotions: PromotionSummary[];
  storeUrl: string;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Catalogue search: free text over name, description and category, plus a
  // category chip. Filtering only hides cards — the basket always spans the
  // whole catalogue, so narrowing the view never drops what's already in it.
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<CatalogItem | null>(null);

  const lines = groups.flatMap((group) => group.items).filter((item) => (cart[item.id] ?? 0) > 0);
  const count = lines.reduce((sum, item) => sum + (cart[item.id] ?? 0), 0);
  const total = lines.reduce((sum, item) => sum + item.pricePesewas * (cart[item.id] ?? 0), 0);

  const categoryLabels = groups
    .map((group) => group.label)
    .filter((label): label is string => label !== null);
  const needle = query.trim().toLowerCase();
  const visibleGroups = groups
    .filter((group) => activeCategory === null || group.label === activeCategory)
    .map((group) => ({
      label: group.label,
      icon: group.icon,
      coverUrl: group.coverUrl,
      items: group.items.filter((item) => matches(item, needle, group.label)),
    }))
    .filter((group) => group.items.length > 0);
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const filtering = needle !== '' || activeCategory !== null;
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
            total: receipt.total,
            customerName: receipt.customerName,
            customerPhone: receipt.customerPhone,
            note: receipt.note,
          }),
        )
      : null;

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
    setReceipt(null);
    setOpen(true);
  }

  async function submit() {
    setError(null);
    const parsed = PublicOrderCreate.safeParse({
      lines: lines.map((item) => ({ itemId: item.id, quantity: cart[item.id] ?? 1 })),
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
    // Snapshot the basket before the request: the cart is cleared on success
    // and the confirmation screen still has to show (and forward) the order.
    const snapshot: Receipt = {
      orderNumber: '',
      lines: lines.map((item) => ({
        name: item.name,
        quantity: cart[item.id] ?? 1,
        amount: formatGhs(item.pricePesewas * (cart[item.id] ?? 1)),
      })),
      total: formatGhs(total),
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
      setReceipt({ ...snapshot, orderNumber: result.order.orderNumber });
      setCart({});
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
    setOpen(false);
    setReceipt(null);
    setName('');
    setPhone('');
    setNote('');
    setError(null);
  }

  function clearFilters() {
    setQuery('');
    setActiveCategory(null);
  }

  function emptyCopy() {
    const search = query.trim();
    if (search && activeCategory) return `Nothing matches "${search}" in ${activeCategory}.`;
    if (search) return `Nothing matches "${search}".`;
    if (activeCategory) return `Nothing filed under ${activeCategory} yet.`;
    return 'Nothing matches those filters.';
  }

  function renderItem(item: CatalogItem) {
    const discount = itemDiscountPercent(item);
    const promos = promosForItem(promotions, item);
    const soldOut = item.stock != null && item.stock <= 0;
    const lowStock = item.stock != null && item.stock > 0 && item.stock <= 5;
    const maxQty = item.stock ?? 99;
    const qty = cart[item.id] ?? 0;
    const priceLabel =
      discount != null
        ? `${formatGhs(item.pricePesewas)}, was ${formatGhs(item.compareAtPricePesewas ?? 0)} (${discount}% off)`
        : formatGhs(item.pricePesewas);
    const orderLink = contactPhone
      ? waMessageLink(
          contactPhone,
          itemOrderWhatsApp({
            storeName,
            itemName: item.name,
            priceLabel,
            quantity: Math.max(1, qty),
          }),
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
        id={item.id}
        className="lift group flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm"
      >
        {/* Image-forward: the photo (or a themed monogram panel) is the card.
            Badges float on it so the media stays edge-to-edge. */}
        <div className="relative overflow-hidden rounded-xl bg-muted">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105"
            />
          ) : (
            <span className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-[var(--tl-700)] to-[var(--tl-900)] text-white/70">
              {item.kind === 'SERVICE' ? (
                <Wrench aria-hidden className="size-10" />
              ) : (
                <Package aria-hidden className="size-10" />
              )}
            </span>
          )}
          {(discount != null || promos.length > 0) && (
            <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
              {discount != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-caption font-bold text-white shadow-sm">
                  <Percent aria-hidden className="size-3" />
                  {discount}% off
                </span>
              )}
              {promos.map((promo) => (
                <span
                  key={promo.name}
                  className="rounded-full bg-[var(--tl-950)]/70 px-2.5 py-1 text-caption font-semibold text-white backdrop-blur"
                >
                  {promo.name}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShareItem(item)}
            aria-label={`Share ${item.name}`}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
          >
            <Share2 aria-hidden className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col p-3">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-eyebrow">{kindLabels[item.kind]}</span>
            {soldOut ? (
              <span className="text-eyebrow rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                Sold out
              </span>
            ) : (
              lowStock && (
                <span className="text-eyebrow rounded-full bg-destructive/10 px-2.5 py-0.5 text-destructive">
                  Only {item.stock} left
                </span>
              )
            )}
          </span>
          <h2 className="mt-1.5 break-words font-display text-h4">{item.name}</h2>
          {item.description && (
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}
          <div className="mt-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-h4 text-foreground">
                {formatGhs(item.pricePesewas)}
              </span>
              {discount != null && (
                <span className="text-small text-muted-foreground line-through">
                  {formatGhs(item.compareAtPricePesewas ?? 0)}
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {soldOut ? (
              <p className="rounded-md border border-dashed border-border px-4 py-3 text-center text-small text-muted-foreground">
                Back soon — message the shop to reserve one.
              </p>
            ) : (
              <>
                {qty === 0 ? (
                  <Button
                    type="button"
                    onClick={() => setQuantity(item.id, 1)}
                    className="h-11 w-full items-center gap-2 rounded-xl px-4 font-semibold shadow-sm transition-transform active:scale-[0.98]"
                  >
                    <ShoppingCart aria-hidden className="size-4" /> Add to basket
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-2 py-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`One fewer ${item.name}`}
                      onClick={() => setQuantity(item.id, qty - 1)}
                      className="size-8 rounded-md"
                    >
                      <Minus aria-hidden className="size-3.5" />
                    </Button>
                    <span className="min-w-8 text-center font-mono text-lg font-semibold">
                      {qty}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`One more ${item.name}`}
                      onClick={() => setQuantity(item.id, Math.min(maxQty, qty + 1))}
                      className="size-8 rounded-md"
                    >
                      <Plus aria-hidden className="size-3.5" />
                    </Button>
                    <span className="text-eyebrow hidden flex-1 text-right min-[360px]:block">
                      in basket
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name} from the basket`}
                      onClick={() => setQuantity(item.id, 0)}
                      className="grid size-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {!soldOut && orderLink && (
                    <a
                      href={orderLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-small font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
                    >
                      <MessageCircle aria-hidden className="size-4" /> WhatsApp
                    </a>
                  )}
                  {!soldOut && smsHref && (
                    <a
                      href={smsHref}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--tl-700)] px-4 text-small font-semibold text-[var(--tl-800)] transition-colors hover:bg-[var(--tl-100)]"
                    >
                      <MessageSquareText aria-hidden className="size-4" /> SMS
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <div className={`grid gap-10 ${count > 0 ? 'pb-28' : ''}`}>
        <div className="grid gap-3">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the catalogue"
              aria-label="Search the catalogue"
              className="h-12 rounded-xl pl-10 pr-10 shadow-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>

          {categoryLabels.length > 1 && (
            <fieldset
              aria-label="Filter by category"
              className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
            >
              {[null, ...categoryLabels].map((label) => {
                const active = activeCategory === label;
                return (
                  <button
                    key={label ?? '__all'}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveCategory(label)}
                    className={`rounded-full border px-4 py-2 text-small font-semibold transition-all ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {label ?? 'All items'}
                  </button>
                );
              })}
            </fieldset>
          )}

          {filtering && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-eyebrow text-muted-foreground">
                {visibleCount} of {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-small font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-16 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Search aria-hidden className="size-5" />
            </span>
            <p className="mt-4 break-words font-display text-h3 tracking-tight">No matches</p>
            <p className="mt-1 text-sm text-muted-foreground">{emptyCopy()}</p>
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="mt-5 h-10 rounded-md px-4 text-small font-semibold"
            >
              Clear search &amp; filters
            </Button>
          </div>
        ) : (
          visibleGroups.map((group) => {
            const GroupIcon = group.icon ? (CATEGORY_ICONS[group.icon] ?? null) : null;
            return (
              <section key={group.label ?? '__uncategorised'}>
                {group.label && (
                  <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {group.coverUrl ? (
                        <img
                          src={group.coverUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-12 shrink-0 rounded-xl border border-border bg-muted object-cover shadow-sm"
                        />
                      ) : (
                        GroupIcon && (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <GroupIcon aria-hidden className="size-5" />
                          </span>
                        )
                      )}
                      <h2 className="break-words font-display text-h2 tracking-tight">
                        {group.label}
                      </h2>
                    </div>
                    <span className="shrink-0 text-caption font-semibold text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                )}
                <div
                  className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${group.label ? 'mt-5' : ''}`}
                >
                  {group.items.map((item) => renderItem(item))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {count > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {/* Floating basket pill: the one always-on control, so it floats over
              the page instead of welding itself to the bottom edge. */}
          <div className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-2.5 pl-4 shadow-2xl backdrop-blur">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-h4 text-primary">
                {count}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-caption font-semibold text-muted-foreground">
                  {count === 1 ? 'item' : 'items'} in your basket
                </span>
                <span className="block font-display text-h4">{formatGhs(total)}</span>
              </span>
            </span>
            <Button
              type="button"
              onClick={checkout}
              className="h-11 shrink-0 items-center gap-2 rounded-xl px-5 font-semibold shadow-sm transition-transform active:scale-[0.98]"
            >
              <ShoppingCart aria-hidden className="size-4" /> Checkout
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-md">
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
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Check aria-hidden className="size-6" />
              </span>
              <div>
                <p className="text-lg font-semibold">Order recorded</p>
                <p className="font-mono text-sm text-muted-foreground">#{receipt.orderNumber}</p>
              </div>
              <ul className="grid gap-1.5 rounded-xl border border-border p-3 text-left">
                {receipt.lines.map((line, index) => (
                  <li
                    key={`${index}-${line.name}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-muted-foreground">{line.quantity}x</span>{' '}
                      {line.name}
                    </span>
                    <span className="shrink-0 font-mono">{line.amount}</span>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm font-semibold">
                  <span>Total</span>
                  <span className="font-mono">{receipt.total}</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                {waOrderLink
                  ? `${storeName} sees it immediately — send the order on WhatsApp.`
                  : `${storeName} has your order and will contact you to confirm.`}
              </p>
              {waOrderLink && (
                <a
                  href={waOrderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
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
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
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
                        className="size-8 rounded-md"
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
                        className="size-8 rounded-md"
                      >
                        <Plus aria-hidden className="size-3.5" />
                      </Button>
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-sm font-bold max-[400px]:w-full max-[400px]:text-left">
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
                className="h-11 rounded-md font-semibold"
              >
                {busy ? 'Saving…' : 'Place order'}
              </Button>
              {contactPhone && (
                <p className="text-center text-xs text-muted-foreground">
                  You&apos;ll then send it to {storeName} on WhatsApp.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {shareItem && (
        <ShareSheet
          open={shareItem !== null}
          onOpenChange={(next) => {
            if (!next) setShareItem(null);
          }}
          title={`Share “${shareItem.name}”`}
          description="Send this product anywhere — WhatsApp carries the price and link."
          message={productShareMessage({
            storeName,
            itemName: shareItem.name,
            priceLabel: formatGhs(shareItem.pricePesewas),
            itemUrl: `${storeUrl}#${shareItem.id}`,
          })}
          url={`${storeUrl}#${shareItem.id}`}
          imageUrl={`/api/public/store/items/${shareItem.id}/share`}
          imageName={`${shareItem.name}-share.png`}
        />
      )}
    </>
  );
}
