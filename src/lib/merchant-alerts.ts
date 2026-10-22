import 'server-only';

import { formatGhs } from '@/lib/contracts/order';
import { prisma } from '@/lib/db';

type LowStockLine = { name: string; stock: number | null };

type OrderAlertInput = {
  userId: string;
  storeName: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  amountPesewas: number;
  lines: { name: string; quantity: number }[];
  lowStock: LowStockLine[];
};

type WeeklyDigestInput = {
  to: string;
  ownerName: string | null;
  storeName: string;
  orderCount: number;
  revenuePesewas: number;
  newCustomers: number;
  lowStock: LowStockLine[];
};

function dashboardUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}${path}`;
}

/** The same gate the alert writer uses — surfaced to settings so copy stays honest. */
export function isMerchantEmailConfigured(): boolean {
  return process.env.EMAIL_PROVIDER === 'resend' && Boolean(process.env.RESEND_API_KEY);
}

async function emailClient() {
  if (!isMerchantEmailConfigured()) return null;
  return import('@/lib/email');
}

async function ownerFor(userId: string) {
  if (!prisma.user?.findUnique) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
}

function lowStockText(lines: LowStockLine[]): string {
  if (lines.length === 0) return '';
  const items = lines.map((line) => `- ${line.name}: ${line.stock ?? 0} left`).join('\n');
  return `\n\nRunning low:\n${items}`;
}

export async function sendOrderAlert(input: OrderAlertInput): Promise<void> {
  try {
    const email = await emailClient();
    if (!email) return;
    const owner = await ownerFor(input.userId);
    if (!owner?.email) return;
    const items = input.lines.map((line) => `${line.quantity}x ${line.name}`).join('\n');
    await email.sendEmail({
      to: owner.email,
      subject: `New order ${input.orderNumber} — ${formatGhs(input.amountPesewas)}`,
      text: [
        `Hi ${owner.name || 'there'},`,
        '',
        `${input.customerName} just placed an order at ${input.storeName}.`,
        '',
        `Order: ${input.orderNumber}`,
        `Customer: ${input.customerName} (${input.customerPhone})`,
        '',
        items,
        '',
        `Total: ${formatGhs(input.amountPesewas)}`,
        lowStockText(input.lowStock),
        '',
        `View the order: ${dashboardUrl('/dashboard/orders')}`,
      ].join('\n'),
    });
  } catch {
    // Notifications never block a sale.
  }
}

export async function sendWeeklyDigest(input: WeeklyDigestInput): Promise<boolean> {
  try {
    const email = await emailClient();
    if (!email) return false;
    const result = await email.sendEmail({
      to: input.to,
      subject: `Your week at ${input.storeName}: ${input.orderCount} order${
        input.orderCount === 1 ? '' : 's'
      }`,
      text: [
        `Hi ${input.ownerName || 'there'},`,
        '',
        `Here is the last 7 days at ${input.storeName}:`,
        `- Orders: ${input.orderCount}`,
        `- Recorded sales: ${formatGhs(input.revenuePesewas)}`,
        `- New customers: ${input.newCustomers}`,
        lowStockText(input.lowStock),
        '',
        `Open your dashboard: ${dashboardUrl('/dashboard')}`,
      ].join('\n'),
    });
    return result.ok;
  } catch {
    return false;
  }
}
