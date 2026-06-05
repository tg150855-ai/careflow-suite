import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Smartphone, Stethoscope, BarChart3, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SimpleTable } from "@/components/simple-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listRows, insertRow } from "@/lib/saas-crud";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mobile-api")({ component: MobilePage });

const ENDPOINTS = [
  { group: "Patient App", icon: Smartphone, items: [
    { m: "POST", p: "/api/public/mobile/auth/login", d: "Patient login (UHID + OTP)" },
    { m: "GET",  p: "/api/public/mobile/patient/appointments", d: "List appointments" },
    { m: "POST", p: "/api/public/mobile/patient/appointments", d: "Book appointment" },
    { m: "GET",  p: "/api/public/mobile/patient/prescriptions", d: "Prescriptions" },
    { m: "GET",  p: "/api/public/mobile/patient/lab-reports", d: "Lab reports" },
    { m: "GET",  p: "/api/public/mobile/patient/radiology", d: "Radiology reports" },
    { m: "POST", p: "/api/public/mobile/patient/payments", d: "Online payments" },
    { m: "GET",  p: "/api/public/mobile/patient/history", d: "Medical history" },
    { m: "GET",  p: "/api/public/mobile/telemedicine/sessions", d: "Telemedicine sessions" },
  ]},
  { group: "Doctor App", icon: Stethoscope, items: [
    { m: "GET",  p: "/api/public/mobile/doctor/appointments", d: "Today's appointments" },
    { m: "POST", p: "/api/public/mobile/doctor/opd/note", d: "Record consultation" },
    { m: "GET",  p: "/api/public/mobile/doctor/patient/{id}", d: "Patient history" },
    { m: "POST", p: "/api/public/mobile/doctor/prescriptions", d: "E-prescription" },
    { m: "GET",  p: "/api/public/mobile/doctor/notifications", d: "Push notifications" },
  ]},
  { group: "Executive App", icon: BarChart3, items: [
    { m: "GET", p: "/api/public/mobile/exec/kpis", d: "Revenue / admissions / occupancy / OPD / pending bills" },
    { m: "GET", p: "/api/public/mobile/exec/alerts", d: "Critical alerts" },
  ]},
];

function MobilePage() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ platform: "ios", app_role: "patient", device_token: "" });

  async function load() { setTokens(await listRows("mobile_device_tokens", { order: "last_active_at" })); }
  useEffect(() => { load(); }, []);

  async function register() {
    try { await insertRow("mobile_device_tokens", { ...f, user_id: user?.id }); toast.success("Token registered"); setOpen(false); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader icon={Smartphone} title="Mobile API & Push" subtitle="Endpoints powering Patient / Doctor / Executive mobile apps · device token registration"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Register Device</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register Push Token</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Platform</Label>
                  <Select value={f.platform} onValueChange={(v) => setF({ ...f, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ios">iOS</SelectItem><SelectItem value="android">Android</SelectItem><SelectItem value="web">Web</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>App Role</Label>
                  <Select value={f.app_role} onValueChange={(v) => setF({ ...f, app_role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="patient">Patient</SelectItem><SelectItem value="doctor">Doctor</SelectItem><SelectItem value="executive">Executive</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Device Token</Label><Input value={f.device_token} onChange={(e) => setF({ ...f, device_token: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={register} disabled={!f.device_token}>Register</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {ENDPOINTS.map((g) => (
          <Card key={g.group}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><g.icon className="size-5 text-primary" /> {g.group}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {g.items.map((it) => (
                <div key={it.p} className="text-xs space-y-1 pb-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={it.m === "GET" ? "secondary" : "default"} className="text-[10px] px-1.5 py-0">{it.m}</Badge>
                    <code className="text-[11px]">{it.p}</code>
                  </div>
                  <div className="text-muted-foreground">{it.d}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Registered Devices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <SimpleTable rows={tokens} empty="No devices registered yet." columns={[
            { header: "Platform", cell: (r) => <Badge variant="outline" className="uppercase">{r.platform}</Badge> },
            { header: "App", cell: (r) => r.app_role },
            { header: "Token", cell: (r) => <code className="text-xs">{r.device_token.slice(0, 24)}…</code> },
            { header: "Last Active", cell: (r) => new Date(r.last_active_at).toLocaleString() },
          ]} />
        </CardContent>
      </Card>
    </div>
  );
}
