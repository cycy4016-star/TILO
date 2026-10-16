import { expect, test } from '@playwright/test';
import { ghanaianSmes } from '../fixtures/ghanaian-smes';

test('staff can create a Ghanaian SME customer, link an order, and update status', async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_BASE_URL || !process.env.E2E_OWNER_EMAIL || !process.env.E2E_OWNER_PASSWORD,
    'Platform E2E harness must provide E2E_BASE_URL and configured owner credentials',
  );

  const fixture = ghanaianSmes[0];
  if (!fixture) throw new Error('The Ghanaian SME fixture set is empty');

  await page.goto('/login');
  // Credential sign-in (email + password) is the fallback path; Google OAuth is
  // the primary one but can't be driven headlessly here.
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_OWNER_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.E2E_OWNER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/dashboard/customers');
  await page.getByRole('button', { name: /add customer/i }).click();
  // The dialog's fields were renamed — see customer-workspace.tsx FormLabels.
  await page.getByLabel('Name', { exact: true }).fill(fixture.name);
  await page.getByLabel('Outfit').fill(fixture.company);
  await page.getByLabel('Email', { exact: true }).fill(fixture.email);
  await page.getByLabel('Phone', { exact: true }).fill(fixture.phone);
  await page.getByLabel('Where to find them').fill(fixture.address);
  // The trigger above and this submit both read "Add customer", so scope the
  // click to the open dialog or strict mode sees two matches.
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^add customer$/i })
    .click();

  // The row and its WhatsApp shortcut share the customer name, so key on the
  // detail-route href instead of the accessible name.
  await page
    .locator('a[href*="/dashboard/customers/"]')
    .filter({ hasText: fixture.name })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: fixture.name })).toBeVisible();
  await page.getByLabel('Order label or description').fill(fixture.order.description);
  await page.getByRole('button', { name: /create order/i }).click();
  await expect(page.getByText(/TILZA-\d{8}-[A-Z0-9]+/)).toBeVisible();

  const statusControl = page.getByRole('combobox', { name: 'Order status' });
  await statusControl.click();
  await page.getByRole('option', { name: 'Processing' }).click();
  // Scope to the trigger: the timeline badge renders the same label, so a bare
  // getByText('Processing') matches two nodes and fails strict mode.
  await expect(statusControl).toContainText('Processing');

  await page.reload();
  await expect(page.getByRole('heading', { name: fixture.name })).toBeVisible();
  await expect(statusControl).toContainText('Processing');
  // The platform harness should additionally assert the persisted customer/order rows by id.
});
