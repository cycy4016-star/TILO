// Paystack redirect target after checkout (the default PAYSTACK_CALLBACK_URL).
// Verifies the transaction by reference and shows the outcome. Paystack appends
// `reference`/`trxref` to this URL; the session cookie rides along so the
// verify route can settle the order immediately.
import type { Metadata } from 'next';
import { PaymentReturn } from '@/components/custom/payment-return';

export const metadata: Metadata = { title: 'Payment | Tilo' };

export default function PaymentReturnPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#fffbeb] px-5 py-16 dark:bg-stone-950">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
        <div className="absolute -right-24 bottom-[-10%] size-96 rounded-full bg-amber-300 opacity-40 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <PaymentReturn />
      </div>
    </main>
  );
}
