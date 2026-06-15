import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Phone, Plus, Search, Trash2 } from "lucide-react";
import { differenceInYears, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/patients")({ component: PatientsPage });

function PatientsPage() {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("all");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const pageSize = 20;
  const canDelete = can(roles, "patients", "delete");
  const canEdit = can(roles, "patients", "edit");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["patients", q, gender, page],
    queryFn: async () => {
      const safeTerm = q.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ");
      let query = supabase
        .from("patients")
        .select("id, uhid, full_name, mobile, gender, dob, blood_group, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (safeTerm.length >= 2) query = query.or(`full_name.ilike.%${safeTerm}%,mobile.ilike.%${safeTerm}%,uhid.ilike.%${safeTerm}%`);
      if (gender !== "all") query = query.eq("gender", gender as any);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const patients = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function deletePatient(patient: any) {
    const { data: before } = await (supabase as any).from("patients").select("*").eq("id", patient.id).maybeSingle();
    const { error } = await supabase.from("patients").delete().eq("id", patient.id);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entity: "patients", entityId: patient.id, before });
    toast.success("Patient record deleted");
    queryClient.invalidateQueries({ queryKey: ["patients"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
          <p className="text-muted-foreground mt-1">{total} record{total === 1 ? "" : "s"}</p>
        </div>
        <Button asChild size="lg">
          <Link to="/patients/new"><Plus className="size-4 mr-2" />New patient</Link>
        </Button>
      </div>

      <Card className="p-2">
        <div className="p-3 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name, mobile or UHID..." className="pl-10 h-11 border-transparent bg-surface-muted" />
          </div>
          <Select value={gender} onValueChange={(v) => { setGender(v); setPage(1); }}>
            <SelectTrigger className="h-11 bg-surface-muted border-transparent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="divide-y">
          {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
          {isError && <div className="p-8 text-center text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load patients."}</div>}
          {!isLoading && patients.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No patients found.</p>
              <Button asChild className="mt-4"><Link to="/patients/new">Register first patient</Link></Button>
            </div>
          )}
          {patients.map((p) => (
            <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="flex items-center justify-between p-4 hover:bg-surface-muted transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  {p.full_name.slice(0,2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                    <span className="font-mono">{p.uhid}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="size-3" />{p.mobile}</span>
                    <span className="capitalize">{p.gender}</span>
                    {p.blood_group && <span>· {p.blood_group}</span>}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {format(new Date(p.created_at), "dd MMM yyyy")}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
