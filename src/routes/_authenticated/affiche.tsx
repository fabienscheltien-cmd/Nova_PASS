import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listerSites, monProfil } from "@/lib/visites.functions";
import { SiteBrand, SiteQr } from "@/components/site-brand";
import { useSiteAnalyse } from "@/lib/site-analyse";
import novaReception from "@/assets/nova-reception.jpg.asset.json";
import novaLogo from "@/assets/nova-logo.png.asset.json";
import novaSerenityLogo from "@/assets/nova-serenity.png.asset.json";
import { urlCheckin } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/affiche")({
  validateSearch: (search: Record<string, unknown>): { site?: string | undefined } => ({
    site: typeof search["site"] === "string" ? (search["site"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Affiche d'accueil — Nova Pass" },
      {
        name: "description",
        content: "Affiche A4 portrait du QR code d'accueil, prête à imprimer ou à télécharger en PowerPoint (.pptx).",
      },
      { property: "og:title", content: "Affiche d'accueil — Nova Pass" },
      { property: "og:description", content: "Affiche imprimable du QR code de votre site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Affiche,
});

const printCss = `
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: none !important; }
  .no-print { display: none !important; }
  .affiche-a4 { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

function Affiche() {
  const { site: siteParam } = Route.useSearch();
  const chargerSites = useServerFn(listerSites);
  const chargerProfil = useServerFn(monProfil);
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => chargerSites() });
  const { data: profil } = useQuery({ queryKey: ["monProfil"], queryFn: () => chargerProfil() });

  // Une hôtesse n'imprime que l'affiche de son propre site.
  const siteAnalyse = useSiteAnalyse();
  // Toujours un site : celui de l'URL, sinon le site analysé ou le premier site
  // (super admin), sinon le site du compte. Le QR et l'impression ne sont jamais bloqués.
  const siteId = profil?.estSuperAdmin
    ? (siteParam ?? (siteAnalyse || undefined) ?? sites?.[0]?.id)
    : (profil?.siteId ?? undefined);
  const site = (sites ?? []).find((s) => s.id === siteId) ?? null;
  const url = site ? urlCheckin(site.id) : "";
  const [generation, setGeneration] = useState(false);
  const [erreurPptx, setErreurPptx] = useState<string | null>(null);

  async function exporterPptx() {
    if (!site) return;
    setErreurPptx(null);
    setGeneration(true);
    try {
      const canvas = document.getElementById("qr-affiche-pptx") as HTMLCanvasElement | null;
      if (!canvas) throw new Error("QR code indisponible");
      const { telechargerAffichePptx } = await import("@/lib/affiche-pptx");
      await telechargerAffichePptx({
        nomSite: site.nom,
        qrDataUrl: canvas.toDataURL("image/png"),
        logoSiteUrl: site.logo_url ?? null,
        logoNovaUrl: novaLogo.url,
        fondUrl: novaReception.url,
      });
    } catch (err) {
      setErreurPptx(
        `Le fichier PowerPoint n'a pas pu être généré${err instanceof Error ? ` : ${err.message}` : "."}`,
      );
    } finally {
      setGeneration(false);
    }
  }

  return (
    <div className="bg-muted/40 py-6 print:bg-transparent print:py-0">
      <style>{printCss}</style>
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <p className="text-sm text-muted-foreground">
          Affiche A4 modifiable dans PowerPoint, Keynote ou Google Slides.
        </p>
        <div className="flex gap-2">
          <button
            onClick={exporterPptx}
            disabled={!url || generation}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {generation ? "Génération…" : "Télécharger en PowerPoint (.pptx)"}
          </button>
          <button
            onClick={() => window.print()}
            disabled={!url}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Imprimer
          </button>
        </div>
      </div>
      {erreurPptx && (
        <p
          role="alert"
          className="no-print mx-auto mb-4 max-w-[210mm] px-4 text-sm text-destructive"
        >
          {erreurPptx}
        </p>
      )}
      {url && (
        <div className="hidden" aria-hidden="true">
          <SiteQr canvasId="qr-affiche-pptx" value={url} logoUrl={site?.logo_url} size={1024} />
        </div>
      )}

      <div className="affiche-a4 relative isolate mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-foreground shadow-2xl">
        <img
          src={novaReception.url}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-hero-overlay" aria-hidden="true" />

        <header className="flex flex-col items-center gap-[6mm] border-b border-hero-line px-[14mm] pb-[8mm] pt-[10mm]">
          <img
            src={novaSerenityLogo.url}
            alt="Nova Serenity"
            className="h-auto w-20 self-start opacity-90"
          />
          <SiteBrand logoUrl={site?.logo_url} nom={site?.nom} format="affiche" />
        </header>

        <section className="flex flex-1 flex-col items-center px-[14mm] pt-[12mm] text-center">
          <p className="text-2xl font-bold uppercase tracking-widest text-pass-pastel">
            Accueil visiteurs
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight text-hero-foreground">
            Bienvenue chez {site?.nom ?? "Nova Serenity"}
          </h1>

          <div className="mt-[12mm] overflow-hidden rounded-2xl border border-hero-line shadow-2xl">
            {url ? (
              <SiteQr value={url} logoUrl={site?.logo_url} size={330} />
            ) : (
              <div className="h-[330px] w-[330px]" />
            )}
          </div>

          <ol className="mt-[12mm] grid w-full grid-cols-3 gap-4 text-left">
            {[
              "Ouvrez l'appareil photo de votre téléphone",
              "Scannez le QR code ci-dessus",
              "Complétez le formulaire : l'accueil est prévenu",
            ].map((t, i) => (
              <li key={t} className="rounded-xl border border-hero-line bg-hero-surface p-4">
                <span className="text-3xl font-bold text-pass-pastel">{i + 1}</span>
                <p className="mt-2 text-sm leading-snug text-hero-foreground">{t}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="px-[14mm] pb-[10mm] text-center text-[10px] text-hero-muted">
          Registre d'accueil sécurisé · Données traitées conformément au RGPD
        </footer>
      </div>
    </div>
  );
}
