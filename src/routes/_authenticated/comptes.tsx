import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listerSites } from "@/lib/visites.functions";
import {
  listerComptes,
  modifierCompte,
  supprimerCompte,
  inviterCompte,
  genererMotDePasse,
  envoyerLienMotDePasse,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/comptes")({
  head: () => ({
    meta: [
      { title: "Comptes d'accueil — Nova Pass" },
      {
        name: "description",
        content: "Invitez les adresses d'accueil, rattachez-les à un site et gérez leurs accès.",
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
const petitBouton =
  "rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50";

function Comptes() {
  const queryClient = useQueryClient();
  const chargerComptes = useServerFn(listerComptes);
  const chargerSites = useServerFn(listerSites);
  const inviter = useServerFn(inviterCompte);
  const generer = useServerFn(genererMotDePasse);
  const envoyerLien = useServerFn(envoyerLienMotDePasse);
  const modifier = useServerFn(modifierCompte);
  const supprimer = useServerFn(supprimerCompte);

  const { data: comptes, isLoading } = useQuery({ queryKey: ["comptes"], queryFn: () => chargerComptes() });
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => chargerSites() });

  const [email, setEmail] = useState("");
  const [siteId, setSiteId] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [mdpAffiche, setMdpAffiche] = useState<{ email: string; motDePasse: string } | null>(null);
  const [copie, setCopie] = useState(false);

  async function onInviter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);
    setEnvoi(true);
    try {
      await inviter({ data: { email, siteId, origine: window.location.origin } });
      setMessage(`Invitation envoyée à ${email}. La personne choisira son mot de passe depuis l'e-mail reçu.`);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "L'invitation n'a pas pu être envoyée.");
    } finally {
      setEnvoi(false);
    }
  }

  async function onGenerer(userId: string, mail: string) {
    if (!confirm(`Générer un nouveau mot de passe pour ${mail} ? L'ancien ne fonctionnera plus.`)) return;
    setOccupe(userId);
    setErreur(null);
    setMessage(null);
    try {
      const r = await generer({ data: { userId } });
      setCopie(false);
      setMdpAffiche({ email: mail, motDePasse: r.motDePasse });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setOccupe(null);
    }
  }

  async function onLien(userId: string, mail: string) {
    setOccupe(userId);
    setErreur(null);
    setMessage(null);
    try {
      await envoyerLien({ data: { email: mail, origine: window.location.origin } });
      setMessage(`Lien de réinitialisation envoyé à ${mail}.`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setOccupe(null);
    }
  }

  async function changerSite(userId: string, nouveauSite: string) {
    await modifier({ data: { userId, siteId: nouveauSite || null } });
    queryClient.invalidateQueries({ queryKey: ["comptes"] });
  }

  async function onSupprimer(userId: string, mail: string) {
    if (!confirm(`Retirer l'accès de ${mail} ? Le compte sera supprimé.`)) return;
    try {
      await supprimer({ data: { userId } });
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Suppression impossible.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comptes d'accueil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vous seule décidez des adresses autorisées. Chaque adresse est rattachée à un seul site.
      </p>

      <form onSubmit={onInviter} className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-email">E-mail de l'accueil</label>
          <input id="invite-email" className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="accueil@exemple.fr" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-site">Site rattaché</label>
          <select id="invite-site" className={inputClass} required value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Choisir un site…</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </div>
        <button disabled={envoi} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {envoi ? "Envoi…" : "Inviter par e-mail"}
        </button>
      </form>

      {erreur && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{message}</p>}

      {mdpAffiche && (
        <div role="dialog" aria-label="Nouveau mot de passe" className="mt-4 rounded-xl border border-primary/40 bg-card p-5">
          <p className="text-sm text-foreground">
            Nouveau mot de passe pour <strong>{mdpAffiche.email}</strong> — affiché une seule fois :
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code data-testid="mdp-genere" className="rounded-md bg-muted px-3 py-2 font-mono text-base text-foreground">{mdpAffiche.motDePasse}</code>
            <button
              onClick={() => navigator.clipboard.writeText(mdpAffiche.motDePasse).then(() => setCopie(true))}
              className={petitBouton}
            >
              {copie ? "Copié ✓" : "Copier"}
            </button>
            <button onClick={() => setMdpAffiche(null)} className={petitBouton}>Fermer</button>
          </div>
        </div>
      )}

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
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
            )}
            {(comptes ?? []).map((c) => (
              <tr key={c.userId} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{c.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.estSuperAdmin ? "Super admin" : "Hôtesse"}</td>
                <td className="px-4 py-3">
                  {c.estSuperAdmin ? (
                    <span className="text-muted-foreground">Tous les sites</span>
                  ) : (
                    <select
                      value={c.siteId ?? ""}
                      onChange={(e) => changerSite(c.userId, e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="">Aucun</option>
                      {(sites ?? []).map((s) => (
                        <option key={s.id} value={s.id}>{s.nom}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button disabled={occupe === c.userId} onClick={() => onGenerer(c.userId, c.email)} className={petitBouton}>
                      Générer un mot de passe
                    </button>
                    <button disabled={occupe === c.userId} onClick={() => onLien(c.userId, c.email)} className={petitBouton}>
                      Renvoyer le lien
                    </button>
                    {!c.estSuperAdmin && (
                      <button onClick={() => onSupprimer(c.userId, c.email)} className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-accent">
                        Retirer l'accès
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
