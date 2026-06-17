import { useQuery } from "@tanstack/react-query";
import logoAsset from "@/assets/sbg-arogya-plus-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const BRAND = {
  name: "SBG Arogya Plus",
  shortName: "SBG Arogya+",
  tagline: "Hospital Management Suite",
  logoUrl: logoAsset.url,
} as const;

/** Reads the active hospital_settings row (logo + branding). Cached app-wide. */
export function useHospitalBrand() {
  return useQuery({
    queryKey: ["hospital-settings", "brand"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hospital_settings")
        .select("hospital_name, tagline, logo_url, primary_color, secondary_color, accent_color")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .maybeSingle();
      return {
        name: data?.hospital_name || BRAND.name,
        tagline: data?.tagline || BRAND.tagline,
        logoUrl: data?.logo_url || BRAND.logoUrl,
        primaryColor: data?.primary_color || "#0EA5E9",
        secondaryColor: data?.secondary_color || "#0F172A",
        accentColor: data?.accent_color || "#22C55E",
      };
    },
  });
}

type BrandLogoProps = {
  className?: string;
  size?: number;
  alt?: string;
  src?: string;
};

export function BrandLogo({ className, size, alt, src }: BrandLogoProps) {
  const { data } = useHospitalBrand();
  const url = src || data?.logoUrl || BRAND.logoUrl;
  return (
    <img
      src={url}
      alt={alt ?? data?.name ?? BRAND.name}
      height={size}
      className={className}
      style={{ height: size ? `${size}px` : undefined, width: "auto", objectFit: "contain" }}
    />
  );
}

export function BrandMark({ className, size = 36, src }: { className?: string; size?: number; src?: string }) {
  const { data } = useHospitalBrand();
  const url = src || data?.logoUrl || BRAND.logoUrl;
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${url})`,
        backgroundSize: "300% auto",
        backgroundPosition: "10% center",
        backgroundRepeat: "no-repeat",
      }}
      aria-label={data?.name ?? BRAND.name}
      role="img"
    />
  );
}
