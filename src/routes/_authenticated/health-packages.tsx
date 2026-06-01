import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Package, Plus, Check } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/health-packages")({ component: PkgPage });

function PkgPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "general", price: "", description: "", includes: "", active: true });

  async function load() {
    const { data } = await supabase.from("health_packages").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.name || !form.price) return toast.error("Name and price required");
    const includesArr = form.includes.split("\n").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("health_packages").insert({
      name: form.name, category: form.category, price: parseFloat(form.price),
      description: form.description, includes: includesArr as any, active: form.active,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Package added"); setOpen(false);
    setForm({ name: "", category: "general", price: "", description: "", includes: "", active: true }); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Package className="size-6 text-primary" /> Health Packages</h1>
          <p className="text-sm text-muted-foreground">Preventive checkups: full body, diabetes, heart, executive.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add Package</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Health Package</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div><Label>Includes (one per line)</Label><Textarea value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} rows={4} placeholder="CBC&#10;Lipid Profile&#10;ECG" /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full text-center text-muted-foreground py-10">No packages yet</div>}
        {rows.map((p) => (
          <Card key={p.id} className="hover:shadow-md transition">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
              </div>
              {p.category && <div className="text-xs text-muted-foreground capitalize">{p.category}</div>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold text-primary">{inr(p.price)}</div>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              {Array.isArray(p.includes) && p.includes.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {(p.includes as string[]).map((i, idx) => (
                    <li key={idx} className="flex items-center gap-2"><Check className="size-3.5 text-success shrink-0" /> {i}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
