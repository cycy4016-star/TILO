import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '../../node_modules/@prisma/client/default.js';

test('customer/order schema persists linked records across client instances', async (t) => {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    t.skip('Set TEST_DATABASE_URL or DATABASE_URL for disposable PostgreSQL integration coverage');
    return;
  }

  const first = new PrismaClient({ datasources: { db: { url } } });
  const second = new PrismaClient({ datasources: { db: { url } } });
  t.after(async () => {
    await second.$disconnect();
    await first.$disconnect();
  });

  const customer = await first.customer.create({
    data: {
      name: 'Fixture SME',
      company: 'Fixture SME Ltd.',
      phone: '024 000 0000',
      address: 'Accra',
    },
  });
  const order = await first.order.create({
    data: {
      customerId: customer.id,
      orderNumber: 'TILO-INTEGRATION-1',
      description: 'Fixture order',
    },
  });
  const persisted = await second.order.findUnique({
    where: { id: order.id },
    include: { customer: true },
  });
  assert.equal(persisted?.customer.id, customer.id);
  assert.equal(persisted?.status, 'PENDING');

  await first.order.delete({ where: { id: order.id } });
  await first.customer.delete({ where: { id: customer.id } });
});
