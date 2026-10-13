// @vitest-environment node
//
// Public feedback ingest: open to everyone, hostile input assumed. Locks the
// contract, the field-error shape, shop attribution via slug, and the honeypot
// (acknowledge a bot without writing anything).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const db = vi.hoisted(() => ({
  prisma: { store: { findFirst: vi.fn() }, feedback: { create: vi.fn() } },
}));
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const limit = vi.hoisted(() => ({ allow: vi.fn(() => true), ipOf: vi.fn(() => '203.0.113.9') }));

vi.mock('@/lib/db', () => db);
vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/rate-limit', () => limit);

const VALID = {
  message: 'The checkout button does nothing on mobile Safari',
  kind: 'BUG',
  email: 'shopper@example.com',
};

function post(body: unknown) {
  return new Request('http://test/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  limit.allow.mockReturnValue(true);
  auth.getSessionUser.mockResolvedValue(null);
  db.prisma.store.findFirst.mockResolvedValue(null);
  db.prisma.feedback.create.mockResolvedValue({ id: 'fb-1' });
});

describe('feedback contract', () => {
  it('insists on a message with something in it', async () => {
    const { FeedbackCreate } = await import('@/lib/contracts/feedback');
    expect(FeedbackCreate.safeParse({ message: 'too short' }).success).toBe(false);
    expect(FeedbackCreate.safeParse({ message: 'This is a real report.' }).success).toBe(true);
  });

  it('defaults the kind and caps the rating at five', async () => {
    const { FeedbackCreate } = await import('@/lib/contracts/feedback');
    const parsed = FeedbackCreate.parse({ message: 'Works beautifully, thank you' });
    expect(parsed.kind).toBe('OTHER');
    expect(FeedbackCreate.safeParse({ message: 'Great work overall', rating: 6 }).success).toBe(
      false,
    );
    expect(FeedbackCreate.safeParse({ message: 'Great work overall', rating: 5 }).success).toBe(
      true,
    );
  });
});

describe('POST /api/feedback', () => {
  it('rejects an empty message with a field error', async () => {
    const { POST } = await import('@/app/api/feedback/route');
    const response = await POST(post({ message: 'nope' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors.message).toBeTruthy();
    expect(db.prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('files a platform-level report when no session and no shop are given', async () => {
    const { POST } = await import('@/app/api/feedback/route');
    const response = await POST(post(VALID));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(db.prisma.feedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        message: VALID.message,
        kind: 'BUG',
        email: VALID.email,
        userId: null,
        storeId: null,
      }),
    });
  });

  it('attributes a report to its shop when a slug resolves', async () => {
    db.prisma.store.findFirst.mockResolvedValue({ id: 'store-9' });
    const { POST } = await import('@/app/api/feedback/route');
    const response = await POST(post({ ...VALID, slug: 'ama-wears' }));
    expect(response.status).toBe(201);
    expect(db.prisma.store.findFirst).toHaveBeenCalledWith({
      where: { slug: 'ama-wears' },
      select: { id: true },
    });
    expect(db.prisma.feedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storeId: 'store-9' }),
    });
  });

  it('still files the report when the slug is unknown', async () => {
    const { POST } = await import('@/app/api/feedback/route');
    const response = await POST(post({ ...VALID, slug: 'does-not-exist' }));
    expect(response.status).toBe(201);
    expect(db.prisma.feedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storeId: null }),
    });
  });

  it('acknowledges the honeypot without saving anything', async () => {
    const { POST } = await import('@/app/api/feedback/route');
    const response = await POST(post({ ...VALID, website: 'https://spam.example' }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(db.prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('stops hammering from one address without tipping the client off', async () => {
    limit.allow.mockReturnValue(false);
    const { POST } = await import('@/app/api/feedback/route');
    const response = await POST(post(VALID));
    expect(response.status).toBe(200);
    expect(db.prisma.feedback.create).not.toHaveBeenCalled();
  });
});
