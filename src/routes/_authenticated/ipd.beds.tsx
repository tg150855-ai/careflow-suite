import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, BedDouble, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/ipd/beds")({ component: BedMap });

type WardType = "icu" | "general" | "semi_private" | "private" | "emergency";
const WARD_TYPES: { value: WardType; label: string }[] = [
  { value: "emergency", label: "Emergency" },
  { value: "general", label: "General Ward" },
  { value: "semi_private", label: "Semi-Private" },
  { value: "private", label: "Private" },
  { value: "icu", label: "ICU" },
];

const STATUS_COLORS: Record<string, string> = {
  available: "bg-success/10 text-success border-success/30",
  occupied: "bg-destructive/10 text-destructive border-destructive/30",
  cleaning: "bg-warning/10 text-warning-foreground border-warning/40",
  reserved: "bg-primary/10 text-primary border-primary/30",
  maintenance: "bg-muted text-muted-foreground border-muted-foreground/20",
};

function BedMap() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "super_admin"]);
  const [filter, setFilter] = useState<string>("all");

  const { data: wards = [] } = useQuery({
    queryKey: ["wards-with-beds"],
    queryFn: async () => {
      const { data: wards } = await supabase
        .from("wards")
        .select("id, name, type, floor, description")
        .order("name");
      const { data: beds } = await supabase
        .from("beds")
        .select("id, ward_id, bed_number, status, charge_per_day")
        .order("bed_number");
      const { data: adm } = await supabase
        .from("admissions")
        .select("id, bed_id, admitted_at, patients(full_name, uhid), doctors(name)")
        .eq("status", "active");
      const admByBed = Object.fromEntries((adm ?? []).map((a: any) => [a.bed_id, a]));
      return (wards ?? []).map((w) => ({
        ...w,
        beds: (beds ?? [])
          .filter((b) => b.ward_id === w.id)
          .map((b) => ({ ...b, admission: admByBed[b.id] ?? null })),
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("beds").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bed updated");
      qc.invalidateQueries({ queryKey: ["wards-with-beds"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeBed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("beds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bed removed");
      qc.invalidateQueries({ queryKey: ["wards-with-beds"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeWard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ward removed");
      qc.invalidateQueries({ queryKey: ["wards-with-beds"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allBeds = wards.flatMap((w: any) => w.beds);
  const stats = allBeds.reduce(
    (acc: any, b: any) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    },
    { available: 0, occupied: 0, cleaning: 0, reserved: 0, maintenance: 0 },
  );
  const total = allBeds.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon">
          <Link to="/ipd">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Bed map</h1>
          <p className="text-sm text-muted-foreground">
            Hospital-wide bed status and occupancy
          </p>
        </div>
        {canManage && <AddWardDialog />}
        <Button asChild>
          <Link to="/ipd/new">New admission</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "available", "occupied", "cleaning", "reserved", "maintenance"].map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            className="capitalize"
            onClick={() => setFilter(s)}
          >
            {s}
            <Badge variant="secondary" className="ml-2">
              {s === "all" ? total : (stats[s] ?? 0)}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        {wards.map((w: any) => {
          const beds = filter === "all" ? w.beds : w.beds.filter((b: any) => b.status === filter);
          return (
            <Card key={w.id} className="p-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    <BedDouble className="size-4" /> {w.name}
                  </h2>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">
                    {WARD_TYPES.find((t) => t.value === w.type)?.label ?? w.type} · Floor{" "}
                    {w.floor ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {w.beds.filter((b: any) => b.status === "occupied").length} / {w.beds.length}{" "}
                    occupied
                  </div>
                  {canManage && (
                    <>
                      <AddBedDialog wardId={w.id} wardName={w.name} />
                      <EditWardDialog ward={w} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Delete ward"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete ward "{w.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the ward and all{" "}
                              <b>{w.beds.length}</b> beds in it. Wards with active admissions
                              cannot be deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => removeWard.mutate(w.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
              {beds.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No beds in this ward.
                  {canManage && (
                    <span>
                      {" "}
                      Use <b>Add bed</b> above to configure capacity.
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {beds.map((b: any) => (
                    <div key={b.id} className="relative">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`group w-full rounded-xl border-2 p-3 text-left transition-all hover:shadow-soft ${STATUS_COLORS[b.status]}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-mono text-sm font-semibold">{b.bed_number}</div>
                              <span className="text-[10px] uppercase tracking-wider opacity-70">
                                {b.status}
                              </span>
                            </div>
                            {b.admission ? (
                              <div className="mt-2 space-y-0.5">
                                <div className="text-xs font-medium text-foreground truncate">
                                  {b.admission.patients?.full_name}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  Dr. {b.admission.doctors?.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Day{" "}
                                  {differenceInDays(new Date(), new Date(b.admission.admitted_at)) +
                                    1}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-[10px] text-muted-foreground">
                                ₹{Number(b.charge_per_day).toLocaleString()}/day
                              </div>
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {b.admission && (
                            <DropdownMenuItem asChild>
                              <Link to="/ipd/$id" params={{ id: b.admission.id }}>
                                Open admission
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {!b.admission && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  setStatus.mutate({ id: b.id, status: "available" })
                                }
                              >
                                Mark available
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setStatus.mutate({ id: b.id, status: "cleaning" })}
                              >
                                Mark cleaning
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setStatus.mutate({ id: b.id, status: "reserved" })}
                              >
                                Mark reserved
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setStatus.mutate({ id: b.id, status: "maintenance" })
                                }
                              >
                                Maintenance
                              </DropdownMenuItem>
                            </>
                          )}
                          {canManage && !b.admission && (
                            <>
                              <EditBedMenuItem bed={b} />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  if (
                                    confirm(`Delete bed ${b.bed_number}? This cannot be undone.`)
                                  )
                                    removeBed.mutate(b.id);
                                }}
                              >
                                <Trash2 className="size-4 mr-2" /> Remove bed
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {wards.length === 0 && (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            No wards configured yet. {canManage && "Click 'Add ward' to create your first ward."}
          </Card>
        )}
      </div>
    </div>
  );
}

// ===== Dialogs =====

function AddWardDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<WardType>("general");
  const [floor, setFloor] = useState("");
  const [description, setDescription] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Ward name is required");
      const { error } = await supabase.from("wards").insert({
        name: name.trim(),
        type,
        floor: floor.trim() || null,
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ward added");
      qc.invalidateQueries({ queryKey: ["wards-with-beds"] });
      setOpen(false);
      setName("");
      setFloor("");
      setDescription("");
      setType("general");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4 mr-2" /> Add ward
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add ward</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. General Ward A"
            />
          </div>
          <div className="space-y-1">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as WardType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Floor</Label>
            <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="1, 2…" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save ward"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditWardDialog({ ward }: { ward: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(ward.name);
  const [type, setType] = useState<WardType>(ward.type);
  const [floor, setFloor] = useState(ward.floor ?? "");
  const [description, setDescription] = useState(ward.description ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("wards")
        .update({
          name: name.trim(),
          type,
          floor: floor.trim() || null,
          description: description.trim() || null,
        })
        .eq("id", ward.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ward updated");
      qc.invalidateQueries({ queryKey: ["wards-with-beds"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit ward">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit ward</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as WardType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Floor</Label>
            <Input value={floor} onChange={(e) => setFloor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddBedDialog({ wardId, wardName }: { wardId: string; wardName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [bedNumber, setBedNumber] = useState("");
  const [prefix, setPrefix] = useState("B-");
  const [startNum, setStartNum] = useState(1);
  const [count, setCount] = useState(10);
  const [pad, setPad] = useState(2);
  const [charge, setCharge] = useState(0);

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "single") {
        if (!bedNumber.trim()) throw new Error("Bed number is required");
        const { error } = await supabase.from("beds").insert({
          ward_id: wardId,
          bed_number: bedNumber.trim(),
          charge_per_day: charge,
        });
        if (error) throw error;
      } else {
        if (count <= 0 || count > 500) throw new Error("Enter 1–500 beds");
        const rows = Array.from({ length: count }, (_, i) => ({
          ward_id: wardId,
          bed_number: `${prefix}${String(startNum + i).padStart(pad, "0")}`,
          charge_per_day: charge,
        }));
        const { error } = await supabase.from("beds").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "single" ? "Bed added" : `${count} beds added`);
      qc.invalidateQueries({ queryKey: ["wards-with-beds"] });
      setOpen(false);
      setBedNumber("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4 mr-2" /> Add bed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add bed to {wardName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("single")}
            >
              Single bed
            </Button>
            <Button
              variant={mode === "bulk" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("bulk")}
            >
              Bulk add
            </Button>
          </div>

          {mode === "single" ? (
            <div className="space-y-1">
              <Label>Bed number *</Label>
              <Input
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                placeholder="e.g. B-01"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prefix</Label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Start number</Label>
                <Input
                  type="number"
                  min={1}
                  value={startNum}
                  onChange={(e) => setStartNum(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Number padding</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={pad}
                  onChange={(e) => setPad(Number(e.target.value))}
                />
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                Will create: <b>{prefix}{String(startNum).padStart(pad, "0")}</b> …{" "}
                <b>{prefix}{String(startNum + count - 1).padStart(pad, "0")}</b>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Charge per day (₹)</Label>
            <Input
              type="number"
              min={0}
              value={charge}
              onChange={(e) => setCharge(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : mode === "single" ? "Add bed" : `Add ${count} beds`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditBedMenuItem({ bed }: { bed: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bedNumber, setBedNumber] = useState(bed.bed_number);
  const [charge, setCharge] = useState(Number(bed.charge_per_day));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("beds")
        .update({ bed_number: bedNumber.trim(), charge_per_day: charge })
        .eq("id", bed.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bed updated");
      qc.invalidateQueries({ queryKey: ["wards-with-beds"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
        <Pencil className="size-4 mr-2" /> Edit bed
      </DropdownMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bed</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Bed number</Label>
              <Input value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Charge per day (₹)</Label>
              <Input
                type="number"
                min={0}
                value={charge}
                onChange={(e) => setCharge(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
