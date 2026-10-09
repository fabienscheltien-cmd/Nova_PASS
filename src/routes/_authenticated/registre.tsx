import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listerVisites, listerSites, monProfil } from "@/lib/visites.functions";
import {
  AjoutVisiteur,
  BoutonsExport,
  exporter,
  RegistreDepots,
  RegistreObjets,
} from "@/components/registres-accueil";

const ONGLETS = {
  visiteurs: "Visiteurs",
  objets: "Objets trouvés",
  courrier: "Courrier, colis & clés",
} as const;
type Onglet = keyof typeof ONGLETS;

export const Route = createFileRoute("/_authenticated/registre")({
  validateSearch: (search: Record<string, unknown>): { onglet?: Onglet | undefined } => ({
    onglet:
      typeof search["onglet"] === "string" && search["onglet"] in ONGLETS
        ? (search["onglet"] as Onglet)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Registre des visiteurs — Nova Pass" },
      {
        name: "description",
        content:
          "Consultez, filtrez par site et par dates, triez et exportez le registre des visiteurs.",
      },
      { property: "og:title", content: "Registre des visiteurs — Nova Pass" },
      { property: "og:description", content: "Historique des arrivées avec filtres et export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Registre,
});

function Registre() {
  const { onglet = "visiteurs" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const chargerSites = useServerFn(listerSites);
  const chargerProfil = useServerFn(monProfil);
  const { data: profil } = useQuery({ queryKey: ["monProfil"], queryFn: () => chargerProfil() });
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => chargerSites() });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Registre</h1>
      <nav
        className="mt-4 flex flex-wrap gap-1 border-b border-border"
        aria-label="Rubriques du registre"
      >
        {(Object.keys(ONGLETS) as Onglet[]).map((o) => (
          <button
            key={o}
            onClick={() => navigate({ search: { onglet: o === "visiteurs" ? undefined : o } })}
            aria-current={o === onglet ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              o === onglet
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {ONGLETS[o]}
          </button>
        ))}
      </nav>
      <div className="mt-6">
        {onglet === "objets" && <RegistreObjets sites={sites} profil={profil} />}
        {onglet === "courrier" && <RegistreDepots sites={sites} profil={profil} />}
        {onglet === "visiteurs" && <Visiteurs />}
      </div>
    </div>
  );
}

type Visite = {
  id: string;
  nom: string;
  prenom: string;
  entreprise: string;
  personne_visitee: string;
  entreprise_visitee: string;
  arrivee_at: string;
  site_id: string | null;
  saisie_manuelle?: boolean;
  sites: { nom: string; adresse: string; code_postal: string; ville: string } | null;
};

const inputClass =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function formatFr(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function adresseSite(v: Visite) {
  const s = v.sites;
  if (!s) return "";
  return [s.adresse, s.code_postal, s.ville].filter(Boolean).join(" ");
}

type ColTri =
  "arrivee_at" | "visiteur" | "entreprise" | "personne_visitee" | "entreprise_visitee" | "site";
type SensTri = "asc" | "desc";

function Visiteurs() {
  const charger = useServerFn(listerVisites);
  const chargerSites = useServerFn(listerSites);
  const chargerProfil = useServerFn(monProfil);

  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [recherche, setRecherche] = useState("");
  const [site, setSite] = useState("");
  const [tri, setTri] = useState<ColTri>("arrivee_at");
  const [sens, setSens] = useState<SensTri>("desc");

  const { data: profil } = useQuery({ queryKey: ["monProfil"], queryFn: () => chargerProfil() });
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => chargerSites() });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["visites", date, heure, recherche, site],
    queryFn: () =>
      charger({
        data: {
          du: date || undefined,
          au: date || undefined,
          heure: date && heure ? heure : undefined,
          recherche,
          siteId: site || undefined,
        },
      }),
    refetchInterval: 30000,
  });

  const visites = useMemo(() => {
    const lignes = [...((data ?? []) as Visite[])];
    const cle = (v: Visite): string => {
      switch (tri) {
        case "visiteur":
          return `${v.nom} ${v.prenom}`.toLowerCase();
        case "entreprise":
          return v.entreprise.toLowerCase();
        case "personne_visitee":
          return v.personne_visitee.toLowerCase();
        case "entreprise_visitee":
          return v.entreprise_visitee.toLowerCase();
        case "site":
          return (v.sites?.nom ?? "").toLowerCase();
        default:
          return v.arrivee_at;
      }
    };
    lignes.sort((a, b) => {
      const comp = cle(a).localeCompare(cle(b), "fr");
      return sens === "asc" ? comp : -comp;
    });
    return lignes;
  }, [data, tri, sens]);

  function changerTri(col: ColTri) {
    if (tri === col) setSens(sens === "asc" ? "desc" : "asc");
    else {
      setTri(col);
      setSens(col === "arrivee_at" ? "desc" : "asc");
    }
  }

  function enteteTri(label: string, col: ColTri) {
    return (
      <button
        onClick={() => changerTri(col)}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
      >
        {label}
        <span className="text-[10px]">{tri === col ? (sens === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    );
  }

  function lignesExport() {
    return visites.map((v) => ({
      "Date et heure": formatFr(v.arrivee_at),
      Site: v.sites?.nom ?? "",
      "Adresse du site": adresseSite(v),
      "Ville du site": v.sites?.ville ?? "",
      Nom: v.nom,
      Prénom: v.prenom,
      "Entreprise du visiteur": v.entreprise,
      "Personne visitée": v.personne_visitee,
      "Entreprise visitée": v.entreprise_visitee,
    }));
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {visites.length} visite{visites.length > 1 ? "s" : ""} affichée
          {visites.length > 1 ? "s" : ""}
        </p>
        <BoutonsExport
          desactive={visites.length === 0}
          onExport={(f) => exporter(lignesExport(), "registre-visiteurs", f)}
        />
      </div>

      <AjoutVisiteur profil={profil} />

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        {profil?.estSuperAdmin && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="site">
              Site
            </label>
            <select
              id="site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Tous les sites</option>
              {(sites ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="heure">
            Heure
          </label>
          <select
            id="heure"
            value={heure}
            disabled={!date}
            title={date ? undefined : "Choisissez d'abord une date"}
            onChange={(e) => setHeure(e.target.value)}
            className={`mt-1 ${inputClass} disabled:opacity-50`}
          >
            <option value="">Toute la journée</option>
            {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
              <option key={h} value={h}>
                {h} h – {h} h 59
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="q">
            Recherche
          </label>
          <input
            id="q"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, entreprise, personne visitée…"
            className={`mt-1 w-full ${inputClass}`}
          />
        </div>
        <button
          onClick={() => {
            setDate("");
            setHeure("");
            setRecherche("");
            setSite("");
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
        >
          Réinitialiser
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{enteteTri("Date et heure", "arrivee_at")}</th>
              <th className="px-4 py-3">{enteteTri("Site", "site")}</th>
              <th className="px-4 py-3">{enteteTri("Visiteur", "visiteur")}</th>
              <th className="px-4 py-3">{enteteTri("Entreprise", "entreprise")}</th>
              <th className="px-4 py-3">{enteteTri("Personne visitée", "personne_visitee")}</th>
              <th className="px-4 py-3">{enteteTri("Entreprise visitée", "entreprise_visitee")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  Le registre n'a pas pu être chargé.
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              visites.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-foreground">
                    {formatFr(v.arrivee_at)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="font-medium text-foreground">{v.sites?.nom ?? "—"}</span>
                    {adresseSite(v) && <div className="text-xs">{adresseSite(v)}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {v.prenom} {v.nom}
                    {v.saisie_manuelle && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase text-muted-foreground">
                        saisie manuelle
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{v.entreprise}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.personne_visitee}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.entreprise_visitee}</td>
                </tr>
              ))}
            {!isLoading && !isError && visites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Aucune visite pour ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
