import React from 'react';
import { type BreadcrumbItemData } from '@/components/PageBreadcrumb';
import { cn } from '@/lib/utils';

interface PageShellProps {
  breadcrumbs?: BreadcrumbItemData[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function PageShell({
  breadcrumbs: _breadcrumbs,
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn('p-4 sm:p-6 lg:p-8 space-y-4', className)}>
      {/* Header — stacks on mobile, side-by-side on sm+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold font-heading truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
