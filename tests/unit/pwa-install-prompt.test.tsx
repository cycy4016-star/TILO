// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallPrompt } from '@/components/custom/pwa-install-prompt';

vi.mock('next/navigation', () => ({ usePathname: () => '/welcome' }));
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } }, isPending: false }),
}));

const DISMISSED_KEY = 'tilza:pwa-install-dismissed';
const originalUserAgent = window.navigator.userAgent;

function promptButton(): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Install app'),
  ) as HTMLButtonElement | undefined;
}

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
}

describe('PwaInstallPrompt', () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    setUserAgent(originalUserAgent);
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    setUserAgent(originalUserAgent);
    vi.unstubAllGlobals();
  });

  it('shows the install action after sign-up and invokes the browser prompt', async () => {
    await act(async () => root.render(<PwaInstallPrompt />));

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    const install = promptButton();
    expect(install).toBeDefined();

    await act(async () => {
      install?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('[data-pwa-install-prompt]')).toBeNull();
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('1');
  });

  it('stays hidden after the prompt is dismissed', async () => {
    await act(async () => root.render(<PwaInstallPrompt />));

    const dismiss = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss install prompt"]',
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.querySelector('[data-pwa-install-prompt]')).toBeNull();
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('1');

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<PwaInstallPrompt />));
    expect(document.body.querySelector('[data-pwa-install-prompt]')).toBeNull();
  });

  it('guides iPhone Safari users to Add to Home Screen', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    );
    await act(async () => root.render(<PwaInstallPrompt />));

    expect(document.body.textContent).toContain('Add to Home Screen');
    expect(promptButton()).toBeUndefined();
  });

  it('guides macOS Safari users to Add to Dock', async () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    );
    await act(async () => root.render(<PwaInstallPrompt />));

    expect(document.body.textContent).toContain('Add to Dock');
    expect(promptButton()).toBeUndefined();
  });
});
