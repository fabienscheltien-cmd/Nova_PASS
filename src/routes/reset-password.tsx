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

function ResetPassword() {
  const navigate = useNavigate();
  const [pret, setPret] = useState(false);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setPret(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setPret(true);
    });
    return () => sub.subscription.unsubscribe();
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nouveau mot de passe
        </h1>

        {!pret && (
          <p className="mt-4 text-sm text-muted-foreground">
            Ouvrez cette page depuis le lien reçu par e-mail pour définir un nouveau mot de passe.
          </p>
        )}

        {ok ? (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            Mot de passe mis à jour. Redirection…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="mdp">
                Mot de passe
              </label>
              <input
                id="mdp"
                type="password"
                required
                minLength={8}
                value={mdp}
                onChange={(e) => setMdp(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="mdp2">
                Confirmer le mot de passe
              </label>
              <input
                id="mdp2"
                type="password"
                required
                minLength={8}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                autoComplete="new-password"
              />
            </div>
            {erreur && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erreur}
              </p>
            )}
            <button
              type="submit"
              disabled={!pret}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-50"
            >
              Enregistrer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
