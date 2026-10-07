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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Card className="w-full shadow-sm">
        <CardHeader className="space-y-2 pb-2 text-center">
          <TiloMark className="mx-auto size-12 rounded-xl shadow-brand" iconClassName="size-6" />
          <p className="text-eyebrow">One last step</p>
          <CardTitle className="font-display text-h2">Verify your phone</CardTitle>
          <CardDescription className="mt-2 text-small text-muted-foreground">
            Confirm the code we sent so your workspace opens up.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <VerifyForm initialPhone={phone} />
        </CardContent>
      </Card>
    </main>
  );
}
