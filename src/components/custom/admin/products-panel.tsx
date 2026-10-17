// F4 · PRODUCTS — platform product intelligence: buy rate across every shop,
// ranked fastest-first, with margin and stock health on the same row.
'use client';

import { useMemo, useState } from 'react';
import { AdminProducts } from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import {
  Bar,
  Cell,
  DataTable,
  Empty,
  ErrorState,
  formatStamp,
  LivePill,
  Panel,
  Row,
  SearchField,
  Stat,
  Tag,
  TONE,
} from './terminal/primitives';
import { useLiveData } from './use-live';

function rate(unitsPerDay: number) {
  return unitsPerDay < 10 ? unitsPerDay.toFixed(1) : String(Math.round(unitsPerDay));
}

export function ProductsPanel() {
  const feed = useLiveData('/api/admin/products', AdminProducts);
  const data = feed.data;
  const [input, setInput] = useState('');

  const items = useMemo(() => {
    if (!data) return [];
    const q = input.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (item) => item.name.toLowerCase().includes(q) || (item.shop ?? '').toLowerCase().includes(q),
    );
  }, [data, input]);

  const maxRate = Math.max(1, ...items.map((item) => item.unitsPerDay));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <SearchField
            label="Filter products"
            value={input}
            onChange={setInput}
            onSubmit={() => undefined}
            placeholder="item or shop"
          />
        </div>
        <LivePill
          live={feed.live}
          updatedAt={feed.updatedAt}
          onToggle={feed.live ? feed.pause : feed.resume}
          onRefresh={feed.refresh}
        />
      </div>

      {!data ? (
        feed.error ? (
          <Panel code="PR" title="Product intelligence">
            <ErrorState message="Could not load product intelligence." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="PR" title="Product intelligence">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Ranking products…
            </p>
          </Panel>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 border border-[var(--t-border)] bg-[var(--t-card)] sm:grid-cols-4">
            <Stat
              label="Units sold"
              value={data.totalUnits}
              sub={`${formatGhs(data.totalRevenuePesewas)} revenue`}
              tone="amber"
            />
            <Stat label="Items ranked" value={data.items.length} />
            <Stat
              label="Out of stock"
              value={data.outOfStock}
              tone={data.outOfStock > 0 ? 'red' : 'green'}
            />
            <Stat
              label="Running low"
              value={data.lowStock}
              sub="5 or fewer left"
              tone={data.lowStock > 0 ? 'amber' : 'green'}
            />
          </div>

          <Panel
            code="PR"
            title="Buy-rate board · fastest first"
            right={
              <span>
                {items.length} of {data.items.length} ranked
              </span>
            }
            bodyClassName="p-0"
          >
            {items.length === 0 ? (
              <Empty
                title={data.items.length === 0 ? 'No sales counted yet' : 'Nothing matches'}
                hint={
                  data.items.length === 0
                    ? 'Buy rates appear the moment a shop sells through its storefront.'
                    : 'Try a shorter filter.'
                }
              />
            ) : (
              <DataTable
                columns={[
                  { key: 'rank', label: '#', right: true },
                  { key: 'item', label: 'Item' },
                  { key: 'rate', label: 'Buy rate' },
                  { key: 'tape', label: 'Rate' },
                  { key: 'sold', label: 'Sold', right: true },
                  { key: 'revenue', label: 'Revenue', right: true },
                  { key: 'profit', label: 'Profit', right: true },
                  { key: 'margin', label: 'Margin', right: true },
                  { key: 'stock', label: 'Stock' },
                  { key: 'last', label: 'Last sold', right: true },
                ]}
              >
                {items.map((item, index) => (
                  <Row key={`${item.slug ?? 'loose'}-${item.name}`}>
                    <Cell right tone="faint">
                      {index + 1}
                    </Cell>
                    <td className="max-w-0 px-3 py-2">
                      <span className="block truncate font-bold text-[var(--t-text)]">
                        {item.name}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--t-cyan)]">
                        {item.shop ?? 'deleted item'}
                      </span>
                    </td>
                    <Cell tone="amber">
                      <span className="font-bold">{rate(item.unitsPerDay)}</span>
                      <span className="text-[10px] text-[var(--t-faint)]">/day</span>
                    </Cell>
                    <td className="px-3 py-2">
                      <Bar value={item.unitsPerDay} max={maxRate} tone="amber" />
                    </td>
                    <Cell right tone="text">
                      {item.units}
                      <span className="ml-1 text-[10px] text-[var(--t-faint)]">
                        · {item.orderCount} ord
                      </span>
                    </Cell>
                    <Cell right tone="amber">
                      {formatGhs(item.revenuePesewas)}
                    </Cell>
                    <Cell right tone={item.profitPesewas > 0 ? 'green' : 'dim'}>
                      {formatGhs(item.profitPesewas)}
                    </Cell>
                    <Cell right tone={item.marginPercent == null ? 'faint' : 'cyan'}>
                      {item.marginPercent == null ? '—' : `${item.marginPercent}%`}
                    </Cell>
                    <Cell>
                      {item.stock == null ? (
                        <Tag tone="dim">untracked</Tag>
                      ) : item.stock <= 0 ? (
                        <Tag tone="red">sold out</Tag>
                      ) : item.stock <= 5 ? (
                        <Tag tone="amber">{item.stock} left</Tag>
                      ) : (
                        <span className={TONE.text}>{item.stock}</span>
                      )}
                    </Cell>
                    <Cell right tone="dim">
                      {item.lastSoldAt ? formatStamp(item.lastSoldAt) : '—'}
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
