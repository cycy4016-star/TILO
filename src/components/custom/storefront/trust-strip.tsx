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
    <ul aria-label="Why shop here" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {PROMISES.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-small font-medium shadow-xs"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 leading-tight">{label}</span>
        </li>
      ))}
    </ul>
  );
}
