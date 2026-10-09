// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemWizard } from '@/components/custom/item-wizard';
import { ShareSheet } from '@/components/custom/share-sheet';

function text(): string {
  return document.body.textContent ?? '';
}

function query<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector);
}

function queryAll(selector: string): Element[] {
  return [...document.body.querySelectorAll(selector)];
}

describe('ItemWizard gating', () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render() {
    await act(async () =>
      root.render(<ItemWizard open onOpenChange={() => {}} categories={[]} onSaved={() => {}} />),
    );
  }

  async function fillName(value: string) {
    const name = query<HTMLInputElement>('#wiz-name');
    expect(name).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(name, value);
      name?.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function clickNext() {
    const next = query('button[type="submit"]');
    await act(async () => {
      next?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('gates Next on a valid name, then advances a step', async () => {
    await render();
    expect(text()).toContain('Step 1 of 8');
    const next = query('button[type="submit"]');
    expect(next?.hasAttribute('disabled')).toBe(true);

    await fillName('Apron');
    const enabled = query('button[type="submit"]');
    expect(enabled?.hasAttribute('disabled')).toBe(false);
    await clickNext();
    expect(text()).toContain('Step 2 of 8');
  });

  it('collapses a finished name into a summary chip', async () => {
    await render();
    await fillName('Apron');
    await clickNext();
    expect(text()).toContain('Name:');
    expect(text()).toContain('Apron');
  });
});

describe('ShareSheet targets', () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('opens WhatsApp with the encoded message', async () => {
    await act(async () =>
      root.render(
        <ShareSheet
          open
          onOpenChange={() => {}}
          title="Share it"
          description="Send it anywhere."
          message="Hi S! Widget — GH₵ 25.00"
          url="https://t/s#i"
        />,
      ),
    );
    const buttons = queryAll('button');
    const whatsapp = buttons.find((button) => button.textContent?.includes('WhatsApp'));
    expect(whatsapp).toBeDefined();
    const opened: string[] = [];
    const realOpen = window.open;
    window.open = ((url: string) => {
      opened.push(url);
      return null;
    }) as typeof window.open;
    try {
      await act(async () => {
        whatsapp?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    } finally {
      window.open = realOpen;
    }
    expect(opened).toEqual([
      `https://wa.me/?text=${encodeURIComponent('Hi S! Widget — GH₵ 25.00')}`,
    ]);
  });
});
