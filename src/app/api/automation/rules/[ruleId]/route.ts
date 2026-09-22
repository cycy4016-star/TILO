// admin update/delete API for a single automation rule.
import 'server-only';

import { NextResponse } from 'next/server';
import {
  AutomationRuleCreate,
  AutomationRuleItem,
  AutomationRuleUpdate,
} from '@/lib/contracts/automation';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';

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

type RouteContext = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdminUser(request);
    const { ruleId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = AutomationRuleUpdate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const merged = AutomationRuleCreate.safeParse({
      name: existing.name,
      kind: existing.kind,
      triggerStatus: existing.triggerStatus,
      waitHours: existing.waitHours,
      message: existing.message,
      recipient: existing.recipient,
      targetStatus: existing.targetStatus,
      enabled: existing.enabled,
      ...parsed.data,
    });
    if (!merged.success) return validationResponse(merged.error);

    const rule = await prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        name: merged.data.name,
        kind: merged.data.kind,
        triggerStatus: merged.data.triggerStatus ?? null,
        waitHours: merged.data.waitHours,
        message: merged.data.message || null,
        recipient: merged.data.recipient || null,
        targetStatus: merged.data.targetStatus || null,
        enabled: merged.data.enabled,
      },
    });
    return NextResponse.json(serializeRule(rule));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAdminUser(request);
    const { ruleId } = await context.params;
    const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    await prisma.automationRule.delete({ where: { id: ruleId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
