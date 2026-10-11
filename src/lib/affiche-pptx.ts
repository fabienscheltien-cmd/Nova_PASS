/**
 * Génère l'affiche A4 d'un site au format PowerPoint (.pptx), modifiable dans
 * PowerPoint / Keynote / Google Slides. Reprend la mise en page de l'affiche web.
 */

/** Convertit une image (URL ou data URL) en data URL, ou null si elle est inaccessible. */
async function enDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return src;
  try {
    const reponse = await fetch(src);
    if (!reponse.ok) return null;
    const blob = await reponse.blob();
    return await new Promise((resolve) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(typeof lecteur.result === "string" ? lecteur.result : null);
      lecteur.onerror = () => resolve(null);
      lecteur.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function telechargerAffichePptx(options: {
  nomSite: string;
  qrDataUrl: string;
  logoSiteUrl: string | null;
  logoNovaUrl: string;
  fondUrl: string;
}) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  // A4 portrait, en pouces.
  pptx.defineLayout({ name: "A4_PORTRAIT", width: 8.27, height: 11.69 });
  pptx.layout = "A4_PORTRAIT";
  pptx.title = `Affiche accueil visiteurs — ${options.nomSite}`;

  const L = 8.27;
  const H = 11.69;
  const diapo = pptx.addSlide();
  diapo.background = { color: "0F1B26" };

  const fond = await enDataUrl(options.fondUrl);
  if (fond)
    diapo.addImage({ data: fond, x: 0, y: 0, w: L, h: H, sizing: { type: "cover", w: L, h: H } });
  // Voile sombre pour la lisibilité (comme sur l'affiche web).
  diapo.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: L,
    h: H,
    fill: { color: "0F1B26", transparency: 22 },
    line: { color: "0F1B26", transparency: 100 },
  });

  // En-tête : logo du site, sinon NOVA PASS.
  const logoSite = options.logoSiteUrl ? await enDataUrl(options.logoSiteUrl) : null;
  if (logoSite) {
    diapo.addImage({
      data: logoSite,
      x: (L - 4.4) / 2,
      y: 0.5,
      w: 4.4,
      h: 1.1,
      sizing: { type: "contain", w: 4.4, h: 1.1 },
    });
  } else {
    const nova = await enDataUrl(options.logoNovaUrl);
    if (nova)
      diapo.addImage({
        data: nova,
        x: 2.5,
        y: 0.6,
        w: 2,
        h: 0.9,
        sizing: { type: "contain", w: 2, h: 0.9 },
      });
    diapo.addText("PASS", {
      x: 4.55,
      y: 0.6,
      w: 1.6,
      h: 0.9,
      fontSize: 36,
      bold: true,
      color: "7FC4D9",
      fontFace: "Arial",
    });
  }
  diapo.addShape(pptx.ShapeType.line, {
    x: 0.55,
    y: 1.95,
    w: L - 1.1,
    h: 0,
    line: { color: "FFFFFF", transparency: 75, width: 0.75 },
  });

  diapo.addText("ACCUEIL VISITEURS", {
    x: 0.5,
    y: 2.35,
    w: L - 1,
    h: 0.5,
    align: "center",
    fontSize: 22,
    bold: true,
    color: "7FC4D9",
    charSpacing: 4,
    fontFace: "Arial",
  });
  diapo.addText(`Bienvenue chez ${options.nomSite}`, {
    x: 0.5,
    y: 2.9,
    w: L - 1,
    h: 1.1,
    align: "center",
    fontSize: 38,
    bold: true,
    color: "FFFFFF",
    fontFace: "Arial",
    fit: "shrink",
  });

  // QR code (avec sa marge claire, indispensable à la lecture).
  const tailleQr = 3.7;
  diapo.addImage({
    data: options.qrDataUrl,
    x: (L - tailleQr) / 2,
    y: 4.35,
    w: tailleQr,
    h: tailleQr,
    rounding: false,
  });

  // Trois étapes.
  const etapes = [
    "Ouvrez l'appareil photo de votre téléphone",
    "Scannez le QR code ci-dessus",
    "Complétez le formulaire : l'accueil est prévenu",
  ];
  const largeur = (L - 1.1 - 0.4) / 3;
  etapes.forEach((texte, i) => {
    const x = 0.55 + i * (largeur + 0.2);
    diapo.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 8.55,
      w: largeur,
      h: 1.45,
      rectRadius: 0.12,
      fill: { color: "16283A", transparency: 15 },
      line: { color: "FFFFFF", transparency: 75, width: 0.75 },
    });
    diapo.addText(String(i + 1), {
      x: x + 0.15,
      y: 8.62,
      w: 0.6,
      h: 0.55,
      fontSize: 26,
      bold: true,
      color: "7FC4D9",
      fontFace: "Arial",
    });
    diapo.addText(texte, {
      x: x + 0.15,
      y: 9.15,
      w: largeur - 0.3,
      h: 0.75,
      fontSize: 11,
      color: "FFFFFF",
      valign: "top",
      fontFace: "Arial",
    });
  });

  diapo.addText("Registre d'accueil sécurisé · Données traitées conformément au RGPD", {
    x: 0.5,
    y: H - 0.7,
    w: L - 1,
    h: 0.35,
    align: "center",
    fontSize: 8,
    color: "C9D6E0",
    fontFace: "Arial",
  });

  const nomFichier = `Affiche-${options.nomSite.replace(/[^a-z0-9]+/gi, "-")}.pptx`;
  await pptx.writeFile({ fileName: nomFichier });
}
