// Tilo sign-up shell.
import { SignUpForm } from '@/components/custom/sign-up-form';
import { TiloMark } from '@/components/custom/tilo-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Card className="w-full shadow-sm">
        <CardHeader className="space-y-2 pb-2 text-center">
          <TiloMark className="mx-auto size-12 rounded-xl shadow-brand" iconClassName="size-6" />
          <p className="text-eyebrow">New here</p>
          <CardTitle className="font-display text-h1">Create your account</CardTitle>
          <CardDescription className="mt-2 text-small text-muted-foreground">
            Free to start — set up in minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <SignUpForm />
          <p className="mt-6 text-center text-small text-muted-foreground">
            Already have an account?{' '}
            <a
              href="/login"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
