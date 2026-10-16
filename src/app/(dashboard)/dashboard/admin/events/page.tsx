// Events: the merged order/SMS/payment/signup/error/feedback stream — one
// filterable feed for "what happened in the last hour".
import { EventsPanel } from '@/components/custom/admin/events-panel';

export default function AdminEventsPage() {
  return <EventsPanel />;
}
