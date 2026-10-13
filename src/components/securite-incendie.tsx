import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listerVisites } from "@/lib/visites.functions";
import { exporter } from "@/components/registres-accueil";

type V = {
  id: string;
  nom: string;
  prenom: string;
  entreprise: string;
  personne_visitee: string;
  entreprise_visitee: string;
  arrivee_at: string;
  depart_at: string | null;
  sites: { nom: string } | null;
};

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function SecuriteIncendie({ siteId }: { siteId: string | undefined }) {
  const charger = useServerFn(listerVisites);
  const [ouvert, setOuvert] = useState(false);
  const jour = new Date().toLocaleDateString("sv-SE");
  const { data } = useQuery({
    queryKey: ["presents", jour, siteId],
    queryFn: () => charger({ data: { du: jour, au: jour, recherche: "", siteId } }),
    refetchInterval: 30000,
  });
  const presents = ((data ?? []) as V[])
    .filter((v) => !v.depart_at)
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"));

  const lignes = () =>
    presents.map((v) => ({
      Nom: v.nom,
      Prénom: v.prenom,
      "Entreprise du visiteur": v.entreprise,
      "Personne visitée": v.personne_visitee,
      "Entreprise visitée": v.entreprise_visitee,
      Site: v.sites?.nom ?? "",
      Arrivée: heure(v.arrivee_at),
      Présent: "",
    }));

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        title="Liste d'évacuation des personnes présentes"
        className="mt-4 inline-flex items-center gap-2.5 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-emerald-600/20"
      >
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        Live : {presents.length} présent{presents.length > 1 ? "s" : ""} sur site
      </button>
      {ouvert && (
        <div
          className="fixed inset-0 z-50 overflow-auto bg-background p-6 print:p-0"
          id="liste-incendie"
        >
          <style>{`@media print { body * { visibility: hidden } #liste-incendie, #liste-incendie * { visibility: visible } #liste-incendie { position: absolute; inset: 0 } .no-print { display: none !important } }`}</style>
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Liste d'évacuation</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })} —{" "}
                  {presents.length} visiteur{presents.length > 1 ? "s" : ""} présent
                  {presents.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="no-print flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                >
                  Imprimer
                </button>
                <button
                  onClick={() => exporter(lignes(), "liste-evacuation", "xlsx")}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                >
                  Excel
                </button>
                <button
                  onClick={() => exporter(lignes(), "liste-evacuation", "csv")}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                >
                  CSV
                </button>
                <button
                  onClick={() => setOuvert(false)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                >
                  Fermer
                </button>
              </div>
            </div>
            <table className="mt-6 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-foreground text-foreground">
                  <th className="w-10 py-2">✓</th>
                  <th className="py-2">Visiteur</th>
                  <th className="py-2">Entreprise</th>
                  <th className="py-2">Personne / entreprise visitée</th>
                  <th className="py-2">Arrivée</th>
                </tr>
              </thead>
              <tbody>
                {presents.map((v) => (
                  <tr key={v.id} className="border-b border-border text-foreground">
                    <td className="py-2">
                      <span className="inline-block h-4 w-4 border border-foreground" />
                    </td>
                    <td className="py-2 font-medium">
                      {v.prenom} {v.nom}
                    </td>
                    <td className="py-2">{v.entreprise}</td>
                    <td className="py-2">
                      {v.personne_visitee} — {v.entreprise_visitee}
                    </td>
                    <td className="py-2">{heure(v.arrivee_at)}</td>
                  </tr>
                ))}
                {presents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Aucun visiteur présent sur site.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
