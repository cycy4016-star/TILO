// F9 · REPORT — the investor sheet. A printable document assembled from the
// same live feeds the other panels read (overview, accounts ledger, shops,
// products), plus one-click CSV / XLS downloads of each underlying report.
// Nothing here is sampled or cached: the stamp at the top is the moment these
// numbers came out of the database.
'use client';

import { useState } from 'react';
import { AdminOverview, AdminProducts, AdminShops, AdminUserMonitor } from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import {
  Bar,
  Cell,
  DataTable,
  ErrorState,
  formatStamp,
  LivePill,
  num,
  Panel,
  Row,
  Stat,
  TButton,
  TONE,
  Trend,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const REPORT_MS = 60_000;

function DownloadLinks({ report }: { report: string }) {
  const base =
    'inline-flex items-center border border-[var(--t-border)] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--t-dim)] transition-colors hover:border-current hover:text-[var(--t-amber)]';
  return (
    <span className="flex items-center gap-1">
      <a className={base} href={`/api/admin/export?report=${report}&format=csv`}>
        CSV
      </a>
      <a className={base} href={`/api/admin/export?report=${report}&format=xls`}>
        Excel
      </a>
    </span>
  );
}

export function ReportConsole() {
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const overview = useLiveData('/api/admin/overview?days=30', AdminOverview, REPORT_MS);
  const users = useLiveData('/api/admin/users', AdminUserMonitor, REPORT_MS);
  const shops = useLiveData('/api/admin/shops', AdminShops, REPORT_MS);
  const products = useLiveData('/api/admin/products', AdminProducts, REPORT_MS);

  const o = overview.data;
  const u = users.data;
  const s = shops.data;
  const p = products.data;

  const refreshAll = () => {
    overview.refresh();
    users.refresh();
    shops.refresh();
    products.refresh();
  };

  const generate = () => {
    setGeneratedAt(new Date().toISOString());
    refreshAll();
  };

  const anyError = overview.error || users.error || shops.error || products.error;
  const loading = !o && !u && !s && !p;

  const topShops = (s?.shops ?? [])
    .slice()
    .sort((a, b) => b.gmvPesewas - a.gmvPesewas)
    .slice(0, 10);
  const topProducts = (p?.items ?? []).slice(0, 10);
  const recentUsers = (u?.users ?? []).slice(0, 25);
  const daily = o?.daily ?? [];
  const maxOrders = Math.max(1, ...daily.map((day) => day.orders));

  return (
    <div className="grid gap-3">
      <div className="tlz-print-hide flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <span className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--t-dim)]">
          <span>Investor sheet</span>
          <span className="text-[var(--t-faint)]">·</span>
          <span>Overview</span>
          <DownloadLinks report="overview" />
          <span>Accounts</span>
          <DownloadLinks report="users" />
          <span>Shops</span>
          <DownloadLinks report="shops" />
          <span>Products</span>
          <DownloadLinks report="products" />
        </span>
        <span className="flex items-center gap-2">
          <TButton tone="green" onClick={generate}>
            Generate
          </TButton>
          <TButton tone="amber" onClick={() => window.print()}>
            Print / PDF
          </TButton>
          <LivePill
            live={overview.live}
            updatedAt={overview.updatedAt}
            onToggle={overview.live ? overview.pause : overview.resume}
            onRefresh={refreshAll}
          />
        </span>
      </div>

      {loading ? (
        <Panel code="RP" title="Platform report">
          {anyError ? (
            <ErrorState message="Could not reach the report feeds." onRetry={refreshAll} />
          ) : (
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Assembling report…
            </p>
          )}
        </Panel>
      ) : (
        <>
          <Panel
            code="RP"
            title="Tilza platform report"
            right={
              <span>
                generated{' '}
                {formatStamp(
                  generatedAt ?? new Date(overview.updatedAt ?? Date.now()).toISOString(),
                )}
              </span>
            }
          >
            <div className="grid grid-cols-2 border-b border-[var(--t-grid)] sm:grid-cols-4">
              <Stat
                label="Accounts"
                value={o ? num(o.users) : '—'}
                sub={u ? `${u.activeThisMonth} active this month` : undefined}
              />
              <Stat
                label="Sign-ins"
                value={o ? num(o.signInsMonth) : '—'}
                sub={o ? `${o.signInsToday} today` : undefined}
                tone="cyan"
              />
              <Stat
                label="Shops live"
                value={o ? `${o.activeStores}/${o.stores}` : '—'}
                sub={o ? `${num(o.items)} items listed` : undefined}
                tone="green"
              />
              <Stat
                label="Customers"
                value={o ? num(o.customers) : '—'}
                sub={o ? `${num(o.leads)} leads` : undefined}
              />
              <Stat
                label="Orders"
                value={o ? num(o.orders) : '—'}
                sub={o ? `${o.ordersToday} today` : undefined}
              />
              <Stat label="Volume moved" value={o ? formatGhs(o.gmvPesewas) : '—'} tone="amber" />
              <Stat
                label="Collected"
                value={o ? formatGhs(o.paidPesewas) : '—'}
                sub={o ? `${formatGhs(o.gmvPesewas - o.paidPesewas)} outstanding` : undefined}
                tone="green"
              />
              <Stat
                label="Inquiries"
                value={o ? num(o.inquiries) : '—'}
                sub={o ? `${num(o.itemsAddedMonth)} items added MTD` : undefined}
              />
            </div>
            <p className="px-3 py-2 text-[11px] text-[var(--t-faint)]">
              Every figure is read live from the platform database at generation time — no samples,
              no estimates. Money in GHS.
            </p>
          </Panel>

          <Panel
            code="DY"
            title="Day by day · last 30 days"
            right={<span>{daily.length} days</span>}
            bodyClassName="p-0"
          >
            <div className="grid grid-cols-1 gap-x-4 border-b border-[var(--t-grid)] px-3 pt-2.5 sm:grid-cols-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-dim)]">
                  Orders
                </span>
                <Trend
                  values={daily.map((day) => day.orders)}
                  tone="amber"
                  title="Orders per day"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-dim)]">
                  Signups
                </span>
                <Trend
                  values={daily.map((day) => day.signups)}
                  tone="green"
                  title="Signups per day"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-dim)]">
                  Inquiries
                </span>
                <Trend
                  values={daily.map((day) => day.inquiries)}
                  tone="cyan"
                  title="Inquiries per day"
                />
              </div>
            </div>
            <DataTable
              columns={[
                { key: 'day', label: 'Day' },
                { key: 'orders', label: 'Orders', right: true },
                { key: 'items', label: 'Items in', right: true },
                { key: 'signups', label: 'Signups', right: true },
                { key: 'inquiries', label: 'Inquiries', right: true },
                { key: 'errors', label: 'New bugs', right: true },
                { key: 'tape', label: 'Orders' },
              ]}
              empty="No days in this window."
            >
              {daily.map((day) => (
                <Row key={day.day}>
                  <Cell tone="dim">{day.day}</Cell>
                  <Cell right tone={day.orders > 0 ? 'amber' : 'faint'}>
                    {day.orders}
                  </Cell>
                  <Cell right tone={day.items > 0 ? 'text' : 'faint'}>
                    {day.items}
                  </Cell>
                  <Cell right tone={day.signups > 0 ? 'text' : 'faint'}>
                    {day.signups}
                  </Cell>
                  <Cell right tone={day.inquiries > 0 ? 'cyan' : 'faint'}>
                    {day.inquiries}
                  </Cell>
                  <Cell right tone={day.errors > 0 ? 'red' : 'faint'}>
                    {day.errors}
                  </Cell>
                  <Cell>
                    <Bar value={day.orders} max={maxOrders} tone="amber" />
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </Panel>

          <div className="grid gap-3 xl:grid-cols-2">
            <Panel
              code="SH"
              title="Top shops by volume"
              right={<span>{s?.total ?? 0} shops</span>}
              bodyClassName="p-0"
            >
              <DataTable
                columns={[
                  { key: 'store', label: 'Shop' },
                  { key: 'orders', label: 'Orders', right: true },
                  { key: 'items', label: 'Items', right: true },
                  { key: 'gmv', label: 'Volume', right: true },
                ]}
                empty="No shops in this window yet — a shop appears once a merchant creates one."
              >
                {topShops.map((shop) => (
                  <Row key={shop.userId}>
                    <Cell tone="cyan">{shop.storeName ?? shop.ownerName}</Cell>
                    <Cell right>{shop.orderCount}</Cell>
                    <Cell right tone="dim">
                      {shop.itemCount}
                    </Cell>
                    <Cell right tone="amber">
                      {formatGhs(shop.gmvPesewas)}
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            </Panel>

            <Panel
              code="PR"
              title="Top products by revenue"
              right={<span>{p?.items.length ?? 0} lines</span>}
              bodyClassName="p-0"
            >
              <DataTable
                columns={[
                  { key: 'item', label: 'Item' },
                  { key: 'shop', label: 'Shop' },
                  { key: 'units', label: 'Units', right: true },
                  { key: 'revenue', label: 'Revenue', right: true },
                ]}
                empty="Nothing sold yet."
              >
                {topProducts.map((item) => (
                  <Row key={`${item.shop}-${item.name}`}>
                    <Cell tone="text">{item.name}</Cell>
                    <Cell tone="dim">{item.shop ?? '—'}</Cell>
                    <Cell right>{item.units}</Cell>
                    <Cell right tone="amber">
                      {formatGhs(item.revenuePesewas)}
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            </Panel>
          </div>

          <Panel
            code="AC"
            title="Account ledger · newest 25"
            right={<span>{u?.totalUsers ?? 0} accounts</span>}
            bodyClassName="p-0"
          >
            <DataTable
              columns={[
                { key: 'account', label: 'Account' },
                { key: 'signed', label: 'Signed up' },
                { key: 'signins', label: 'Sign-ins', right: true },
                { key: 'last', label: 'Last sign-in', right: true },
                { key: 'status', label: 'Status' },
              ]}
              empty="No accounts yet — sign-ups land here the moment they happen."
            >
              {recentUsers.map((user) => (
                <Row key={user.id}>
                  <Cell>
                    <span className="block truncate font-bold text-[var(--t-text)]">
                      {user.name}
                    </span>
                    <span className="block truncate text-[10px] text-[var(--t-cyan)]">
                      {user.email}
                    </span>
                  </Cell>
                  <Cell tone="dim">{formatStamp(user.createdAt)}</Cell>
                  <Cell right tone={user.signInCount > 0 ? 'text' : 'faint'}>
                    {user.signInCount}
                  </Cell>
                  <Cell right tone="dim">
                    {user.lastSeenAt ? formatStamp(user.lastSeenAt) : 'never'}
                  </Cell>
                  <Cell tone={user.banned ? 'red' : 'green'}>
                    {user.banned ? 'Suspended' : 'Active'}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </Panel>

          <p className="text-center text-[10px] uppercase tracking-[0.16em] text-[var(--t-faint)]">
            Tilza · platform report · <span className={TONE.amber}>live figures</span> · keep for
            investors
          </p>
        </>
      )}
    </div>
  );
}
