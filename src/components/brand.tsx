import logoAsset from "@/assets/sbg-arogya-plus-logo.png.asset.json";

export const BRAND = {
  name: "SBG Arogya Plus",
  shortName: "SBG Arogya+",
  tagline: "Hospital Management Suite",
  logoUrl: logoAsset.url,
} as const;

type BrandLogoProps = {
  className?: string;
  size?: number;
  alt?: string;
};

/** Full horizontal SBG Arogya Plus logo (caduceus + wordmark). */
export function BrandLogo({ className, size, alt = BRAND.name }: BrandLogoProps) {
  return (
    <img
      src={BRAND.logoUrl}
      alt={alt}
      height={size}
      className={className}
      style={{ height: size ? `${size}px` : undefined, width: "auto", objectFit: "contain" }}
    />
  );
}

/** Crop-out square mark for tight spaces (sidebar collapsed, favicons). */
export function BrandMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${BRAND.logoUrl})`,
        backgroundSize: "300% auto",
        backgroundPosition: "10% center",
        backgroundRepeat: "no-repeat",
      }}
      aria-label={BRAND.name}
      role="img"
    />
  );
}
