// First-run setup: every new account lands here until the shop has its
// identity and a visual. The dashboard layout redirects here, and this page
// stays reachable afterwards so the wizard doubles as the "edit setup" screen
// at any time — including adding the socials that were skipped during setup.
import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/custom/onboarding-wizard';
import { getSessionUser } from '@/lib/require-auth';
import { isAdminRole } from '@/lib/roles';

export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // This wizard is the one place a shop gets created and named. A platform
  // operator owns no shop, so the route is closed to them.
  if (isAdminRole(user.role)) redirect('/dashboard/admin');
  return (
    <main className="container-page py-10 sm:py-14">
      <OnboardingWizard />
    </main>
  );
}
