import { Bell, CalendarClock, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow, startOfDay } from "date-fns";
import { toast } from "sonner";
import { getReadFollowUpIds, saveReadFollowUpIds, FOLLOWUP_READ_KEY } from "@/routes/_authenticated/notifications";

type Notif = { id: string; title: string; body: string | null; category: string; priority: string; link: string | null; read_at: string | null; created_at: string };

export function NotificationBell() {
  const { user, roles } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [followUpTotal, setFollowUpTotal] = useState(0);
  const [followUpReadCount, setFollowUpReadCount] = useState(0);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,category,priority,link,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notif[]) ?? []);
  }

  async function loadFollowUpCount() {
    if (!user) return;
    const today = startOfDay(new Date());
    const { data } = await supabase
      .from("opd_visits")
      .select("id, follow_up_date")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", today.toISOString().split("T")[0]);
    const allIds = (data ?? []).map((d: any) => d.id);
    const readIds = getReadFollowUpIds();
    const unreadCount = allIds.filter((id: string) => !readIds.has(id)).length;
    setFollowUpTotal(allIds.length);
    setFollowUpReadCount(allIds.length - unreadCount);
  }

  useEffect(() => {
    if (!user?.id) return;
    load();
    loadFollowUpCount();
    const ch = supabase
      .channel(`notif:${user.id}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();

    // Listen for localStorage changes from the notifications page
    function onStorage(e: StorageEvent) {
      if (e.key === FOLLOWUP_READ_KEY) loadFollowUpCount();
    }
    window.addEventListener("storage", onStorage);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roles.join(",")]);

  // Re-check follow-up count when popover opens (catches same-tab localStorage writes)
  useEffect(() => {
    if (open) loadFollowUpCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const unread = items.filter((n) => !n.read_at).length;
  const followUpCount = followUpTotal - followUpReadCount;
  const totalBadge = unread + followUpCount;

  // Mark ALL notifications as read — optimistic
  async function markAll(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (!ids.length) return;
    setItems(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n));
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (error) { toast.error("Failed to mark as read"); load(); }
    else toast.success("All notifications marked as read");
  }

  // Mark SINGLE notification as read — optimistic
  async function markOne(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to mark as read"); load(); }
  }

  // Mark ALL follow-ups as read
  function markAllFollowUpsRead(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Load all current IDs from DB and mark them all
    supabase
      .from("opd_visits")
      .select("id")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", startOfDay(new Date()).toISOString().split("T")[0])
      .then(({ data }) => {
        const readIds = getReadFollowUpIds();
        (data ?? []).forEach((d: any) => readIds.add(d.id));
        saveReadFollowUpIds(readIds);
        setFollowUpReadCount(followUpTotal);
        toast.success("All follow-ups marked as read");
      });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {totalBadge > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" onPointerDownOutside={() => setOpen(false)} onFocusOutside={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          <button
            type="button"
            disabled={!unread}
            className="text-xs h-7 px-2 rounded-md hover:bg-accent disabled:opacity-50 disabled:pointer-events-none font-medium transition-colors"
            onClick={markAll}
          >
            Mark all read
          </button>
        </div>

        {/* Follow-up reminder banner */}
        {followUpCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b">
            <Link to="/notifications" onClick={() => setOpen(false)} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="size-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <CalendarClock className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {followUpCount} follow-up{followUpCount > 1 ? "s" : ""} due
                </div>
                <div className="text-[10px] text-amber-600/70 dark:text-amber-500/70">
                  Patients overdue or due today
                </div>
              </div>
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium text-amber-700 hover:bg-amber-200/60 dark:text-amber-400 dark:hover:bg-amber-900/40 transition-colors shrink-0"
              onClick={markAllFollowUpsRead}
            >
              <Check className="size-3" /> Read
            </button>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto divide-y">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>}
          {items.map((n) => (
            <div key={n.id} className={`px-4 py-3 transition-colors ${!n.read_at ? "bg-accent/40" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">{n.title}</div>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded shrink-0 ${n.priority === "critical" ? "bg-destructive/15 text-destructive" : n.priority === "high" ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                  {n.priority}
                </span>
              </div>
              {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
              <div className="flex items-center justify-between mt-1.5">
                <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })} · {n.category}</div>
                {!n.read_at && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    onClick={(e) => markOne(e, n.id)}
                  >
                    <Check className="size-3" /> Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* View All link */}
        <div className="border-t px-4 py-2.5">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-full h-8 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
