import ExcelJS from "exceljs";

/** Trigger a browser download of arbitrary text/blob content. */
function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export an array of plain objects to CSV. Columns are inferred from the first row. */
export function exportCsv<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (!rows.length) {
    download(filename.endsWith(".csv") ? filename : `${filename}.csv`, new Blob(["\n"], { type: "text/csv" }));
    return;
  }
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
  download(filename.endsWith(".csv") ? filename : `${filename}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

function appendSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name.slice(0, 31) || "Sheet1");
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  ws.columns = cols.map((c) => ({ header: c, key: c }));
  for (const r of rows) {
    const row: Record<string, unknown> = {};
    for (const c of cols) {
      const v = r[c];
      row[c] = v instanceof Date ? v : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v;
    }
    ws.addRow(row);
  }
}

/** Export rows (or multiple sheets) to an .xlsx file. */
export async function exportXlsx(
  data: Record<string, unknown>[] | Record<string, Record<string, unknown>[]>,
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  if (Array.isArray(data)) {
    appendSheet(wb, "Sheet1", data);
  } else {
    for (const [name, rows] of Object.entries(data)) {
      appendSheet(wb, name, rows);
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  download(filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`, blob);
}

/** Print the current page. Callers that want a scoped print should use a print stylesheet or dedicated print route. */
export function printPage() {
  window.print();
}

/**
 * "Download Report" → uses the browser's Save-as-PDF print dialog so we don't pull in a heavy PDF library.
 * Callers can pre-set document.title before calling for a sensible filename suggestion.
 */
export function downloadAsPdf(suggestedTitle?: string) {
  const prev = document.title;
  if (suggestedTitle) document.title = suggestedTitle;
  window.print();
  setTimeout(() => {
    document.title = prev;
  }, 500);
}
