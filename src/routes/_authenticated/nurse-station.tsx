import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeartPulse, Pill, AlertCircle, ClipboardList } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nurse-station")({ component: NurseStation });

function NurseStation() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["nurse-station"],
    queryFn: async () => {
      const { data: adm } = await supabase
        .from("admissions")
        .select("id, admission_no, patients(full_name, uhid), beds(bed_number), wards(name, type), doctors(name)")
        .eq("status", "active")
        .order("admitted_at", { ascending: false });

      const ids = (adm ?? []).map((a) => a.id);
      const next4h = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

      const { data: due } = ids.length
        ? await supabase
            .from("medication_administration")
            .select("id, admission_id, medicine_name, dosage, route, scheduled_at, status")
            .in("admission_id", ids)
            .eq("status", "scheduled")
            .lte("scheduled_at", next4h)
            .order("scheduled_at")
        : { data: [] as any[] };

      const byAdm: Record<string, any[]> = {};
      (due ?? []).forEach((d: any) => { (byAdm[d.admission_id] ||= []).push(d); });

      const overdue = (due ?? []).filter((d: any) => new Date(d.scheduled_at) < new Date());

      return { admissions: adm ?? [], dueByAdm: byAdm, dueCount: (due ?? []).length, overdueCount: overdue.length };
    },
    refetchInterval: 60000,
  });

  const giveMed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medication_administration").update({
        status: "administered", administered_at: new Date().toISOString(), administered_by: user?.id ?? null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dose given"); qc.invalidateQueries({ queryKey: ["nurse-station"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const cards = [
    { label: "Active patients", value: data?.admissions.length ?? 0, icon: HeartPulse, tone: "primary" },
    { label: "Medicines due (4h)", value: data?.dueCount ?? 0, icon: Pill, tone: "primary" },
    { label: "Overdue", value: data?.overdueCount ?? 0, icon: AlertCircle, tone: "destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Nurse station</h1>
        <p className="text-muted-foreground mt-1">Medicines, vitals and shift tasks for active patients</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-6">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4"><c.icon className="size-5" /></div>
            <div className="text-2xl font-semibold tracking-tight">{c.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><ClipboardList className="size-4" /> Active patients & due medicines</h2>
        <div className="space-y-3">
          {(data?.admissions ?? []).map((a: any) => {
            const due = data?.dueByAdm[a.id] ?? [];
            return (
              <Card key={a.id} className="p-4 shadow-none border">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                  <div>
                    <Link to="/ipd/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.patients?.full_name}</Link>
                    <div className="text-xs text-muted-foreground">{a.patients?.uhid} · {a.wards?.name} / {a.beds?.bed_number} · Dr. {a.doctors?.name}</div>
                  </div>
                  <Badge variant={due.length > 0 ? "default" : "secondary"}>{due.length} due</Badge>
                </div>
                {due.length > 0 && (
                  <div className="border-t pt-2 mt-2 space-y-1.5">
                    {due.map((d: any) => {
                      const minutes = differenceInMinutes(new Date(d.scheduled_at), new Date());
                      const overdue = minutes < 0;
                      return (
                        <div key={d.id} className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg ${overdue ? "bg-destructive/5" : ""}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {overdue && <AlertCircle className="size-3.5 text-destructive shrink-0" />}
                            <div className="text-sm truncate"><span className="font-medium">{d.medicine_name}</span> {d.dosage && <span className="text-muted-foreground">· {d.dosage}</span>} <span className="text-muted-foreground">· {d.route}</span></div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className={`text-xs tabular-nums ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{format(new Date(d.scheduled_at), "HH:mm")}</div>
                            <Button size="sm" variant="outline" onClick={() => giveMed.mutate(d.id)} disabled={giveMed.isPending}>Given</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          {(data?.admissions ?? []).length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No active in-patients.</div>}
        </div>
      </Card>
    </div>
  );
}
