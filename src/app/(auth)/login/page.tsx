// Tilo sign-in shell.
import { SignInForm } from '@/components/custom/sign-in-form';
import { TiloMark } from '@/components/custom/tilo-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh_-_4rem)] items-center justify-center bg-background px-5 py-10 sm:py-16 dark:bg-stone-950">
      <Card className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
        <CardHeader className="pb-2 text-center">
          <TiloMark
            className="mx-auto size-14 rounded-2xl shadow-[0_10px_24px_-10px_rgba(202,138,4,0.6)]"
            iconClassName="size-7"
          />
          <p className="mx-auto mt-3 w-fit rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
            Welcome back
          </p>
          <CardTitle className="mt-3 text-3xl font-bold">Sign in</CardTitle>
          <CardDescription className="font-medium">Back to running the business</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <SignInForm />
          <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
            New around here?{' '}
            <a
              href="/signup"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Create an account
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
