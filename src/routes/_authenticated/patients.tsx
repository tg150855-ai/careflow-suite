import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Plus, Search, Phone } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/patients")({ component: PatientsPage });

function PatientsPage() {
  const [q, setQ] = useState("");
  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", q],
    queryFn: async () => {
      let query = supabase.from("patients").select("id, uhid, full_name, mobile, gender, dob, blood_group, created_at").order("created_at", { ascending: false }).limit(100);
      if (q.length >= 2) query = query.or(`full_name.ilike.%${q}%,mobile.ilike.%${q}%,uhid.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
          <p className="text-muted-foreground mt-1">{patients.length} record{patients.length === 1 ? "" : "s"}</p>
        </div>
        <Button asChild size="lg">
          <Link to="/patients/new"><Plus className="size-4 mr-2" />New patient</Link>
        </Button>
      </div>

      <Card className="p-2">
        <div className="relative p-3">
          <Search className="size-4 absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, mobile or UHID..." className="pl-10 h-11 border-transparent bg-surface-muted" />
        </div>

        <div className="divide-y">
          {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
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
