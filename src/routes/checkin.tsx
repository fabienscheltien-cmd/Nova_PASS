import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { enregistrerVisite, listerSitesPublics } from "@/lib/visites.functions";


import novaReception from "@/assets/nova-reception.jpg.asset.json";
import { SiteBrand } from "@/components/site-brand";

export const Route = createFileRoute("/checkin")({
  validateSearch: (search: Record<string, unknown>): { site?: string | undefined } => ({
    site: typeof search["site"] === "string" ? (search["site"] as string) : undefined,
  }),
  head: () => ({

    meta: [
      { title: "Enregistrement visiteur — Accueil" },
      {
        name: "description",
        content: "Renseignez vos informations d'arrivée : nom, entreprise et personne visitée.",
      },
      { property: "og:title", content: "Enregistrement visiteur — Accueil" },
      {
        property: "og:description",
        content: "Formulaire d'arrivée des visiteurs sur site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Checkin,
});

function maintenantLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const labelClass = "block text-sm font-medium text-hero-foreground";
const inputClass =
  "mt-1.5 w-full rounded-lg border border-hero-line bg-hero-surface px-3 py-2.5 text-base text-hero-foreground placeholder:text-hero-muted outline-none focus:border-pass-pastel focus:ring-2 focus:ring-pass-pastel/30";

function Checkin() {
  const envoyer = useServerFn(enregistrerVisite);
  const chargerSites = useServerFn(listerSitesPublics);
  const { site: siteParam } = Route.useSearch();
  const { data: sites } = useQuery({ queryKey: ["sitesPublics"], queryFn: () => chargerSites() });

  const [siteId, setSiteId] = useState(siteParam ?? "");
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    entreprise: "",
    personneVisitee: "",
    entrepriseVisitee: "",
    arriveeAt: maintenantLocal(),
  });
  const [etat, setEtat] = useState<"saisie" | "envoi" | "ok">("saisie");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId && sites && sites.length > 0) setSiteId(sites[0]!.id);
  }, [sites, siteId]);

  const siteActif = (sites ?? []).find((s) => s.id === siteId) ?? null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!siteId) {
      setErreur("Merci de choisir le site où vous vous présentez.");
      return;
    }
    setEtat("envoi");
    try {
      // L'heure saisie est locale au navigateur : on la convertit en instant ISO avec fuseau.
      await envoyer({ data: { ...form, arriveeAt: new Date(form.arriveeAt).toISOString(), siteId } });
      setEtat("ok");
    } catch {
      setErreur("L'enregistrement n'a pas pu être effectué. Merci de prévenir l'accueil.");
      setEtat("saisie");
    }
  }


  if (etat === "ok") {
    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-foreground">
        <img
          src={novaReception.url}
          alt="Accueil Nova Serenity"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-hero-overlay" aria-hidden="true" />

        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
          <header className="flex items-center justify-between border-b border-hero-line pb-5">
            <Link
              to="/"
              className="flex items-center gap-3 sm:gap-4"
            >
              <SiteBrand logoUrl={siteActif?.logo_url} nom={siteActif?.nom} />
            </Link>
            <Link
              to="/registre"
              className="rounded-md border border-hero-line bg-hero-surface px-4 py-2 text-sm font-medium text-hero-foreground backdrop-blur-md transition-colors hover:bg-hero-surface-strong"
            >
              Espace accueil
            </Link>
          </header>

          <section className="flex flex-1 items-center justify-center py-8 sm:py-12">
            <div className="max-w-sm rounded-2xl border border-hero-line bg-hero-surface p-8 text-center shadow-2xl backdrop-blur-md">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pass-pastel/20 text-2xl text-pass-pastel">
                ✓
              </div>
              <h1 className="mt-6 text-2xl font-semibold text-hero-foreground">Merci {form.prenom} !</h1>
              <p className="mt-3 text-sm text-hero-muted">
                Votre arrivée est enregistrée et l'accueil a été prévenu. Merci de patienter quelques
                instants.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-foreground">
      <img
        src={novaReception.url}
        alt="Accueil Nova Serenity"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-hero-overlay" aria-hidden="true" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="flex items-center justify-between border-b border-hero-line pb-5">
          <Link
            to="/"
            className="flex items-center gap-3 sm:gap-4"
          >
            <SiteBrand logoUrl={siteActif?.logo_url} nom={siteActif?.nom} />
          </Link>
          <Link
            to="/registre"
            className="rounded-md border border-hero-line bg-hero-surface px-4 py-2 text-sm font-medium text-hero-foreground backdrop-blur-md transition-colors hover:bg-hero-surface-strong"
          >
            Espace accueil
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="w-full max-w-md rounded-2xl border border-hero-line bg-hero-surface p-6 shadow-2xl backdrop-blur-md sm:p-8">
            <p className="text-xs font-semibold uppercase text-pass-pastel">Enregistrement visiteur</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-hero-foreground sm:text-3xl">
              Bienvenue chez Nova Serenity
            </h1>
            <p className="mt-2 text-sm text-hero-muted">
              Tous les champs sont obligatoires.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              {siteActif && (
                <div className="rounded-lg border border-hero-line bg-hero-surface px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pass-pastel">Site</p>
                  <p className="text-sm font-medium text-hero-foreground">{siteActif.nom}</p>
                  <p className="text-xs text-hero-muted">
                    {[siteActif.adresse, siteActif.code_postal, siteActif.ville]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>
              )}

              <div>
                <label className={labelClass} htmlFor="prenom">
                  Prénom
                </label>
                <input
                  id="prenom"
                  className={inputClass}
                  value={form.prenom}
                  onChange={set("prenom")}
                  maxLength={80}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="nom">
                  Nom
                </label>
                <input
                  id="nom"
                  className={inputClass}
                  value={form.nom}
                  onChange={set("nom")}
                  maxLength={80}
                  required
                  autoComplete="family-name"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="entreprise">
                  Votre entreprise
                </label>
                <input
                  id="entreprise"
                  className={inputClass}
                  value={form.entreprise}
                  onChange={set("entreprise")}
                  maxLength={120}
                  required
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="entrepriseVisitee">
                  Entreprise visitée
                </label>
                <input
                  id="entrepriseVisitee"
                  className={inputClass}
                  value={form.entrepriseVisitee}
                  onChange={set("entrepriseVisitee")}
                  maxLength={120}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="personneVisitee">
                  Personne visitée
                </label>
                <input
                  id="personneVisitee"
                  className={inputClass}
                  value={form.personneVisitee}
                  onChange={set("personneVisitee")}
                  maxLength={120}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="arriveeAt">
                  Date et heure d'arrivée
                </label>
                <input
                  id="arriveeAt"
                  type="datetime-local"
                  className={inputClass}
                  value={form.arriveeAt}
                  onChange={set("arriveeAt")}
                  required
                />
              </div>

              {erreur && (
                <p className="rounded-lg bg-destructive/20 px-3 py-2 text-sm text-destructive-foreground">
                  {erreur}
                </p>
              )}

              <button
                type="submit"
                disabled={etat === "envoi"}
                className="w-full rounded-lg bg-pass-pastel px-4 py-3 text-base font-semibold text-hero-foreground shadow-lg transition-colors hover:bg-pass-pastel/90 disabled:opacity-60"
              >
                {etat === "envoi" ? "Enregistrement…" : "Valider mon arrivée"}
              </button>
              <p className="pt-1 text-center text-[11px] leading-snug text-hero-muted/80">
                Données collectées uniquement pour la sécurité et l'accueil du site, conservées
                pour une durée limitée et jamais transmises à des tiers. Conformément au RGPD,
                vous pouvez exercer vos droits d'accès, de rectification et d'effacement auprès
                de l'accueil.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
