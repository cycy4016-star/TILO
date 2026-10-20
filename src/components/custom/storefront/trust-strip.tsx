// The reassurance row under the hero — four quiet promises a marketplace
// shopper scans before trusting a shop they've never used. Server-safe (no
// state); icons only, no new colours beyond the token system.
import { BadgeCheck, MessageCircle, ShieldCheck, Truck } from 'lucide-react';

const PROMISES = [
  { icon: ShieldCheck, label: 'Genuine products' },
  { icon: Truck, label: 'Delivery available' },
  { icon: MessageCircle, label: 'Order on WhatsApp' },
  { icon: BadgeCheck, label: 'Fair, transparent prices' },
] as const;

export function TrustStrip() {
  return (
    <ul
      aria-label="Why shop here"
      className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4 sm:divide-y-0"
    >
      {PROMISES.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-2.5 px-3 py-3 text-small font-medium sm:px-4"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md bg-highlight-wash text-highlight-ink"
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 leading-tight">{label}</span>
        </li>
      ))}
    </ul>
  );
}
