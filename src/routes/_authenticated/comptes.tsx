import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listerSites } from "@/lib/visites.functions";
import { listerComptes, creerCompte, modifierCompte, supprimerCompte } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/comptes")({
  head: () => ({
    meta: [
      { title: "Comptes d'accueil — Nova Pass" },
      {
        name: "description",
        content: "Créez les comptes hôtesses, rattachez-les à un site et gérez leurs accès.",
      },
      { property: "og:title", content: "Comptes d'accueil — Nova Pass" },
      { property: "og:description", content: "Gestion des accès au registre des visiteurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Comptes,
});

const inputClass =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function Comptes() {
  const queryClient = useQueryClient();
  const chargerComptes = useServerFn(listerComptes);
  const chargerSites = useServerFn(listerSites);
  const creer = useServerFn(creerCompte);
  const modifier = useServerFn(modifierCompte);
  const supprimer = useServerFn(supprimerCompte);

  const { data: comptes, isLoading } = useQuery({
    queryKey: ["comptes"],
    queryFn: () => chargerComptes(),
  });
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => chargerSites() });

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [siteId, setSiteId] = useState("");
  const [superAdmin, setSuperAdmin] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);
    try {
      await creer({ data: { email, motDePasse, siteId, superAdmin } });
      setEmail("");
      setMotDePasse("");
      setSuperAdmin(false);
      setMessage("Compte créé. Communiquez l'e-mail et le mot de passe à la personne.");
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le compte n'a pas pu être créé.");
    }
  }

  async function changerSite(userId: string, nouveauSite: string) {
    await modifier({ data: { userId, siteId: nouveauSite || null } });
    queryClient.invalidateQueries({ queryKey: ["comptes"] });
  }

  async function reinitialiser(userId: string) {
    const nouveau = prompt("Nouveau mot de passe (8 caractères minimum) :");
    if (!nouveau) return;
    await modifier({ data: { userId, motDePasse: nouveau } });
    alert("Mot de passe mis à jour.");
  }

  async function onSupprimer(userId: string) {
    if (!confirm("Supprimer définitivement ce compte ?")) return;
    try {
      await supprimer({ data: { userId } });
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Suppression impossible.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comptes d'accueil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vous seule décidez des adresses autorisées à consulter le registre.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
      >
        <div>
          <label className="text-xs font-medium text-muted-foreground">E-mail</label>
          <input
            className={inputClass}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Mot de passe initial</label>
          <input
            className={inputClass}
            type="text"
            required
            minLength={8}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Site rattaché</label>
          <select
            className={inputClass}
            required
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Choisir un site…</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={superAdmin}
            onChange={(e) => setSuperAdmin(e.target.checked)}
          />
          Super administrateur (accès à tous les sites)
        </label>

        {erreur && <p className="text-sm text-destructive sm:col-span-2">{erreur}</p>}
        {message && <p className="text-sm text-primary sm:col-span-2">{message}</p>}

        <div className="sm:col-span-2">
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Créer le compte
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Site</th>
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
            {(comptes ?? []).map((c) => (
              <tr key={c.userId} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{c.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.estSuperAdmin ? "Super admin" : "Hôtesse"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={c.siteId ?? ""}
                    onChange={(e) => changerSite(c.userId, e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                  >
                    <option value="">Aucun</option>
                    {(sites ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => reinitialiser(c.userId)}
                    className="mr-2 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                  >
                    Mot de passe
                  </button>
                  <button
                    onClick={() => onSupprimer(c.userId)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-accent"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
