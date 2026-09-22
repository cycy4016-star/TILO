// Rescue ramp for an interrupted sign-up: your account exists but is still
// unverified, so finish the SMS OTP here instead of being locked out.
import type { Metadata } from 'next';
import { VerifyForm } from '@/components/custom/verify-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Verify your phone' };

export default function VerifyPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#fffbeb] px-5 py-16 dark:bg-stone-950">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
        <div className="absolute -right-24 bottom-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md rotate-1 rounded-[2rem] border-2 border-amber-950 bg-white shadow-[8px_8px_0_0_#451a03] dark:bg-stone-900">
        <CardHeader className="pb-2 text-center">
          <p className="mx-auto w-fit -rotate-2 rounded-full bg-yellow-600 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.2em] text-white">
            One last step
          </p>
          <CardTitle className="mt-3 font-display text-3xl font-black uppercase">
            Prove it&apos;s you
          </CardTitle>
          <CardDescription className="font-medium">
            Confirm your phone so the workspace opens up.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <VerifyForm />
        </CardContent>
      </Card>
    </main>
  );
}
