import * as XLSX from "xlsx";

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

/** Export rows (or multiple sheets) to an .xlsx file. */
export function exportXlsx(
  data: Record<string, unknown>[] | Record<string, Record<string, unknown>[]>,
  filename: string,
) {
  const wb = XLSX.utils.book_new();
  if (Array.isArray(data)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Sheet1");
  } else {
    for (const [name, rows] of Object.entries(data)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
    }
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
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
