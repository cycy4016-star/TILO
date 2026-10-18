// @vitest-environment node
//
// Slug availability endpoint behind the wizard's debounced "is it free?"
// check. The two behaviours worth pinning: the caller's own slug must count as
// free (re-saving the wizard must not report "taken"), and a taken slug must
// come back with a usable free suggestion instead of a bare failure.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const db = vi.hoisted(() => ({ prisma: { store: { findFirst: vi.fn() } } }));

vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const { GET } = await import('@/app/api/store/slug-check/route');

function request(slug?: string) {
  const url =
    slug === undefined
      ? 'http://localhost/api/store/slug-check'
      : `http://localhost/api/store/slug-check?slug=${encodeURIComponent(slug)}`;
  return new Request(url);
}

// DB stand-in: a set of slugs held by OTHER stores.
function takenSlugs(...slugs: string[]) {
  db.prisma.store.findFirst.mockImplementation(async ({ where }: { where: { slug: string } }) =>
    slugs.includes(where.slug) ? { id: 'other-store' } : null,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.requireAuth.mockResolvedValue({ id: 'user-1' });
});

describe('GET /api/store/slug-check', () => {
  it('reports a free slug as available', async () => {
    takenSlugs();
    const res = await GET(request('amas-boutique'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: 'amas-boutique',
      available: true,
      suggestion: null,
    });
    // Tenancy: the check must exclude the caller's own store, never a bare
    // findUnique that would flag their current slug as taken.
    expect(db.prisma.store.findFirst).toHaveBeenCalledWith({
      where: { slug: 'amas-boutique', NOT: { userId: 'user-1' } },
      select: { id: true },
    });
  });

  it('suggests the first free numeric suffix for a taken slug', async () => {
    takenSlugs('amas', 'amas-2');
    const res = await GET(request('amas'));
    expect(await res.json()).toEqual({
      slug: 'amas',
      available: false,
      suggestion: 'amas-3',
    });
  });

  it('cleans an illegal slug and offers the cleaned version when free', async () => {
    takenSlugs();
    const res = await GET(request("Ama's Boutique"));
    expect(await res.json()).toEqual({
      slug: "ama's boutique",
      available: false,
      suggestion: 'amas-boutique',
    });
  });

  it('falls through to a suffix when the cleaned version is taken too', async () => {
    takenSlugs('amas-boutique');
    const res = await GET(request("Ama's Boutique"));
    expect(await res.json()).toEqual({
      slug: "ama's boutique",
      available: false,
      suggestion: 'amas-boutique-2',
    });
  });

  it('gives no suggestion when nothing usable can be built', async () => {
    takenSlugs();
    const noSlug = await GET(request());
    expect(await noSlug.json()).toEqual({ slug: '', available: false, suggestion: null });

    const tiny = await GET(request('a'));
    expect(await tiny.json()).toEqual({ slug: 'a', available: false, suggestion: null });
  });
});
