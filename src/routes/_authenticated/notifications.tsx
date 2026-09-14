import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CalendarClock, Phone, CalendarPlus, CheckCircle2, Clock,
  AlertTriangle, CalendarCheck, Search, Filter, ChevronRight,
  Stethoscope, FileText, Eye, CheckCheck, Loader2,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isBefore, isAfter, addDays, startOfDay, differenceInDays } from "date-fns";
import { toast } from "sonner";

/** Shared localStorage key — also used by NotificationBell */
export const FOLLOWUP_READ_KEY = "careflow.followup.read_ids";

export function getReadFollowUpIds(): Set<string> {
  try {
    const stored = localStorage.getItem(FOLLOWUP_READ_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* noop */ }
  return new Set();
}

export function saveReadFollowUpIds(ids: Set<string>) {
  try { localStorage.setItem(FOLLOWUP_READ_KEY, JSON.stringify([...ids])); } catch { /* noop */ }
}

export const Route = createFileRoute("/_authenticated/notifications")({ component: NotificationsPage });

/* ─────────── types ─────────── */
type Notif = {
  id: string; title: string; body: string | null; category: string;
  priority: string; link: string | null; read_at: string | null;
  created_at: string; reference_id: string | null; reference_type: string | null;
};

type FollowUp = {
  id: string; follow_up_date: string; diagnosis: string | null;
  chief_complaints: string | null; notes: string | null; created_at: string;
  patient_id: string;
  patients: { full_name: string; uhid: string; mobile: string | null } | null;
  doctors: { name: string } | null;
};

/* ─────────── main ─────────── */
function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("followups");

  /* ── All Notifications ── */
  const [catFilter, setCatFilter] = useState("all");
  const [prioFilter, setPrioFilter] = useState("all");

  const { data: notifications = [], isLoading: nLoading, refetch: refetchNotifs } = useQuery({
    queryKey: ["all-notifications"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,category,priority,link,read_at,created_at,reference_id,reference_type")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data as Notif[]) ?? [];
    },
  });

  // realtime
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif-page:${user.id}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => refetchNotifs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]); // eslint-disable-line

  const filteredNotifs = useMemo(() => {
    let items = notifications;
    if (catFilter !== "all") items = items.filter(n => n.category === catFilter);
    if (prioFilter !== "all") items = items.filter(n => n.priority === prioFilter);
    return items;
  }, [notifications, catFilter, prioFilter]);

  const categories = useMemo(() => [...new Set(notifications.map(n => n.category))], [notifications]);
  const unreadCount = notifications.filter(n => !n.read_at).length;

  async function markAllRead() {
    const ids = notifications.filter(n => !n.read_at).map(n => n.id);
    if (!ids.length) return;
    // Optimistic update
    qc.setQueryData(["all-notifications"], (prev: Notif[] | undefined) =>
      (prev ?? []).map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)
    );
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (error) { toast.error("Failed to mark as read"); refetchNotifs(); }
    else toast.success("All notifications marked as read");
  }

  async function markSingleRead(id: string) {
    // Optimistic update
    qc.setQueryData(["all-notifications"], (prev: Notif[] | undefined) =>
      (prev ?? []).map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to mark as read"); refetchNotifs(); }
  }

  /* ── Follow-up Reminders ── */
  const [fuSearch, setFuSearch] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadFollowUpIds());

  const markFollowUpRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev).add(id);
      saveReadFollowUpIds(next);
      return next;
    });
    toast.success("Marked as read");
  }, []);

  function markAllFollowUpsRead() {
    const allIds = [...grouped.today, ...grouped.upcoming, ...grouped.overdue].map(f => f.id);
    if (!allIds.length) return;
    setReadIds(prev => {
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      saveReadFollowUpIds(next);
      return next;
    });
    toast.success("All follow-ups marked as read");
  }

  const { data: followUps = [], isLoading: fuLoading } = useQuery({
    queryKey: ["followup-reminders"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("opd_visits")
        .select("id, follow_up_date, diagnosis, chief_complaints, notes, created_at, patient_id, patients(full_name, uhid, mobile), doctors(name)")
        .not("follow_up_date", "is", null)
        .order("follow_up_date", { ascending: true });
      return (data ?? []) as unknown as FollowUp[];
    },
  });

  const today = startOfDay(new Date());
  const next7 = addDays(today, 7);

  const grouped = useMemo(() => {
    let items = followUps;
    if (fuSearch.trim()) {
      const q = fuSearch.toLowerCase();
      items = items.filter(f =>
        f.patients?.full_name?.toLowerCase().includes(q) ||
        f.patients?.uhid?.toLowerCase().includes(q) ||
        f.doctors?.name?.toLowerCase().includes(q) ||
        f.diagnosis?.toLowerCase().includes(q)
      );
    }
    const overdue: FollowUp[] = [];
    const todayItems: FollowUp[] = [];
    const upcoming: FollowUp[] = [];

    for (const f of items) {
      if (readIds.has(f.id)) continue;
      const d = startOfDay(new Date(f.follow_up_date));
      if (isToday(d)) todayItems.push(f);
      else if (isBefore(d, today)) overdue.push(f);
      else if (isAfter(d, today) && !isAfter(d, next7)) upcoming.push(f);
    }

    // sort overdue: most overdue first
    overdue.sort((a, b) => new Date(a.follow_up_date).getTime() - new Date(b.follow_up_date).getTime());

    return { overdue, today: todayItems, upcoming };
  }, [followUps, fuSearch, readIds, today, next7]);

  const overdueCount = grouped.overdue.length;
  const todayCount = grouped.today.length;
  const totalFollowUp = overdueCount + todayCount + grouped.upcoming.length;

  /* ─────────── render ─────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="size-6 text-primary" />
            Notifications
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Stay updated with system alerts and patient follow-up reminders
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-11 p-1 bg-muted/60 backdrop-blur">
          <TabsTrigger value="followups" className="gap-2 data-[state=active]:shadow-md px-5">
            <CalendarClock className="size-4" />
            Follow-up Reminders
            {(overdueCount + todayCount) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                {overdueCount + todayCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2 data-[state=active]:shadow-md px-5">
            <Bell className="size-4" />
            All Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Follow-ups ─── */}
        <TabsContent value="followups" className="mt-6">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient, UHID, doctor, or diagnosis..."
                value={fuSearch}
                onChange={e => setFuSearch(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <Badge variant="outline" className="h-10 px-4 flex items-center gap-2 text-sm font-normal">
              <CalendarClock className="size-4" />
              {totalFollowUp} follow-up{totalFollowUp !== 1 ? "s" : ""} pending
            </Badge>
            <Button variant="outline" size="sm" onClick={markAllFollowUpsRead} disabled={!totalFollowUp} className="h-10 gap-2">
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          </div>

          {fuLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : totalFollowUp === 0 ? (
            <EmptyState
              icon={<CalendarCheck className="size-10" />}
              title="No follow-up reminders"
              description="All patient follow-ups are up to date. Great job!"
            />
          ) : (
            <div className="space-y-8">
              {/* Today */}
              {grouped.today.length > 0 && (
                <FollowUpSection
                  title="Today"
                  subtitle="Patients due for follow-up today"
                  icon={<Clock className="size-5" />}
                  color="warning"
                  items={grouped.today}
                  today={today}
                  onContact={markFollowUpRead}
                />
              )}

              {/* Upcoming */}
              {grouped.upcoming.length > 0 && (
                <FollowUpSection
                  title="Upcoming (7 days)"
                  subtitle="Patients with follow-ups in the next week"
                  icon={<CalendarClock className="size-5" />}
                  color="success"
                  items={grouped.upcoming}
                  today={today}
                  onContact={markFollowUpRead}
                />
              )}

              {/* Overdue */}
              {grouped.overdue.length > 0 && (
                <FollowUpSection
                  title="Overdue"
                  subtitle="These patients missed their follow-up date"
                  icon={<AlertTriangle className="size-5" />}
                  color="destructive"
                  items={grouped.overdue}
                  today={today}
                  onContact={markFollowUpRead}
                />
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab: All Notifications ─── */}
        <TabsContent value="all" className="mt-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-48 h-10">
                <Filter className="size-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={prioFilter} onValueChange={setPrioFilter}>
              <SelectTrigger className="w-48 h-10">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="sm:ml-auto">
              <Button variant="outline" size="sm" onClick={markAllRead} disabled={!unreadCount} className="h-10 gap-2">
                <CheckCheck className="size-4" />
                Mark all read ({unreadCount})
              </Button>
            </div>
          </div>

          {nLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotifs.length === 0 ? (
            <EmptyState
              icon={<Bell className="size-10" />}
              title="No notifications"
              description="You're all caught up — no notifications to show."
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {filteredNotifs.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                  >
                    <NotificationCard notif={n} onMarkRead={markSingleRead} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────── Follow-up Section ─────────── */
function FollowUpSection({
  title, subtitle, icon, color, items, today, onContact,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  color: "destructive" | "warning" | "success";
  items: FollowUp[]; today: Date; onContact: (id: string) => void;
}) {
  const borderColor = color === "destructive" ? "border-red-500" : color === "warning" ? "border-amber-500" : "border-emerald-500";
  const bgColor = color === "destructive" ? "bg-red-500/10" : color === "warning" ? "bg-amber-500/10" : "bg-emerald-500/10";
  const textColor = color === "destructive" ? "text-red-600" : color === "warning" ? "text-amber-600" : "text-emerald-600";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`size-9 rounded-lg ${bgColor} ${textColor} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            {title}
            <Badge variant="secondary" className="text-[11px]">{items.length}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {items.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <FollowUpCard item={f} today={today} borderColor={borderColor} onContact={onContact} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─────────── Follow-up Card ─────────── */
function FollowUpCard({
  item, today, borderColor, onContact,
}: {
  item: FollowUp; today: Date; borderColor: string; onContact: (id: string) => void;
}) {
  const fuDate = startOfDay(new Date(item.follow_up_date));
  const daysDiff = differenceInDays(fuDate, today);
  const isOverdue = daysDiff < 0;
  const isDueToday = daysDiff === 0;

  let timeLabel: string;
  if (isDueToday) timeLabel = "Due today";
  else if (isOverdue) timeLabel = `${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? "s" : ""} overdue`;
  else timeLabel = `In ${daysDiff} day${daysDiff > 1 ? "s" : ""}`;

  const mobile = item.patients?.mobile?.replace(/\D/g, "");

  return (
    <Card className={`border-l-4 ${borderColor} hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm`}>
      <CardContent className="p-4 space-y-3">
        {/* Patient info */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {(item.patients?.full_name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{item.patients?.full_name ?? "Unknown"}</div>
              <div className="text-[11px] text-muted-foreground">{item.patients?.uhid ?? "—"}</div>
            </div>
          </div>
          <Badge variant={isOverdue ? "destructive" : isDueToday ? "default" : "secondary"} className="text-[10px] shrink-0">
            {timeLabel}
          </Badge>
        </div>

        {/* Diagnosis / details */}
        <div className="space-y-1.5">
          {item.diagnosis && (
            <div className="flex items-start gap-1.5 text-xs">
              <FileText className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-muted-foreground line-clamp-2">{item.diagnosis}</span>
            </div>
          )}
          {item.doctors?.name && (
            <div className="flex items-center gap-1.5 text-xs">
              <Stethoscope className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Dr. {item.doctors.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <CalendarClock className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              Follow-up: {format(new Date(item.follow_up_date), "dd MMM yyyy")}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {mobile && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5 flex-1">
              <a href={`tel:+91${mobile}`}>
                <Phone className="size-3" /> Call
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5 flex-1">
            <Link to="/opd/appointments">
              <CalendarPlus className="size-3" /> Book
            </Link>
          </Button>
          <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={() => onContact(item.id)}>
            <CheckCircle2 className="size-3" /> Mark as read
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────── Notification Card ─────────── */
function NotificationCard({ notif, onMarkRead }: { notif: Notif; onMarkRead: (id: string) => void }) {
  const isUnread = !notif.read_at;
  const priorityStyle =
    notif.priority === "critical" ? "bg-red-500/15 text-red-600 border-red-200" :
    notif.priority === "high" ? "bg-amber-500/15 text-amber-600 border-amber-200" :
    "bg-muted text-muted-foreground border-transparent";

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${isUnread ? "bg-primary/[0.03] border-primary/20" : "bg-card/60"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Unread dot */}
          <div className="pt-1.5 shrink-0">
            {isUnread ? (
              <div className="size-2.5 rounded-full bg-primary animate-pulse" />
            ) : (
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium text-sm">{notif.title}</div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[10px] uppercase px-1.5 py-0 h-5 border ${priorityStyle}`}>
                  {notif.priority}
                </Badge>
              </div>
            </div>
            {notif.body && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.body}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{notif.category}</Badge>
              {isUnread && (
                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 ml-auto gap-1" onClick={() => onMarkRead(notif.id)}>
                  <Eye className="size-3" /> Mark read
                </Button>
              )}
              {notif.link && (
                <Button asChild variant="ghost" size="sm" className="h-6 text-[11px] px-2 gap-1">
                  <Link to={notif.link}>
                    View <ChevronRight className="size-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────── Empty State ─────────── */
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="size-20 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
    </motion.div>
  );
}
