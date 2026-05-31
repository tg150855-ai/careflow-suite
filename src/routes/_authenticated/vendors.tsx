import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors")({ component: Vendors });

const CATS = ["Medicines", "Equipment", "Laboratory Supplies", "Consumables", "Services", "Other"];

function Vendors() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Medicines", gst_number: "", contact_person: "", phone: "", email: "", address: "", payment_terms: "Net 30" });

  async function load() {
    const { data } = await (supabase as any).from("vendors").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.name) return toast.error("Name required");
    const { error } = await (supabase as any).from("vendors").insert(form as any);
    if (error) return toast.error(error.message);
    toast.success("Vendor added"); setOpen(false);
    setForm({ name: "", category: "Medicines", gst_number: "", contact_person: "", phone: "", email: "", address: "", payment_terms: "Net 30" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Truck className="size-6 text-primary" /> Vendor Management</h1>
          <p className="text-sm text-muted-foreground">Suppliers, contracts, and contacts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Add Vendor</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Vendor</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>GST Number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Payment Terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Vendors ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>GST</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell className="font-mono text-xs">{r.gst_number ?? "—"}</TableCell>
                  <TableCell>{r.contact_person ?? "—"}</TableCell>
                  <TableCell>{r.phone ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No vendors yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
