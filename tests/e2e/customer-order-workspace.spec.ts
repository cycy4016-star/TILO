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
  // Sign-in is phone-first: one identifier field accepts a phone OR an email.
  await page.getByLabel('Phone number or email').fill(process.env.E2E_OWNER_EMAIL ?? '');
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
  await page.getByRole('button', { name: /pin them up/i }).click();

  await page.getByRole('link', { name: fixture.name }).click();
  await expect(page.getByRole('heading', { name: fixture.name })).toBeVisible();
  await page.getByLabel('Order label or description').fill(fixture.order.description);
  await page.getByRole('button', { name: /create order/i }).click();
  await expect(page.getByText(/TILO-\d{8}-[A-Z0-9]+/)).toBeVisible();

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
