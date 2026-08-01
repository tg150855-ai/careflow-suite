import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Pill, History } from "lucide-react";

export type MedicineSuggestion = {
  name: string;
  count: number;
  strength?: string;
  route?: string;
  frequency?: string;
  food?: string;
  instructions?: string;
  source: "history" | "stock";
  lastUsed?: number;
};

function unpack(notes: string | null) {
  if (!notes) return { strength: "", route: "", instructions: "" };
  try {
    const j = JSON.parse(notes);
    return { strength: j.s ?? "", route: j.r ?? "", instructions: j.i ?? "" };
  } catch {
    return { strength: "", route: "", instructions: notes };
  }
}

/** Previously-prescribed medicines (ranked by usage) + pharmacy stock, cached app-wide. */
export function useMedicineSuggestions() {
  return useQuery({
    queryKey: ["medicine-suggestions"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MedicineSuggestion[]> => {
      const [rxRes, stockRes] = await Promise.all([
        supabase
          .from("prescription_items")
          .select("medicine_name, dosage, food_instruction, notes, prescriptions(created_at)")
          .limit(1500),
        supabase.from("medicines").select("name, generic_name").eq("active", true).limit(1000),
      ]);

      const map = new Map<string, MedicineSuggestion>();
      for (const row of (rxRes.data ?? []) as any[]) {
        const name = (row.medicine_name ?? "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const meta = unpack(row.notes);
        const ts = row.prescriptions?.created_at ? +new Date(row.prescriptions.created_at) : 0;
        const prev = map.get(key);
        if (prev) {
          prev.count += 1;
          if (ts >= (prev.lastUsed ?? 0)) {
            prev.lastUsed = ts;
            prev.strength = meta.strength || prev.strength;
            prev.route = meta.route || prev.route;
            prev.frequency = row.dosage || prev.frequency;
            prev.food = row.food_instruction || prev.food;
            prev.instructions = meta.instructions || prev.instructions;
          }
        } else {
          map.set(key, {
            name,
            count: 1,
            strength: meta.strength,
            route: meta.route,
            frequency: row.dosage ?? "",
            food: row.food_instruction ?? "",
            instructions: meta.instructions,
            source: "history",
            lastUsed: ts,
          });
        }
      }
      for (const m of (stockRes.data ?? []) as any[]) {
        const name = (m.name ?? "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, { name, count: 0, source: "stock" });
      }
      return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    },
  });
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: MedicineSuggestion) => void;
  className?: string;
  placeholder?: string;
};

/** Medicine name input with debounced autocomplete from history + pharmacy stock. */
export function MedicineAutocomplete({ value, onChange, onSelect, className, placeholder = "Medicine name" }: Props) {
  const { data: all = [] } = useMedicineSuggestions();
  const [focused, setFocused] = useState(false);
  const [term, setTerm] = useState(value);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setTerm(value), 300);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const recent = useMemo(
    () => [...all].filter((s) => s.source === "history").sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0)).slice(0, 8),
    [all],
  );

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    return all.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [all, term]);

  const list = term.trim().length >= 2 ? matches : recent;
  const showPanel = focused && list.length > 0;

  function pick(s: MedicineSuggestion) {
    onSelect(s);
    setFocused(false);
  }

  return (
    <div ref={boxRef} className={`relative ${className ?? ""}`}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        className="h-9 text-sm w-full"
        autoComplete="off"
      />
      {showPanel && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {term.trim().length < 2 && (
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <History className="size-3" /> Recent medicines
            </div>
          )}
          {list.map((s) => (
            <button
              key={`${s.source}-${s.name}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 hover:bg-muted/70 transition"
            >
              <div className="text-sm font-medium flex items-center gap-1.5 truncate">
                <Pill className="size-3.5 text-primary shrink-0" />
                {s.name}
                {s.strength ? <span className="text-xs text-muted-foreground">{s.strength}</span> : null}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {s.count > 0 ? `Prescribed ${s.count} time${s.count > 1 ? "s" : ""}` : "Pharmacy stock"}
                {s.frequency ? ` · ${s.frequency}` : ""}
                {s.food ? ` · ${s.food}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
