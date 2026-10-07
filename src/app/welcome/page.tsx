// First-run setup: every new account lands here until the shop has its
// identity, socials and a visual. The dashboard layout redirects here, and
// this page bounces finished shops straight to the dashboard — so the wizard
// doubles as the "edit setup" screen at any time.
import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/custom/onboarding-wizard';
import { getOnboardingStatus } from '@/lib/onboarding';
import { getSessionUser } from '@/lib/require-auth';

export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const status = await getOnboardingStatus(user.id);
  if (status.complete) redirect('/dashboard');
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <OnboardingWizard />
    </main>
  );
}
