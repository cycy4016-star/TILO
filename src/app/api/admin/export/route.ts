// Investor-ready exports for the ops console: CSV (Excel-compatible, UTF-8
// BOM) and XLS (HTML-table flavour) for the four headline reports — platform
// overview, the account/sign-in ledger, shops and product velocity.
//
// The data comes from the SAME route handlers the terminal panels use (called
// in-process with the incoming request's headers, so the admin gate re-runs
// and the numbers can never disagree with what the operator just saw). Only
// the shaping into cells lives here.
import 'server-only';

import { NextResponse } from 'next/server';
import { GET as overviewGet } from '@/app/api/admin/overview/route';
import { GET as productsGet } from '@/app/api/admin/products/route';
import { GET as shopsGet } from '@/app/api/admin/shops/route';
import { GET as usersGet } from '@/app/api/admin/users/route';
import { type ExportCell, type ExportSheet, sheetToCsv, sheetToXls } from '@/lib/admin-export';
import { AdminOverview, AdminProducts, AdminShops, AdminUserMonitor } from '@/lib/contracts/admin';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const REPORTS = ['overview', 'users', 'shops', 'products'] as const;
type ReportId = (typeof REPORTS)[number];

function isReportId(value: string): value is ReportId {
  return (REPORTS as readonly string[]).includes(value);
}

/** Pesewas → GHS decimal string; exports stay numeric for spreadsheet math. */
function ghs(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function stamp(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16).replace('T', ' ') : '';
}

/** Ask a sibling route handler for data, in-process with the same request. */
const SOURCES: Record<ReportId, (request: Request) => Promise<Response>> = {
  overview: overviewGet,
  users: usersGet,
  shops: shopsGet,
  products: productsGet,
};

async function fetchJson(request: Request, report: ReportId, query = ''): Promise<unknown> {
  const path = `/api/admin/${report}${query}`;
  const response = await SOURCES[report](new Request(new URL(path, request.url)));
  if (!response.ok) {
    // Gate failures pass through untouched (the export route re-runs the same
    // admin check, so this only fires if the sub-route tightens its own rules).
    if (response.status === 401 || response.status === 403) throw response;
    const detail = await response.text().catch(() => '');
    throw new Error(`export source ${path} failed (${response.status}): ${detail}`);
  }
  return response.json();
}

async function buildSheet(report: ReportId, request: Request): Promise<ExportSheet> {
  const generatedAt = new Date();

  if (report === 'overview') {
    const data = AdminOverview.parse(await fetchJson(request, 'overview', '?days=30'));
    const totals: [string, ExportCell][] = [
      ['Users', data.users],
      ['Signups this month', data.signupsMonth],
      ['Sign-ins today', data.signInsToday],
      ['Sign-ins this month', data.signInsMonth],
      ['Stores', data.stores],
      ['Active stores', data.activeStores],
      ['Items listed', data.items],
      ['Items added this month', data.itemsAddedMonth],
      ['Customers', data.customers],
      ['Leads', data.leads],
      ['Inquiries', data.inquiries],
      ['Orders', data.orders],
      ['Orders today', data.ordersToday],
      ['Unpaid orders', data.unpaidOrders],
      ['Volume (GHS)', ghs(data.gmvPesewas)],
      ['Collected (GHS)', ghs(data.paidPesewas)],
      ['Outstanding (GHS)', ghs(data.gmvPesewas - data.paidPesewas)],
      ['SMS sent this month', data.smsSentMonth],
      ['SMS failed this month', data.smsFailedMonth],
      ['Payments settled', data.paymentsSuccess],
      ['Payments pending', data.paymentsPending],
      ['Payments failed', data.paymentsFailed],
      ['Feedback total', data.feedbackTotal],
      ['Feedback untriaged', data.feedbackNew],
      ['Open incidents', data.errorsOpen],
      ['Error occurrences', data.errorOccurrences],
    ];
    const rows: ExportCell[][] = totals.map(([metric, value]) => [
      'Platform totals',
      metric,
      value,
    ]);
    for (const day of data.daily) {
      rows.push(
        [`Day ${day.day}`, 'Signups', day.signups],
        [`Day ${day.day}`, 'Orders', day.orders],
        [`Day ${day.day}`, 'Items added', day.items],
        [`Day ${day.day}`, 'Inquiries', day.inquiries],
        [`Day ${day.day}`, 'New incidents', day.errors],
      );
    }
    return {
      title: 'Tilza platform overview',
      generatedAt,
      headers: ['Section', 'Metric', 'Value'],
      rows,
    };
  }

  if (report === 'users') {
    const data = AdminUserMonitor.parse(await fetchJson(request, 'users'));
    return {
      title: 'Tilza accounts and sign-in ledger',
      generatedAt,
      headers: [
        'Name',
        'Email',
        'Phone',
        'Role',
        'Status',
        'Signed up',
        'Sign-ins',
        'Last sign-in',
      ],
      rows: data.users.map((user) => [
        user.name,
        user.email,
        user.phone,
        (user.role ?? '').includes('admin') ? 'Operator' : 'Owner',
        user.banned ? 'Suspended' : 'Active',
        stamp(user.createdAt),
        user.signInCount,
        stamp(user.lastSeenAt),
      ]),
    };
  }

  if (report === 'shops') {
    const data = AdminShops.parse(await fetchJson(request, 'shops'));
    return {
      title: 'Tilza shops',
      generatedAt,
      headers: [
        'Owner',
        'Phone',
        'Store',
        'Slug',
        'Status',
        'Items',
        'Customers',
        'Orders',
        'Unpaid',
        'GMV (GHS)',
        'Last order',
        'Account created',
      ],
      rows: data.shops.map((shop) => [
        shop.ownerName,
        shop.ownerPhone,
        shop.storeName,
        shop.slug,
        shop.storeActive === null ? '—' : shop.storeActive ? 'Live' : 'Closed',
        shop.itemCount,
        shop.customerCount,
        shop.orderCount,
        shop.unpaidCount,
        ghs(shop.gmvPesewas),
        stamp(shop.lastOrderAt),
        stamp(shop.createdAt),
      ]),
    };
  }

  const data = AdminProducts.parse(await fetchJson(request, 'products'));
  return {
    title: 'Tilza product velocity',
    generatedAt,
    headers: [
      'Item',
      'Shop',
      'Units sold',
      'Orders',
      'Revenue (GHS)',
      'Profit (GHS)',
      'Margin %',
      'Units / day',
      'Days active',
      'Last sold',
      'Stock',
      'Active',
    ],
    rows: data.items.map((item) => [
      item.name,
      item.shop,
      item.units,
      item.orderCount,
      ghs(item.revenuePesewas),
      ghs(item.profitPesewas),
      item.marginPercent,
      item.unitsPerDay.toFixed(2),
      item.daysActive,
      stamp(item.lastSoldAt),
      item.stock,
      item.active === null ? '' : item.active ? 'Yes' : 'No',
    ]),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const params = new URL(request.url).searchParams;
    const report = params.get('report')?.trim() ?? '';
    if (!isReportId(report)) {
      return NextResponse.json(
        { error: 'Unknown report. Use overview, users, shops or products.' },
        { status: 400 },
      );
    }
    const format = params.get('format')?.trim() === 'xls' ? 'xls' : 'csv';
    const sheet = await buildSheet(report, request);

    const name = `tilza-${report}-${sheet.generatedAt.toISOString().slice(0, 10)}.${format}`;
    const body = format === 'xls' ? sheetToXls(sheet) : sheetToCsv(sheet);
    return new NextResponse(body, {
      headers: {
        'content-type':
          format === 'xls' ? 'application/vnd.ms-excel; charset=utf-8' : 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
