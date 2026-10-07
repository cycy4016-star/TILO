// Tilo app code.

import type { HTMLAttributes, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function DashboardCard({
  title,
  description,
  action,
  children,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <Card className={cn('border-border shadow-sm', className)} {...props}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
        <div className="grid gap-1">
          <CardTitle className="font-display text-h4">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-small">{description}</CardDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
