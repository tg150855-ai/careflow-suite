import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";

export type ImportColumn = {
  /** Header label shown in the template (case-insensitive match). */
  key: string;
  /** Aliases accepted from user files. */
  aliases?: string[];
  required?: boolean;
  /** Example placeholder value put in the template sample row. */
  example?: string;
};

export type ImportSummary = { inserted: number; skipped: number; failed: number; errors?: string[] };

export function DataImportDialog({
  open,
  onOpenChange,
  title,
  templateName,
  columns,
  onImport,
  helperText,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  templateName: string;
  columns: ImportColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<ImportSummary>;
  helperText?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function reset() { setRows([]); setErrors({}); setFileName(null); if (fileRef.current) fileRef.current.value = ""; }

  async function downloadTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Template");
    ws.addRow(columns.map(c => c.key)).font = { bold: true };
    ws.addRow(columns.map(c => c.example ?? ""));
    ws.columns.forEach((c, i) => { c.width = Math.max(14, (columns[i]?.key?.length ?? 10) + 4); });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${templateName}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function normalizeHeader(h: string) { return h.trim().toLowerCase().replace(/[\s_-]+/g, ""); }

  function matchColumn(header: string): string | null {
    const n = normalizeHeader(header);
    for (const c of columns) {
      const candidates = [c.key, ...(c.aliases ?? [])];
      if (candidates.some(x => normalizeHeader(x) === n)) return c.key;
    }
    return null;
  }

  async function onFile(file: File) {
    setBusy(true);
    try {
      let parsed: Record<string, string>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim().length);
        if (lines.length < 2) throw new Error("File is empty");
        const splitCsv = (s: string) => {
          const out: string[] = []; let cur = ""; let q = false;
          for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '"') { if (q && s[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
            else if (ch === "," && !q) { out.push(cur); cur = ""; }
            else cur += ch;
          }
          out.push(cur); return out.map(v => v.trim());
        };
        const rawHeaders = splitCsv(lines[0]);
        const mapping = rawHeaders.map(matchColumn);
        parsed = lines.slice(1).map(line => {
          const vals = splitCsv(line);
          const row: Record<string, string> = {};
          mapping.forEach((k, i) => { if (k) row[k] = vals[i] ?? ""; });
          return row;
        });
      } else {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const ws = wb.worksheets[0];
        if (!ws) throw new Error("No sheet found");
        const rawHeaders: string[] = [];
        ws.getRow(1).eachCell((c, i) => { rawHeaders[i - 1] = String(c.value ?? ""); });
        const mapping = rawHeaders.map(matchColumn);
        for (let r = 2; r <= ws.rowCount; r++) {
          const row: Record<string, string> = {};
          const rowObj = ws.getRow(r);
          let any = false;
          rowObj.eachCell((cell, i) => {
            const k = mapping[i - 1]; if (!k) return;
            const v = cell.value == null ? "" : (typeof cell.value === "object" && "text" in (cell.value as any) ? String((cell.value as any).text) : String(cell.value));
            row[k] = v.trim(); if (v) any = true;
          });
          if (any) parsed.push(row);
        }
      }
      if (parsed.length === 0) throw new Error("No data rows found");
      // Validate required
      const errMap: Record<number, string[]> = {};
      parsed.forEach((r, idx) => {
        const errs: string[] = [];
        columns.forEach(c => { if (c.required && !r[c.key]) errs.push(`Missing ${c.key}`); });
        if (errs.length) errMap[idx] = errs;
      });
      setRows(parsed);
      setErrors(errMap);
      setFileName(file.name);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to read file");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    const valid = rows.filter((_, i) => !errors[i]);
    if (!valid.length) { toast.error("No valid rows to import"); return; }
    setBusy(true);
    try {
      const summary = await onImport(valid);
      toast.success(`${summary.inserted} imported · ${summary.skipped} skipped · ${summary.failed} failed`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="size-4 mr-1.5" /> Download template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
              Choose file (.xlsx or .csv)
            </Button>
            {fileName && (
              <Badge variant="secondary" className="gap-1">
                <FileSpreadsheet className="size-3" />{fileName}
                <button className="ml-1" onClick={reset}><X className="size-3" /></button>
              </Badge>
            )}
          </div>
          {rows.length > 0 && (
            <div className="border rounded-lg max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {columns.map(c => <TableHead key={c.key}>{c.key}</TableHead>)}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={errors[i] ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      {columns.map(c => (
                        <TableCell key={c.key} className="text-xs">
                          {r[c.key] || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs">
                        {errors[i] ? <span className="text-destructive">{errors[i].join(", ")}</span> : <span className="text-emerald-600">Ready</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {rows.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {rows.length - Object.keys(errors).length} valid · {Object.keys(errors).length} with errors
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirmImport} disabled={busy || rows.length === 0}>
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null}
            Import {rows.length - Object.keys(errors).length} row(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
