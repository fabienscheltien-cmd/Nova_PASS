import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteQr } from "@/components/site-brand";
import { listerSites } from "@/lib/visites.functions";
import {
  enregistrerSite,
  supprimerSite,
  listerComptes,
  inviterCompte,
  modifierCompte,
  envoyerLienMotDePasse,
  supprimerCompte,
} from "@/lib/admin.functions";

const petitBouton =
  "rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50";

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

/** Mot de passe facile à dicter : 3 syllabes, un tiret et 4 chiffres (ex. « Bamiko-4821 »). */
function suggererMotDePasse() {
  const consonnes = "bcdfghjklmnprstvz";
  const voyelles = "aeiou";
  const n = new Uint32Array(10);
  crypto.getRandomValues(n);
  let mot = "";
  for (let i = 0; i < 3; i++)
    mot += consonnes[n[i * 2]! % consonnes.length]! + voyelles[n[i * 2 + 1]! % voyelles.length]!;
  const chiffres = String(1000 + (n[6]! % 9000));
  return `${mot[0]!.toUpperCase()}${mot.slice(1)}-${chiffres}`;
}

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
  motDePasse: "",
  logoUrl: null as string | null,
};

function Sites() {
  const queryClient = useQueryClient();
  const charger = useServerFn(listerSites);
  const enregistrer = useServerFn(enregistrerSite);
  const supprimer = useServerFn(supprimerSite);
  const chargerComptes = useServerFn(listerComptes);
  const inviter = useServerFn(inviterCompte);
  const definirMdp = useServerFn(modifierCompte);
  const envoyerLien = useServerFn(envoyerLienMotDePasse);
  const supprimerAcces = useServerFn(supprimerCompte);

  const {
    data: sites,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["sites"],
    queryFn: () => charger(),
  });
  const { data: comptes } = useQuery({ queryKey: ["comptes"], queryFn: () => chargerComptes() });
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [mdpAffiche, setMdpAffiche] = useState<{ email: string; motDePasse: string } | null>(null);
  const [copie, setCopie] = useState(false);
  const [saisieMdp, setSaisieMdp] = useState<{
    userId: string;
    email: string;
    motDePasse: string;
  } | null>(null);
  const [voirMdp, setVoirMdp] = useState(true);

  const [form, setForm] = useState(vide);
  const [origine, setOrigine] = useState("");
  useEffect(() => setOrigine(window.location.origin), []);

  function telechargerQr(id: string, nom: string) {
    const canvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `QR-${nom.replace(/[^a-z0-9]+/gi, "-")}.png`;
    a.click();
  }
  const [erreur, setErreur] = useState<string | null>(null);

  function choisirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      // Redimensionné sans déformation (max 600 px de large) pour un affichage net et léger.
      const ratio = Math.min(1, 600 / img.naturalWidth, 300 / img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * ratio);
      c.height = Math.round(img.naturalHeight * ratio);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setForm((fm) => ({ ...fm, logoUrl: c.toDataURL("image/png") }));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  }

  const set = (k: keyof typeof vide) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function compteDuSite(siteId: string) {
    return (comptes ?? []).find((c) => !c.estSuperAdmin && c.siteId === siteId) ?? null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);
    const { motDePasse, ...site } = form;
    const mail = form.emailAccueil.trim().toLowerCase();
    if (mail && comptes?.some((c) => c.estSuperAdmin && c.email.toLowerCase() === mail)) {
      setErreur(
        "Cette adresse est celle d'un compte super admin : utilisez une autre adresse pour l'accueil du site.",
      );
      return;
    }
    if (motDePasse && !mail) {
      setErreur("Renseignez l'e-mail de l'accueil pour lui attribuer ce mot de passe.");
      return;
    }
    if (motDePasse && motDePasse.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    try {
      const r = await enregistrer({ data: site });
      const actuel = compteDuSite(r.id);
      const mdp = motDePasse ? { motDePasse } : {};
      if (mail && actuel?.email !== mail) {
        if (actuel) await supprimerAcces({ data: { userId: actuel.userId } });
        await inviter({ data: { email: mail, siteId: r.id, ...mdp } });
        setMessage(
          motDePasse
            ? `Accès créé pour ${mail}.`
            : `Accès créé pour ${mail}. Cliquez sur « Définir le mot de passe » ou « Envoyer un lien » sur la ligne du site.`,
        );
      } else if (actuel && motDePasse) {
        await definirMdp({ data: { userId: actuel.userId, motDePasse } });
      }
      if (mail && motDePasse) {
        setCopie(false);
        setMdpAffiche({ email: mail, motDePasse });
      }
      setForm(vide);
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Le site n'a pas pu être enregistré.");
    }
  }

  async function onDefinirMdp(e: React.FormEvent) {
    e.preventDefault();
    if (!saisieMdp) return;
    setErreur(null);
    setOccupe(saisieMdp.userId);
    try {
      await definirMdp({ data: { userId: saisieMdp.userId, motDePasse: saisieMdp.motDePasse } });
      setCopie(false);
      setMdpAffiche({ email: saisieMdp.email, motDePasse: saisieMdp.motDePasse });
      setSaisieMdp(null);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Le mot de passe n'a pas pu être enregistré.");
    } finally {
      setOccupe(null);
    }
  }

  async function onCreerAcces(siteId: string, mail: string) {
    setErreur(null);
    setOccupe(siteId);
    try {
      await inviter({ data: { email: mail, siteId } });
      setMessage(
        `Accès créé pour ${mail}. Définissez maintenant son mot de passe ou envoyez-lui un lien.`,
      );
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Création de l'accès impossible.");
    } finally {
      setOccupe(null);
    }
  }

  async function onLien(userId: string, mail: string) {
    setOccupe(userId);
    try {
      await envoyerLien({ data: { email: mail, origine: window.location.origin } });
      setMessage(`Lien de mot de passe envoyé à ${mail}.`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setOccupe(null);
    }
  }

  async function onSupprimer(id: string) {
    if (!confirm("Supprimer ce site et son accès ? Les visites déjà enregistrées sont conservées."))
      return;
    const c = compteDuSite(id);
    if (c) await supprimerAcces({ data: { userId: c.userId } });
    await supprimer({ data: { id } });
    queryClient.invalidateQueries({ queryKey: ["sites"] });
    queryClient.invalidateQueries({ queryKey: ["comptes"] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sites</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Un site = une adresse e-mail d'accueil, un mot de passe et un QR code. Après l'ajout,
        définissez le mot de passe de l'accès ou envoyez-lui un lien.
      </p>
      {message && (
        <p role="status" className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      )}
      {mdpAffiche && (
        <div
          role="dialog"
          aria-label="Nouveau mot de passe"
          className="mt-4 rounded-xl border border-primary/40 bg-card p-5"
        >
          <p className="text-sm text-foreground">
            Mot de passe enregistré pour <strong>{mdpAffiche.email}</strong>. Notez-le ou
            transmettez-le maintenant : pour des raisons de sécurité, il n'est pas conservé en clair
            et ne pourra plus être affiché.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code
              data-testid="mdp-genere"
              className="rounded-md bg-muted px-3 py-2 font-mono text-base text-foreground"
            >
              {mdpAffiche.motDePasse}
            </code>
            <button
              onClick={() =>
                navigator.clipboard.writeText(mdpAffiche.motDePasse).then(() => setCopie(true))
              }
              className={petitBouton}
            >
              {copie ? "Copié ✓" : "Copier"}
            </button>
            <button onClick={() => setMdpAffiche(null)} className={petitBouton}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {saisieMdp && (
        <form
          onSubmit={onDefinirMdp}
          role="dialog"
          aria-label="Définir le mot de passe"
          className="mt-4 rounded-xl border border-primary/40 bg-card p-5"
        >
          <p className="text-sm text-foreground">
            Définir le mot de passe de <strong>{saisieMdp.email}</strong> (l'ancien ne fonctionnera
            plus) :
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              aria-label="Nouveau mot de passe"
              autoFocus
              placeholder="Saisissez le mot de passe (8 caractères min.)"
              type={voirMdp ? "text" : "password"}
              required
              minLength={8}
              maxLength={72}
              value={saisieMdp.motDePasse}
              onChange={(e) => setSaisieMdp({ ...saisieMdp, motDePasse: e.target.value })}
              className="w-64 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setVoirMdp((v) => !v)}
              className={petitBouton}
              aria-pressed={voirMdp}
            >
              {voirMdp ? (
                <EyeOff className="inline h-4 w-4" aria-label="Masquer le mot de passe" />
              ) : (
                <Eye className="inline h-4 w-4" aria-label="Afficher le mot de passe" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSaisieMdp({ ...saisieMdp, motDePasse: suggererMotDePasse() })}
              className={petitBouton}
            >
              Suggérer
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={occupe === saisieMdp.userId}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Enregistrer le mot de passe
            </button>
            <button type="button" onClick={() => setSaisieMdp(null)} className={petitBouton}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
      >
        <div>
          <label className="text-xs font-medium text-muted-foreground">Nom du site</label>
          <input
            className={inputClass}
            value={form.nom}
            onChange={set("nom")}
            required
            maxLength={120}
          />
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
          <label className="text-xs font-medium text-muted-foreground" htmlFor="site-mdp">
            Mot de passe de l'accès{" "}
            {form.id
              ? "(laisser vide pour ne pas le changer)"
              : "(optionnel, 8 caractères minimum)"}
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="site-mdp"
              className="w-64 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              type={voirMdp ? "text" : "password"}
              minLength={8}
              maxLength={72}
              value={form.motDePasse}
              onChange={set("motDePasse")}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setVoirMdp((v) => !v)}
              className={petitBouton}
              aria-pressed={voirMdp}
            >
              {voirMdp ? (
                <EyeOff className="inline h-4 w-4" aria-label="Masquer le mot de passe" />
              ) : (
                <Eye className="inline h-4 w-4" aria-label="Afficher le mot de passe" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setVoirMdp(true);
                setForm((f) => ({ ...f, motDePasse: suggererMotDePasse() }));
              }}
              className={petitBouton}
            >
              Suggérer
            </button>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Adresse</label>
          <input
            className={inputClass}
            value={form.adresse}
            onChange={set("adresse")}
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Code postal</label>
          <input
            className={inputClass}
            value={form.codePostal}
            onChange={set("codePostal")}
            maxLength={20}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Ville</label>
          <input
            className={inputClass}
            value={form.ville}
            onChange={set("ville")}
            maxLength={120}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            Logo du site (remplace NOVA PASS sur l'accueil et au centre du QR code)
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {form.logoUrl && (
              <span className="rounded-md bg-qr-surface p-2">
                <img src={form.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
              </span>
            )}
            <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent">
              {form.logoUrl ? "Changer le logo" : "Ajouter un logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={choisirLogo}
              />
            </label>
            {form.logoUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}
                className="text-sm text-destructive hover:underline"
              >
                Retirer
              </button>
            )}
          </div>
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
              <th className="px-4 py-3">QR code du site</th>
              <th className="px-4 py-3" />
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
                  Liste indisponible.
                </td>
              </tr>
            )}
            {(sites ?? []).map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">
                  {s.logo_url && (
                    <img src={s.logo_url} alt="" className="mb-1 h-6 w-auto object-contain" />
                  )}
                  {s.nom}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[s.adresse, s.code_postal, s.ville].filter(Boolean).join(" ")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {(() => {
                    const c = compteDuSite(s.id);
                    if (!c) {
                      if (!s.email_accueil) return <span>—</span>;
                      const mail = s.email_accueil;
                      return (
                        <div className="flex flex-col gap-1">
                          <span>{mail} (accès non créé)</span>
                          <button
                            disabled={occupe === s.id}
                            onClick={() => onCreerAcces(s.id, mail)}
                            className={petitBouton}
                          >
                            Créer l'accès
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground">{c.email}</span>
                        <div className="flex flex-wrap gap-1">
                          <button
                            disabled={occupe === c.userId}
                            onClick={() => onLien(c.userId, c.email)}
                            className={petitBouton}
                            title="L'accueil reçoit un e-mail pour choisir lui-même son mot de passe"
                          >
                            Envoyer un lien
                          </button>
                          <button
                            disabled={occupe === c.userId}
                            onClick={() => {
                              setVoirMdp(true);
                              setSaisieMdp({ userId: c.userId, email: c.email, motDePasse: "" });
                            }}
                            className={petitBouton}
                          >
                            Définir le mot de passe
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  {origine && (
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-qr-surface p-1">
                        <SiteQr
                          canvasId={`qr-${s.id}`}
                          value={`${origine}/checkin?site=${s.id}`}
                          logoUrl={s.logo_url}
                          size={512}
                          displaySize={64}
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-xs">
                        <button
                          onClick={() => telechargerQr(s.id, s.nom)}
                          className="text-left text-primary hover:underline"
                        >
                          Télécharger (PNG)
                        </button>
                        <a
                          href={`/?site=${s.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Écran d'accueil du site
                        </a>
                        <a href={`/affiche?site=${s.id}`} className="text-primary hover:underline">
                          Affiche PDF
                        </a>
                      </div>
                    </div>
                  )}
                </td>
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
                        motDePasse: "",
                        logoUrl: s.logo_url ?? null,
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
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
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
