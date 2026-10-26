import type { Metadata } from 'next';
import Link from 'next/link';
import { OrdersSignIn } from '@/components/custom/storefront/orders-sign-in';
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { Button } from '@/components/ui/button';
import { formatGhs, type OrderStatusValue } from '@/lib/contracts/order';
import { env } from '@/lib/env';
import { signOrderToken } from '@/lib/order-tracking';
import { getSessionUser } from '@/lib/require-auth';
import { listShopperOrders } from '@/lib/shopper-orders';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your orders',
  robots: { index: false, follow: false },
};

const statusLabel: Record<OrderStatusValue, string> = {
  PENDING: 'Order received',
  PROCESSING: 'Being prepared',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium' }).format(value);
}

export default async function OrdersPage() {
  const user = await getSessionUser();
  const googleEnabled =
    env.NEXT_PUBLIC_GOOGLE_AUTH === 'true' &&
    Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  if (!user) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-lg content-center gap-5 px-4 py-10">
        <TilzaLogo className="text-lg" />
        <div>
          <p className="text-eyebrow">Your orders</p>
          <h1 className="mt-1 font-display text-h2">Keep every order in one place</h1>
          <p className="mt-2 text-small text-muted-foreground">
            Sign in with Google to see the orders you saved from a tracking link.
          </p>
        </div>
        <OrdersSignIn googleEnabled={googleEnabled} />
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Back to Tilza</Link>
        </Button>
      </main>
    );
  }

  const orders = await listShopperOrders(user.id);

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-5 px-4 py-8 sm:py-12">
      <header className="grid gap-3">
        <TilzaLogo className="text-lg" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-eyebrow">Your orders</p>
            <h1 className="mt-1 font-display text-h2">Saved orders</h1>
            <p className="mt-1 text-small text-muted-foreground">Signed in as {user.email}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back to Tilza</Link>
          </Button>
        </div>
      </header>

      {orders.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-h3">No saved orders yet</h2>
          <p className="mt-2 text-small text-muted-foreground">
            Open the tracking link from a receipt and choose Save this order to keep it here.
          </p>
        </section>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => {
            const store = order.user.store;
            const token = signOrderToken(order.id);
            return (
              <li key={order.id}>
                <Link
                  href={`/track/${encodeURIComponent(token)}`}
                  className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-h4">#{order.orderNumber}</span>
                    <span className="text-caption font-semibold text-primary">
                      {statusLabel[order.status]}
                    </span>
                  </span>
                  <span className="mt-1 block text-small text-muted-foreground">
                    {store?.name ?? 'Tilza shop'} · {formatDate(order.createdAt)}
                  </span>
                  {order.amountPesewas != null ? (
                    <span className="mt-2 block font-mono text-small font-semibold">
                      {formatGhs(order.amountPesewas)}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
