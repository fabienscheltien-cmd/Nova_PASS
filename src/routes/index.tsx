import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { listerSitesPublics } from "@/lib/visites.functions";

import novaReception from "@/assets/nova-reception.jpg.asset.json";
import novaSerenityLogo from "@/assets/nova-serenity.png.asset.json";
import novaLogo from "@/assets/nova-logo.png.asset.json";


export const Route = createFileRoute("/")({
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
  const [origine, setOrigine] = useState("");
  const [siteId, setSiteId] = useState("");
  const chargerSites = useServerFn(listerSitesPublics);
  const { data: sites } = useQuery({ queryKey: ["sitesPublics"], queryFn: () => chargerSites() });

  useEffect(() => {
    setOrigine(window.location.origin);
  }, []);

  useEffect(() => {
    if (!siteId && sites && sites.length > 0) setSiteId(sites[0]!.id);
  }, [sites, siteId]);

  const siteActif = (sites ?? []).find((s) => s.id === siteId) ?? null;
  const url = origine
    ? `${origine}/checkin${siteId ? `?site=${siteId}` : ""}`
    : "";


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
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={novaLogo.url}
              alt="NOVA"
              className="h-8 w-auto drop-shadow-sm sm:h-10"
            />
            <span className="text-2xl font-bold uppercase tracking-wide text-pass-pastel sm:text-3xl">
              Pass
            </span>
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
              Bienvenue chez Nova Serenity
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-hero-muted sm:text-lg">
              Scannez le QR code pour vous enregistrer. L'accueil sera prévenu immédiatement.
            </p>

            {(sites?.length ?? 0) > 1 && (
              <div className="mt-5">
                <label
                  className="block text-xs font-semibold uppercase tracking-wide text-pass-pastel"
                  htmlFor="site"
                >
                  Site
                </label>
                <select
                  id="site"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="mt-1.5 rounded-lg border border-hero-line bg-hero-surface px-3 py-2 text-sm text-hero-foreground outline-none"
                >
                  {(sites ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {siteActif && (
              <p className="mt-3 text-sm text-hero-muted">
                {siteActif.nom}
                {[siteActif.adresse, siteActif.code_postal, siteActif.ville].filter(Boolean).length >
                  0 && (
                  <>
                    {" — "}
                    {[siteActif.adresse, siteActif.code_postal, siteActif.ville]
                      .filter(Boolean)
                      .join(" ")}
                  </>
                )}
              </p>
            )}



            <div className="mt-7 inline-flex rounded-xl border border-hero-line bg-qr-surface p-4 shadow-2xl sm:p-5">
              {url ? (
                <QRCodeSVG
                  value={url}
                  size={244}
                  level="H"
                  marginSize={2}
                  fgColor="var(--qr-foreground)"
                  bgColor="var(--qr-background)"
                  imageSettings={{
                    src: novaLogo.url,
                    width: 78,
                    height: 26,
                    excavate: true,
                  }}
                  aria-label="QR code vers le formulaire visiteur Nova Serenity"
                />
              ) : (
                <div className="h-[244px] w-[244px] animate-pulse rounded-md bg-muted" />
              )}
            </div>

            <p className="mt-5 text-sm text-hero-muted">
              Pas de téléphone ?{" "}
              <Link
                to="/checkin"
                search={{ site: siteId || undefined }}
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
