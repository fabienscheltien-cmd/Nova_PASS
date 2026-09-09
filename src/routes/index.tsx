import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

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
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/checkin`);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-14 text-center print:py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Accueil visiteurs
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Bienvenue
        </h1>
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          Scannez ce QR code avec votre téléphone pour vous enregistrer. L'accueil sera prévenu
          immédiatement.
        </p>

        <div className="mt-10 rounded-3xl border border-border bg-card p-8 shadow-sm">
          {url ? (
            <QRCodeSVG value={url} size={260} level="M" marginSize={2} />
          ) : (
            <div className="h-[260px] w-[260px] animate-pulse rounded-xl bg-muted" />
          )}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Pas de téléphone ?{" "}
          <Link to="/checkin" className="font-medium text-primary underline underline-offset-4">
            Remplir le formulaire ici
          </Link>
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Imprimer l'affichette
          </button>
          <Link
            to="/registre"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Espace accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
