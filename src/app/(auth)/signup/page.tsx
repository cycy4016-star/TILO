// Tilza sign-up shell.
import Link from 'next/link';
import { SignUpForm } from '@/components/custom/sign-up-form';
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Card className="w-full shadow-sm">
        <CardHeader className="space-y-2 pb-2 text-center">
          <div className="flex justify-center">
            <TilzaLogo className="text-4xl" />
          </div>
          <p className="text-eyebrow">New here</p>
          {/* Card title, not page title — login uses text-h2, and the two
              screens are structurally identical, so they share a scale step. */}
          <CardTitle className="text-h2">Create your account</CardTitle>
          <CardDescription className="mt-2 text-small text-muted-foreground">
            14 days free — no card, set up in minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <SignUpForm />
          <p className="mt-6 text-center text-small text-muted-foreground">
            Already have an account?{' '}
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
