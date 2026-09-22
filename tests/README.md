# Customer and order workspace tests

The unit suite covers the shared Zod contracts and route-handler boundaries:

```bash
npm run test -- tests/unit/customer-order
```

Disposable PostgreSQL coverage requires `TEST_DATABASE_URL` (or the sandbox
`DATABASE_URL`) and a schema push before running:

```bash
npx prisma db push
node --test tests/integration/customer-order-db.test.mjs
```

The integration test creates and removes only its own fixture rows. The
Ghanaian SME fixtures in `tests/fixtures/ghanaian-smes.ts` are test-owned and
must not be added to `src/lib/seed.ts` or production startup data.

The expected journey is: sign in as the configured test owner, create or search
an Accra/Kumasi SME by name or contact field, create an order from its detail
page, move the order through a status update, reload, and verify the linked
customer/order rows in the test database. Platform E2E runs should provide the
real owner session and disposable database rather than mocking the REST API.
