import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MonitorSmartphone, QrCode, UserSearch, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SimpleTable } from "@/components/simple-table";
import { supabase } from "@/integrations/supabase/client";
import { listRows } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kiosk")({ component: KioskPage });

function KioskPage() {
  const [uhid, setUhid] = useState("");
  const [patient, setPatient] = useState<any>(null);
  const [appts, setAppts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  async function load() { setSessions(await listRows("kiosk_sessions", { order: "created_at", limit: 20 })); }
  useEffect(() => { load(); }, []);

  async function lookup() {
    const sb = supabase as any;
    const { data: p } = await sb.from("patients").select("*").eq("uhid", uhid.trim()).maybeSingle();
    if (!p) { toast.error("Patient not found"); setPatient(null); setAppts([]); return; }
    setPatient(p);
    const today = new Date().toISOString().split("T")[0];
    const { data: a } = await sb.from("appointments").select("*").eq("patient_id", p.id)
      .gte("scheduled_at", today + "T00:00:00").lte("scheduled_at", today + "T23:59:59");
    setAppts(a ?? []);
  }

  async function checkIn(appointmentId: string) {
    try {
      const sb = supabase as any;
      await sb.from("kiosk_sessions").insert({ kiosk_id: "kiosk-01", patient_id: patient.id, appointment_id: appointmentId, check_in_method: "qr", status: "completed" });
      await sb.from("appointments").update({ status: "checked_in" }).eq("id", appointmentId);
      toast.success("Checked in successfully");
      lookup(); load();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader icon={MonitorSmartphone} title="Self Check-In Kiosk" subtitle="QR scan + UHID lookup + appointment check-in. Future-ready for physical kiosk deployment." />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserSearch className="size-5 text-primary" /> Patient Lookup</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2"><Input placeholder="UHID e.g. HMS-202612-000001" value={uhid} onChange={(e) => setUhid(e.target.value)} /><Button onClick={lookup}>Find</Button></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><QrCode className="size-4" /> Scan UHID QR code from patient card</div>
            {patient && (
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <div className="font-semibold">{patient.full_name}</div>
                <div className="text-xs text-muted-foreground">{patient.uhid} · {patient.mobile}</div>
                {appts.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">No appointments today.</div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {appts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded bg-background border">
                        <div className="text-sm">
                          <div>{new Date(a.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          <Badge variant="outline" className="mt-1">{a.status}</Badge>
                        </div>
                        <Button size="sm" onClick={() => checkIn(a.id)} disabled={a.status === "checked_in"}>
                          <CheckCircle2 className="size-4 mr-1" /> Check-in
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Check-Ins</CardTitle></CardHeader>
          <CardContent className="p-0">
            <SimpleTable rows={sessions} empty="No check-ins yet." columns={[
              { header: "Method", cell: (r) => r.check_in_method },
              { header: "Kiosk", cell: (r) => r.kiosk_id ?? "—" },
              { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
              { header: "Time", cell: (r) => new Date(r.created_at).toLocaleTimeString() },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
