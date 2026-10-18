// F10 · VAULT — the terminal's window into the self-archive. The newest
// snapshot is the baseline; the live database is audited against it and any
// shrink — storefronts, items, accounts, ledger rows — becomes a red banner
// naming exactly what went missing. Every snapshot downloads as JSON, and
// `npm run vault:restore -- <id>` puts one back. Snapshots marked manual are
// never pruned; boot and daily ones roll off after sixty days.
'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminVault, AdminVaultSnapshot } from '@/lib/contracts/admin';
import { lossHeadline } from '@/lib/vault-diff';
import {
  Cell,
  DataTable,
  Empty,
  ErrorState,
  formatStamp,
  LivePill,
  num,
  Panel,
  Row,
  Stat,
  Tag,
  TButton,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const COLUMNS = [
  { key: 'when', label: 'Taken' },
  { key: 'trigger', label: 'Trigger' },
  { key: 'users', label: 'Accounts', right: true },
  { key: 'stores', label: 'Shops', right: true },
  { key: 'items', label: 'Items', right: true },
  { key: 'orders', label: 'Orders', right: true },
  { key: 'size', label: 'Size', right: true },
  { key: 'file', label: 'File', right: true },
];

function sizeLabel(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function TriggerTag({ trigger }: { trigger: string }) {
  const tone = trigger === 'manual' ? 'amber' : trigger === 'boot' ? 'cyan' : 'dim';
  return <Tag tone={tone}>{trigger}</Tag>;
}

export function VaultPanel() {
  const feed = useLiveData('/api/admin/vault', AdminVault, 60_000);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const vault = feed.data;

  const snapshotNow = async () => {
    setBusy(true);
    setNote(null);
    try {
      await apiFetch('/api/admin/vault', { method: 'POST', schema: AdminVaultSnapshot });
      feed.refresh();
    } catch {
      setNote('Snapshot failed — the database did not answer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <span className="text-[11px] text-[var(--t-dim)]">
          THE VAULT ARCHIVES THE WHOLE WORLD — ACCOUNTS, SHOPS, CATALOGUES, ORDERS, LEDGER
        </span>
        <span className="flex items-center gap-2">
          <TButton onClick={() => void snapshotNow()} disabled={busy}>
            {busy ? 'Archiving…' : 'Snapshot now'}
          </TButton>
          <LivePill
            live={feed.live}
            updatedAt={feed.updatedAt}
            onToggle={feed.live ? feed.pause : feed.resume}
            onRefresh={feed.refresh}
          />
        </span>
      </div>

      {!vault ? (
        feed.error ? (
          <Panel code="VT" title="Vault integrity">
            <ErrorState message="Could not read the vault." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="VT" title="Vault integrity">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Reading vault…
            </p>
          </Panel>
        )
      ) : (
        <>
          {vault.loss.length > 0 ? (
            <div className="border border-[var(--t-red)] bg-[var(--t-red)]/5 px-3 py-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--t-red)]">
                Data loss detected
              </p>
              <p className="mt-1.5 text-[12px] text-[var(--t-text)]">
                Since the snapshot of {vault.since ? formatStamp(vault.since) : '—'}:{' '}
                <span className="font-bold text-[var(--t-red)]">{lossHeadline(vault.loss)}</span>{' '}
                {vault.loss.length === 1 ? 'is' : 'are'} gone from the live database.
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--t-faint)]">
                Restore with{' '}
                <span className="font-mono text-[var(--t-amber)]">
                  npm run vault:restore -- {vault.snapshots[0]?.id.slice(0, 8)}…
                </span>{' '}
                — or download the snapshot below and keep it offline.
              </p>
            </div>
          ) : vault.since === null ? (
            <div className="border border-[var(--t-amber)] bg-[var(--t-amber)]/5 px-3 py-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--t-amber)]">
                No baseline yet
              </p>
              <p className="mt-1.5 text-[12px] text-[var(--t-dim)]">
                The vault is empty. Take the first snapshot now — from then on, anything that
                vanishes will be caught and named here.
              </p>
            </div>
          ) : (
            <div className="border border-[var(--t-green)] bg-[var(--t-green)]/5 px-3 py-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--t-green)]">
                No loss
              </p>
              <p className="mt-1.5 text-[12px] text-[var(--t-dim)]">
                Live database matches the {formatStamp(vault.since)} snapshot on every watched
                tally.
              </p>
            </div>
          )}

          {note && (
            <p className="border border-[var(--t-red)] px-3 py-2 text-[11px] font-bold text-[var(--t-red)]">
              {note}
            </p>
          )}

          <div className="grid grid-cols-2 border border-[var(--t-border)] bg-[var(--t-card)] sm:grid-cols-4">
            <Stat label="Snapshots" value={num(vault.snapshots.length)} />
            <Stat
              label="Newest"
              value={vault.since ? formatStamp(vault.since) : '—'}
              sub={vault.snapshots[0] ? sizeLabel(vault.snapshots[0].bytes) : undefined}
              tone="amber"
            />
            <Stat label="Accounts live" value={num(vault.current.users)} />
            <Stat
              label="Storefronts live"
              value={`${vault.current.storesActive}/${vault.current.stores}`}
              tone={vault.current.stores > 0 ? 'green' : 'dim'}
            />
          </div>

          <Panel
            code="VT"
            title="Archive"
            right={
              <span>manual snapshots are kept forever · automatic ones roll off after 60 days</span>
            }
            bodyClassName="p-0"
          >
            {vault.snapshots.length === 0 ? (
              <Empty
                title="Nothing archived yet"
                hint="Take the first snapshot — it becomes the baseline the integrity check insists on."
              />
            ) : (
              <DataTable columns={COLUMNS}>
                {vault.snapshots.map((row) => (
                  <Row key={row.id}>
                    <Cell tone="dim">{formatStamp(row.createdAt)}</Cell>
                    <Cell>
                      <TriggerTag trigger={row.trigger} />
                    </Cell>
                    <Cell right>{num(row.counts.users)}</Cell>
                    <Cell right tone={row.counts.stores > 0 ? 'green' : 'dim'}>
                      {num(row.counts.stores)}
                    </Cell>
                    <Cell right>{num(row.counts.items)}</Cell>
                    <Cell right>{num(row.counts.orders)}</Cell>
                    <Cell right tone="dim">
                      {sizeLabel(row.bytes)}
                      {!row.imagesIncluded && <span title="text only"> *</span>}
                    </Cell>
                    <Cell right>
                      <a
                        href={`/api/admin/vault/${row.id}`}
                        className="inline-flex items-center border border-[var(--t-border)] px-2.5 py-[4px] text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--t-amber)] transition-colors hover:border-current hover:bg-[var(--t-card-hi)]"
                      >
                        JSON
                      </a>
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Panel>

          <p className="text-[10px] text-[var(--t-faint)]">
            * text-only snapshot — photos and logos exceeded the archive size budget for that run.
            Restore: npm run vault:restore -- &lt;id or file.json&gt;
          </p>
        </>
      )}
    </div>
  );
}
