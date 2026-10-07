// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SampleSlideshow } from '@/components/custom/sample-showcase';

const SLIDES = [
  { name: 'Nova X5', shelf: 'Phones', price: 'GH₵ 2,450.00', image: '/samples/phone-nova.jpg' },
  { name: 'Court sneakers', shelf: 'Men', price: 'GH₵ 850.00', image: '/samples/sneakers-red.jpg' },
  { name: 'Croissants', shelf: 'Bakes', price: 'GH₵ 60.00', image: '/samples/croissant.jpg' },
];

function counterText(container: HTMLElement): string | null {
  const captions = [...container.querySelectorAll('p')].map((p) => p.textContent ?? '');
  return captions.find((text) => text.includes(' of ')) ?? null;
}

describe('SampleSlideshow controls', () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function render() {
    await act(async () => root.render(<SampleSlideshow slides={SLIDES} />));
  }

  it('starts on the first slide', async () => {
    await render();
    expect(counterText(container)).toContain('1 of 3');
  });

  it('auto-advances on the autoplay interval', async () => {
    await render();
    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    expect(counterText(container)).toContain('2 of 3');
    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    expect(counterText(container)).toContain('3 of 3');
  });

  it('wraps past the last slide', async () => {
    await render();
    await act(async () => {
      vi.advanceTimersByTime(4500 * 3);
    });
    expect(counterText(container)).toContain('1 of 3');
  });

  it('moves with the arrow buttons', async () => {
    await render();
    const next = container.querySelector('button[aria-label="Next product"]');
    const prev = container.querySelector('button[aria-label="Previous product"]');
    expect(next).not.toBeNull();
    await act(async () => {
      (next as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(counterText(container)).toContain('2 of 3');
    await act(async () => {
      (prev as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(counterText(container)).toContain('1 of 3');
  });

  it('jumps with the dot tabs', async () => {
    await render();
    const dots = container.querySelectorAll('button[role="tab"]');
    expect(dots).toHaveLength(3);
    await act(async () => {
      (dots[2] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(counterText(container)).toContain('3 of 3');
  });
});
