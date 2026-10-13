import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteQr, SiteBrand } from "@/components/site-brand";
import { supabase } from "@/integrations/supabase/client";
import { monProfil } from "@/lib/visites.functions";
import { useEffect, useState } from "react";
import { listerSitesPublics } from "@/lib/visites.functions";

import novaReception from "@/assets/nova-reception.jpg.asset.json";
import novaSerenityLogo from "@/assets/nova-serenity.png.asset.json";
import { URL_SITE_NOVA_SERENITY, urlCheckin } from "@/lib/config";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { site?: string | undefined } => ({
    site: typeof search["site"] === "string" ? (search["site"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Accueil visiteurs — Enregistrement par QR code" },
      {
        name: "description",
        content:
          "Affichez le QR code à l'accueil : chaque visiteur s'enregistre en quelques secondes et l'hôtesse reçoit ses informations.",
      },
      { property: "og:title", content: "Accueil visiteurs — Enregistrement par QR code" },
      {
        property: "og:description",
        content: "Registre de visiteurs par QR code pour l'accueil d'entreprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { site: siteParam } = Route.useSearch();
  const [siteId, setSiteId] = useState(siteParam ?? "");
  const chargerSites = useServerFn(listerSitesPublics);
  const { data: sites, isError: sitesIndisponibles } = useQuery({
    queryKey: ["sitesPublics"],
    queryFn: () => chargerSites(),
  });

  const chargerProfil = useServerFn(monProfil);
  const [siteConnecte, setSiteConnecte] = useState<string | null>(null);

  useEffect(() => {
    // Si une hôtesse est connectée, l'écran affiche automatiquement son site.
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) return;
        try {
          const p = await chargerProfil();
          if (p.siteId) setSiteConnecte(p.siteId);
        } catch {
          /* ignoré */
        }
      })
      .catch(() => {
        /* ignoré */
      });
  }, [chargerProfil]);

  useEffect(() => {
    if (!siteParam && siteConnecte) setSiteId(siteConnecte);
  }, [siteParam, siteConnecte]);

  useEffect(() => {
    if (!sites || sites.length === 0 || !siteId) return;
    if (!sites.some((s) => s.id === siteId)) setSiteId("");
  }, [sites, siteId]);

  // Le site du compte connecté s'applique dès qu'il est connu (sans attendre l'effet ci-dessus).
  const siteVoulu = siteId || (!siteParam && siteConnecte) || "";
  const siteActif = (sites ?? []).find((s) => s.id === siteVoulu) ?? null;
  // Site demandé (lien ou compte connecté) dont la liste n'est pas encore arrivée.
  const siteEnAttente = siteVoulu !== "" && sites === undefined && !sitesIndisponibles;
  // Site actif (lien /?site=… ou compte du site connecté) : QR du formulaire de ce
  // site, toujours sur l'adresse publique. Sinon : QR vers le site Nova Serenity.
  const url = siteActif ? urlCheckin(siteActif.id) : siteEnAttente ? "" : URL_SITE_NOVA_SERENITY;

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-foreground">
      <img
        src={novaReception.url}
        alt="Accueil Nova Serenity"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-hero-overlay" aria-hidden="true" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-hero-line pb-5">
          <div className="flex justify-start">
            <img
              src={novaSerenityLogo.url}
              alt="Nova Serenity"
              className="h-auto w-20 drop-shadow-sm sm:w-24"
            />
          </div>
          <div className="flex items-center justify-center">
            <SiteBrand logoUrl={siteActif?.logo_url} nom={siteActif?.nom} />
          </div>
          <div className="flex justify-end">
            <Link
              to="/registre"
              className="rounded-md border border-hero-line bg-hero-surface px-4 py-2 text-sm font-medium text-hero-foreground backdrop-blur-md transition-colors hover:bg-hero-surface-strong"
            >
              Espace accueil
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-8 sm:py-12">
          <p className="mb-8 text-center text-2xl font-bold uppercase tracking-widest text-pass-pastel sm:mb-10 sm:text-3xl lg:text-4xl">
            Accueil visiteurs
          </p>
          <div className="w-full max-w-lg text-center sm:text-left">
            <h1 className="text-4xl font-semibold text-hero-foreground sm:text-5xl lg:text-6xl">
              {siteActif ? `Bienvenue chez ${siteActif.nom}` : "Bienvenue chez Nova Serenity"}
            </h1>
            {(url || siteEnAttente) && (
              <>
                <p className="mt-4 max-w-md text-base leading-relaxed text-hero-muted sm:text-lg">
                  {siteActif || siteEnAttente
                    ? "Scannez le QR code pour vous enregistrer. L'accueil sera prévenu immédiatement."
                    : "Scannez le QR code pour découvrir Nova Serenity."}
                </p>

                <div className="mt-7 inline-flex overflow-hidden rounded-2xl border border-hero-line shadow-2xl">
                  {url ? (
                    <div
                      aria-label={
                        siteActif
                          ? "QR code vers le formulaire visiteur"
                          : "QR code vers le site Nova Serenity"
                      }
                    >
                      <SiteQr
                        value={url}
                        logoUrl={siteActif ? siteActif.logo_url : novaSerenityLogo.url}
                        size={244}
                      />
                    </div>
                  ) : (
                    <div className="h-[244px] w-[244px] bg-white" aria-hidden="true" />
                  )}
                </div>
              </>
            )}

            <p className="mt-5 text-sm text-hero-muted">
              Pas de téléphone ?{" "}
              <Link
                to="/checkin"
                search={{ site: siteActif?.id }}
                className="font-semibold text-hero-foreground underline decoration-pass underline-offset-4"
              >
                Remplir le formulaire ici
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
