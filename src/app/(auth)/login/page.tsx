// Tilo sign-in shell.
import { SignInForm } from '@/components/custom/sign-in-form';
import { TiloMark } from '@/components/custom/tilo-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Card className="w-full shadow-sm">
        <CardHeader className="space-y-2 pb-2 text-center">
          <TiloMark className="mx-auto size-12 rounded-xl shadow-brand" iconClassName="size-6" />
          <p className="text-eyebrow">Welcome back</p>
          <CardTitle className="font-display text-h2">Sign in</CardTitle>
          <CardDescription className="mt-2 text-small text-muted-foreground">
            Back to running the business
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <SignInForm />
          <p className="mt-6 text-center text-small text-muted-foreground">
            New around here?{' '}
            <a
              href="/signup"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Create an account
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
