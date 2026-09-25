// Tilo sign-up shell.
import { SignUpForm } from '@/components/custom/sign-up-form';
import { TiloMark } from '@/components/custom/tilo-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh_-_4rem)] items-center justify-center bg-background px-5 py-10 sm:py-16 dark:bg-stone-950">
      <Card className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
        <CardHeader className="pb-2 text-center">
          <TiloMark
            className="mx-auto size-14 rounded-2xl shadow-[0_10px_24px_-10px_rgba(202,138,4,0.6)]"
            iconClassName="size-7"
          />
          <p className="mx-auto mt-3 w-fit rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
            New here
          </p>
          <CardTitle className="mt-3 text-3xl font-bold">Create your account</CardTitle>
          <CardDescription className="font-medium">
            Free to start — set up in minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <SignUpForm />
          <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
            Already have an account?{' '}
            <a
              href="/login"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
