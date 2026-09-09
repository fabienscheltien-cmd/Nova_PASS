import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { lireReglages, enregistrerReglages } from "@/lib/visites.functions";

export const Route = createFileRoute("/_authenticated/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages de l'accueil — Registre visiteurs" },
      {
        name: "description",
        content: "Définissez l'adresse e-mail qui reçoit les notifications d'arrivée des visiteurs.",
      },
      { property: "og:title", content: "Réglages de l'accueil — Registre visiteurs" },
      { property: "og:description", content: "Adresse e-mail de notification de l'accueil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reglages,
});

function Reglages() {
  const lire = useServerFn(lireReglages);
  const enregistrer = useServerFn(enregistrerReglages);
  const { data } = useQuery({ queryKey: ["reglages"], queryFn: () => lire() });

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (data?.emailAccueil) setEmail(data.emailAccueil);
  }, [data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setErreur(null);
    try {
      await enregistrer({ data: { emailAccueil: email } });
      setMessage("Adresse enregistrée.");
    } catch {
      setErreur("L'adresse n'a pas pu être enregistrée.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Réglages</h1>

      <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-border bg-card p-5">
        <label className="block text-sm font-medium text-foreground" htmlFor="email">
          Adresse e-mail de l'accueil
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque nouvelle arrivée y sera envoyée.
        </p>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="accueil@monentreprise.fr"
          className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />
        {message && <p className="mt-3 text-sm text-primary">{message}</p>}
        {erreur && <p className="mt-3 text-sm text-destructive">{erreur}</p>}
        <button
          type="submit"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Enregistrer
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Envoi des e-mails</p>
        <p className="mt-2">
          L'envoi automatique nécessite un nom de domaine qui vous appartient. Tant qu'il n'est pas
          configuré, aucune notification ne part : le registre se met à jour tout seul toutes les
          30 secondes pour que l'hôtesse voie les arrivées en direct.
        </p>
      </div>
    </div>
  );
}
