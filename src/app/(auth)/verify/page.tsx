// Rescue ramp for an interrupted sign-up: your account exists but is still
// unverified, so finish the SMS OTP here instead of being locked out.
import type { Metadata } from 'next';
import { TiloMark } from '@/components/custom/tilo-mark';
import { VerifyForm } from '@/components/custom/verify-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Verify your phone' };

type VerifyPageProps = { searchParams: Promise<{ phone?: string }> };

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { phone } = await searchParams;
  return (
    <main className="relative flex min-h-[calc(100dvh_-_4rem)] items-center justify-center bg-background px-5 py-10 sm:py-16 dark:bg-stone-950">
      <Card className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
        <CardHeader className="pb-2 text-center">
          <TiloMark
            className="mx-auto size-14 rounded-2xl shadow-[0_10px_24px_-10px_rgba(202,138,4,0.6)]"
            iconClassName="size-7"
          />
          <p className="mx-auto mt-3 w-fit rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
            One last step
          </p>
          <CardTitle className="mt-3 text-3xl font-bold">Verify your phone</CardTitle>
          <CardDescription className="font-medium">
            Confirm the code we sent so your workspace opens up.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <VerifyForm initialPhone={phone} />
        </CardContent>
      </Card>
    </main>
  );
}
