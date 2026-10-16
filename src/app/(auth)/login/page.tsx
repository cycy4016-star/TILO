// Tilza sign-in shell.
import Link from 'next/link';
import { SignInForm } from '@/components/custom/sign-in-form';
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Card className="w-full shadow-sm">
        <CardHeader className="space-y-2 pb-2 text-center">
          <div className="flex justify-center">
            <TilzaLogo className="text-4xl" />
          </div>
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
            <Link
              href="/signup"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
