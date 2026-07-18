import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Package } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { RecordActions } from "@/components/common/record-actions";

export const Route = createFileRoute("/_authenticated/billing/packages")({ component: PackagesPage });

type Pkg = {
  id?: string;
  name: string;
  category: string | null;
  price: number;
  duration_days: number | null;
  description: string | null;
  includes: string[];
  active: boolean;
};

const EMPTY: Pkg = { name: "", category: "", price: 0, duration_days: null, description: "", includes: [], active: true };

function PackagesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Pkg>(EMPTY);

  const { data: packages = [] } = useQuery({
    queryKey: ["health-packages-all"],
    queryFn: async () => {
      const { data } = await supabase.from("health_packages").select("*").order("name");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return packages;
    return packages.filter((p: any) =>
      [p.name, p.category, p.description].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(term))
    );
  }, [packages, q]);

  const save = useMutation({
    mutationFn: async (p: Pkg) => {
      const payload = {
        name: p.name.trim(),
        category: p.category?.trim() || null,
        price: Number(p.price),
        duration_days: p.duration_days ? Number(p.duration_days) : null,
        description: p.description?.trim() || null,
        includes: p.includes.filter(Boolean),
        active: p.active,
      };
      if (!payload.name) throw new Error("Name is required");
      if (p.id) {
        const { error } = await supabase.from("health_packages").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("health_packages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Package updated" : "Package created");
      setOpen(false); setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["health-packages-all"] });
      qc.invalidateQueries({ queryKey: ["health-packages-active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("health_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Package deleted");
      qc.invalidateQueries({ queryKey: ["health-packages-all"] });
      qc.invalidateQueries({ queryKey: ["health-packages-active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setForm({ ...EMPTY, includes: [""] }); setOpen(true); }
  function openEdit(p: any) {
    setForm({
      id: p.id, name: p.name, category: p.category ?? "", price: Number(p.price),
      duration_days: p.duration_days, description: p.description ?? "",
      includes: Array.isArray(p.includes) ? p.includes.map(String) : [],
      active: !!p.active,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon"><Link to="/billing"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Health Packages</h1>
          <p className="text-sm text-muted-foreground">Manage bundled service packages used in OPD/IPD billing</p>
        </div>
        <Button onClick={openNew}><Plus className="size-4 mr-2" />New package</Button>
      </div>

      <Card className="p-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search packages by name, category…" className="max-w-md" />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p: any) => (
          <Card key={p.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  <h3 className="font-semibold truncate">{p.name}</h3>
                </div>
                {p.category && <div className="text-xs text-muted-foreground mt-1">{p.category}</div>}
              </div>
              <Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-semibold tabular-nums">{inr(p.price)}</div>
              {p.duration_days ? <div className="text-xs text-muted-foreground">{p.duration_days} days</div> : null}
            </div>
            {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
            {Array.isArray(p.includes) && p.includes.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                {p.includes.slice(0, 4).map((i: string, idx: number) => <li key={idx} className="truncate">{i}</li>)}
                {p.includes.length > 4 && <li>+{p.includes.length - 4} more</li>}
              </ul>
            )}
            <div className="pt-2 border-t">
              <RecordActions
                onEdit={() => openEdit(p)}
                onDelete={() => del.mutate(p.id)}
                deleteLabel={`package "${p.name}"`}
              />
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground col-span-full">No packages yet.</Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Category</Label><Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Cardiac, Preventive" /></div>
              <div className="space-y-1"><Label>Price (₹) *</Label><Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-1"><Label>Duration (days)</Label><Input type="number" min={0} value={form.duration_days ?? ""} onChange={(e) => setForm({ ...form, duration_days: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Includes (one per line)</Label>
              <Textarea rows={4} value={form.includes.join("\n")} onChange={(e) => setForm({ ...form, includes: e.target.value.split("\n") })} placeholder="ECG&#10;Chest X-ray&#10;CBC" />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Label className="cursor-pointer">Active</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
