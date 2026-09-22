// Tilo sign-up shell.
import { SignUpForm } from '@/components/custom/sign-up-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#fffbeb] px-5 py-16 dark:bg-stone-950">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-24 top-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
        <div className="absolute -left-24 bottom-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md -rotate-1 rounded-[2rem] border-2 border-amber-950 bg-white shadow-[8px_8px_0_0_#451a03] dark:bg-stone-900">
        <CardHeader className="pb-2 text-center">
          <p className="mx-auto w-fit rotate-2 rounded-full bg-amber-300 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.2em] text-amber-950">
            Fresh paint
          </p>
          <CardTitle className="mt-3 font-display text-3xl font-black uppercase">
            Claim a stool
          </CardTitle>
          <CardDescription className="font-medium">
            Free to start — loud from day one
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <SignUpForm />
          <p className="mt-4 text-center text-sm font-medium text-stone-500">
            Already posted up?{' '}
            <a
              href="/login"
              className="font-black uppercase tracking-wide text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              Slide in
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
