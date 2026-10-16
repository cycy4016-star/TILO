// Seed a shop-owner account for the Playwright E2E suite.
//
// The e2e spec (tests/e2e/customer-order-workspace.spec.ts) drives the OWNER
// customer workspace, but the only local account is the admin dev-login user
// (which sees the platform operator console instead). This script provisions a
// normal "user" with a fully-onboarded store (name + slug + dialable
// contactPhone + logo => getOnboardingStatus().complete) and a credential
// account hashed by better-auth itself, so the login form accepts it.
//
// Idempotent: safe to run on every CI/e2e boot. Caller must provide
// DATABASE_URL (CI job env) or have .env.local present (local runs).

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

if (!process.env.DATABASE_URL) {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
        break;
      } catch {
        // Ignore malformed env files; Prisma will report a missing URL.
      }
    }
  }
}

const OWNER_ID = 'e2e_tilza_owner';
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@tilza.org';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'tilza-e2e-password';
const OWNER_PHONE = '+233201110000';
const STORE_SLUG = 'e2e-test-shop';
const TRIAL_DAYS = 14;

// 1x1 transparent PNG — satisfies the logoMime/logo "has visual" onboarding gate.
const LOGO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const password = await hashPassword(OWNER_PASSWORD);

  // Reset the owner's workspace so reruns start clean: the spec assumes exactly
  // one customer with one order, and a persisted DB would otherwise accumulate
  // duplicate "Ama's Boutique" rows across runs. Orders first (they hold the FK).
  await prisma.order.deleteMany({ where: { userId: OWNER_ID } });
  await prisma.customer.deleteMany({ where: { userId: OWNER_ID } });

  await prisma.user.upsert({
    where: { id: OWNER_ID },
    create: {
      id: OWNER_ID,
      name: 'E2E Owner',
      email: OWNER_EMAIL,
      emailVerified: true,
      role: 'user',
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
    update: { email: OWNER_EMAIL, updatedAt: now },
  });

  const account = await prisma.account.findFirst({
    where: { userId: OWNER_ID, providerId: 'credential' },
    select: { id: true },
  });
  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password, updatedAt: now },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: OWNER_ID,
        providerId: 'credential',
        userId: OWNER_ID,
        password,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await prisma.store.upsert({
    where: { userId: OWNER_ID },
    create: {
      userId: OWNER_ID,
      name: 'E2E Test Shop',
      slug: STORE_SLUG,
      tagline: 'Seeded for end-to-end tests',
      contactPhone: OWNER_PHONE,
      logo: LOGO,
      logoMime: 'image/png',
    },
    update: {
      name: 'E2E Test Shop',
      slug: STORE_SLUG,
      contactPhone: OWNER_PHONE,
      logo: LOGO,
      logoMime: 'image/png',
    },
  });

  process.stdout.write(
    `seed-e2e: owner ${OWNER_EMAIL} ready (store ${STORE_SLUG}, onboarding complete).\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`seed-e2e failed: ${error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
