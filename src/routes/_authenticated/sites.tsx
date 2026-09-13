import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listerSites } from "@/lib/visites.functions";
import { enregistrerSite, supprimerSite } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/sites")({
  head: () => ({
    meta: [
      { title: "Sites — Nova Pass" },
      {
        name: "description",
        content: "Gérez les sites d'accueil : nom, adresse physique et e-mail de notification.",
      },
      { property: "og:title", content: "Sites — Nova Pass" },
      { property: "og:description", content: "Gestion des sites multisite Nova Pass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sites,
});

const inputClass =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

const vide = {
  id: undefined as string | undefined,
  nom: "",
  adresse: "",
  codePostal: "",
  ville: "",
  pays: "France",
  emailAccueil: "",
};

function Sites() {
  const queryClient = useQueryClient();
  const charger = useServerFn(listerSites);
  const enregistrer = useServerFn(enregistrerSite);
  const supprimer = useServerFn(supprimerSite);

  const { data: sites, isLoading, isError } = useQuery({
    queryKey: ["sites"],
    queryFn: () => charger(),
  });

  const [form, setForm] = useState(vide);
  const [erreur, setErreur] = useState<string | null>(null);

  const set = (k: keyof typeof vide) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      await enregistrer({ data: form });
      setForm(vide);
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    } catch {
      setErreur("Le site n'a pas pu être enregistré.");
    }
  }

  async function onSupprimer(id: string) {
    if (!confirm("Supprimer ce site ? Les visites déjà enregistrées sont conservées.")) return;
    await supprimer({ data: { id } });
    queryClient.invalidateQueries({ queryKey: ["sites"] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sites</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Chaque site possède son propre QR code et son adresse e-mail d'accueil.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Nom du site</label>
          <input className={inputClass} value={form.nom} onChange={set("nom")} required maxLength={120} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">E-mail de l'accueil</label>
          <input
            className={inputClass}
            type="email"
            value={form.emailAccueil}
            onChange={set("emailAccueil")}
            placeholder="accueil@nova-serenity.fr"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Adresse</label>
          <input className={inputClass} value={form.adresse} onChange={set("adresse")} maxLength={200} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Code postal</label>
          <input className={inputClass} value={form.codePostal} onChange={set("codePostal")} maxLength={20} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Ville</label>
          <input className={inputClass} value={form.ville} onChange={set("ville")} maxLength={120} />
        </div>

        {erreur && <p className="text-sm text-destructive sm:col-span-2">{erreur}</p>}

        <div className="flex gap-2 sm:col-span-2">
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {form.id ? "Enregistrer les modifications" : "Ajouter le site"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(vide)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Adresse</th>
              <th className="px-4 py-3">E-mail accueil</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-destructive">
                  Liste indisponible.
                </td>
              </tr>
            )}
            {(sites ?? []).map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{s.nom}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[s.adresse, s.code_postal, s.ville].filter(Boolean).join(" ")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.email_accueil ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() =>
                      setForm({
                        id: s.id,
                        nom: s.nom,
                        adresse: s.adresse ?? "",
                        codePostal: s.code_postal ?? "",
                        ville: s.ville ?? "",
                        pays: s.pays ?? "France",
                        emailAccueil: s.email_accueil ?? "",
                      })
                    }
                    className="mr-2 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => onSupprimer(s.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-accent"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && (sites ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun site pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
