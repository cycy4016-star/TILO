// Tilo order creation island.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  OrderCreate,
  type OrderCreateInput,
  OrderItem,
  type OrderItem as OrderRecord,
} from '@/lib/contracts/order';
import { applyServerErrors } from '@/lib/forms';

function getErrorBody(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

function cedisToPesewas(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function OrderForm({
  customerId,
  onCreated,
}: {
  customerId: string;
  onCreated: (order: OrderRecord) => void;
}) {
  const [amount, setAmount] = useState('');

  const form = useForm<z.input<typeof OrderCreate>, unknown, OrderCreateInput>({
    resolver: zodResolver(OrderCreate),
    defaultValues: { customerId, description: '', status: 'PENDING' },
  });

  async function onSubmit(values: OrderCreateInput) {
    const payload: OrderCreateInput = { ...values };
    if (amount.trim()) {
      const amountPesewas = cedisToPesewas(amount);
      if (amountPesewas == null) {
        toast.error('Enter a valid amount in cedis (e.g. 45.50)');
        return;
      }
      payload.amountPesewas = amountPesewas;
    }
    try {
      const order = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
        schema: OrderItem,
      });
      onCreated(order);
      form.reset({ customerId, description: '', status: 'PENDING' });
      setAmount('');
      toast.success('Order created');
    } catch (error) {
      const applied = applyServerErrors(getErrorBody(error), form.setError);
      if (!applied) toast.error('Could not create the order');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order label or description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="12 branded aprons for Friday delivery"
                  rows={4}
                  {...field}
                  className="rounded-2xl"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Amount owed (cedis)</FormLabel>
          <FormControl>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="45.50 — optional, powers payment reminders"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="rounded-2xl"
            />
          </FormControl>
        </FormItem>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-12 w-full rounded-full bg-yellow-600 font-semibold text-white hover:bg-amber-700"
        >
          {form.formState.isSubmitting ? 'Creating…' : 'Create order'}
        </Button>
      </form>
    </Form>
  );
}
