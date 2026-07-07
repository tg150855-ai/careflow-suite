import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, BedDouble, Pill, FlaskConical as Flask,
  Scissors, HeartPulse, FileBarChart, UserCog, Settings, LogOut,
  ChevronLeft, Heart, ChevronDown, Ambulance, ShieldCheck, Siren, MessageSquare,
  Briefcase, Clock, CalendarCheck, Wallet, Boxes, Truck, ShoppingCart, Landmark,
  BarChart3, Building2, ShieldAlert, Database,
  Video, Sparkles, FileText, Hash, Activity, CreditCard,
  Scan, Image as ImageIcon, Droplet,
  Network, Bug, AlertTriangle, ClipboardCheck,
  Lightbulb,
  Smartphone, TrendingUp, Files,
  Bot, Cpu, HeartHandshake, Home as HomeIcon, Mic,
  Send, Bell, Printer, Star,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { BRAND, BrandLogo, BrandMark } from "@/components/brand";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[] };
type NavGroup = { key: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[]; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    key: "clinical", label: "Clinical", icon: Stethoscope, items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/emergency", label: "Emergency", icon: Siren },
      { to: "/patients", label: "Patients", icon: Users },
      { to: "/opd", label: "OPD", icon: Stethoscope },
      { to: "/ipd", label: "IPD", icon: BedDouble },
      { to: "/billing-center", label: "Billing", icon: FileBarChart },
      { to: "/ot", label: "OT / Surgery", icon: Scissors },
      { to: "/nurse-station", label: "Nurse Station", icon: HeartPulse },
      { to: "/icu", label: "ICU / Critical Care", icon: HeartPulse },
    ],
  },
  {
    key: "operations", label: "Operations", icon: Activity, items: [
      { to: "/laboratory", label: "Laboratory", icon: Flask },
      { to: "/radiology", label: "Radiology", icon: Scan },
      { to: "/blood-bank", label: "Blood Bank", icon: Droplet },
      { to: "/dialysis", label: "Dialysis", icon: Activity },
      { to: "/ipd/beds", label: "Bed Management", icon: BedDouble },
      { to: "/ipd/death-register", label: "Death Register", icon: BedDouble },
      { to: "/ipd/birth-register", label: "Birth Register", icon: BedDouble },
      { to: "/ambulance", label: "Ambulance", icon: Ambulance },
      { to: "/assets", label: "Assets", icon: Boxes },
      { to: "/vendors", label: "Vendors", icon: Truck },
      { to: "/procurement", label: "Procurement", icon: ShoppingCart },
      { to: "/biomedical", label: "Biomedical", icon: Activity },
    ],
  },
  {
    key: "finance", label: "Finance", icon: Landmark, items: [
      { to: "/billing", label: "Billing", icon: FileBarChart },
      { to: "/pharmacy", label: "Pharmacy", icon: Pill },
      { to: "/insurance", label: "Insurance", icon: ShieldCheck },
      { to: "/finance", label: "Accounts", icon: Landmark },
      { to: "/reports", label: "Revenue Reports", icon: FileBarChart },
      { to: "/bi", label: "BI Dashboard", icon: BarChart3 },
    ],
  },
  {
    key: "hr", label: "HR", icon: Briefcase, items: [
      { to: "/hr/employees", label: "Employees", icon: Briefcase },
      { to: "/hr/attendance", label: "Attendance", icon: Clock },
      { to: "/hr/leave", label: "Leave Management", icon: CalendarCheck },
      { to: "/hr/payroll", label: "Payroll", icon: Wallet },
      { to: "/smart-staffing", label: "Shift / Staffing", icon: Users },
      { to: "/performance", label: "Performance", icon: BarChart3 },
    ],
  },
  {
    key: "admin", label: "Admin", icon: ShieldAlert, roles: ["admin","super_admin"], items: [
      { to: "/staff", label: "User Management", icon: UserCog },
      { to: "/authority", label: "Roles & Permissions", icon: ShieldCheck },
      { to: "/branches", label: "Branch Management", icon: Building2 },
      { to: "/settings", label: "Hospital Settings", icon: Settings },
      { to: "/backups", label: "Backup & Restore", icon: Database },
      { to: "/audit", label: "Audit Logs", icon: ShieldAlert },
      { to: "/audit-trail", label: "Audit Trail", icon: ClipboardCheck },
      { to: "/security-center", label: "Security Center", icon: ShieldAlert },
      { to: "/api-gateway", label: "API Gateway", icon: Network },
      { to: "/mobile-api", label: "Mobile API & Push", icon: Smartphone },
    ],
  },
];



const STORAGE_KEY = "medicore.sidebar.expanded";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [now] = useState(new Date());
  const { hasAnyRole, hasRole, profile, user, signOut, roles } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Force first-login password change
  useEffect(() => {
    if (profile && profile.password_changed === false && path !== "/change-password") {
      window.location.replace("/change-password");
    }
  }, [profile, path]);



  const visibleGroups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.some(hasRole)) }))
    .filter((g) => (!g.roles || g.roles.some(hasRole)) && g.items.length > 0);

  // auto-open group containing active route; persist user toggles
  const activeGroupKey = visibleGroups.find((g) => g.items.some((i) => path === i.to || path.startsWith(i.to + "/")))?.key;

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    if (activeGroupKey && !(activeGroupKey in expanded)) {
      setExpanded((e) => ({ ...e, [activeGroupKey]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupKey]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded)); } catch { /* noop */ }
  }, [expanded]);

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-screen flex bg-background overflow-hidden">
        {/* Sidebar */}
        <motion.aside
          animate={{ width: collapsed ? 76 : 264 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0 h-screen"
        >
          <div className="h-16 flex items-center justify-center gap-2 px-3 border-b border-sidebar-border shrink-0 bg-white">
            {collapsed ? (
              <BrandMark size={36} className="rounded-lg shrink-0" />
            ) : (
              <BrandLogo
                className="shrink-0"
                style={{ maxHeight: 48, maxWidth: 160, width: "auto", height: "auto", objectFit: "contain" }}
              />
            )}
          </div>

          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
            {visibleGroups.map((group) => {
              const isOpen = !!expanded[group.key];
              const hasActive = group.items.some((i) => path === i.to || path.startsWith(i.to + "/"));

              if (collapsed) {
                return (
                  <div key={group.key} className="py-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center justify-center h-10 rounded-xl ${hasActive ? "bg-sidebar-accent text-primary" : "text-muted-foreground"}`}>
                          <group.icon className="size-4.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="p-0">
                        <div className="min-w-[200px] py-1">
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</div>
                          {group.items.map((item) => {
                            const active = path === item.to || path.startsWith(item.to + "/");
                            return (
                              <Link key={item.to} to={item.to} className={`flex items-center gap-2 px-3 h-8 text-xs hover:bg-accent ${active ? "text-primary font-medium" : ""}`}>
                                <item.icon className="size-3.5" /> {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              }

              return (
                <div key={group.key}>
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    className={`w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all ${
                      hasActive
                        ? "bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                    }`}
                  >
                    <group.icon className={`size-4.5 shrink-0 ${hasActive ? "text-primary" : ""}`} />
                    <span className="truncate flex-1 text-left">{group.label}</span>
                    <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="ml-3 mt-0.5 mb-1 pl-3 border-l border-sidebar-border/70 space-y-0.5 py-0.5">
                          {group.items.map((item) => {
                            const active = path === item.to || path.startsWith(item.to + "/");
                            return (
                              <Link
                                key={item.to}
                                to={item.to}
                                className={`group flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] transition-all ${
                                  active
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-soft"
                                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                }`}
                              >
                                <item.icon className={`size-4 shrink-0 ${active ? "text-primary" : ""}`} />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="p-3 border-t border-sidebar-border shrink-0">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-9" onClick={() => setCollapsed(!collapsed)}>
              <ChevronLeft className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
              {!collapsed && <span className="text-xs">Collapse</span>}
            </Button>
          </div>
        </motion.aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <header className="h-16 border-b bg-surface/80 backdrop-blur shrink-0 flex items-center gap-4 px-6 z-30">
            <GlobalSearch />

            <div className="hidden lg:flex flex-col items-center text-center px-6 border-l border-r">
              <div className="text-sm font-semibold">{BRAND.name}</div>
              <div className="text-xs text-muted-foreground">{format(now, "EEEE, dd MMM yyyy")}</div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <NotificationBell />

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
            {hasAnyRole(["admin","doctor","receptionist","nurse","pharmacist","lab_tech","accountant","patient","super_admin","surgeon","insurance_officer","ot_coordinator","hr_manager","finance_manager","dept_head","procurement_officer"]) ? (
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
    </TooltipProvider>
  );
}
