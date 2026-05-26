import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, BedDouble, Pill, FlaskConical,
  Scissors, HeartPulse, FileBarChart, UserCog, Settings, Search, Bell, LogOut,
  ChevronLeft, Heart, ChevronDown,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/opd", label: "OPD", icon: Stethoscope },
  { to: "/ipd", label: "IPD", icon: BedDouble },
  { to: "/pharmacy", label: "Pharmacy", icon: Pill },
  { to: "/laboratory", label: "Laboratory", icon: FlaskConical },
  { to: "/ot", label: "OT / Surgery", icon: Scissors },
  { to: "/nurse-station", label: "Nurse Station", icon: HeartPulse },
  { to: "/billing", label: "Billing", icon: FileBarChart },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/staff", label: "Staff", icon: UserCog, roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [now] = useState(new Date());
  const { hasAnyRole, hasRole, profile, user, signOut, roles } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const visible = NAV.filter((n) => !n.roles || n.roles.some(hasRole));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 256 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0"
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Heart className="size-4.5" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="font-semibold leading-tight">MediCore</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">HMIS</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {visible.map((item) => {
            const active = path === item.to || path.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-soft"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className={`size-4.5 shrink-0 ${active ? "text-primary" : ""}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-9" onClick={() => setCollapsed(!collapsed)}>
            <ChevronLeft className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span className="text-xs">Collapse</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-surface/80 backdrop-blur sticky top-0 z-30 flex items-center gap-4 px-6">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search patients, doctors, bills..." className="pl-9 h-10 bg-surface-muted border-transparent focus-visible:bg-surface" />
          </div>

          <div className="hidden lg:flex flex-col items-center text-center px-6 border-l border-r">
            <div className="text-sm font-semibold">MediCore General Hospital</div>
            <div className="text-xs text-muted-foreground">{format(now, "EEEE, dd MMM yyyy")}</div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5" />
              <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-3 h-10">
                  <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                    {(profile?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left leading-tight">
                    <div className="text-xs font-medium truncate max-w-[140px]">{profile?.full_name ?? user?.email}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{roles[0]?.replace("_"," ") ?? "no role"}</div>
                  </div>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{profile?.full_name ?? user?.email}</div>
                  <div className="text-xs text-muted-foreground font-normal">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roles.length > 0 ? (
                  <div className="px-2 py-1.5 flex flex-wrap gap-1">
                    {roles.map((r) => <Badge key={r} variant="secondary" className="capitalize">{r.replace("_", " ")}</Badge>)}
                  </div>
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No role assigned. Contact admin.</div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {hasAnyRole(["admin","doctor","receptionist","nurse","pharmacist","lab_tech","accountant"]) ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="p-6 lg:p-8 max-w-[1600px] mx-auto"
              key={path}
            >
              {children}
            </motion.div>
          ) : (
            <div className="p-12 max-w-xl mx-auto text-center">
              <div className="size-14 rounded-2xl bg-warning/15 text-warning-foreground flex items-center justify-center mx-auto mb-4">
                <HeartPulse className="size-7" />
              </div>
              <h2 className="text-xl font-semibold">Awaiting role assignment</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Your account exists but no role has been assigned yet. Ask an administrator to grant you access.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
