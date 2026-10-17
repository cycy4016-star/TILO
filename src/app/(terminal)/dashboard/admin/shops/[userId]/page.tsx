// One shop's dossier, as a real URL so an operator can paste it in a chat and
// say "look at this one". Guarded by admin/layout.tsx; data comes from
// GET /api/admin/shops/[userId].
import { ShopDossierView } from '@/components/custom/admin/shops-console';

type RouteContext = { params: Promise<{ userId: string }> };

export default async function AdminShopDossierPage({ params }: RouteContext) {
  const { userId } = await params;
  return <ShopDossierView userId={userId} />;
}
