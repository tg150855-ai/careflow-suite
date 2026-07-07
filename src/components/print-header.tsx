import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/components/brand";
import { format } from "date-fns";

export type HospitalProfile = {
  hospital_name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  registration_no?: string | null;
  gst_no?: string | null;
  nabh_no?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
};

/** Fetches full hospital profile for use in PDF/print templates. Cached app-wide. */
export function useHospitalProfile() {
  return useQuery({
    queryKey: ["hospital-settings", "profile"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<HospitalProfile> => {
      const { data } = await (supabase as any)
        .from("hospital_settings")
        .select("hospital_name, tagline, address, phone, email, website, registration_no, gst_no, nabh_no, logo_url, primary_color")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .maybeSingle();
      return {
        hospital_name: data?.hospital_name || BRAND.name,
        tagline: data?.tagline ?? null,
        address: data?.address ?? null,
        phone: data?.phone ?? null,
        email: data?.email ?? null,
        website: data?.website ?? null,
        registration_no: data?.registration_no ?? null,
        gst_no: data?.gst_no ?? null,
        nabh_no: data?.nabh_no ?? null,
        logo_url: data?.logo_url ?? BRAND.logoUrl,
        primary_color: data?.primary_color ?? "#0EA5E9",
      };
    },
  });
}

type PrintHeaderProps = {
  title: string;
  documentNo?: string | null;
  /** Optional right-side meta (e.g. status badge). */
  rightSlot?: React.ReactNode;
  /** Override the "Generated on" timestamp. Defaults to now. */
  timestamp?: Date | string;
};

/**
 * Shared professional header used at the top of EVERY PDF/print template.
 * Pulls hospital branding from Admin → Hospital Settings.
 */
export function PrintHeader({ title, documentNo, rightSlot, timestamp }: PrintHeaderProps) {
  const { data: h } = useHospitalProfile();
  const ts = timestamp ? new Date(timestamp) : new Date();
  const meta = [
    h?.phone && `Phone: ${h.phone}`,
    h?.email && `Email: ${h.email}`,
  ].filter(Boolean).join(" | ");
  const regLine = [
    h?.registration_no && `License No: ${h.registration_no}`,
    h?.gst_no && `GSTIN: ${h.gst_no}`,
    h?.nabh_no && `NABH: ${h.nabh_no}`,
  ].filter(Boolean).join(" | ");
  const accent = h?.primary_color || "#0EA5E9";

  return (
    <header className="print-header w-full">
      <div className="flex items-start gap-4 pb-3">
        {h?.logo_url && (
          <img
            src={h.logo_url}
            alt={h.hospital_name}
            className="print-header-logo shrink-0"
            style={{ maxHeight: 64, maxWidth: 120, objectFit: "contain" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold leading-tight" style={{ color: accent }}>
            {h?.hospital_name}
          </div>
          {h?.tagline && <div className="text-xs text-gray-600 mt-0.5">{h.tagline}</div>}
          {h?.address && <div className="text-xs text-gray-700 mt-0.5 whitespace-pre-line">{h.address}</div>}
          {meta && <div className="text-xs text-gray-700 mt-0.5">{meta}</div>}
          {regLine && <div className="text-xs text-gray-600 mt-0.5">{regLine}</div>}
        </div>
        {rightSlot && <div className="text-right text-xs">{rightSlot}</div>}
      </div>
      <div className="h-[2px] w-full" style={{ background: accent }} />
      <div className="flex items-center justify-between py-2 text-sm">
        <div className="font-semibold uppercase tracking-wide" style={{ color: accent }}>{title}</div>
        <div className="text-xs text-gray-600">
          {documentNo && <span className="font-mono mr-3">#{documentNo}</span>}
          Generated on: {format(ts, "dd/MM/yyyy")} | Time: {format(ts, "HH:mm")}
        </div>
      </div>
      <div className="h-px w-full bg-gray-300" />
    </header>
  );
}

/** Footer with page-number placeholder + hospital name. Rendered by browser print. */
export function PrintFooter() {
  const { data: h } = useHospitalProfile();
  return (
    <footer className="print-footer mt-8 pt-3 border-t text-[10px] text-gray-500 flex justify-between">
      <span>{h?.hospital_name}</span>
      <span>Computer generated · {format(new Date(), "dd/MM/yyyy HH:mm")}</span>
    </footer>
  );
}
