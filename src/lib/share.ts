/**
 * Opens a WhatsApp share window with the given text and optional URL.
 * Uses wa.me which works on web, Android, and iOS.
 */
export function shareOnWhatsApp(text: string, url?: string, phone?: string) {
  const body = url ? `${text}\n\n${url}` : text;
  const base = phone ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : `https://wa.me/`;
  const href = `${base}?text=${encodeURIComponent(body)}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

/** Builds a one-line summary suitable for WhatsApp/SMS sharing. */
export function summarizeRecord(label: string, fields: Record<string, string | number | null | undefined>) {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`);
  return `${label}\n${parts.join("\n")}`;
}
