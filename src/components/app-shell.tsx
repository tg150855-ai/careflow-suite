import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, BedDouble, Pill, FlaskConical as Flask,
  Scissors, HeartPulse, FileBarChart, UserCog, Settings, Bell, LogOut,
  ChevronLeft, Heart, ChevronDown, Ambulance, ShieldCheck, Siren, MessageSquare,
  Briefcase, Clock, CalendarCheck, Wallet, Boxes, Truck, ShoppingCart, Landmark,
  BarChart3, Building2, ShieldAlert, Database,
  Video, Sparkles, Send, UserCheck, FileText, Syringe, Package, Hash, Activity, CreditCard,
  Scan, Image as ImageIcon, Droplet, Wrench,
  Network, Globe, Bug, AlertTriangle, ClipboardCheck, FileSignature, Archive,
  History, Lightbulb, FlaskConical, Share2,
  MonitorSmartphone, Smartphone, TrendingUp, Files,
  Bot, Cpu, BookOpen, HeartHandshake, Home as HomeIcon, Mic,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[]; section?: string };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Clinical" },
  { to: "/emergency", label: "Emergency", icon: Siren, section: "Clinical" },
  { to: "/patients", label: "Patients", icon: Users, section: "Clinical" },
  { to: "/appointments", label: "Appointments", icon: CalendarDays, section: "Clinical" },
  { to: "/opd", label: "OPD", icon: Stethoscope, section: "Clinical" },
  { to: "/ipd", label: "IPD", icon: BedDouble, section: "Clinical" },
  { to: "/ot", label: "OT / Surgery", icon: Scissors, section: "Clinical" },
  { to: "/nurse-station", label: "Nurse Station", icon: HeartPulse, section: "Clinical" },
  { to: "/pharmacy", label: "Pharmacy", icon: Pill, section: "Clinical" },
  { to: "/laboratory", label: "Laboratory", icon: Flask, section: "Clinical" },
  { to: "/radiology", label: "Radiology", icon: Scan, section: "Clinical" },
  { to: "/pacs", label: "PACS / Imaging", icon: ImageIcon, section: "Clinical" },
  { to: "/blood-bank", label: "Blood Bank", icon: Droplet, section: "Clinical" },
  { to: "/dialysis", label: "Dialysis", icon: Activity, section: "Clinical" },
  { to: "/icu", label: "ICU / Critical Care", icon: HeartPulse, section: "Clinical" },
  { to: "/biomedical", label: "Biomedical", icon: Wrench, section: "Operations" },
  { to: "/billing", label: "Billing", icon: FileBarChart, section: "Finance" },
  { to: "/insurance", label: "Insurance", icon: ShieldCheck, section: "Finance" },
  { to: "/ambulance", label: "Ambulance", icon: Ambulance, section: "Operations" },
  { to: "/communications", label: "Communications", icon: MessageSquare, section: "Operations" },
  { to: "/hr/employees", label: "Employees", icon: Briefcase, section: "HR" },
  { to: "/hr/attendance", label: "Attendance", icon: Clock, section: "HR" },
  { to: "/hr/leave", label: "Leave", icon: CalendarCheck, section: "HR" },
  { to: "/hr/payroll", label: "Payroll", icon: Wallet, section: "HR" },
  { to: "/assets", label: "Assets", icon: Boxes, section: "Operations" },
  { to: "/vendors", label: "Vendors", icon: Truck, section: "Operations" },
  { to: "/procurement", label: "Procurement", icon: ShoppingCart, section: "Operations" },
  { to: "/finance", label: "Finance", icon: Landmark, section: "Finance" },
  { to: "/bi", label: "BI Dashboard", icon: BarChart3, section: "Admin" },
  { to: "/reports", label: "Reports", icon: FileBarChart, section: "Admin" },
  { to: "/branches", label: "Branches", icon: Building2, section: "Admin", roles: ["admin", "super_admin"] },
  { to: "/audit", label: "Audit & Compliance", icon: ShieldAlert, section: "Admin", roles: ["admin", "super_admin"] },
  { to: "/backups", label: "Backups", icon: Database, section: "Admin", roles: ["admin", "super_admin"] },
  { to: "/staff", label: "Staff", icon: UserCog, section: "Admin", roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings, section: "Admin", roles: ["admin"] },
  // Phase 6 — Digital Healthcare
  { to: "/command-center", label: "Command Center", icon: Activity, section: "Admin", roles: ["admin", "super_admin"] },
  { to: "/telemedicine", label: "Telemedicine", icon: Video, section: "Digital" },
  { to: "/ai-assistant", label: "AI Assistant", icon: Sparkles, section: "Digital" },
  { to: "/health-records", label: "Health Records", icon: FileText, section: "Digital" },
  { to: "/vaccinations", label: "Vaccinations", icon: Syringe, section: "Digital" },
  { to: "/health-packages", label: "Health Packages", icon: Package, section: "Digital" },
  { to: "/queue", label: "Queue Tokens", icon: Hash, section: "Digital" },
  { to: "/whatsapp", label: "WhatsApp Campaigns", icon: Send, section: "Digital" },
  { to: "/crm", label: "Patient CRM", icon: UserCheck, section: "Digital" },
  { to: "/payments-online", label: "Online Payments", icon: CreditCard, section: "Digital" },
  { to: "/patient-portal", label: "Patient Portal", icon: Heart, section: "Patient", roles: ["patient", "admin"] },
  // Phase 8 — Compliance & EMR
  { to: "/emr", label: "EMR Timeline", icon: FileText, section: "Compliance" },
  { to: "/ehr", label: "EHR Sharing", icon: Share2, section: "Compliance" },
  { to: "/hl7", label: "HL7 Engine", icon: Network, section: "Compliance" },
  { to: "/fhir", label: "FHIR Resources", icon: Globe, section: "Compliance" },
  { to: "/nabh", label: "NABH", icon: ShieldCheck, section: "Compliance" },
  { to: "/jci", label: "JCI", icon: Globe, section: "Compliance" },
  { to: "/quality", label: "Quality Dashboard", icon: Activity, section: "Compliance" },
  { to: "/infection-control", label: "Infection Control", icon: Bug, section: "Compliance" },
  { to: "/incidents", label: "Incidents & Risk", icon: AlertTriangle, section: "Compliance" },
  { to: "/patient-safety", label: "Patient Safety", icon: ShieldAlert, section: "Compliance" },
  { to: "/clinical-audits", label: "Clinical Audits", icon: ClipboardCheck, section: "Compliance" },
  { to: "/consents", label: "Consent Forms", icon: FileSignature, section: "Compliance" },
  { to: "/mrd", label: "MRD Archive", icon: Archive, section: "Compliance" },
  { to: "/regulatory", label: "Regulatory Reports", icon: FileBarChart, section: "Compliance" },
  { to: "/privacy", label: "Data Privacy", icon: ShieldCheck, section: "Compliance" },
  { to: "/audit-trail", label: "Audit Trail", icon: History, section: "Compliance" },
  { to: "/cdss", label: "Clinical Decision Support", icon: Lightbulb, section: "Compliance" },
  { to: "/research", label: "Research Studies", icon: FlaskConical, section: "Compliance" },
  { to: "/compliance-dashboard", label: "Compliance Overview", icon: ShieldCheck, section: "Compliance", roles: ["admin","super_admin"] },
  // Phase 9 — Advanced Hospital Capabilities
  { to: "/documents", label: "Documents", icon: Files, section: "Operations" },
  { to: "/kiosk", label: "Self Check-In", icon: MonitorSmartphone, section: "Operations" },
  { to: "/queue-display", label: "Queue Display", icon: Hash, section: "Operations" },
  { to: "/predictions", label: "Predictive Analytics", icon: TrendingUp, section: "Admin" },
  { to: "/mobile-api", label: "Mobile API & Push", icon: Smartphone, section: "Admin", roles: ["admin","super_admin"] },
  // Phase 10 — Smart Hospital OS
  { to: "/copilot", label: "Hospital Copilot", icon: Bot, section: "Smart OS" },
  { to: "/voice-hmis", label: "Voice HMIS", icon: Mic, section: "Smart OS" },
  { to: "/iot-devices", label: "IoT Devices", icon: Cpu, section: "Smart OS" },
  { to: "/forecast", label: "Forecast Engine", icon: TrendingUp, section: "Smart OS" },
  { to: "/smart-staffing", label: "Smart Staffing", icon: Users, section: "Smart OS" },
  { to: "/digital-twin", label: "Digital Twin", icon: Building2, section: "Smart OS" },
  { to: "/risk-detection", label: "Risk Detection", icon: ShieldAlert, section: "Smart OS" },
  { to: "/pharmacy-intel", label: "Pharmacy Intel", icon: Pill, section: "Smart OS" },
  { to: "/performance", label: "Performance KPIs", icon: BarChart3, section: "Smart OS" },
  { to: "/security-center", label: "Security Center", icon: ShieldAlert, section: "Smart OS", roles: ["admin","super_admin"] },
  { to: "/engagement", label: "Patient Engagement", icon: HeartHandshake, section: "Smart OS" },
  { to: "/remote-care", label: "Remote Care", icon: HomeIcon, section: "Smart OS" },
  { to: "/compliance-ai", label: "Compliance AI", icon: ShieldCheck, section: "Smart OS" },
  { to: "/recovery", label: "Disaster Recovery", icon: Database, section: "Smart OS", roles: ["admin","super_admin"] },
  { to: "/knowledge", label: "Knowledge Base", icon: BookOpen, section: "Smart OS" },
  { to: "/api-gateway", label: "API Gateway", icon: Network, section: "Smart OS", roles: ["admin","super_admin"] },
  { to: "/authority", label: "Authority & Workflow", icon: ShieldCheck, section: "Admin" },
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
          {Array.from(new Set(visible.map((v) => v.section ?? "Clinical"))).map((section) => (
            <div key={section} className="mb-2">
              {!collapsed && (
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {section}
                </div>
              )}
              {visible.filter((v) => (v.section ?? "Clinical") === section).map((item) => {
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
            </div>
          ))}
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
          <GlobalSearch />


          <div className="hidden lg:flex flex-col items-center text-center px-6 border-l border-r">
            <div className="text-sm font-semibold">MediCore General Hospital</div>
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
  );
}
