// Public storefront — the "Jumia" face. Server-rendered (good for sharing),
// fed by the open /api/public/store/[slug] route. Order buttons open WhatsApp
// with the item + price pre-filled into a chat with the store.

import {
  MessageCircle,
  MessageSquareText,
  Package,
  Percent,
  Phone,
  Tag,
  Wrench,
} from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LeadCaptureCard } from '@/components/custom/storefront/lead-capture-card';
import { StoreOrderButton } from '@/components/custom/storefront/store-order-button';
import { formatGhs } from '@/lib/contracts/order';
import { StorePublic } from '@/lib/contracts/store';
import { env } from '@/lib/env';
import { smsLink, waMeLink, waMessageLink } from '@/lib/phone';
import { formatPromoDate, itemDiscountPercent, promoHeadline, promoTerms } from '@/lib/promotions';
import { orderRequestSms } from '@/lib/sms-templates';

type StorePageProps = { params: Promise<{ slug: string }> };

async function fetchStore(slug: string) {
  // Self-fetch through the canonical origin (BETTER_AUTH_URL) so the storefront
  // always talks to this deployment even under a proxy / on a custom domain.
  const res = await fetch(`${env.BETTER_AUTH_URL}/api/public/store/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return StorePublic.parse(await res.json());
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await fetchStore(slug);
  if (!store) return { title: 'Store not found' };
  return {
    title: store.name,
    description: store.tagline ?? store.description ?? `Order from ${store.name}.`,
  };
}

const kindLabels: Record<'PRODUCT' | 'SERVICE', string> = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
};

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;
  const store = await fetchStore(slug);
  if (!store) notFound();

  const chat = waMessageLink(
    store.contactPhone,
    `Hi ${store.name}! I saw your shop online and I'd like to ask about ordering.`,
  );

  const pro = store.appearance === 'professional';

  return (
    <main
      data-theme={store.theme}
      data-appearance={store.appearance}
      className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14"
    >
      <section
        className={`relative ${pro ? 'rounded-3xl' : 'rounded-[2rem]'} bg-gradient-to-br ${
          pro
            ? 'from-[var(--tl-900)] via-[var(--tl-800)] to-[var(--tl-600)]'
            : 'from-amber-950 via-[#78350f] to-yellow-600'
        } ${pro ? 'p-8 text-[var(--tl-50)] sm:p-10' : 'p-8 text-amber-50 sm:p-12'}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, #facc15 0, transparent 35%), radial-gradient(circle at 10% 90%, #fcd34d 0, transparent 30%)',
          }}
        />
        <div className="relative">
          {store.logoUrl && (
            <img
              src={store.logoUrl}
              alt=""
              className="mb-4 size-16 rounded-2xl bg-amber-50/10 object-contain p-1"
            />
          )}
          <p
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] ${
              pro
                ? 'bg-[var(--tl-100)] text-[var(--tl-900)]'
                : 'rotate-1 bg-amber-300 text-amber-950'
            }`}
          >
            {store.items.length} {store.items.length === 1 ? 'item' : 'items'}{' '}
            {pro ? 'in the catalogue' : 'on the shelf'}
          </p>
          <h1
            className={`mt-4 leading-none sm:text-6xl ${
              pro
                ? 'font-display text-4xl font-bold text-[var(--tl-50)]'
                : 'font-display text-4xl font-black uppercase text-amber-50'
            }`}
          >
            {store.name}
          </h1>
          {store.tagline && (
            <p
              className={`mt-3 max-w-xl text-lg font-bold ${
                pro ? 'text-[var(--tl-100)]' : 'text-amber-100'
              }`}
            >
              {store.tagline}
            </p>
          )}
          {store.description && (
            <p
              className={`mt-2 max-w-xl text-sm font-medium leading-relaxed ${
                pro ? 'text-[var(--tl-200)]' : 'text-amber-200/90'
              }`}
            >
              {store.description}
            </p>
          )}
          {chat && (
            <a
              href={chat}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-emerald-600 px-6 font-black uppercase tracking-wide text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] transition-colors hover:bg-emerald-500"
            >
              <MessageCircle aria-hidden className="size-4" /> Chat with us
            </a>
          )}
        </div>
      </section>

      {store.promoBanner && (
        <section className="mt-6 flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--tl-cta-border)] bg-[var(--tl-banner)] px-4 py-3 text-center font-display text-sm font-black uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-stone-900 dark:text-amber-300">
          <Tag aria-hidden className="size-4 shrink-0" />
          <span>{store.promoBanner}</span>
        </section>
      )}

      {store.promotions.length > 0 && (
        <section className="mt-8">
          <h2 className={`text-2xl font-bold ${pro ? '' : 'font-display font-black uppercase'}`}>
            Today&apos;s offers
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.promotions.map((promo, index) => {
              const terms = promoTerms(promo);
              return (
                <article
                  key={`${promo.name}-${promo.code ?? 'any'}-${index}`}
                  className={`flex flex-col border-2 bg-white dark:bg-stone-900 ${
                    pro
                      ? 'rounded-2xl border-[var(--tl-200)] p-5'
                      : `rounded-[1.75rem] border-amber-950 p-5 shadow-[5px_5px_0_0_#451a03] ${
                          index % 2 === 1 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
                        }`
                  }`}
                >
                  {promo.imageUrl && (
                    <img
                      src={promo.imageUrl}
                      alt=""
                      className="mb-3 aspect-[16/9] w-full rounded-2xl border-2 border-amber-100 object-cover dark:border-stone-800"
                    />
                  )}
                  <p className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    {promoHeadline(promo)}
                  </p>
                  <p
                    className={`mt-1 ${
                      pro
                        ? 'text-base font-semibold'
                        : 'font-display font-black uppercase tracking-tight'
                    }`}
                  >
                    {promo.name}
                  </p>
                  {terms.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-stone-500">{terms.join(' · ')}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {promo.code ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-xs font-black tracking-widest text-amber-800 dark:bg-stone-800 dark:text-amber-300">
                        CODE {promo.code}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        No code needed
                      </span>
                    )}
                    {promo.endsAt && (
                      <span className="text-xs font-medium text-stone-400">
                        Ends {formatPromoDate(promo.endsAt)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {store.items.length === 0 ? (
        <section
          className={`mt-8 rounded-2xl border-2 border-dashed px-5 py-16 text-center ${
            pro ? 'border-[var(--tl-200)]' : 'border-amber-400'
          }`}
        >
          <p
            className={`text-xl font-bold ${
              pro ? 'text-[var(--tl-900)]' : 'font-display font-black uppercase'
            }`}
          >
            Restocking soon
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pro
              ? 'The catalogue is empty right now — check back in a moment.'
              : 'The shelf is empty right now — check back in a moment.'}
          </p>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {store.items.map((item, i) => {
            const discount = itemDiscountPercent(item);
            const orderLink = waMessageLink(
              store.contactPhone,
              `Hi ${store.name}! Please, add for me: ${item.name} — ${
                discount != null
                  ? `${formatGhs(item.pricePesewas)}, was ${formatGhs(item.compareAtPricePesewas ?? 0)} (${discount}% off)`
                  : formatGhs(item.pricePesewas)
              }.`,
            );
            return (
              <article
                key={item.id}
                className={`flex flex-col border-2 bg-white dark:bg-stone-900 ${
                  pro
                    ? 'rounded-2xl border-[var(--tl-200)] p-6'
                    : `rounded-[1.75rem] border-amber-950 p-6 shadow-[5px_5px_0_0_#451a03] ${
                        i % 2 === 1 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
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
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[0.7rem] font-black uppercase tracking-wider text-amber-800 dark:bg-stone-800 dark:text-amber-300">
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
                      <span className="font-mono text-xl font-black text-amber-950 dark:text-amber-50">
                        {formatGhs(item.pricePesewas)}
                      </span>
                      {discount != null && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-white">
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
                  <StoreOrderButton
                    itemId={item.id}
                    itemName={item.name}
                    pricePesewas={item.pricePesewas}
                    storeName={store.name}
                    slug={slug}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {orderLink && (
                      <a
                        href={orderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-emerald-700 bg-emerald-600 px-4 font-black uppercase tracking-wide text-white transition-colors hover:bg-emerald-500"
                      >
                        <MessageCircle aria-hidden className="size-4" /> WhatsApp
                      </a>
                    )}
                    {(() => {
                      const smsHref = smsLink(
                        store.contactPhone,
                        orderRequestSms({
                          storeName: store.name,
                          itemName: item.name,
                          priceGhs: formatGhs(item.pricePesewas),
                          quantity: 1,
                        }),
                      );
                      return smsHref ? (
                        <a
                          href={smsHref}
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 px-4 font-black uppercase tracking-wide transition-colors ${
                            pro
                              ? 'border-[var(--tl-700)] text-[var(--tl-800)] hover:bg-[var(--tl-100)]'
                              : 'border-amber-950 text-amber-950 hover:bg-amber-100 dark:text-amber-50'
                          }`}
                        >
                          <MessageSquareText aria-hidden className="size-4" /> SMS
                        </a>
                      ) : null;
                    })()}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <LeadCaptureCard storeName={store.name} slug={slug} />

      {store.contactPhone && waMeLink(store.contactPhone) && (
        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs font-black uppercase tracking-widest text-amber-600">
          <Phone aria-hidden className="size-3.5" /> Orders land straight in the shop — WhatsApp,
          SMS or right here
        </p>
      )}
    </main>
  );
}
