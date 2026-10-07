import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Next resolves the proxy file from `path.join(pagesDir || appDir, '..')`, which
// for this repo is `src/` — a `proxy.ts` at the repo ROOT is never discovered, so
// the build ships WITHOUT a proxy and NO Content-Security-Policy on any response.
// That failure is silent (typecheck/lint/tests/build all stay green), which is
// exactly why this test exists: it pins the file to the location Next reads, and
// — when a build output is present — proves the proxy was REGISTERED, not assumed.
//
// Next 16 + Turbopack records the registration in functions-config-manifest.json
// as `/_middleware`; the older middleware-manifest.json is left empty on purpose,
// so asserting on it would be a false alarm.
const root = process.cwd();

const readJson = (relative: string): unknown => {
  const path = join(root, relative);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
};

describe('proxy location (CSP delivery)', () => {
  it('lives at src/proxy.ts, where Next discovers it', () => {
    expect(existsSync(join(root, 'src', 'proxy.ts'))).toBe(true);
  });

  it('is not shadowed by a root-level proxy.ts Next would ignore', () => {
    expect(existsSync(join(root, 'proxy.ts'))).toBe(false);
  });

  it('keeps a CSP builder the proxy can ship', async () => {
    const { buildCsp } = await import('@/lib/csp');
    const csp = buildCsp('nonce', false);
    expect(csp).toContain("'nonce-nonce'");
    expect(csp).toContain("'strict-dynamic'");
  });

  it('registers itself as /_middleware in a built functions manifest', () => {
    const manifest = readJson(join('.next', 'server', 'functions-config-manifest.json')) as {
      functions?: Record<string, unknown>;
    } | null;
    if (!manifest) return; // no build output yet — location checked above

    expect(Object.keys(manifest.functions ?? {})).toContain('/_middleware');
  });
});
