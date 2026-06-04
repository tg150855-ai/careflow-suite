import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/nabh")({ component: NABHPage });

function NABHPage() {
  const [indicators, setIndicators] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [openI, setOpenI] = useState(false);
  const [openD, setOpenD] = useState(false);
  const [iForm, setIForm] = useState<any>({ indicator_code: "", name: "", category: "patient_safety", period_start: "", period_end: "", numerator: "", denominator: "", target: "" });
  const [dForm, setDForm] = useState<any>({ doc_type: "SOP", title: "", version: "1.0", department: "", effective_date: "", review_date: "", content: "" });

  const load = () => {
    (supabase.from("quality_indicators" as any) as any).select("*").order("period_end", { ascending: false }).then(({ data }: any) => setIndicators(data ?? []));
    (supabase.from("compliance_documents" as any) as any).select("*").order("effective_date", { ascending: false }).then(({ data }: any) => setDocs(data ?? []));
  };
  useEffect(() => { load(); }, []);

  const saveI = async () => {
    const num = parseFloat(iForm.numerator), den = parseFloat(iForm.denominator);
    const value = den > 0 ? +(num * 100 / den).toFixed(2) : null;
    const { error } = await (supabase.from("quality_indicators" as any) as any).insert({
      ...iForm, numerator: num, denominator: den, value, target: iForm.target ? parseFloat(iForm.target) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Indicator recorded"); setOpenI(false); load();
  };
  const saveD = async () => {
    const { error } = await (supabase.from("compliance_documents" as any) as any).insert(dForm);
    if (error) return toast.error(error.message);
    toast.success("Document saved"); setOpenD(false); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="size-6 text-primary" /> NABH Accreditation</h1>
        <p className="text-sm text-muted-foreground">Quality indicators, SOPs, policies & manuals.</p>
      </div>

      <Tabs defaultValue="qi">
        <TabsList><TabsTrigger value="qi">Quality Indicators</TabsTrigger><TabsTrigger value="docs">Documentation</TabsTrigger></TabsList>

        <TabsContent value="qi" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={openI} onOpenChange={setOpenI}>
              <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Record indicator</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Quality Indicator</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code</Label><Input value={iForm.indicator_code} onChange={(e) => setIForm({ ...iForm, indicator_code: e.target.value })} /></div>
                  <div><Label>Category</Label>
                    <Select value={iForm.category} onValueChange={(v) => setIForm({ ...iForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["patient_safety","clinical","infection","medication","surgical","readmission","satisfaction"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Name</Label><Input value={iForm.name} onChange={(e) => setIForm({ ...iForm, name: e.target.value })} /></div>
                  <div><Label>Period start</Label><Input type="date" value={iForm.period_start} onChange={(e) => setIForm({ ...iForm, period_start: e.target.value })} /></div>
                  <div><Label>Period end</Label><Input type="date" value={iForm.period_end} onChange={(e) => setIForm({ ...iForm, period_end: e.target.value })} /></div>
                  <div><Label>Numerator</Label><Input type="number" value={iForm.numerator} onChange={(e) => setIForm({ ...iForm, numerator: e.target.value })} /></div>
                  <div><Label>Denominator</Label><Input type="number" value={iForm.denominator} onChange={(e) => setIForm({ ...iForm, denominator: e.target.value })} /></div>
                  <div><Label>Target (%)</Label><Input type="number" value={iForm.target} onChange={(e) => setIForm({ ...iForm, target: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={saveI}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <SimpleTable
            rows={indicators}
            columns={[
              { header: "Code", cell: (r) => <code className="text-xs">{r.indicator_code}</code> },
              { header: "Indicator", cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground capitalize">{r.category?.replace(/_/g," ")}</div></div> },
              { header: "Period", cell: (r) => <span className="text-xs">{r.period_start} → {r.period_end}</span> },
              { header: "Value", cell: (r) => <Badge variant={r.target && r.value >= r.target ? "default" : "secondary"}>{r.value ?? "—"}%</Badge> },
              { header: "Target", cell: (r) => <span className="text-xs">{r.target ?? "—"}%</span> },
            ]}
          />
        </TabsContent>

        <TabsContent value="docs" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={openD} onOpenChange={setOpenD}>
              <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add document</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Compliance Document</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={dForm.doc_type} onValueChange={(v) => setDForm({ ...dForm, doc_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["SOP","Policy","Guideline","Manual","Form"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Version</Label><Input value={dForm.version} onChange={(e) => setDForm({ ...dForm, version: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Title</Label><Input value={dForm.title} onChange={(e) => setDForm({ ...dForm, title: e.target.value })} /></div>
                  <div><Label>Department</Label><Input value={dForm.department} onChange={(e) => setDForm({ ...dForm, department: e.target.value })} /></div>
                  <div><Label>Effective date</Label><Input type="date" value={dForm.effective_date} onChange={(e) => setDForm({ ...dForm, effective_date: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Content</Label><Textarea rows={5} value={dForm.content} onChange={(e) => setDForm({ ...dForm, content: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={saveD}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <SimpleTable
            rows={docs}
            columns={[
              { header: "Type", cell: (r) => <Badge variant="outline">{r.doc_type}</Badge> },
              { header: "Title", cell: (r) => <div><div className="font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.department}</div></div> },
              { header: "Version", cell: (r) => r.version },
              { header: "Effective", cell: (r) => <span className="text-xs">{r.effective_date ? format(new Date(r.effective_date), "dd MMM yyyy") : "—"}</span> },
              { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
