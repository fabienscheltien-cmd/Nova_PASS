/**
 * Favicon : logo officiel Nova Serenity, recadré en carré haute définition
 * (512 px, logo centré sans déformation) pour l'onglet et les favoris.
 */
export function installerFaviconCarre(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const taille = 512;
      const marge = 0.06 * taille;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = taille;
      const ctx = canvas.getContext("2d");
      if (!ctx || !img.naturalWidth || !img.naturalHeight) return;
      const echelle = Math.min(
        (taille - 2 * marge) / img.naturalWidth,
        (taille - 2 * marge) / img.naturalHeight,
      );
      const l = img.naturalWidth * echelle;
      const h = img.naturalHeight * echelle;
      ctx.drawImage(img, (taille - l) / 2, (taille - h) / 2, l, h);
      const url = canvas.toDataURL("image/png");
      for (const rel of ["icon", "apple-touch-icon"]) {
        document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`).forEach((lien) => {
          lien.href = url;
          lien.type = "image/png";
        });
      }
    } catch {
      /* image non exploitable : le lien direct vers le logo reste en place */
    }
  };
  img.src = src;
}
