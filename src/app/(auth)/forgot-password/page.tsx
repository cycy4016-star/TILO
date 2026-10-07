// Tilo password reset shell.
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/custom/forgot-password-form';
import { TiloMark } from '@/components/custom/tilo-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Card className="w-full shadow-sm">
        <CardHeader className="space-y-2 pb-2 text-center">
          <TiloMark className="mx-auto size-12 rounded-xl shadow-brand" iconClassName="size-6" />
          <p className="text-eyebrow">Account recovery</p>
          <CardTitle className="font-display text-h2">Reset your password</CardTitle>
          <CardDescription className="mt-2 text-small text-muted-foreground">
            We&apos;ll text a code to your number
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ForgotPasswordForm />
          <p className="mt-6 text-center text-small text-muted-foreground">
            Remembered it?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
