// F12 - PROOFS. Buyer-uploaded delivery photos that came with marketing
// consent. The operator approves or rejects each one; only approved photos may
// leave this screen.
'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminProofList, AdminProofRow, AdminProofStatus } from '@/lib/contracts/admin';
import {
  Empty,
  ErrorState,
  formatStamp,
  LivePill,
  Panel,
  Stat,
  Tag,
  TButton,
  TChip,
  type Tone,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const STATUS_TONE: Record<string, Tone> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
};

function sizeLabel(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

export function ProofGalleryPanel() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const feed = useLiveData(
    `/api/admin/proofs${status ? `?status=${status}` : ''}`,
    AdminProofList,
    20_000,
  );
  const data = feed.data;

  const decide = async (row: AdminProofRow, next: 'APPROVED' | 'REJECTED') => {
    setBusy(row.id);
    try {
      await apiFetch('/api/admin/proofs', {
        method: 'PUT',
        body: JSON.stringify({ id: row.id, status: next }),
        schema: AdminProofRow,
      });
      feed.refresh();
    } catch {
      // The card stays on its last known state; the next pulse re-reads it.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t-dim)]">
            Review
          </span>
          {[
            { value: '', label: 'Everything' },
            ...AdminProofStatus.options.map((value) => ({ value, label: value })),
          ].map((entry) => (
            <TChip
              key={entry.value}
              active={status === entry.value}
              onClick={() => setStatus(entry.value)}
            >
              {entry.label}
            </TChip>
          ))}
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
          <Panel code="PG" title="Marketing proofs">
            <ErrorState message="Could not load the proof gallery." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="PG" title="Marketing proofs">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Loading gallery...
            </p>
          </Panel>
        )
      ) : (
        <>
          <div className="grid grid-cols-3 border border-[var(--t-border)] bg-[var(--t-card)]">
            <Stat
              label="Waiting"
              value={data.pending}
              tone={data.pending > 0 ? 'amber' : 'green'}
            />
            <Stat label="Approved" value={data.approved} tone="green" />
            <Stat label="Rejected" value={data.rejected} tone="red" />
          </div>

          <Panel
            code="PG"
            title="Marketing proofs"
            right={<span>consent first, approval second</span>}
          >
            {data.items.length === 0 ? (
              <Empty
                title="No consented proofs here"
                hint="A buyer photo enters this gallery only when the buyer ticked marketing consent."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((row) => (
                  <article
                    key={row.id}
                    className="flex min-w-0 flex-col border border-[var(--t-border)] bg-[var(--t-panel)]"
                  >
                    <a
                      href={row.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-[4/3] overflow-hidden border-b border-[var(--t-border)] bg-[var(--t-input)]"
                    >
                      {/** biome-ignore lint/performance/noImgElement: private admin-only thumbnail behind the session cookie. */}
                      <img
                        src={row.imageUrl}
                        alt={`Delivery proof for order ${row.orderNumber}`}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </a>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[12px] font-bold text-[var(--t-bright)]">
                          #{row.orderNumber}
                        </span>
                        <Tag tone={STATUS_TONE[row.reviewStatus] ?? 'dim'}>{row.reviewStatus}</Tag>
                      </div>
                      <div className="text-[11px] text-[var(--t-dim)]">
                        <span className="text-[var(--t-text)]">{row.shop ?? 'Unknown shop'}</span>
                        {' / '}
                        {row.buyer ?? 'Anonymous buyer'}
                      </div>
                      <div className="text-[10px] text-[var(--t-faint)]">
                        {formatStamp(row.createdAt)} / {sizeLabel(row.size)}
                      </div>
                      {row.reviewNote && (
                        <p className="border-l border-[var(--t-red)] pl-2 text-[11px] text-[var(--t-dim)]">
                          {row.reviewNote}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-end gap-1 border-t border-[var(--t-grid)] pt-2">
                        <TButton
                          tone="red"
                          disabled={busy === row.id || row.reviewStatus === 'REJECTED'}
                          onClick={() => void decide(row, 'REJECTED')}
                        >
                          Reject
                        </TButton>
                        <TButton
                          tone="green"
                          disabled={busy === row.id || row.reviewStatus === 'APPROVED'}
                          onClick={() => void decide(row, 'APPROVED')}
                        >
                          Approve
                        </TButton>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
