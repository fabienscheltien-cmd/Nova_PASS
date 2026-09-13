import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listerVisites, listerSites, monProfil } from "@/lib/visites.functions";

export const Route = createFileRoute("/_authenticated/registre")({
  head: () => ({
    meta: [
      { title: "Registre des visiteurs — Nova Pass" },
      {
        name: "description",
        content: "Consultez, filtrez par site et par dates, triez et exportez le registre des visiteurs.",
      },
      { property: "og:title", content: "Registre des visiteurs — Nova Pass" },
      { property: "og:description", content: "Historique des arrivées avec filtres et export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Registre,
});

type Visite = {
  id: string;
  nom: string;
  prenom: string;
  entreprise: string;
  personne_visitee: string;
  entreprise_visitee: string;
  arrivee_at: string;
  site_id: string | null;
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
  | "arrivee_at"
  | "visiteur"
  | "entreprise"
  | "personne_visitee"
  | "entreprise_visitee"
  | "site";
type SensTri = "asc" | "desc";

function Registre() {
  const charger = useServerFn(listerVisites);
  const chargerSites = useServerFn(listerSites);
  const chargerProfil = useServerFn(monProfil);

  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState("");
  const [site, setSite] = useState("");
  const [tri, setTri] = useState<ColTri>("arrivee_at");
  const [sens, setSens] = useState<SensTri>("desc");

  const { data: profil } = useQuery({ queryKey: ["monProfil"], queryFn: () => chargerProfil() });
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => chargerSites() });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["visites", du, au, recherche, site],
    queryFn: () =>
      charger({
        data: {
          du: du || undefined,
          au: au || undefined,
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

  const nomFichier = () => `registre-visiteurs-${new Date().toISOString().slice(0, 10)}`;

  async function exporterExcel() {
    const XLSX = await import("xlsx");
    const feuille = XLSX.utils.json_to_sheet(lignesExport());
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Visites");
    XLSX.writeFile(classeur, `${nomFichier()}.xlsx`);
  }

  async function exporterCsv() {
    const XLSX = await import("xlsx");
    const feuille = XLSX.utils.json_to_sheet(lignesExport());
    const csv = XLSX.utils.sheet_to_csv(feuille);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomFichier()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Registre des visiteurs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visites.length} visite{visites.length > 1 ? "s" : ""} affichée
            {visites.length > 1 ? "s" : ""}
            {!profil?.estSuperAdmin && profil?.siteNom ? ` · ${profil.siteNom}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exporterExcel}
            disabled={visites.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Export Excel
          </button>
          <button
            onClick={exporterCsv}
            disabled={visites.length === 0}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

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
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="du">
            Du
          </label>
          <input
            id="du"
            type="date"
            value={du}
            onChange={(e) => setDu(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="au">
            Au
          </label>
          <input
            id="au"
            type="date"
            value={au}
            onChange={(e) => setAu(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
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
            setDu("");
            setAu("");
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
    </div>
  );
}
