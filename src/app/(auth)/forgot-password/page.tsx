// Tilo password reset shell.
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/custom/forgot-password-form';
import { TiloMark } from '@/components/custom/tilo-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh_-_4rem)] items-center justify-center bg-background px-5 py-10 sm:py-16 dark:bg-stone-950">
      <Card className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
        <CardHeader className="pb-2 text-center">
          <TiloMark
            className="mx-auto size-14 rounded-2xl shadow-[0_10px_24px_-10px_rgba(202,138,4,0.6)]"
            iconClassName="size-7"
          />
          <p className="mx-auto mt-3 w-fit rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
            Account recovery
          </p>
          <CardTitle className="mt-3 text-3xl font-bold">Reset your password</CardTitle>
          <CardDescription className="font-medium">
            We&apos;ll text a code to your number
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ForgotPasswordForm />
          <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
            Remembered it?{' '}
            <Link
              href="/login"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
