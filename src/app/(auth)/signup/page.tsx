// Tilo sign-up shell.
import { SignUpForm } from '@/components/custom/sign-up-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh_-_4rem)] items-center justify-center bg-background px-5 py-10 sm:py-16 dark:bg-stone-950">
      <Card className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
        <CardHeader className="pb-2 text-center">
          <p className="mx-auto w-fit rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
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
