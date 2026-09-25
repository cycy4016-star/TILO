// Tilo password reset shell.
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/custom/forgot-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh_-_4rem)] items-center justify-center overflow-hidden bg-[#fffbeb] px-5 py-10 sm:py-16 dark:bg-stone-950">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
        <div className="absolute -right-24 bottom-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md rounded-[2rem] border-2 border-amber-950 bg-white shadow-[8px_8px_0_0_#451a03] dark:bg-stone-900 md:rotate-1">
        <CardHeader className="pb-2 text-center">
          <p className="mx-auto w-fit -rotate-2 rounded-full bg-yellow-600 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.2em] text-white">
            No wahala
          </p>
          <CardTitle className="mt-3 font-display text-3xl font-black uppercase">
            Get back in
          </CardTitle>
          <CardDescription className="font-medium">
            We&apos;ll text a code to your number
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ForgotPasswordForm />
          <p className="mt-4 text-center text-sm font-medium text-stone-500">
            Remembered it?{' '}
            <Link
              href="/login"
              className="font-black uppercase tracking-wide text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
