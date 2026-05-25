import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/opd")({ component: OPDQueue });

function OPDQueue() {
  const today = new Date(); today.setHours(0,0,0,0);
  const { data: queue = [] } = useQuery({
    queryKey: ["opd-queue"],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("id, scheduled_at, status, patients(full_name, uhid), doctors(name, specialization)")
        .gte("scheduled_at", today.toISOString())
        .in("status", ["checked_in", "waiting", "booked"])
        .order("scheduled_at").limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">OPD Queue</h1>
        <p className="text-muted-foreground mt-1">Patients waiting for consultation today.</p>
      </div>

      <Card>
        {queue.length === 0 ? (
          <div className="p-16 text-center">
            <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Stethoscope className="size-5 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">No patients in queue. Book or check in appointments first.</p>
            <Button asChild className="mt-4"><Link to="/appointments">Go to appointments</Link></Button>
          </div>
        ) : (
          <div className="divide-y">
            {queue.map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 p-4 hover:bg-surface-muted transition-colors">
                <div className="w-16 text-center shrink-0">
                  <div className="text-lg font-semibold tabular-nums">{format(new Date(a.scheduled_at), "HH:mm")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.patients?.uhid} · {a.doctors?.name} ({a.doctors?.specialization})</div>
                </div>
                <Button asChild size="sm"><Link to="/opd/$appointmentId" params={{ appointmentId: a.id }}>Start consultation</Link></Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
