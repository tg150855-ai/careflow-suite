import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Play, Check, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NS_QK, PRIORITIES, ORDER_STATUS, loadActiveAdmissions } from "./shared";

export function NSOrders() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: admissions = [] } = useQuery({ queryKey: NS_QK.admissions, queryFn: loadActiveAdmissions });
  const { data: doctors = [] } = useQuery({ queryKey: NS_QK.doctors, queryFn: async () => (await supabase.from("doctors").select("id, name").eq("active", true)).data ?? [] });

  const [admissionId, setAdmissionId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [priority, setPriority] = useState("routine");
  const [orderText, setOrderText] = useState("");
  const [filter, setFilter] = useState("active");

  const { data: rows = [] } = useQuery({
    queryKey: ["ns-orders-rows", filter],
    queryFn: async () => {
      let q: any = (supabase as any).from("doctor_orders").select("*, admissions(patient_id, patients(full_name, uhid)), doctors(name)").order("created_at", { ascending: false }).limit(200);
      if (filter === "active") q = q.neq("status", "completed");
      else if (filter !== "all") q = q.eq("status", filter);
      return (await q).data ?? [];
    },
    refetchInterval: 60000,
  });

  const add = async () => {
    if (!admissionId || !orderText.trim()) { toast.error("Patient and order text required"); return; }
    const adm = admissions.find((a: any) => a.id === admissionId);
    const { error } = await (supabase as any).from("doctor_orders").insert({
      admission_id: admissionId, patient_id: adm?.patient_id, doctor_id: doctorId || adm?.doctor_id,
      order_text: orderText, priority, status: "pending", created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Order added"); setOrderText("");
    qc.invalidateQueries({ queryKey: ["ns-orders-rows"] });
  };

  const setStatus = async (id: string, status: string) => {
    const payload: any = { status };
    if (status === "completed") { payload.completed_at = new Date().toISOString(); payload.completed_by = user?.id; }
    const { error } = await (supabase as any).from("doctor_orders").update(payload).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(status); qc.invalidateQueries({ queryKey: ["ns-orders-rows"] }); }
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="font-semibold">Add doctor order</div>
        <div className="grid md:grid-cols-4 gap-2">
          <Select value={admissionId} onValueChange={setAdmissionId}>
            <SelectTrigger><SelectValue placeholder="Patient" /></SelectTrigger>
            <SelectContent>{admissions.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.patients?.full_name} · {a.beds?.bed_number}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger><SelectValue placeholder="Doctor (optional)" /></SelectTrigger>
            <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={add}><Plus className="size-4 mr-1" /> Add</Button>
        </div>
        <Input placeholder="Order details (e.g. ECG STAT, NPO after midnight)" value={orderText} onChange={(e) => setOrderText(e.target.value)} />
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex justify-between mb-3 items-center">
          <div className="font-semibold">Orders</div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active (not completed)</SelectItem>
              {ORDER_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Patient</TableHead><TableHead>Doctor</TableHead><TableHead>Priority</TableHead><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No orders</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), "dd MMM HH:mm")}</TableCell>
                <TableCell className="text-xs">{r.admissions?.patients?.full_name}</TableCell>
                <TableCell className="text-xs">{r.doctors?.name ?? "—"}</TableCell>
                <TableCell><Badge variant={r.priority === "stat" ? "destructive" : r.priority === "urgent" ? "default" : "secondary"} className="capitalize">{r.priority}</Badge></TableCell>
                <TableCell className="text-xs max-w-sm">{r.order_text}</TableCell>
                <TableCell><Badge variant={r.status === "completed" ? "default" : "outline"} className="capitalize">{r.status.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-right">
                  {r.status === "pending" && <Button variant="ghost" size="icon" onClick={() => setStatus(r.id, "in_progress")} title="Start"><Play className="size-4 text-blue-600" /></Button>}
                  {r.status !== "completed" && <Button variant="ghost" size="icon" onClick={() => setStatus(r.id, "completed")} title="Complete"><Check className="size-4 text-green-600" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
