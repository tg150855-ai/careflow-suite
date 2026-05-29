import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BedDouble } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/ipd/beds")({ component: BedMap });

const STATUS_COLORS: Record<string, string> = {
  available: "bg-success/10 text-success border-success/30",
  occupied: "bg-destructive/10 text-destructive border-destructive/30",
  cleaning: "bg-warning/10 text-warning-foreground border-warning/40",
  reserved: "bg-primary/10 text-primary border-primary/30",
  maintenance: "bg-muted text-muted-foreground border-muted-foreground/20",
};

function BedMap() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: wards = [] } = useQuery({
    queryKey: ["wards-with-beds"],
    queryFn: async () => {
      const { data: wards } = await supabase.from("wards").select("id, name, type, floor").order("name");
      const { data: beds } = await supabase.from("beds").select("id, ward_id, bed_number, status, charge_per_day").order("bed_number");
      const { data: adm } = await supabase
        .from("admissions")
        .select("id, bed_id, admitted_at, patients(full_name, uhid), doctors(name)")
        .eq("status", "active");
      const admByBed = Object.fromEntries((adm ?? []).map((a: any) => [a.bed_id, a]));
      return (wards ?? []).map((w) => ({
        ...w,
        beds: (beds ?? []).filter((b) => b.ward_id === w.id).map((b) => ({ ...b, admission: admByBed[b.id] ?? null })),
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("beds").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bed updated"); qc.invalidateQueries({ queryKey: ["wards-with-beds"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const stats = wards.flatMap((w: any) => w.beds).reduce((acc: any, b: any) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, { available: 0, occupied: 0, cleaning: 0, reserved: 0, maintenance: 0 });
  const total = wards.flatMap((w: any) => w.beds).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/ipd"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Bed map</h1>
          <p className="text-sm text-muted-foreground">Hospital-wide bed status and occupancy</p>
        </div>
        <Button asChild><Link to="/ipd/new">New admission</Link></Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "available", "occupied", "cleaning", "reserved"].map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" className="capitalize" onClick={() => setFilter(s)}>
            {s}{s !== "all" && <Badge variant="secondary" className="ml-2">{stats[s] ?? 0}</Badge>}
            {s === "all" && <Badge variant="secondary" className="ml-2">{total}</Badge>}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        {wards.map((w: any) => {
          const beds = filter === "all" ? w.beds : w.beds.filter((b: any) => b.status === filter);
          if (beds.length === 0) return null;
          return (
            <Card key={w.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold flex items-center gap-2"><BedDouble className="size-4" /> {w.name}</h2>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">{w.type.replace("_", " ")} · Floor {w.floor ?? "—"}</div>
                </div>
                <div className="text-xs text-muted-foreground">{w.beds.filter((b: any) => b.status === "occupied").length} / {w.beds.length} occupied</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {beds.map((b: any) => (
                  <DropdownMenu key={b.id}>
                    <DropdownMenuTrigger asChild>
                      <button className={`group rounded-xl border-2 p-3 text-left transition-all hover:shadow-soft ${STATUS_COLORS[b.status]}`}>
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-sm font-semibold">{b.bed_number}</div>
                          <span className="text-[10px] uppercase tracking-wider opacity-70">{b.status}</span>
                        </div>
                        {b.admission ? (
                          <div className="mt-2 space-y-0.5">
                            <div className="text-xs font-medium text-foreground truncate">{b.admission.patients?.full_name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">Dr. {b.admission.doctors?.name}</div>
                            <div className="text-[10px] text-muted-foreground">Day {differenceInDays(new Date(), new Date(b.admission.admitted_at)) + 1}</div>
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-muted-foreground">₹{Number(b.charge_per_day).toLocaleString()}/day</div>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {b.admission && <DropdownMenuItem asChild><Link to="/ipd/$id" params={{ id: b.admission.id }}>Open admission</Link></DropdownMenuItem>}
                      {!b.admission && (
                        <>
                          <DropdownMenuItem onClick={() => setStatus.mutate({ id: b.id, status: "available" })}>Mark available</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus.mutate({ id: b.id, status: "cleaning" })}>Mark cleaning</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus.mutate({ id: b.id, status: "reserved" })}>Mark reserved</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus.mutate({ id: b.id, status: "maintenance" })}>Maintenance</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
