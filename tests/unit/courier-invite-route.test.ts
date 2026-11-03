// @vitest-environment node
//
// The public invite route must not mint a courier session for an account the
// caller has not proven they own. A phone that already belongs to a rider still
// records the membership, but the response asks the caller to return on the
// device that already holds that rider's session.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const auth = vi.hoisted(() => ({
  createCourierSession: vi.fn(),
  getCourierSession: vi.fn(),
}));
const invites = vi.hoisted(() => ({
  findInviteByToken: vi.fn(),
  inviteIsUsable: vi.fn(),
  joinCrew: vi.fn(),
}));
const rate = vi.hoisted(() => ({ allow: vi.fn(), ipOf: vi.fn() }));

vi.mock('@/lib/courier-auth', () => auth);
vi.mock('@/lib/courier-invite', () => invites);
vi.mock('@/lib/rate-limit', () => rate);
vi.mock('@/lib/telemetry', () => ({
  routeErrorResponse: (error: unknown) =>
    error instanceof Response ? error : Response.json({ error: 'error' }, { status: 500 }),
}));

const context = { params: Promise.resolve({ token: 'invite-token' }) };

function joinRequest(body: unknown) {
  return new Request('http://test/api/public/courier/invite/invite-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const body = {
  name: 'New Rider',
  phone: '024 123 4567',
  vehicleType: 'MOTORBIKE',
};

beforeEach(() => {
  vi.clearAllMocks();
  rate.allow.mockReturnValue(true);
  rate.ipOf.mockReturnValue('127.0.0.1');
  invites.findInviteByToken.mockResolvedValue({ id: 'invite-1' });
  invites.inviteIsUsable.mockReturnValue(true);
  auth.getCourierSession.mockResolvedValue(null);
  auth.createCourierSession.mockResolvedValue(undefined);
});

describe('public courier invite join route', () => {
  it('creates a session for a brand-new rider', async () => {
    invites.joinCrew.mockResolvedValue({
      courierId: 'courier-new',
      status: 'PENDING',
      storeName: 'Ama Threads',
      canSignIn: true,
    });

    const { POST } = await import('@/app/api/public/courier/invite/[token]/route');
    const response = await POST(joinRequest(body), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      storeName: 'Ama Threads',
      status: 'PENDING',
      signInRequired: false,
    });
    expect(auth.createCourierSession).toHaveBeenCalledWith('courier-new', expect.any(Request));
  });

  it('does not create a session when the phone belongs to another rider', async () => {
    invites.joinCrew.mockResolvedValue({
      courierId: 'courier-existing',
      status: 'ACTIVE',
      storeName: 'Ama Threads',
      canSignIn: false,
    });

    const { POST } = await import('@/app/api/public/courier/invite/[token]/route');
    const response = await POST(joinRequest(body), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      storeName: 'Ama Threads',
      status: 'ACTIVE',
      signInRequired: true,
    });
    expect(auth.createCourierSession).not.toHaveBeenCalled();
  });

  it('passes the current courier session through so the owner can correct a profile', async () => {
    auth.getCourierSession.mockResolvedValue({ courier: { id: 'courier-1' } });
    invites.joinCrew.mockResolvedValue({
      courierId: 'courier-1',
      status: 'ACTIVE',
      storeName: 'Ama Threads',
      canSignIn: true,
    });

    const { POST } = await import('@/app/api/public/courier/invite/[token]/route');
    const response = await POST(joinRequest(body), context);

    expect(response.status).toBe(200);
    expect(invites.joinCrew).toHaveBeenCalledWith(
      expect.objectContaining({ authenticatedCourierId: 'courier-1' }),
    );
    expect(auth.createCourierSession).toHaveBeenCalledWith('courier-1', expect.any(Request));
  });

  it('rejects an expired or revoked invite before reading the body', async () => {
    invites.findInviteByToken.mockResolvedValue(null);
    invites.joinCrew.mockRejectedValue(
      Response.json({ error: 'This crew link has expired.' }, { status: 404 }),
    );

    const { POST } = await import('@/app/api/public/courier/invite/[token]/route');
    const response = await POST(joinRequest(body), context);

    expect(response.status).toBe(404);
    expect(auth.createCourierSession).not.toHaveBeenCalled();
  });
});
