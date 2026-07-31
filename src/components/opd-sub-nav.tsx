import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, UserPlus, CalendarDays, Stethoscope, Receipt, FileBarChart, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Tab = { to: string; labelKey: string; icon: typeof LayoutDashboard; exact?: boolean };
const TABS: Tab[] = [
  { to: "/opd", labelKey: "opd.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/opd/registration", labelKey: "opd.registration", icon: UserPlus },
  { to: "/opd/appointments", labelKey: "opd.appointments", icon: CalendarDays },
  { to: "/opd/consultation", labelKey: "opd.consultation", icon: Stethoscope },
  { to: "/opd/billing", labelKey: "opd.billing", icon: Receipt },
  { to: "/opd/reports", labelKey: "opd.reports", icon: FileBarChart },
  { to: "/opd/settings", labelKey: "opd.settings", icon: Settings },
];

export function OpdSubNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="border-b border-border -mt-2 mb-4 overflow-x-auto">
      <nav className="flex gap-1 min-w-max">
        {TABS.map((t2) => {
          const active = t2.exact ? pathname === t2.to : pathname.startsWith(t2.to);
          const Icon = t2.icon;

          return (
            <Link
              key={t2.to}
              to={t2.to}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="size-4" />
              {t(t2.labelKey)}

            </Link>
          );
        })}
      </nav>
    </div>
  );
}
