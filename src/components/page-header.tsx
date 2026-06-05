import type { ReactNode } from "react";

export function PageHeader({ icon: Icon, title, subtitle, actions }: { icon?: any; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          {Icon && <Icon className="size-6 text-primary" />} {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
