// Paystack redirect target after checkout (the default PAYSTACK_CALLBACK_URL).
// Verifies the transaction by reference and shows the outcome. Paystack appends
// `reference`/`trxref` to this URL; the session cookie rides along so the
// verify route can settle the order immediately.
import type { Metadata } from 'next';
import { PaymentReturn } from '@/components/custom/payment-return';

export const metadata: Metadata = { title: 'Payment | Tilo' };

export default function PaymentReturnPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-md">
        <PaymentReturn />
      </div>
    </main>
  );
}
