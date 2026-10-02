import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '../../node_modules/@prisma/client/default.js';

// 20260926120000_add_user_ownership made Customer.userId / Order.userId
// required, so every fixture row hangs off a fixture account. The email is the
// cleanup key: the run wipes any fixture left behind by a previous failed run
// instead of tripping the unique index.
const OWNER_EMAIL = 'integration-fixture@example.test';
const OWNER_ID = 'integration_fixture_owner';

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

  // Cascades to that account's customers and orders, so this also clears a
  // partial fixture from an earlier crash.
  await first.user.deleteMany({ where: { email: OWNER_EMAIL } });

  const owner = await first.user.create({
    data: {
      id: OWNER_ID,
      name: 'Fixture Owner',
      email: OWNER_EMAIL,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const customer = await first.customer.create({
    data: {
      userId: owner.id,
      name: 'Fixture SME',
      company: 'Fixture SME Ltd.',
      phone: '024 000 0000',
      address: 'Accra',
    },
  });
  const order = await first.order.create({
    data: {
      userId: owner.id,
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
  await first.user.delete({ where: { id: owner.id } });
});
