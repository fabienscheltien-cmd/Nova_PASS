import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion accueil — Registre visiteurs" },
      {
        name: "description",
        content: "Espace réservé à l'accueil : connexion pour consulter le registre des visiteurs.",
      },
      { property: "og:title", content: "Connexion accueil — Registre visiteurs" },
      { property: "og:description", content: "Accès sécurisé au registre des visiteurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    const { error } =
      mode === "connexion"
        ? await supabase.auth.signInWithPassword({ email, password: motDePasse })
        : await supabase.auth.signUp({
            email,
            password: motDePasse,
            options: { emailRedirectTo: `${window.location.origin}/registre` },
          });
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
            : "Créez le compte de l'accueil."}
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
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="mdp">
              Mot de passe
            </label>
            <input
              id="mdp"
              type="password"
              required
              minLength={8}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
            />
          </div>

          {erreur && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erreur}
            </p>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
          >
            {mode === "connexion" ? "Se connecter" : "Créer le compte"}
          </button>
        </form>

        <button
          onClick={() => {
            setErreur(null);
            setMode(mode === "connexion" ? "inscription" : "connexion");
          }}
          className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {mode === "connexion" ? "Créer un compte accueil" : "J'ai déjà un compte"}
        </button>
      </div>
    </div>
  );
}
