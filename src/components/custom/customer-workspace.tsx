// Tilo customer directory island: search + create, served loud.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Flame, Mail, MessagesSquare, Phone, Plus, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import {
  CustomerCreate,
  type CustomerCreateInput,
  CustomerItem,
  CustomerList,
  type CustomerItem as CustomerRecord,
} from '@/lib/contracts/customer';
import { applyServerErrors } from '@/lib/forms';
import { waMeLink } from '@/lib/phone';

function getErrorBody(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

function CustomerForm({ onCreated }: { onCreated: (customer: CustomerRecord) => void }) {
  const form = useForm<CustomerCreateInput>({
    resolver: zodResolver(CustomerCreate),
    defaultValues: { name: '', company: '', email: '', phone: '', address: '' },
  });

  async function onSubmit(values: CustomerCreateInput) {
    try {
      const created = await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: CustomerItem,
      });
      onCreated(created);
      form.reset();
      toast.success('Pinned to the wall!');
    } catch (error) {
      const applied = applyServerErrors(getErrorBody(error), form.setError);
      if (!applied) toast.error('Could not add them — try again');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Ama's Boutique" {...field} className="rounded-md" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Outfit</FormLabel>
                <FormControl>
                  <Input placeholder="Ama's Boutique Ltd." {...field} className="rounded-md" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="orders@example.com"
                    {...field}
                    className="rounded-md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="024 000 0000" {...field} className="rounded-md" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Where to find them</FormLabel>
              <FormControl>
                <Input placeholder="Osu, Accra" {...field} className="rounded-md" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-11 w-full rounded-md bg-primary font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          {form.formState.isSubmitting ? 'Pinning…' : 'Pin them up'}
        </Button>
      </form>
    </Form>
  );
}

export function CustomerWorkspace() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCustomers = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : '';
      const result = await apiFetch(`/api/customers${params}`, { schema: CustomerList });
      setCustomers(result.items);
    } catch {
      setError('Could not load customers. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers('');
  }, [loadCustomers]);

  function handleCreated(customer: CustomerRecord) {
    setCustomers((current) => [customer, ...current]);
    setDialogOpen(false);
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-7 sm:p-9">
        <p className="relative text-eyebrow">Customer directory</p>
        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-h1 font-display">Customers</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 rounded-md bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus aria-hidden className="size-4" />
                Add customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-h4 font-display">Add a customer</DialogTitle>
                <DialogDescription>
                  Add an email or phone so they&apos;re ready for follow-up.
                </DialogDescription>
              </DialogHeader>
              <CustomerForm key={String(dialogOpen)} onCreated={handleCreated} />
            </DialogContent>
          </Dialog>
        </div>
        <form
          className="relative mt-6 flex w-full gap-2 sm:max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            const next = searchInput.trim();
            setQuery(next);
            void loadCustomers(next);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, email, or phone"
              aria-label="Search customers"
              className="h-11 rounded-md border-border bg-background pl-11"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-11 rounded-md border-border bg-background font-semibold text-foreground hover:bg-muted"
          >
            Search
          </Button>
        </form>
      </section>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-muted/40 px-6 text-small text-muted-foreground">
          Loading…
        </div>
      ) : error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 p-6 text-center">
          <p role="alert" className="text-small font-medium text-foreground">
            {error}
          </p>
          <Button
            type="button"
            onClick={() => void loadCustomers(query)}
            className="h-9 rounded-md font-semibold"
          >
            Try again
          </Button>
        </div>
      ) : customers.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users aria-hidden className="size-6" />
          </span>
          <p className="text-h4 font-display">
            {query ? 'No matching customers' : 'No customers yet'}
          </p>
          <p className="max-w-sm text-small text-muted-foreground">
            {query
              ? 'Try another name or contact detail.'
              : 'Add your first customer and start tracking conversations.'}
          </p>
          {!query && (
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-1 h-11 rounded-md font-semibold"
            >
              Add your first customer
            </Button>
          )}
        </div>
      ) : (
        <div id="customers-directory" className="scroll-mt-24 grid gap-3 sm:grid-cols-2">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="group lift flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <Link
                href={`/dashboard/customers/${customer.id}`}
                className="flex min-w-0 flex-1 items-center gap-4"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-lg font-semibold text-primary">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {customer.name}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-caption font-medium text-muted-foreground">
                    {customer.company && <span>{customer.company}</span>}
                    {customer.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail aria-hidden className="size-3" />
                        {customer.email}
                      </span>
                    )}
                    {customer.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone aria-hidden className="size-3" />
                        {customer.phone}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
              <span className="flex shrink-0 items-center gap-1">
                {customer.phone &&
                  (() => {
                    const chat = waMeLink(customer.phone);
                    return chat ? (
                      <a
                        href={chat}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp ${customer.name}`}
                        className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted"
                      >
                        <MessagesSquare aria-hidden className="size-4" />
                      </a>
                    ) : null;
                  })()}
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-caption font-medium text-primary">
                  <Flame aria-hidden className="size-3" />
                  {customer.orderCount}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
