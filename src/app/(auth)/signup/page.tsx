// Tilza sign-up shell.
import { MessageCircle, PackagePlus, Store } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/custom/sign-up-form';
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { resolveAppHome } from '@/lib/app-home';
import { getSessionUser } from '@/lib/require-auth';
import { TRIAL_DAYS } from '@/lib/trial';

const BENEFITS = [
  { Icon: Store, text: 'Create your shop page in minutes' },
  { Icon: PackagePlus, text: 'Add products with photos and prices' },
  { Icon: MessageCircle, text: 'Receive orders on WhatsApp' },
];

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect(await resolveAppHome(user));
  return (
    <main className="min-h-dvh bg-background">
      <div className="grid min-h-dvh lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="hidden flex-col justify-between bg-highlight p-10 text-highlight-foreground lg:flex">
          <Link href="/" className="w-fit">
            <TilzaLogo className="text-2xl text-[#241205]" />
          </Link>
          <div>
            <p className="inline-flex rounded bg-[#241205] px-3 py-1.5 text-caption font-bold uppercase tracking-[0.08em] text-white">
              Free for {TRIAL_DAYS} days
            </p>
            <h1 className="mt-5 max-w-[10ch] font-display text-h1">Start selling today.</h1>
            <p className="mt-4 max-w-[34ch] text-body text-[#3d1f0d]">
              Add your products, share one link and take orders. No card needed to start.
            </p>
            <ul className="mt-7 grid gap-3">
              {BENEFITS.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-small font-semibold">
                  <span className="grid size-8 place-items-center rounded-md bg-white/25">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-caption font-semibold text-[#3d1f0d]">
            Set up in minutes · Cancel anytime
          </p>
        </aside>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <Link href="/" className="mb-6 flex w-fit lg:hidden">
              <TilzaLogo className="text-2xl text-primary" />
            </Link>
            <p className="text-eyebrow">New here</p>
            <h1 className="mt-2 font-display text-h2">Create your account</h1>
            <p className="mt-1.5 text-small text-muted-foreground">
              {TRIAL_DAYS} days free. No card. Set up in minutes.
            </p>
            <div className="mt-6">
              <SignUpForm />
            </div>
            <p className="mt-6 text-center text-small text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
