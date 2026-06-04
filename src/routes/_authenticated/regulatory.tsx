import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileBarChart, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/regulatory")({ component: RegPage });

const SCOPES = [
  { value: "nabh", label: "NABH", tables: ["quality_indicators","compliance_documents","jci_audits"] },
  { value: "jci", label: "JCI", tables: ["jci_audits","quality_metrics","incidents"] },
  { value: "govt", label: "Govt Health Authorities", tables: ["scheme_claims","scheme_beneficiaries","emergency_cases"] },
  { value: "insurance", label: "Insurance Regulators", tables: ["insurance_claims","bills","patient_insurance"] },
];

function RegPage() {
  const [scope, setScope] = useState("nabh");
  const [busy, setBusy] = useState(false);

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  const fetchAll = async () => {
    const cfg = SCOPES.find((s) => s.value === scope)!;
    const result: Record<string, any[]> = {};
    for (const t of cfg.tables) {
      const { data } = await (supabase.from(t as any) as any).select("*").limit(5000);
      result[t] = (data as any) ?? [];
    }
    return result;
  };

  const toCSV = (rows: any[]) => {
    if (rows.length === 0) return "";
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))].join("\n");
  };
  const toXML = (name: string, rows: any[]) =>
    `<${name}>\n${rows.map((r) => `  <record>${Object.entries(r).map(([k, v]) => `<${k}>${String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as any)[c])}</${k}>`).join("")}</record>`).join("\n")}\n</${name}>`;

  const exportAs = async (format: "json" | "csv" | "xml") => {
    setBusy(true);
    try {
      const all = await fetchAll();
      if (format === "json") download(`${scope}-report.json`, JSON.stringify(all, null, 2), "application/json");
      else if (format === "csv") {
        const csv = Object.entries(all).map(([t, rows]) => `# ${t}\n${toCSV(rows)}`).join("\n\n");
        download(`${scope}-report.csv`, csv, "text/csv");
      } else {
        const xml = `<?xml version="1.0"?>\n<report scope="${scope}">\n${Object.entries(all).map(([t, rows]) => toXML(t, rows)).join("\n")}\n</report>`;
        download(`${scope}-report.xml`, xml, "application/xml");
      }
      toast.success("Report exported");
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileBarChart className="size-6 text-primary" /> Regulatory Reporting</h1>
        <p className="text-sm text-muted-foreground">Generate compliance reports for NABH, JCI, government & insurance regulators.</p>
      </div>

      <Card><CardContent className="pt-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-medium mb-1">Regulator</div>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Includes: {SCOPES.find((s) => s.value === scope)?.tables.join(", ")}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportAs("json")} disabled={busy}><Download className="size-4 mr-1" /> JSON</Button>
          <Button variant="outline" onClick={() => exportAs("csv")} disabled={busy}><Download className="size-4 mr-1" /> CSV (Excel)</Button>
          <Button variant="outline" onClick={() => exportAs("xml")} disabled={busy}><Download className="size-4 mr-1" /> XML</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
