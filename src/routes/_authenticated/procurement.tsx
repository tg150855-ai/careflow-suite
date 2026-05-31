import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Plus, FileText, Package, Check, X } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/procurement")({ component: Procurement });

function Procurement() {
  const { user, hasAnyRole } = useAuth();
  const canApprove = hasAnyRole(["admin", "procurement_officer", "super_admin"]);
  const [prs, setPrs] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [openPr, setOpenPr] = useState(false);
  const [openPo, setOpenPo] = useState(false);
  const [openGrn, setOpenGrn] = useState(false);
  const [prForm, setPrForm] = useState({ department: "", item_name: "", quantity: 1, unit: "pcs", estimated_cost: 0, priority: "normal", notes: "" });
  const [poForm, setPoForm] = useState({ vendor_id: "", pr_id: "", expected_delivery: "", item_name: "", quantity: 1, rate: 0, tax_percent: 18, notes: "" });
  const [grnForm, setGrnForm] = useState({ po_id: "", received_quantity: 0, damaged_quantity: 0, accepted: true, notes: "" });

  async function load() {
    const [a, b, c, d] = await Promise.all([
      (supabase as any).from("purchase_requests").select("*").order("created_at", { ascending: false }).limit(100),
      (supabase as any).from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(100),
      (supabase as any).from("goods_receipts").select("*").order("received_at", { ascending: false }).limit(100),
      (supabase as any).from("vendors").select("id,name").eq("active", true),
    ]);
    setPrs(a.data ?? []); setPos(b.data ?? []); setGrns(c.data ?? []); setVendors(d.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function createPr() {
    if (!prForm.item_name) return toast.error("Item required");
    const { error } = await (supabase as any).from("purchase_requests").insert({ ...prForm, requested_by: user?.id } as any);
    if (error) return toast.error(error.message);
    toast.success("Request raised"); setOpenPr(false);
    setPrForm({ department: "", item_name: "", quantity: 1, unit: "pcs", estimated_cost: 0, priority: "normal", notes: "" });
    load();
  }

  async function decidePr(id: string, status: "approved" | "rejected") {
    await (supabase as any).from("purchase_requests").update({ status, approved_by: user?.id, approved_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(status);
    load();
  }

  async function createPo() {
    if (!poForm.vendor_id || !poForm.item_name) return toast.error("Vendor & item required");
    const amount = poForm.quantity * poForm.rate;
    const tax = amount * poForm.tax_percent / 100;
    const { data: po, error } = await (supabase as any).from("purchase_orders").insert({ vendor_id: poForm.vendor_id, pr_id: poForm.pr_id || null, expected_delivery: poForm.expected_delivery || null, subtotal: amount, tax, total: amount + tax, status: "issued", notes: poForm.notes, created_by: user?.id } as any).select().single();
    if (error) return toast.error(error.message);
    await (supabase as any).from("purchase_order_items").insert({ po_id: po.id, item_name: poForm.item_name, quantity: poForm.quantity, rate: poForm.rate, tax_percent: poForm.tax_percent, amount: amount + tax } as any);
    toast.success("Purchase order issued"); setOpenPo(false);
    setPoForm({ vendor_id: "", pr_id: "", expected_delivery: "", item_name: "", quantity: 1, rate: 0, tax_percent: 18, notes: "" });
    load();
  }

  async function createGrn() {
    if (!grnForm.po_id) return toast.error("Select PO");
    const { error } = await (supabase as any).from("goods_receipts").insert({ ...grnForm, received_by: user?.id } as any);
    if (error) return toast.error(error.message);
    await (supabase as any).from("purchase_orders").update({ status: "received" } as any).eq("id", grnForm.po_id);
    toast.success("GRN recorded"); setOpenGrn(false);
    setGrnForm({ po_id: "", received_quantity: 0, damaged_quantity: 0, accepted: true, notes: "" });
    load();
  }

  const vMap = Object.fromEntries(vendors.map((v) => [v.id, v]));
  const pending = prs.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ShoppingCart className="size-6 text-primary" /> Procurement</h1>
          <p className="text-sm text-muted-foreground">{pending} pending request{pending !== 1 ? "s" : ""} • {pos.length} PO{pos.length !== 1 ? "s" : ""}.</p>
        </div>
      </div>

      <Tabs defaultValue="pr">
        <TabsList>
          <TabsTrigger value="pr"><FileText className="size-3 mr-1" /> Requests ({prs.length})</TabsTrigger>
          <TabsTrigger value="po"><ShoppingCart className="size-3 mr-1" /> Purchase Orders ({pos.length})</TabsTrigger>
          <TabsTrigger value="grn"><Package className="size-3 mr-1" /> Goods Receipt ({grns.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pr">
          <Card>
            <CardHeader className="flex flex-row justify-between"><CardTitle>Purchase Requests</CardTitle>
              <Dialog open={openPr} onOpenChange={setOpenPr}>
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New Request</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Raise Purchase Request</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Department</Label><Input value={prForm.department} onChange={(e) => setPrForm({ ...prForm, department: e.target.value })} /></div>
                    <div><Label>Item</Label><Input value={prForm.item_name} onChange={(e) => setPrForm({ ...prForm, item_name: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Qty</Label><Input type="number" value={prForm.quantity} onChange={(e) => setPrForm({ ...prForm, quantity: Number(e.target.value) })} /></div>
                      <div><Label>Unit</Label><Input value={prForm.unit} onChange={(e) => setPrForm({ ...prForm, unit: e.target.value })} /></div>
                      <div><Label>Est. Cost</Label><Input type="number" value={prForm.estimated_cost} onChange={(e) => setPrForm({ ...prForm, estimated_cost: Number(e.target.value) })} /></div>
                    </div>
                    <div><Label>Priority</Label>
                      <Select value={prForm.priority} onValueChange={(v) => setPrForm({ ...prForm, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Notes</Label><Textarea value={prForm.notes} onChange={(e) => setPrForm({ ...prForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={createPr}>Submit</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>PR No</TableHead><TableHead>Department</TableHead><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Est. Cost</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {prs.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.pr_no}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell className="font-medium">{p.item_name}</TableCell>
                      <TableCell>{p.quantity} {p.unit}</TableCell>
                      <TableCell>{fmtINR(p.estimated_cost)}</TableCell>
                      <TableCell><Badge variant={p.priority === "urgent" ? "destructive" : "outline"}>{p.priority}</Badge></TableCell>
                      <TableCell><Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>{p.status}</Badge></TableCell>
                      <TableCell>{canApprove && p.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => decidePr(p.id, "approved")}><Check className="size-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => decidePr(p.id, "rejected")}><X className="size-3" /></Button>
                        </div>
                      )}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="po">
          <Card>
            <CardHeader className="flex flex-row justify-between"><CardTitle>Purchase Orders</CardTitle>
              <Dialog open={openPo} onOpenChange={setOpenPo}>
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New PO</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Vendor</Label>
                      <Select value={poForm.vendor_id} onValueChange={(v) => setPoForm({ ...poForm, vendor_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Linked PR (optional)</Label>
                      <Select value={poForm.pr_id} onValueChange={(v) => setPoForm({ ...poForm, pr_id: v })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>{prs.filter((p) => p.status === "approved").map((p) => <SelectItem key={p.id} value={p.id}>{p.pr_no} — {p.item_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Item</Label><Input value={poForm.item_name} onChange={(e) => setPoForm({ ...poForm, item_name: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Qty</Label><Input type="number" value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })} /></div>
                      <div><Label>Rate</Label><Input type="number" value={poForm.rate} onChange={(e) => setPoForm({ ...poForm, rate: Number(e.target.value) })} /></div>
                      <div><Label>Tax %</Label><Input type="number" value={poForm.tax_percent} onChange={(e) => setPoForm({ ...poForm, tax_percent: Number(e.target.value) })} /></div>
                    </div>
                    <div><Label>Expected Delivery</Label><Input type="date" value={poForm.expected_delivery} onChange={(e) => setPoForm({ ...poForm, expected_delivery: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={createPo}>Issue PO</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>PO No</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.po_no}</TableCell>
                      <TableCell className="font-medium">{vMap[p.vendor_id]?.name ?? "—"}</TableCell>
                      <TableCell>{format(new Date(p.order_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{fmtINR(p.total)}</TableCell>
                      <TableCell><Badge>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grn">
          <Card>
            <CardHeader className="flex flex-row justify-between"><CardTitle>Goods Receipt Notes</CardTitle>
              <Dialog open={openGrn} onOpenChange={setOpenGrn}>
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Record GRN</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Goods Receipt</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Purchase Order</Label>
                      <Select value={grnForm.po_id} onValueChange={(v) => setGrnForm({ ...grnForm, po_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{pos.filter((p) => p.status === "issued").map((p) => <SelectItem key={p.id} value={p.id}>{p.po_no} — {vMap[p.vendor_id]?.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Received Qty</Label><Input type="number" value={grnForm.received_quantity} onChange={(e) => setGrnForm({ ...grnForm, received_quantity: Number(e.target.value) })} /></div>
                      <div><Label>Damaged Qty</Label><Input type="number" value={grnForm.damaged_quantity} onChange={(e) => setGrnForm({ ...grnForm, damaged_quantity: Number(e.target.value) })} /></div>
                    </div>
                    <div><Label>Notes</Label><Textarea value={grnForm.notes} onChange={(e) => setGrnForm({ ...grnForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={createGrn}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>GRN No</TableHead><TableHead>Received</TableHead><TableHead>Damaged</TableHead><TableHead>Accepted</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {grns.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-mono text-xs">{g.grn_no}</TableCell>
                      <TableCell>{g.received_quantity}</TableCell>
                      <TableCell className="text-rose-600">{g.damaged_quantity}</TableCell>
                      <TableCell><Badge variant={g.accepted ? "default" : "destructive"}>{g.accepted ? "Yes" : "No"}</Badge></TableCell>
                      <TableCell>{format(new Date(g.received_at), "dd MMM HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
