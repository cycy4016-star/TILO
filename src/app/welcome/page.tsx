// First-run setup: every new account lands here until the shop has its
// identity and a visual. The dashboard layout redirects here, and this page
// stays reachable afterwards so the wizard doubles as the "edit setup" screen
// at any time — including adding the socials that were skipped during setup.
import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/custom/onboarding-wizard';
import { getSessionUser } from '@/lib/require-auth';

export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <OnboardingWizard />
    </main>
  );
}
