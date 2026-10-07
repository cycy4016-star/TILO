import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Anchor integrity for the assistive menu and the marketing nav.
 *
 * Two surfaces independently reference `id="..."` elements:
 *   - `src/lib/nav.ts`             → `href: '/#steps'` (marketing pages)
 *   - `assistive-menu.tsx`         → `sectionId: 'steps'`, scrolled to with
 *     `document.getElementById(...)`; split into `LANDING_SECTIONS` and
 *     `DASHBOARD_SECTIONS`
 *
 * Nothing else couples them, so renaming an id on one side silently breaks the
 * other and the control just does nothing — which is exactly how
 * `sectionId: 'week'` shipped while the page only ever had `id="steps"`.
 *
 * These tests read the real sources (no render, no mocks) and fail if any
 * referenced anchor goes missing.
 */

const root = process.cwd();
const read = (relative: string) =>
  readFileSync(join(root, relative), 'utf8').replace(/\r\n/g, '\n');

/** Every `id="foo"` declared in a file. */
const idsIn = (source: string) =>
  new Set([...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1] as string));

/** Every `id="foo"` declared anywhere under any of the given directory trees. */
function idsUnder(...relativeDirs: string[]): Set<string> {
  const ids = new Set<string>();
  const collect = (source: string) => {
    for (const id of idsIn(source)) ids.add(id);
  };
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      // `full` is already absolute — don't re-join it onto root.
      else if (/\.(tsx|ts)$/.test(entry))
        collect(readFileSync(full, 'utf8').replace(/\r\n/g, '\n'));
    }
  };
  for (const dir of relativeDirs) walk(join(root, dir));
  return ids;
}

/** Extract `sectionId: 'x'` values from one named const block. */
function sectionIdsOf(source: string, constName: string): string[] {
  const start = source.indexOf(`const ${constName}`);
  if (start === -1) throw new Error(`Could not find const ${constName} in assistive-menu.tsx`);
  // Anchor on the array's `= [` — not the first `[`, which lives inside the
  // type annotation (`QuickAction[]`) and would return an empty block.
  const open = source.indexOf('= [', start);
  if (open === -1) throw new Error(`Could not find the array literal for ${constName}`);
  const bracket = open + 1;
  let depth = 0;
  let end = bracket;
  for (; end < source.length; end++) {
    if (source[end] === '[') depth++;
    else if (source[end] === ']') {
      depth--;
      if (depth === 0) break;
    }
  }
  const block = source.slice(bracket, end);
  return [...block.matchAll(/sectionId:\s*'([^']+)'/g)].map((m) => m[1] as string);
}

const nav = read('src/lib/nav.ts');
const assistiveMenu = read('src/components/custom/assistive-menu.tsx');
// Landing sections now live in page.tsx plus the landing components it
// composes (src/components/landing/*) — scan both trees for declared ids.
const landingIds = idsUnder('src/app/(setup)', 'src/components/landing');
// Dashboard sections are split between the pages and the workspace components
// they render (`orders-queue` lives in orders-workspace.tsx, not a page).
const dashboardIds = idsUnder('src/app/(dashboard)', 'src/components/custom');

const navTargets = [...nav.matchAll(/href:\s*'\/#([^']+)'/g)].map((m) => m[1] as string);

describe('marketing navigation anchors', () => {
  it('links only to ids the landing page declares', () => {
    expect(navTargets.length).toBeGreaterThan(0);
    for (const target of navTargets) {
      expect(
        landingIds.has(target),
        `nav.ts links to /#${target} but the landing page declares no id="${target}"`,
      ).toBe(true);
    }
  });

  it('lands the assistive menu on ids the landing page declares', () => {
    const targets = sectionIdsOf(assistiveMenu, 'LANDING_SECTIONS');
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(
        landingIds.has(target),
        `LANDING_SECTIONS sectionId '${target}' matches no id="${target}" on the landing page`,
      ).toBe(true);
    }
  });

  it('offers the same landing sections in both the nav and the menu', () => {
    for (const target of sectionIdsOf(assistiveMenu, 'LANDING_SECTIONS')) {
      expect(
        navTargets.includes(target),
        `LANDING_SECTIONS offers '${target}' but nav.ts never links to it`,
      ).toBe(true);
    }
  });
});

describe('dashboard navigation anchors', () => {
  it('lands the assistive menu on ids that exist somewhere in the dashboard', () => {
    const targets = sectionIdsOf(assistiveMenu, 'DASHBOARD_SECTIONS');
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(
        dashboardIds.has(target),
        `DASHBOARD_SECTIONS sectionId '${target}' matches no id="${target}" in src/app/(dashboard)`,
      ).toBe(true);
    }
  });
});
