// The "Amount owed" row is uncontrolled local state, not a react-hook-form
// field — FormLabel and FormControl both read the <FormField> context and
// THROW without it, which blanked the whole New order panel on
// /dashboard/customers/[id]. These tests pin the render and the submit path.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderForm } from '@/components/custom/order-form';

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('OrderForm', () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;
  const onCreated = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onCreated.mockReset();
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
    await act(async () => root.render(<OrderForm customerId="customer-1" onCreated={onCreated} />));
  }

  it('renders the whole panel without throwing', async () => {
    await expect(render()).resolves.not.toThrow();
    expect(container.textContent).toContain('Order label or description');
    expect(container.textContent).toContain('Amount owed (cedis)');
    expect(container.querySelector('textarea')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('labels the amount input it owns, rather than borrowing a FormLabel', async () => {
    await render();
    const input = container.querySelector<HTMLInputElement>('#amount-owed');
    expect(input).not.toBeNull();
    const label = container.querySelector<HTMLLabelElement>('label[for="amount-owed"]');
    expect(label?.textContent).toContain('Amount owed (cedis)');
    expect(input?.getAttribute('inputmode')).toBe('decimal');
  });

  it('submits the description with the cedis amount converted to pesewas', async () => {
    await render();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'order-1',
        orderNumber: 'TILZA-20261012-0001',
        customerId: 'customer-1',
        description: '2 branded aprons',
        status: 'PENDING',
        amountPesewas: 4550,
        paidAt: null,
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    setNativeValue(container.querySelector('textarea') as HTMLTextAreaElement, '2 branded aprons');
    setNativeValue(container.querySelector('#amount-owed') as HTMLInputElement, '45.50');

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/orders');
    expect(JSON.parse(String(init.body))).toEqual({
      customerId: 'customer-1',
      description: '2 branded aprons',
      status: 'PENDING',
      amountPesewas: 4550,
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('refuses a non-numeric amount before touching the network', async () => {
    await render();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    setNativeValue(container.querySelector('textarea') as HTMLTextAreaElement, '2 branded aprons');
    setNativeValue(container.querySelector('#amount-owed') as HTMLInputElement, 'forty cedis');

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
