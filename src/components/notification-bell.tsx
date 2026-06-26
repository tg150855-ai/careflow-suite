import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";

type Notif = { id: string; title: string; body: string | null; category: string; priority: string; link: string | null; read_at: string | null; created_at: string };

export function NotificationBell() {
  const { user, roles } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,category,priority,link,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notif[]) ?? []);
  }

  useEffect(() => {
    if (!user?.id) return;
    load();
    // Unique channel name per mount avoids "cannot add callbacks after subscribe" on remount.
    const ch = supabase
      .channel(`notif:${user.id}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roles.join(",")]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markAll() {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    load();
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={markAll} disabled={!unread}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>}
          {items.map((n) => (
            <div key={n.id} className={`px-4 py-3 ${!n.read_at ? "bg-accent/40" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">{n.title}</div>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${n.priority === "critical" ? "bg-destructive/15 text-destructive" : n.priority === "high" ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                  {n.priority}
                </span>
              </div>
              {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })} · {n.category}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
