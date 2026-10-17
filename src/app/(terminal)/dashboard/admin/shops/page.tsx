// Shops: the platform directory. Row → dossier deep link under
// /dashboard/admin/shops/[userId]; reopening a shop writes via PATCH.
import { ShopsConsole } from '@/components/custom/admin/shops-console';

export default function AdminShopsPage() {
  return <ShopsConsole />;
}
