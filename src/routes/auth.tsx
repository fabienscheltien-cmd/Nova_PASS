import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion accueil — Nova Pass" },
      {
        name: "description",
        content: "Espace réservé à l'accueil : connexion pour consulter le registre des visiteurs.",
      },
      { property: "og:title", content: "Connexion accueil — Nova Pass" },
      { property: "og:description", content: "Accès sécurisé au registre des visiteurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"connexion" | "oubli">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);
    setChargement(true);

    if (mode === "oubli") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setChargement(false);
      if (error) setErreur(error.message);
      else
        setMessage(
          "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.",
        );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    setChargement(false);
    if (error) {
      setErreur(
        error.message.includes("Invalid login")
          ? "E-mail ou mot de passe incorrect."
          : error.message,
      );
      return;
    }
    navigate({ to: "/registre" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Espace accueil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "connexion"
            ? "Connectez-vous pour consulter le registre."
            : "Saisissez votre adresse pour recevoir un lien de réinitialisation."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              autoComplete="email"
            />
          </div>
          {mode === "connexion" && (
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="mdp">
                Mot de passe
              </label>
              <input
                id="mdp"
                type="password"
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                autoComplete="current-password"
              />
            </div>
          )}

          {erreur && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erreur}
            </p>
          )}
          {message && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{message}</p>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
          >
            {mode === "connexion" ? "Se connecter" : "Envoyer le lien"}
          </button>
        </form>

        <button
          onClick={() => {
            setErreur(null);
            setMessage(null);
            setMode(mode === "connexion" ? "oubli" : "connexion");
          }}
          className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {mode === "connexion" ? "Mot de passe oublié ?" : "Revenir à la connexion"}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          Les comptes d'accueil sont créés par l'administratrice Nova Serenity.
        </p>
      </div>
    </div>
  );
}
