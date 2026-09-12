import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listerVisites } from "@/lib/visites.functions";

export const Route = createFileRoute("/_authenticated/registre")({
  head: () => ({
    meta: [
      { title: "Registre des visiteurs — Accueil" },
      {
        name: "description",
        content: "Consultez, filtrez par dates et exportez le registre des visiteurs du site.",
      },
      { property: "og:title", content: "Registre des visiteurs — Accueil" },
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
};

const inputClass =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function formatFr(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

type ColTri = "arrivee_at" | "visiteur" | "entreprise" | "personne_visitee" | "entreprise_visitee";
type SensTri = "asc" | "desc";

function Registre() {
  const charger = useServerFn(listerVisites);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<ColTri>("arrivee_at");
  const [sens, setSens] = useState<SensTri>("desc");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["visites", du, au, recherche],
    queryFn: () => charger({ data: { du: du || undefined, au: au || undefined, recherche } }),
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
    if (tri === col) {
      setSens(sens === "asc" ? "desc" : "asc");
    } else {
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
        <span className="text-[10px]">
          {tri === col ? (sens === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  async function exporterExcel() {
    const XLSX = await import("xlsx");
    const lignes = visites.map((v) => ({
      "Date et heure": formatFr(v.arrivee_at),
      Nom: v.nom,
      Prénom: v.prenom,
      "Entreprise du visiteur": v.entreprise,
      "Personne visitée": v.personne_visitee,
      "Entreprise visitée": v.entreprise_visitee,
    }));
    const feuille = XLSX.utils.json_to_sheet(lignes);
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Visites");
    XLSX.writeFile(classeur, `registre-visiteurs-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
          </p>
        </div>
        <button
          onClick={exporterExcel}
          disabled={visites.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Exporter en Excel
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
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
              <th className="px-4 py-3">Date et heure</th>
              <th className="px-4 py-3">Visiteur</th>
              <th className="px-4 py-3">Entreprise</th>
              <th className="px-4 py-3">Personne visitée</th>
              <th className="px-4 py-3">Entreprise visitée</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-destructive">
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
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
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
