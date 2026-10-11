import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import novaLogo from "@/assets/nova-logo.png.asset.json";

/**
 * Logo central : logo du site s'il existe (sur un cartouche clair pour rester
 * lisible sur la photo), sinon NOVA + PASS. « affiche » = grand format pour l'A4.
 */
export function SiteBrand({
  logoUrl,
  nom,
  format = "entete",
}: {
  logoUrl?: string | null | undefined;
  nom?: string | null | undefined;
  format?: "entete" | "affiche";
}) {
  if (logoUrl) {
    return format === "affiche" ? (
      <img
        src={logoUrl}
        alt={nom ?? "Logo du site"}
        className="h-[28mm] w-auto max-w-[120mm] rounded-2xl border border-hero-line object-contain shadow-2xl"
      />
    ) : (
      <img
        src={logoUrl}
        alt={nom ?? "Logo du site"}
        className="h-14 w-auto max-w-[240px] rounded-2xl border border-hero-line object-contain shadow-2xl sm:h-[4.5rem] sm:max-w-[320px]"
      />
    );
  }
  if (format === "affiche") {
    return (
      <span className="flex items-center gap-4">
        <img src={novaLogo.url} alt="NOVA" className="h-[18mm] w-auto drop-shadow-sm" />
        <span className="text-6xl font-bold uppercase tracking-wide text-pass-pastel">Pass</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 sm:gap-3">
      <img src={novaLogo.url} alt="NOVA" className="h-8 w-auto drop-shadow-sm sm:h-10" />
      <span className="text-2xl font-bold uppercase tracking-wide text-pass-pastel sm:text-3xl">
        Pass
      </span>
    </span>
  );
}

/** Dimensions du logo central (ratio conservé, sans déformation). */
function useLogoBox(src: string, maxW: number, maxH: number) {
  const [box, setBox] = useState<{ w: number; h: number }>({ w: maxW, h: maxW / 3 });
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth / img.naturalHeight || 3;
      let w = maxW;
      let h = w / r;
      if (h > maxH) {
        h = maxH;
        w = h * r;
      }
      setBox({ w: Math.round(w), h: Math.round(h) });
    };
    img.src = src;
  }, [src, maxW, maxH]);
  return box;
}

export function SiteQr({
  value,
  logoUrl,
  size,
  canvasId,
  displaySize,
}: {
  value: string;
  logoUrl?: string | null | undefined;
  size: number;
  canvasId?: string;
  displaySize?: number;
}) {
  const src = logoUrl || novaLogo.url;
  const box = useLogoBox(src, size * 0.32, size * 0.2);
  const common = {
    value,
    size,
    level: "H" as const,
    marginSize: 3,
    imageSettings: {
      src,
      width: box.w,
      height: box.h,
      excavate: true,
      crossOrigin: "anonymous" as const,
    },
  };
  if (canvasId) {
    return (
      <QRCodeCanvas
        id={canvasId}
        {...common}
        style={displaySize ? { width: displaySize, height: displaySize } : undefined}
      />
    );
  }
  return (
    <QRCodeSVG
      {...common}
      fgColor="var(--qr-foreground)"
      bgColor="var(--qr-background)"
      style={{ display: "block" }}
    />
  );
}
