// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    store: { findFirst: vi.fn() },
    storefrontView: { create: vi.fn() },
  },
}));
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const rate = vi.hoisted(() => ({ allow: vi.fn(), ipOf: vi.fn() }));

vi.mock('@/lib/db', () => db);
vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/rate-limit', () => rate);
vi.mock('server-only', () => ({}));

function request(options: { cookie?: string; userAgent?: string; ref?: string } = {}) {
  return new Request('https://tilza.app/api/public/store/ama-threads/view', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': options.userAgent ?? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: JSON.stringify({
      ref: options.ref,
      referrer: 'https://www.instagram.com/p/abc?utm=1',
    }),
  });
}

const context = { params: Promise.resolve({ slug: 'ama-threads' }) };

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.store.findFirst.mockResolvedValue({ id: 'store-1', userId: 'owner-1' });
  db.prisma.storefrontView.create.mockResolvedValue({});
  auth.getSessionUser.mockResolvedValue(null);
  rate.allow.mockReturnValue(true);
  rate.ipOf.mockReturnValue('203.0.113.5');
});

describe('storefront view beacon', () => {
  it('records a new visitor, sets the visitor cookie, and keeps only the referrer host', async () => {
    const { POST } = await import('@/app/api/public/store/[slug]/view/route');
    const response = await POST(request({ ref: 'WhatsApp' }), context);

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toMatch(/tilza_vid=[a-f0-9-]{36}/i);
    expect(db.prisma.storefrontView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: 'store-1',
        userId: null,
        ref: 'whatsapp',
        referrerHost: 'instagram.com',
      }),
    });
    const created = db.prisma.storefrontView.create.mock.calls[0]?.[0]?.data;
    expect(created.visitorId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('reuses an existing visitor cookie', async () => {
    const { POST } = await import('@/app/api/public/store/[slug]/view/route');
    await POST(request({ cookie: 'theme=dark; tilza_vid=visitor_123456' }), context);

    expect(db.prisma.storefrontView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visitorId: 'visitor_123456' }),
    });
  });

  it('does not count the shop owner opening their own page', async () => {
    auth.getSessionUser.mockResolvedValue({ id: 'owner-1' });
    const { POST } = await import('@/app/api/public/store/[slug]/view/route');
    const response = await POST(request(), context);

    expect(response.status).toBe(204);
    expect(db.prisma.storefrontView.create).not.toHaveBeenCalled();
  });

  it('ignores bots and link previews', async () => {
    const { POST } = await import('@/app/api/public/store/[slug]/view/route');
    await POST(request({ userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)' }), context);

    expect(db.prisma.store.findFirst).not.toHaveBeenCalled();
    expect(db.prisma.storefrontView.create).not.toHaveBeenCalled();
  });
});
