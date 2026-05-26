import { useEffect, useRef, useState } from "react";
import { Search, User, Receipt, Pill, FlaskConical, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

type Row = { kind: "patient" | "bill" | "medicine" | "lab_order"; id: string; primary: string; secondary?: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Row[]>([]);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const term = `%${q}%`;
      const [pat, bill, med, lab] = await Promise.all([
        supabase.from("patients").select("id, full_name, uhid, mobile").or(`full_name.ilike.${term},mobile.ilike.${term},uhid.ilike.${term}`).limit(5),
        supabase.from("bills").select("id, bill_no, total, patients(full_name)").ilike("bill_no", term).limit(5),
        supabase.from("medicines").select("id, name, generic_name").or(`name.ilike.${term},generic_name.ilike.${term}`).limit(5),
        supabase.from("lab_orders").select("id, order_no, patients(full_name)").ilike("order_no", term).limit(5),
      ]);
      const rows: Row[] = [
        ...(pat.data ?? []).map((p: any) => ({ kind: "patient" as const, id: p.id, primary: p.full_name, secondary: `${p.uhid} · ${p.mobile}` })),
        ...(bill.data ?? []).map((b: any) => ({ kind: "bill" as const, id: b.id, primary: b.bill_no, secondary: `${b.patients?.full_name ?? ""} · ₹${b.total}` })),
        ...(med.data ?? []).map((m: any) => ({ kind: "medicine" as const, id: m.id, primary: m.name, secondary: m.generic_name ?? "" })),
        ...(lab.data ?? []).map((l: any) => ({ kind: "lab_order" as const, id: l.id, primary: l.order_no, secondary: l.patients?.full_name ?? "" })),
      ];
      setResults(rows);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function go(r: Row) {
    setOpen(false); setQ("");
    if (r.kind === "patient") navigate({ to: "/patients/$id", params: { id: r.id } });
    else if (r.kind === "bill") navigate({ to: "/billing/$id", params: { id: r.id } });
    else if (r.kind === "medicine") navigate({ to: "/pharmacy/medicines" });
    else if (r.kind === "lab_order") navigate({ to: "/laboratory/$id", params: { id: r.id } });
  }

  const icons = { patient: User, bill: Receipt, medicine: Pill, lab_order: FlaskConical };

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search patients, bills, medicines, lab orders..."
        className="pl-9 h-10 bg-surface-muted border-transparent focus-visible:bg-surface"
      />
      <AnimatePresence>
        {open && q.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-12 left-0 right-0 bg-popover border rounded-xl shadow-elevated overflow-hidden z-50 max-h-[420px] overflow-y-auto"
          >
            {loading && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" /> Searching…</div>}
            {!loading && results.length === 0 && <div className="p-4 text-sm text-muted-foreground">No results.</div>}
            {!loading && results.map((r) => {
              const Icon = icons[r.kind];
              return (
                <button key={r.kind + r.id} onClick={() => go(r)} className="w-full text-left p-3 hover:bg-surface-muted flex items-center gap-3 border-b last:border-b-0">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.primary}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.secondary}</div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.kind.replace("_"," ")}</div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
