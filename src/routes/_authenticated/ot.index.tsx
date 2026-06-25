import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Clock3, DoorOpen, Plus, Scissors, Siren, Zap } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

export const Route = createFileRoute("/_authenticated/ot/")({ component: OtDashboard });

function OtDashboard() {
  const fromISO = startOfDay(new Date()).toISOString();
  const toISO = endOfDay(new Date()).toISOString();

  const { data: today = [] } = useQuery({
    queryKey: ["ot-today", fromISO, toISO],
    queryFn: async () => (await (supabase as any).from("surgeries")
      .select("id, surgery_no, procedure_name, priority, status, scheduled_start, scheduled_end, ot_room_id, patients(full_name, uhid), ot_rooms(name)")
      .gte("scheduled_start", fromISO).lte("scheduled_start", toISO)
      .order("scheduled_start")).data ?? [],
  });

  const { data: all = [] } = useQuery({
    queryKey: ["ot-all-counts"],
    queryFn: async () => (await (supabase as any).from("surgeries").select("id, priority, status, scheduled_start")).data ?? [],
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["ot-rooms-active"],
    queryFn: async () => (await (supabase as any).from("ot_rooms").select("id, name").eq("active", true)).data ?? [],
  });

  const surgeriesToday = today.length;
  const planned = all.filter((s: any) => ["scheduled", "pre_op"].includes(s.status) && (s.priority === "planned" || s.priority === "elective")).length;
  const urgent = all.filter((s: any) => s.priority === "urgent" && s.status !== "completed" && s.status !== "cancelled").length;
  const emergency = all.filter((s: any) => s.priority === "emergency" && s.status !== "completed" && s.status !== "cancelled").length;
  const completed = all.filter((s: any) => s.status === "completed").length;
  const pending = all.filter((s: any) => ["scheduled", "pre_op", "in_progress", "recovery"].includes(s.status)).length;
  const inUse = today.filter((s: any) => ["in_progress", "pre_op", "recovery"].includes(s.status) && s.ot_room_id).length;
  const occupancyPct = rooms.length ? Math.round((Math.min(inUse, rooms.length) / rooms.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<CalendarClock className="size-5" />} label="Surgeries Today" value={surgeriesToday} />
        <Stat icon={<Activity className="size-5" />} label="Planned" value={planned} />
        <Stat icon={<Zap className="size-5" />} label="Urgent" value={urgent} tone="warn" />
        <Stat icon={<Siren className="size-5" />} label="Emergency" value={emergency} tone="danger" />
        <Stat icon={<CheckCircle2 className="size-5" />} label="Completed" value={completed} tone="success" />
        <Stat icon={<DoorOpen className="size-5" />} label="OT Occupancy" value={`${occupancyPct}%`} sub={`${inUse}/${rooms.length} rooms`} />
        <Stat icon={<Clock3 className="size-5" />} label="Pending" value={pending} />
        <Stat icon={<AlertTriangle className="size-5" />} label="Total OT Rooms" value={rooms.length} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild><Link to="/ot/schedule"><Plus className="size-4" /> Schedule Surgery</Link></Button>
          <Button asChild variant="outline"><Link to="/ot/schedule">Start Surgery</Link></Button>
          <Button asChild variant="outline"><Link to="/ot/schedule">Complete Surgery</Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Scissors className="size-4" /> Today's Surgeries</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Surgery No</TableHead><TableHead>Patient</TableHead><TableHead>Procedure</TableHead>
              <TableHead>OT Room</TableHead><TableHead>Time</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {today.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No surgeries scheduled for today</TableCell></TableRow>}
              {today.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.surgery_no}</TableCell>
                  <TableCell>{s.patients?.full_name} <span className="text-xs text-muted-foreground">{s.patients?.uhid}</span></TableCell>
                  <TableCell>{s.procedure_name}</TableCell>
                  <TableCell>{s.ot_rooms?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(s.scheduled_start), "HH:mm")}</TableCell>
                  <TableCell><PriorityBadge p={s.priority} /></TableCell>
                  <TableCell><StatusBadge s={s.status} /></TableCell>
                  <TableCell><Button asChild size="sm" variant="outline"><Link to="/ot/$id" params={{ id: s.id }}>Open</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "success" | "warn" | "danger" }) {
  const tones: Record<string, string> = { success: "bg-emerald-500/10 text-emerald-600", warn: "bg-amber-500/10 text-amber-600", danger: "bg-rose-500/10 text-rose-600" };
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`size-10 rounded-xl flex items-center justify-center ${tone ? tones[tone] : "bg-primary/10 text-primary"}`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold leading-tight">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </div>
    </CardContent></Card>
  );
}

export function PriorityBadge({ p }: { p: string }) {
  const v = p === "emergency" ? "destructive" : p === "urgent" ? "default" : "secondary";
  const label = p === "elective" ? "planned" : p;
  return <Badge variant={v as any} className="capitalize">{label}</Badge>;
}
export function StatusBadge({ s }: { s: string }) {
  return <Badge variant="outline" className="capitalize">{s.replace("_", " ")}</Badge>;
}
