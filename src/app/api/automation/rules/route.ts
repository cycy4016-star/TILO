// authenticated rule list + create API for the automation switchboard.
import 'server-only';

import { NextResponse } from 'next/server';
import {
  AutomationRuleCreate,
  AutomationRuleItem,
  AutomationRuleList,
} from '@/lib/contracts/automation';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function validationResponse(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const fieldErrors = error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (message) errors[field] = message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}

function serializeRule(rule: {
  id: string;
  name: string;
  kind: string;
  triggerStatus: string | null;
  waitHours: number;
  message: string | null;
  recipient: string | null;
  targetStatus: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return AutomationRuleItem.parse({
    id: rule.id,
    name: rule.name,
    kind: rule.kind,
    triggerStatus: rule.triggerStatus,
    waitHours: rule.waitHours,
    message: rule.message,
    recipient: rule.recipient,
    targetStatus: rule.targetStatus,
    enabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const rules = await prisma.automationRule.findMany({
      orderBy: [{ createdAt: 'asc' }],
    });
    return NextResponse.json(AutomationRuleList.parse({ items: rules.map(serializeRule) }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = AutomationRuleCreate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const rule = await prisma.automationRule.create({
      data: {
        name: parsed.data.name,
        kind: parsed.data.kind,
        triggerStatus: parsed.data.triggerStatus ?? null,
        waitHours: parsed.data.waitHours,
        message: parsed.data.message || null,
        recipient: parsed.data.recipient || null,
        targetStatus: parsed.data.targetStatus || null,
        enabled: parsed.data.enabled,
      },
    });
    return NextResponse.json(serializeRule(rule), { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
