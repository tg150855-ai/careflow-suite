import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, UserPlus, CalendarDays, Stethoscope, Receipt, FileBarChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const TABS: Tab[] = [
  { to: "/opd", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/opd/registration", label: "Registration", icon: UserPlus },
  { to: "/opd/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/opd/consultation", label: "Consultation", icon: Stethoscope },
  { to: "/opd/billing", label: "Billing", icon: Receipt },
  { to: "/opd/reports", label: "Reports", icon: FileBarChart },
  { to: "/opd/settings", label: "Settings", icon: Settings },
];

export function OpdSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="border-b border-border -mt-2 mb-4 overflow-x-auto">
      <nav className="flex gap-1 min-w-max">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
