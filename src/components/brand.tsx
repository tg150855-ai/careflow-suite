import { useQuery } from "@tanstack/react-query";
import logoAsset from "@/assets/sbg-arogya-plus-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const BRAND = {
  name: "SBG Arogya Plus",
  shortName: "SBG Arogya+",
  tagline: "Hospital Management Suite",
  logoUrl: logoAsset.url,
  phone: "+91 8000 123 456",
} as const;

/** Reads the active hospital_settings row (logo + branding). Cached app-wide. */
export function useHospitalBrand() {
  return useQuery({
    queryKey: ["hospital-settings", "brand"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let tenantHospital: any = null;
      try {
        const { data: authData } = await supabase.auth.getSession();
        const userId = authData?.session?.user?.id;
        if (userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("hospital_id")
            .eq("id", userId)
            .maybeSingle();

          const hospitalId = (prof as { hospital_id?: string | null } | null)?.hospital_id;
          if (hospitalId) {
            const { data: hRow } = await supabase
              .from("hospitals")
              .select("id, hospital_name")
              .eq("id", hospitalId)
              .maybeSingle();
            tenantHospital = hRow;
          }
        }
      } catch (err) {
        console.warn("Could not fetch tenant hospital for brand:", err);
      }

      let data: any = null;
      if (tenantHospital?.id) {
        const { data: tenantSettings } = await (supabase as any)
          .from("hospital_settings")
          .select("hospital_name, tagline, logo_url, primary_color, secondary_color, accent_color")
          .eq("id", tenantHospital.id)
          .maybeSingle();
        data = tenantSettings;
      }

      if (!data) {
        const { data: defaultSettings } = await (supabase as any)
          .from("hospital_settings")
          .select("hospital_name, tagline, logo_url, primary_color, secondary_color, accent_color")
          .eq("id", "00000000-0000-0000-0000-000000000001")
          .maybeSingle();
        data = defaultSettings;
      }

      const resolvedName =
        (data?.hospital_name && data.hospital_name !== "SBG Arogya Plus" ? data.hospital_name : null) ||
        tenantHospital?.hospital_name ||
        data?.hospital_name ||
        BRAND.name;

      return {
        name: resolvedName,
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
  style?: React.CSSProperties;
};

export function BrandLogo({ className, size, alt, src, style }: BrandLogoProps) {
  const { data } = useHospitalBrand();
  const url = src || data?.logoUrl || BRAND.logoUrl;
  return (
    <img
      src={url}
      alt={alt ?? data?.name ?? BRAND.name}
      height={size}
      className={className}
      style={style ?? { height: size ? `${size}px` : undefined, width: "auto", objectFit: "contain" }}
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
