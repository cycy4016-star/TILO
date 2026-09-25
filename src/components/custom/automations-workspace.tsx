// Tilo switchboard island: rules a shop sets once, a run-now button, and the
// recent activity trail. Any signed-in user can wire rules, run the sweep and
// watch the machine.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BellRing,
  Bot,
  Clock,
  HandCoins,
  MessagesSquare,
  Pencil,
  Play,
  RefreshCw,
  Repeat2,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  AUTOMATION_KIND_META,
  AutomationEventList,
  type AutomationKindMeta,
  type AutomationKindValue,
  AutomationRuleCreate,
  AutomationRuleItem,
  AutomationRuleList,
  AutomationSweepResult,
  type AutomationEventItem as EventRecord,
  type AutomationRuleItem as RuleRecord,
} from '@/lib/contracts/automation';
import { OrderStatus } from '@/lib/contracts/order';
import { applyServerErrors } from '@/lib/forms';

const statusLabels = {
  PENDING: 'warming up',
  PROCESSING: 'on the fire',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
} as const;

const statusOptions = OrderStatus.options;

function statusLabel(status: string | null | undefined): string {
  return status ? statusLabels[status as keyof typeof statusLabels] : '';
}

const KIND_ICONS = {
  SMS: MessagesSquare,
  FLIP: Repeat2,
  PAYMENT: HandCoins,
  ALERT: BellRing,
  RETRY: RefreshCw,
} as const;

function KindPill({ kind }: { kind: AutomationKindValue }) {
  const meta = AUTOMATION_KIND_META[kind];
  const Icon = KIND_ICONS[meta.icon];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-800 dark:bg-stone-800 dark:text-amber-300">
      <Icon aria-hidden className="size-3" />
      {meta.label}
    </span>
  );
}

function waitLabel(kind: AutomationKindValue): string {
  if (kind === 'REVIEW_REQUEST' || kind === 'RE_ENGAGE') return 'How quiet (hours)';
  if (kind === 'PAYMENT_REMINDER') return 'Owed after (hours)';
  return 'After (hours idle)';
}

const messagePlaceholder =
  'Hello {customerName}, your order {orderNumber} is still {statusLabel}. Reply and we will get it moving — Tilo';

function getErrorBody(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

function humanizeHours(hours: number) {
  return hours < 24
    ? `${hours}h`
    : `${Math.floor(hours / 24)}d ${hours % 24 ? `${hours % 24}h` : ''}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function RuleForm({
  rule,
  onSaved,
  onCancelled,
}: {
  rule?: RuleRecord;
  onSaved: (rule: RuleRecord) => void;
  onCancelled: () => void;
}) {
  const form = useForm<
    z.input<typeof AutomationRuleCreate>,
    unknown,
    z.output<typeof AutomationRuleCreate>
  >({
    resolver: zodResolver(AutomationRuleCreate),
    defaultValues: rule
      ? {
          name: rule.name,
          kind: rule.kind,
          triggerStatus: rule.triggerStatus ?? undefined,
          waitHours: rule.waitHours,
          message: rule.message ?? '',
          recipient: rule.recipient ?? undefined,
          targetStatus: rule.targetStatus ?? undefined,
          enabled: rule.enabled,
        }
      : {
          name: '',
          kind: 'SMS_NUDGE',
          triggerStatus: 'PENDING',
          waitHours: 24,
          message: '',
          recipient: undefined,
          targetStatus: undefined,
          enabled: true,
        },
  });

  const kind = form.watch('kind');
  const isEditing = Boolean(rule);
  const meta = AUTOMATION_KIND_META[kind] as AutomationKindMeta;

  async function onSubmit(values: z.output<typeof AutomationRuleCreate>) {
    try {
      const saved = await apiFetch(
        rule ? `/api/automation/rules/${rule.id}` : '/api/automation/rules',
        {
          method: rule ? 'PATCH' : 'POST',
          body: JSON.stringify(values),
          schema: AutomationRuleItem,
        },
      );
      onSaved(saved);
      toast.success(isEditing ? 'Rule retuned.' : 'Rule wired in.');
    } catch (error) {
      const applied = applyServerErrors(getErrorBody(error), form.setError);
      if (!applied) toast.error('Could not save the rule — try again');
    }
  }

  function switchKind(next: AutomationKindValue) {
    form.setValue('kind', next);
    const nextMeta = AUTOMATION_KIND_META[next];
    if (nextMeta.requiresStatus && !form.getValues('triggerStatus')) {
      form.setValue('triggerStatus', nextMeta.defaultStatus);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name this rule</FormLabel>
              <FormControl>
                <Input placeholder="Sweat the stragglers" {...field} className="rounded-2xl" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What it does</FormLabel>
              <Select
                onValueChange={(value) => switchKind(value as AutomationKindValue)}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Pick one" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(AUTOMATION_KIND_META) as AutomationKindValue[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUTOMATION_KIND_META[k].label} — {AUTOMATION_KIND_META[k].blurb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="waitHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{waitLabel(kind)}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} className="rounded-2xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {meta.requiresStatus && (
            <FormField
              control={form.control}
              name="triggerStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>When an order has been</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Pick a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        {meta.requiresRecipient && (
          <FormField
            control={form.control}
            name="recipient"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alert phone (your WhatsApp number)</FormLabel>
                <FormControl>
                  <Input placeholder="+233 24 000 0000" {...field} className="rounded-2xl" />
                </FormControl>
                <FormDescription>Where the panic texts go when an order stalls.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {meta.requiresTarget && (
          <FormField
            control={form.control}
            name="targetStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Flip it to</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                  <FormControl>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="Pick a destination" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {meta.usesMessage && (
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={messagePlaceholder}
                    {...field}
                    className="rounded-2xl"
                  />
                </FormControl>
                <FormDescription>
                  Uses {`{customerName} {orderNumber} {description} {statusLabel}`}. For payment
                  rules add {`{amount}`} (renders as GHS). Left empty for the house default.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-2xl border-2 border-amber-100 bg-amber-50/60 px-4 py-3">
              <div>
                <FormLabel>Rule live</FormLabel>
                <FormDescription>Turn it off without deleting it.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancelled}
            className="rounded-full font-black uppercase tracking-wide"
          >
            Not now
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
          >
            {form.formState.isSubmitting ? 'Wiring…' : isEditing ? 'Save changes' : 'Wire it in'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function AutomationsWorkspace() {
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRecord | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch('/api/automation/rules', { schema: AutomationRuleList });
      setRules(result.items);
    } catch {
      setError('The switchboard sparked. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadRules();
    apiFetch('/api/automation/events', { schema: AutomationEventList })
      .then((result) => {
        if (!cancelled) setEvents(result.items);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRules]);

  function handleSaved(saved: RuleRecord) {
    setRules((current) => {
      const exists = current.some((r) => r.id === saved.id);
      return exists ? current.map((r) => (r.id === saved.id ? saved : r)) : [...current, saved];
    });
    setDialogOpen(false);
    setEditingRule(null);
  }

  async function toggleEnabled(rule: RuleRecord) {
    await apiFetch(`/api/automation/rules/${rule.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !rule.enabled }),
      schema: AutomationRuleItem,
    })
      .then((updated) => {
        setRules((current) => current.map((r) => (r.id === updated.id ? updated : r)));
        toast.success(updated.enabled ? 'Rule switched back on.' : 'Rule parked.');
      })
      .catch(() => toast.error('Could not flip the rule — try again'));
  }

  async function deleteRule(rule: RuleRecord) {
    if (!window.confirm(`Delete "${rule.name}"? Its history is kept.`)) return;
    await apiFetch(`/api/automation/rules/${rule.id}`, { method: 'DELETE' })
      .then(() => {
        setRules((current) => current.filter((r) => r.id !== rule.id));
        toast.success('Rule deleted.');
      })
      .catch(() => toast.error('Could not delete it — try again'));
  }

  async function runSweep() {
    setSweeping(true);
    try {
      const result = await apiFetch('/api/automation/sweep', {
        method: 'POST',
        schema: AutomationSweepResult,
      });
      toast.success(
        `Swept the kitchen — ${result.nudged} texted, ${result.flipped} flipped, ${result.rules} rules checked.`,
      );
    } catch {
      toast.error('Could not run the sweep right now.');
    } finally {
      setSweeping(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-amber-950 p-7 text-amber-50 sm:p-9">
        <Bot
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 size-40 rotate-12 text-amber-900"
        />
        <p className="relative text-xs font-black uppercase tracking-[0.25em] text-amber-300">
          Set it once, Tilo keeps the rhythm
        </p>
        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-black uppercase leading-none sm:text-5xl">
            The switchboard
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void runSweep()}
              disabled={sweeping}
              className="h-12 rounded-full bg-amber-50 font-black uppercase tracking-wide text-amber-950 hover:bg-white"
            >
              <Play aria-hidden className="size-4" />
              {sweeping ? 'Sweeping…' : 'Run now'}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 rounded-full bg-amber-300 px-6 font-black uppercase tracking-wide text-amber-950 hover:bg-amber-200">
                  <Zap aria-hidden className="size-4" />
                  New rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="font-display font-black uppercase">
                    Wire in a rule
                  </DialogTitle>
                  <DialogDescription>
                    Pick a trigger, set the timing, and Tilo handles the rest automatically.
                  </DialogDescription>
                </DialogHeader>
                <RuleForm
                  key={editingRule?.id ?? String(dialogOpen)}
                  rule={editingRule ?? undefined}
                  onSaved={handleSaved}
                  onCancelled={() => {
                    setDialogOpen(false);
                    setEditingRule(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <p className="relative mt-3 max-w-2xl text-sm font-medium text-amber-200/90">
          Rules are checked by a daily sweep. Nudges, ready-pings, receipts and review asks text the
          customer once per order, ever; stall alerts and the daily brief text you. Set the rules
          once and Tilo keeps the rhythm going.
        </p>
      </section>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-[2rem] border-2 border-dashed border-amber-300 px-6 text-sm font-bold uppercase tracking-widest text-amber-500">
          Flicking the switches…
        </div>
      ) : error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-amber-950 bg-white px-6 text-center dark:bg-stone-900">
          <p role="alert" className="font-bold text-amber-700">
            {error}
          </p>
          <Button
            type="button"
            onClick={() => void loadRules()}
            className="rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
          >
            Try again
          </Button>
        </div>
      ) : rules.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-amber-400 px-6 text-center">
          <span className="flex size-14 -rotate-6 items-center justify-center rounded-3xl bg-yellow-600 text-white">
            <Zap aria-hidden className="size-6" />
          </span>
          <p className="font-display text-xl font-black uppercase">A quiet board</p>
          <p className="max-w-sm text-sm font-medium text-stone-500">
            Wire in your first rule and the machine starts watching the orders for you.
          </p>
          <Button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-1 rounded-full bg-amber-950 font-black uppercase tracking-wide text-amber-300 hover:bg-stone-900"
          >
            Wire in the first rule
          </Button>
        </div>
      ) : (
        <div id="switchboard-rules" className="scroll-mt-24 grid gap-3">
          {rules.map((rule, i) => {
            const meta = AUTOMATION_KIND_META[rule.kind];
            return (
              <div
                key={rule.id}
                className={`flex flex-col gap-4 rounded-[1.75rem] border-2 border-amber-950 bg-white p-5 shadow-[4px_4px_0_0_#451a03] sm:flex-row sm:items-center sm:justify-between dark:bg-stone-900 ${
                  i % 2 === 1 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
                } ${rule.enabled ? '' : 'opacity-60'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display font-black uppercase tracking-tight">
                      {rule.name}
                    </h2>
                    <KindPill kind={rule.kind} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-stone-500">
                    <Clock aria-hidden className="size-3.5" />
                    <span>
                      {meta.requiresStatus
                        ? `After ${humanizeHours(rule.waitHours)} of ${statusLabel(rule.triggerStatus)}`
                        : `After ${humanizeHours(rule.waitHours)}`}
                    </span>
                    {meta.requiresRecipient && rule.recipient && (
                      <>
                        <span aria-hidden>→</span>
                        <span className="font-black text-amber-900 dark:text-amber-200">
                          alert {rule.recipient}
                        </span>
                      </>
                    )}
                    {meta.requiresTarget && rule.targetStatus && (
                      <>
                        <span aria-hidden>→</span>
                        <span className="font-black text-amber-900 dark:text-amber-200">
                          flip to {statusLabel(rule.targetStatus)}
                        </span>
                      </>
                    )}
                  </p>
                  {meta.usesMessage && rule.message && (
                    <p className="mt-2 max-w-lg truncate text-xs font-medium text-stone-400">
                      &ldquo;{rule.message}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => void toggleEnabled(rule)}
                    aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${rule.name}`}
                      onClick={() => {
                        setEditingRule(rule);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${rule.name}`}
                      onClick={() => void deleteRule(rule)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section
        id="recent-activity"
        className="scroll-mt-24 rounded-[2rem] border-2 border-amber-950 bg-white p-5 shadow-[4px_4px_0_0_#451a03] dark:bg-stone-900"
      >
        <h2 className="font-display text-lg font-black uppercase tracking-tight">
          Recent activity
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-stone-500">
            Nothing yet. Once the sweep fires, every nudge and flip shows up here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50/70 px-4 py-2.5 text-sm dark:bg-stone-800"
              >
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full ${
                    event.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  <span aria-hidden className="text-[10px] font-black">
                    {event.ok ? '✓' : '✕'}
                  </span>
                </span>
                <span className="font-black uppercase tracking-wide text-amber-900 dark:text-amber-200">
                  {event.kind.replaceAll('_', ' ')}
                </span>
                {event.to && <span className="text-xs font-medium text-stone-500">{event.to}</span>}
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-stone-500">
                  {event.message ?? event.detail}
                </span>
                <time className="text-xs font-medium text-stone-400">
                  {formatDate(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
