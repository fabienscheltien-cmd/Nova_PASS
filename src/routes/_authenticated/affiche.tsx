import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listerSites, monProfil } from "@/lib/visites.functions";
import { SiteBrand, SiteQr } from "@/components/site-brand";
import novaReception from "@/assets/nova-reception.jpg.asset.json";
import novaSerenityLogo from "@/assets/nova-serenity.png.asset.json";

export const Route = createFileRoute("/_authenticated/affiche")({
  validateSearch: (search: Record<string, unknown>): { site?: string | undefined } => ({
    site: typeof search["site"] === "string" ? (search["site"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Affiche d'accueil — Nova Pass" },
      { name: "description", content: "Affiche A4 portrait du QR code d'accueil, prête à imprimer en PDF." },
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
  const [origine, setOrigine] = useState("");
  useEffect(() => setOrigine(window.location.origin), []);

  // Une hôtesse n'imprime que l'affiche de son propre site.
  const siteId = profil?.estSuperAdmin ? (siteParam ?? profil?.siteId ?? sites?.[0]?.id) : profil?.siteId;
  const site = (sites ?? []).find((s) => s.id === siteId) ?? null;
  const url = origine && site ? `${origine}/checkin?site=${site.id}` : "";

  return (
    <div className="bg-muted/40 py-6 print:bg-transparent print:py-0">
      <style>{printCss}</style>
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <p className="text-sm text-muted-foreground">
          Choisissez « Enregistrer au format PDF », format A4 portrait, marges « Aucune ».
        </p>
        <button
          onClick={() => window.print()}
          disabled={!url}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Télécharger en PDF / Imprimer
        </button>
      </div>

      <div className="affiche-a4 relative isolate mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-foreground shadow-2xl">
        <img src={novaReception.url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]" />
        <div className="absolute inset-0 -z-10 bg-hero-overlay" aria-hidden="true" />

        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-hero-line px-[14mm] pb-[7mm] pt-[12mm]">
          <img src={novaSerenityLogo.url} alt="Nova Serenity" className="h-auto w-24" />
          <SiteBrand logoUrl={site?.logo_url} nom={site?.nom} />
          <span />
        </header>

        <section className="flex flex-1 flex-col items-center px-[14mm] pt-[12mm] text-center">
          <p className="text-2xl font-bold uppercase tracking-widest text-pass-pastel">Accueil visiteurs</p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight text-hero-foreground">
            Bienvenue chez {site?.nom ?? "Nova Serenity"}
          </h1>

          <div className="mt-[12mm] rounded-2xl border border-hero-line bg-qr-surface p-6 shadow-2xl">
            {url ? <SiteQr value={url} logoUrl={site?.logo_url} size={330} /> : <div className="h-[330px] w-[330px]" />}
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
