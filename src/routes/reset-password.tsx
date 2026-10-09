import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Nova Pass" },
      {
        name: "description",
        content: "Choisissez un nouveau mot de passe pour accéder au registre des visiteurs.",
      },
      { property: "og:title", content: "Nouveau mot de passe — Nova Pass" },
      { property: "og:description", content: "Réinitialisation du mot de passe de l'accueil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

type Etat = "verification" | "pret" | "lien_invalide" | "sans_lien";

/** Message lisible pour les erreurs renvoyées par Supabase dans l'URL ou à l'échange du code. */
function messageErreurLien(code: string | null, description: string | null) {
  if (code === "otp_expired" || /expired|invalid/i.test(description ?? "")) {
    return "Ce lien a expiré ou a déjà été utilisé. Certaines messageries d'entreprise ouvrent automatiquement les liens pour les analyser, ce qui peut les consommer. Demandez un nouveau lien ci-dessous et ouvrez-le rapidement.";
  }
  return description
    ? `Le lien n'a pas pu être validé : ${description}`
    : "Le lien n'a pas pu être validé. Demandez un nouveau lien ci-dessous.";
}

/**
 * Valide le lien reçu par e-mail, quel que soit son format :
 * #access_token=… (flux implicite), ?code=… (PKCE) ou ?token_hash=…&type=… (OTP).
 */
async function validerLienDuMail(): Promise<{ ok: true } | { ok: false; message: string } | null> {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const erreur =
    query.get("error_code") ?? hash.get("error_code") ?? query.get("error") ?? hash.get("error");
  if (erreur) {
    return {
      ok: false,
      message: messageErreurLien(
        query.get("error_code") ?? hash.get("error_code"),
        query.get("error_description") ?? hash.get("error_description"),
      ),
    };
  }

  const code = query.get("code");
  const tokenHash = query.get("token_hash");
  const type = query.get("type");
  if (
    tokenHash &&
    (type === "recovery" || type === "invite" || type === "signup" || type === "email")
  ) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return { ok: false, message: messageErreurLien(error.code ?? null, error.message) };
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: messageErreurLien(error.code ?? null, error.message) };
  }

  // Flux implicite (#access_token) : le client Supabase l'a déjà converti en session.
  const { data } = await supabase.auth.getSession();
  if (data.session) return { ok: true };
  return code || tokenHash || hash.get("access_token")
    ? { ok: false, message: messageErreurLien(null, null) }
    : null;
}

function ResetPassword() {
  const navigate = useNavigate();
  const [etat, setEtat] = useState<Etat>("verification");
  const [erreurLien, setErreurLien] = useState<string | null>(null);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [email, setEmail] = useState("");
  const [lienEnvoye, setLienEnvoye] = useState(false);

  useEffect(() => {
    let actif = true;
    validerLienDuMail()
      .then((r) => {
        if (!actif) return;
        if (r?.ok) setEtat("pret");
        else if (r) {
          setErreurLien(r.message);
          setEtat("lien_invalide");
        } else setEtat("sans_lien");
      })
      .catch(() => {
        if (!actif) return;
        setErreurLien(messageErreurLien(null, null));
        setEtat("lien_invalide");
      })
      .finally(() => {
        // Retire les jetons de l'adresse affichée (historique, captures d'écran…).
        window.history.replaceState(null, "", window.location.pathname);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((evenement, session) => {
      if (session && (evenement === "PASSWORD_RECOVERY" || evenement === "SIGNED_IN"))
        setEtat("pret");
    });
    return () => {
      actif = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (mdp !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: mdp });
    if (error) {
      setErreur(error.message);
      return;
    }
    setOk(true);
    setTimeout(() => navigate({ to: "/registre" }), 1200);
  }

  async function demanderNouveauLien(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setErreur(error.message);
    else setLienEnvoye(true);
  }

  const champClass =
    "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nouveau mot de passe
        </h1>

        {etat === "verification" && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Vérification de votre lien…
          </p>
        )}

        {(etat === "lien_invalide" || etat === "sans_lien") && (
          <div className="mt-4 space-y-4">
            <p
              role="alert"
              className={
                etat === "lien_invalide"
                  ? "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {etat === "lien_invalide"
                ? erreurLien
                : "Ouvrez cette page depuis le lien reçu par e-mail, ou demandez un nouveau lien."}
            </p>
            {lienEnvoye ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                Si un compte existe pour cette adresse, un nouveau lien vient d'être envoyé.
              </p>
            ) : (
              <form onSubmit={demanderNouveauLien} className="space-y-3">
                <label className="block text-sm font-medium text-foreground" htmlFor="email">
                  Votre adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={champClass}
                  autoComplete="email"
                />
                {erreur && <p className="text-sm text-destructive">{erreur}</p>}
                <button className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground">
                  Recevoir un nouveau lien
                </button>
              </form>
            )}
          </div>
        )}

        {etat === "pret" &&
          (ok ? (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              Mot de passe mis à jour. Redirection…
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="mdp">
                  Mot de passe (8 caractères minimum)
                </label>
                <input
                  id="mdp"
                  type={voir ? "text" : "password"}
                  required
                  minLength={8}
                  value={mdp}
                  onChange={(e) => setMdp(e.target.value)}
                  className={champClass}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="mdp2">
                  Confirmer le mot de passe
                </label>
                <input
                  id="mdp2"
                  type={voir ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className={champClass}
                  autoComplete="new-password"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={voir} onChange={(e) => setVoir(e.target.checked)} />
                Afficher le mot de passe
              </label>
              {erreur && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erreur}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground"
              >
                Enregistrer
              </button>
            </form>
          ))}
      </div>
    </div>
  );
}
