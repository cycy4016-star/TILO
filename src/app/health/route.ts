// Liveness + database readiness. Hosts (Railway, VPS) should point their
// healthcheck here: a 200 means the app AND its Postgres answer. A deploy
// with a missing migration or a dead DATABASE_URL gets a 503 instead of
// serving a broken storefront behind a lying "healthy".
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ status: 'unhealthy', db: false }, { status: 503 });
  }
  return NextResponse.json({ status: 'healthy', db: true });
}
