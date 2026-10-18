// F2 · SHOPS — the cross-account shop table plus the per-account dossier, with
// the power to open or close a storefront. Terminal tables, live.
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminShopDetail, AdminShops, AdminShopToggleResult } from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import {
  Cell,
  DataTable,
  Dot,
  Empty,
  ErrorState,
  formatStamp,
  Kv,
  LivePill,
  Panel,
  Row,
  SearchField,
  Stat,
  Tag,
  TButton,
  TONE,
} from './terminal/primitives';
import { useLiveData } from './use-live';

function ShopsPanel({ onOpen }: { onOpen: (userId: string) => void }) {
  const [q, setQ] = useState('');
  const [input, setInput] = useState('');
  const feed = useLiveData(`/api/admin/shops${q ? `?q=${encodeURIComponent(q)}` : ''}`, AdminShops);
  const shops = feed.data;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <SearchField
            label="Search shops"
            value={input}
            onChange={setInput}
            onSubmit={() => setQ(input.trim())}
            placeholder="owner · phone · shop · slug"
          />
        </div>
        <LivePill
          live={feed.live}
          updatedAt={feed.updatedAt}
          onToggle={feed.live ? feed.pause : feed.resume}
          onRefresh={feed.refresh}
        />
      </div>

      {!shops ? (
        feed.error ? (
          <Panel code="SH" title="Shop register">
            <ErrorState message="Could not load the shop register." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="SH" title="Shop register">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Loading register…
            </p>
          </Panel>
        )
      ) : shops.shops.length === 0 ? (
        <Panel code="SH" title="Shop register">
          <Empty title="No shops match" hint="Clear the search or try a slug fragment." />
        </Panel>
      ) : (
        <Panel
          code="SH"
          title="Shop register"
          right={
            <span>
              {shops.shops.length}/{shops.total} accounts · press a row to open the dossier
            </span>
          }
          bodyClassName="p-0"
        >
          <DataTable
            columns={[
              { key: 'shop', label: 'Shop' },
              { key: 'owner', label: 'Owner' },
              { key: 'state', label: 'State' },
              { key: 'orders', label: 'Orders', right: true },
              { key: 'unpaid', label: 'Unpaid', right: true },
              { key: 'customers', label: 'Cust', right: true },
              { key: 'volume', label: 'Volume', right: true },
              { key: 'last', label: 'Last order', right: true },
            ]}
            empty="No shops match."
          >
            {shops.shops.map((shop) => (
              <Row key={shop.userId} className="cursor-pointer">
                <td className="max-w-0 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpen(shop.userId)}
                    className="block max-w-full truncate text-left font-bold text-[var(--t-amber)] hover:underline"
                  >
                    {shop.storeName ?? '—'}
                  </button>
                  <span className="block truncate text-[10px] text-[var(--t-faint)]">
                    /store/{shop.slug ?? '—'} · {shop.itemCount} items
                  </span>
                </td>
                <Cell>
                  {shop.ownerName}
                  <span className="block truncate text-[10px] text-[var(--t-faint)]">
                    {shop.ownerPhone ?? 'no phone'}
                  </span>
                </Cell>
                <Cell>
                  {shop.storeActive === false ? (
                    <Tag tone="red">Closed</Tag>
                  ) : (
                    <Tag tone="green">Live</Tag>
                  )}
                </Cell>
                <Cell right tone={shop.orderCount > 0 ? 'text' : 'faint'}>
                  {shop.orderCount}
                </Cell>
                <Cell right tone={shop.unpaidCount > 0 ? 'red' : 'faint'}>
                  {shop.unpaidCount}
                </Cell>
                <Cell right tone="text">
                  {shop.customerCount}
                </Cell>
                <Cell right tone="amber">
                  {formatGhs(shop.gmvPesewas)}
                </Cell>
                <Cell right tone="dim">
                  {shop.lastOrderAt ? formatStamp(shop.lastOrderAt) : 'never'}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>
      )}
    </div>
  );
}

function ShopDossier({ userId, onBack }: { userId: string; onBack: () => void }) {
  const feed = useLiveData(`/api/admin/shops/${userId}`, AdminShopDetail);
  const data = feed.data;
  const [busy, setBusy] = useState(false);

  const toggleActive = async () => {
    if (!data || data.storeActive == null) return;
    const next = !data.storeActive;
    if (
      !next &&
      !window.confirm(
        `Close ${data.storeName ?? 'this shop'}? The storefront goes offline until you reopen it.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/shops/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: next }),
        schema: AdminShopToggleResult,
      });
      feed.refresh();
    } catch {
      // Leave the dossier as it was; the button re-enables for another try.
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <Panel code="SH" title={`Dossier ${userId}`}>
        {feed.error ? (
          <ErrorState message="Could not load that account." onRetry={feed.refresh} />
        ) : (
          <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
            Loading dossier…
          </p>
        )}
      </Panel>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <TButton onClick={onBack} tone="dim">
          ← Back to register
        </TButton>
        <LivePill
          live={feed.live}
          updatedAt={feed.updatedAt}
          onToggle={feed.live ? feed.pause : feed.resume}
          onRefresh={feed.refresh}
        />
      </div>

      <Panel
        code="SH"
        title={data.storeName ?? data.ownerName}
        right={
          <span className="flex items-center gap-2">
            <Tag tone={data.banned ? 'red' : 'green'}>{data.banned ? 'Suspended' : 'Active'}</Tag>
            <Tag tone={data.role === 'admin' ? 'amber' : 'dim'}>{data.role ?? 'user'}</Tag>
            {data.storeActive === false && <Tag tone="red">Shop closed</Tag>}
            <TButton
              onClick={() => void toggleActive()}
              disabled={busy || data.storeActive == null}
              tone={data.storeActive === false ? 'green' : 'red'}
            >
              {data.storeActive == null
                ? 'No storefront'
                : data.storeActive === false
                  ? 'Reopen shop'
                  : 'Close shop'}
            </TButton>
          </span>
        }
      >
        <div className="grid gap-x-4 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
          <Kv k="Owner" v={data.ownerName} />
          <Kv k="Email" v={data.ownerEmail} />
          <Kv k="Phone" v={data.ownerPhone ?? '—'} />
          <Kv
            k="Verified"
            v={data.phoneVerified ? 'yes' : 'no'}
            tone={data.phoneVerified ? 'green' : 'dim'}
          />
          <Kv k="Storefront" v={`/store/${data.slug ?? '—'}`} tone="cyan" />
          <Kv k="Account" v={`opened ${formatStamp(data.createdAt)}`} tone="dim" />
          <Kv
            k="Last seen"
            v={data.lastSeenAt ? formatStamp(data.lastSeenAt) : 'never'}
            tone={data.lastSeenAt ? 'text' : 'dim'}
          />
          <Kv k="Created" v={formatStamp(data.createdAt)} tone="dim" />
          <Kv k="User id" v={data.userId} tone="dim" />
        </div>
      </Panel>

      <div className="grid grid-cols-2 border border-[var(--t-border)] bg-[var(--t-card)] sm:grid-cols-4">
        <Stat
          label="Orders"
          value={data.orderCount}
          sub={`${formatGhs(data.gmvPesewas)} volume`}
          tone="amber"
        />
        <Stat label="Collected" value={formatGhs(data.paidPesewas)} tone="green" />
        <Stat label="Customers" value={data.customerCount} />
        <Stat
          label="Catalogue"
          value={data.itemCount}
          sub={data.storeActive === false ? 'storefront closed' : 'storefront live'}
          tone={data.storeActive === false ? 'red' : 'text'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          code="ITM"
          title="Top items by revenue"
          right={<span>{data.topItems.length} ranked</span>}
          bodyClassName="p-0"
        >
          {data.topItems.length === 0 ? (
            <Empty
              title="No productized sales yet"
              hint="Revenue ranks appear the moment an order line names a catalogue item."
            />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Item' },
                { key: 'units', label: 'Units', right: true },
                { key: 'revenue', label: 'Revenue', right: true },
              ]}
            >
              {data.topItems.map((item) => (
                <Row key={item.name}>
                  <Cell tone="text">{item.name}</Cell>
                  <Cell right tone="dim">
                    {item.units}
                  </Cell>
                  <Cell right tone="amber">
                    {formatGhs(item.revenuePesewas)}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel
          code="ORD"
          title="Recent orders"
          right={<span>{data.recentOrders.length} shown</span>}
          bodyClassName="p-0"
        >
          {data.recentOrders.length === 0 ? (
            <Empty title="No orders yet" hint="Customer checkouts land here in real time." />
          ) : (
            <DataTable
              columns={[
                { key: 'number', label: 'Order' },
                { key: 'customer', label: 'Customer' },
                { key: 'status', label: 'Status' },
                { key: 'amount', label: 'Amount', right: true },
              ]}
            >
              {data.recentOrders.map((order) => (
                <Row key={order.id}>
                  <Cell tone="cyan">{order.orderNumber}</Cell>
                  <Cell tone="dim">{order.customerName ?? 'Walk-in'}</Cell>
                  <Cell tone={order.status === 'COMPLETED' ? 'green' : 'text'}>
                    <span className="uppercase">{order.status}</span>
                  </Cell>
                  <Cell right tone={order.amountPesewas == null ? 'faint' : 'amber'}>
                    {order.amountPesewas == null ? '—' : formatGhs(order.amountPesewas)}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel
          code="CUS"
          title="Recent customers"
          right={<span>{data.customerCount} total</span>}
          bodyClassName="p-0"
        >
          {data.recentCustomers.length === 0 ? (
            <Empty
              title="No customers yet"
              hint="A customer appears with their first order or inquiry."
            />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Customer' },
                { key: 'phone', label: 'Phone' },
                { key: 'orders', label: 'Orders', right: true },
                { key: 'seen', label: 'First seen', right: true },
              ]}
            >
              {data.recentCustomers.map((customer) => (
                <Row key={customer.id}>
                  <Cell tone="text">{customer.name}</Cell>
                  <Cell tone="dim">{customer.phone ?? '—'}</Cell>
                  <Cell right tone="amber">
                    {customer.orderCount}
                  </Cell>
                  <Cell right tone="dim">
                    {formatStamp(customer.createdAt)}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel
          code="SMS"
          title="Recent SMS"
          right={<span>{data.recentSms.length} shown</span>}
          bodyClassName="p-0"
        >
          {data.recentSms.length === 0 ? (
            <Empty
              title="No SMS on this account"
              hint="Messages sent to this shop's customers will show here."
            />
          ) : (
            <DataTable
              columns={[
                { key: 'to', label: 'To' },
                { key: 'source', label: 'Source' },
                { key: 'credits', label: 'Credits', right: true },
                { key: 'ok', label: 'Result' },
              ]}
            >
              {data.recentSms.map((sms) => (
                <Row key={sms.id}>
                  <Cell tone="text">{sms.to}</Cell>
                  <Cell tone="dim">{sms.source}</Cell>
                  <Cell right tone="dim">
                    {sms.credits}
                  </Cell>
                  <Cell>
                    <span className="flex items-center gap-1.5">
                      <Dot tone={sms.ok ? 'green' : 'red'} />
                      <span className={sms.ok ? TONE.green : TONE.red}>
                        {sms.ok ? 'DELIVERED' : 'FAILED'}
                      </span>
                    </span>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** The /dashboard/admin/shops island: rows deep-link to a real dossier URL. */
export function ShopsConsole() {
  const router = useRouter();
  return <ShopsPanel onOpen={(userId) => router.push(`/dashboard/admin/shops/${userId}`)} />;
}

/** The /dashboard/admin/shops/[userId] dossier, with a back link to the list. */
export function ShopDossierView({ userId }: { userId: string }) {
  const router = useRouter();
  return <ShopDossier userId={userId} onBack={() => router.push('/dashboard/admin/shops')} />;
}
