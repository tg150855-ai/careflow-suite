import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ot")({ component: OTLayout });

const TABS = [
  { to: "/ot", label: "Dashboard", exact: true },
  { to: "/ot/schedule", label: "Schedule" },
  { to: "/ot/reports", label: "Reports" },
  { to: "/ot/settings", label: "Settings" },
];

function OTLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Scissors className="size-6 text-primary" /> OT / Surgery
          </h1>
          <p className="text-sm text-muted-foreground">Schedule, perform and bill surgical procedures.</p>
        </div>
        <nav className="flex gap-1 rounded-lg border bg-card p-1">
          {TABS.map((t) => {
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
