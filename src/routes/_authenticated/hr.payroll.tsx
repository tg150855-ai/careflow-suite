import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Calculator, Play } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { SearchBox } from "@/components/common/search-box";
import { ModuleActionBar } from "@/components/common/action-bar";
import { exportXlsx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/payroll")({ component: Payroll });

function Payroll() {
  const { user } = useAuth();
  const [emps, setEmps] = useState<any[]>([]);
  const [structs, setStructs] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [slips, setSlips] = useState<any[]>([]);
  const [openStruct, setOpenStruct] = useState(false);
  const [openRun, setOpenRun] = useState(false);
  const now = new Date();
  const [structForm, setStructForm] = useState({ employee_id: "", basic: 0, hra: 0, da: 0, allowances: 0, pf: 0, esi: 0, professional_tax: 0, other_deductions: 0 });
  const [runForm, setRunForm] = useState({ period_month: now.getMonth() + 1, period_year: now.getFullYear() });

  async function load() {
    const [{ data: e }, { data: s }, { data: r }, { data: sl }] = await Promise.all([
      (supabase as any).from("employees").select("id,employee_no,full_name,department").eq("status", "active").order("full_name"),
      (supabase as any).from("salary_structures").select("*"),
      (supabase as any).from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      (supabase as any).from("salary_slips").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setEmps(e ?? []); setStructs(s ?? []); setRuns(r ?? []); setSlips(sl ?? []);
  }
  useEffect(() => { load(); }, []);

  async function saveStruct() {
    if (!structForm.employee_id) return toast.error("Select employee");
    const { error } = await (supabase as any).from("salary_structures").upsert(structForm as any, { onConflict: "employee_id" });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpenStruct(false);
    load();
  }

  async function runPayroll() {
    const { data: structRows } = await (supabase as any).from("salary_structures").select("*, employees(full_name)");
    if (!structRows || structRows.length === 0) return toast.error("No salary structures defined");

    const { data: runIns, error: runErr } = await (supabase as any).from("payroll_runs").insert({ period_month: runForm.period_month, period_year: runForm.period_year, status: "processed", processed_by: user?.id, processed_at: new Date().toISOString() } as any).select().single();
    if (runErr) return toast.error(runErr.message);

    let totalGross = 0, totalDed = 0, totalNet = 0;
    const slipRows = structRows.map((s: any) => {
      const gross = +s.basic + +s.hra + +s.da + +s.allowances;
      const ded = +s.pf + +s.esi + +s.professional_tax + +s.other_deductions;
      const net = gross - ded;
      totalGross += gross; totalDed += ded; totalNet += net;
      return { payroll_run_id: runIns.id, employee_id: s.employee_id, basic: s.basic, hra: s.hra, da: s.da, allowances: s.allowances, gross, pf: s.pf, esi: s.esi, professional_tax: s.professional_tax, other_deductions: s.other_deductions, total_deductions: ded, net_pay: net, present_days: 30 };
    });
    await (supabase as any).from("salary_slips").insert(slipRows as any);
    await (supabase as any).from("payroll_runs").update({ total_gross: totalGross, total_deductions: totalDed, total_net: totalNet } as any).eq("id", runIns.id);
    toast.success(`Processed ${slipRows.length} salary slips`);
    setOpenRun(false);
    load();
  }

  const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Wallet className="size-6 text-primary" /> Payroll</h1>
          <p className="text-sm text-muted-foreground">Salary structures, monthly runs, and slips.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openStruct} onOpenChange={setOpenStruct}>
            <DialogTrigger asChild><Button variant="outline"><Calculator className="size-4" /> Salary Structure</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Set Salary Structure</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Employee</Label>
                  <select className="w-full border rounded-md h-9 px-2 text-sm" value={structForm.employee_id} onChange={(e) => setStructForm({ ...structForm, employee_id: e.target.value })}>
                    <option value="">Select</option>
                    {emps.map((e) => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["basic", "hra", "da", "allowances", "pf", "esi", "professional_tax", "other_deductions"].map((k) => (
                    <div key={k}><Label className="capitalize">{k.replace("_", " ")}</Label><Input type="number" value={(structForm as any)[k]} onChange={(e) => setStructForm({ ...structForm, [k]: Number(e.target.value) } as any)} /></div>
                  ))}
                </div>
              </div>
              <DialogFooter><Button onClick={saveStruct}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={openRun} onOpenChange={setOpenRun}>
            <DialogTrigger asChild><Button><Play className="size-4" /> Run Payroll</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Process Monthly Payroll</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Month</Label><Input type="number" min={1} max={12} value={runForm.period_month} onChange={(e) => setRunForm({ ...runForm, period_month: Number(e.target.value) })} /></div>
                <div><Label>Year</Label><Input type="number" value={runForm.period_year} onChange={(e) => setRunForm({ ...runForm, period_year: Number(e.target.value) })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Generates slips for all employees with a salary structure.</p>
              <DialogFooter><Button onClick={runPayroll}>Process</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="runs">
        <TabsList><TabsTrigger value="runs">Payroll Runs</TabsTrigger><TabsTrigger value="slips">Salary Slips</TabsTrigger><TabsTrigger value="structures">Structures ({structs.length})</TabsTrigger></TabsList>
        <TabsContent value="runs">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead>Net Pay</TableHead><TableHead>Status</TableHead><TableHead>Processed</TableHead></TableRow></TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{format(new Date(r.period_year, r.period_month - 1), "MMMM yyyy")}</TableCell>
                    <TableCell>{fmtINR(r.total_gross)}</TableCell>
                    <TableCell>{fmtINR(r.total_deductions)}</TableCell>
                    <TableCell className="font-semibold text-emerald-600">{fmtINR(r.total_net)}</TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.processed_at ? format(new Date(r.processed_at), "dd MMM HH:mm") : "—"}</TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payroll runs yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="slips">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead>Net Pay</TableHead></TableRow></TableHeader>
              <TableBody>
                {slips.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{empMap[s.employee_id]?.full_name ?? "—"}</TableCell>
                    <TableCell>{fmtINR(s.gross)}</TableCell>
                    <TableCell>{fmtINR(s.total_deductions)}</TableCell>
                    <TableCell className="font-semibold text-emerald-600">{fmtINR(s.net_pay)}</TableCell>
                  </TableRow>
                ))}
                {slips.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No slips</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="structures">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Basic</TableHead><TableHead>HRA</TableHead><TableHead>DA</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead></TableRow></TableHeader>
              <TableBody>
                {structs.map((s) => {
                  const gross = +s.basic + +s.hra + +s.da + +s.allowances;
                  const ded = +s.pf + +s.esi + +s.professional_tax + +s.other_deductions;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{empMap[s.employee_id]?.full_name ?? "—"}</TableCell>
                      <TableCell>{fmtINR(s.basic)}</TableCell>
                      <TableCell>{fmtINR(s.hra)}</TableCell>
                      <TableCell>{fmtINR(s.da)}</TableCell>
                      <TableCell>{fmtINR(ded)}</TableCell>
                      <TableCell className="font-semibold">{fmtINR(gross - ded)}</TableCell>
                    </TableRow>
                  );
                })}
                {structs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No structures defined</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
