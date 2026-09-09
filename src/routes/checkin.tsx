import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { enregistrerVisite } from "@/lib/visites.functions";

export const Route = createFileRoute("/checkin")({
  head: () => ({
    meta: [
      { title: "Enregistrement visiteur — Accueil" },
      {
        name: "description",
        content: "Renseignez vos informations d'arrivée : nom, entreprise et personne visitée.",
      },
      { property: "og:title", content: "Enregistrement visiteur — Accueil" },
      {
        property: "og:description",
        content: "Formulaire d'arrivée des visiteurs sur site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Checkin,
});

function maintenantLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const labelClass = "block text-sm font-medium text-foreground";
const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function Checkin() {
  const envoyer = useServerFn(enregistrerVisite);
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    entreprise: "",
    personneVisitee: "",
    entrepriseVisitee: "",
    arriveeAt: maintenantLocal(),
  });
  const [etat, setEtat] = useState<"saisie" | "envoi" | "ok">("saisie");
  const [erreur, setErreur] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEtat("envoi");
    try {
      await envoyer({ data: form });
      setEtat("ok");
    } catch {
      setErreur("L'enregistrement n'a pas pu être effectué. Merci de prévenir l'accueil.");
      setEtat("saisie");
    }
  }

  if (etat === "ok") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-foreground">Merci {form.prenom} !</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre arrivée est enregistrée et l'accueil a été prévenu. Merci de patienter quelques
            instants.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Enregistrement visiteur
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tous les champs sont obligatoires.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className={labelClass} htmlFor="prenom">
              Prénom
            </label>
            <input
              id="prenom"
              className={inputClass}
              value={form.prenom}
              onChange={set("prenom")}
              maxLength={80}
              required
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="nom">
              Nom
            </label>
            <input
              id="nom"
              className={inputClass}
              value={form.nom}
              onChange={set("nom")}
              maxLength={80}
              required
              autoComplete="family-name"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="entreprise">
              Votre entreprise
            </label>
            <input
              id="entreprise"
              className={inputClass}
              value={form.entreprise}
              onChange={set("entreprise")}
              maxLength={120}
              required
              autoComplete="organization"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="personneVisitee">
              Personne visitée
            </label>
            <input
              id="personneVisitee"
              className={inputClass}
              value={form.personneVisitee}
              onChange={set("personneVisitee")}
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="entrepriseVisitee">
              Entreprise visitée
            </label>
            <input
              id="entrepriseVisitee"
              className={inputClass}
              value={form.entrepriseVisitee}
              onChange={set("entrepriseVisitee")}
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="arriveeAt">
              Date et heure d'arrivée
            </label>
            <input
              id="arriveeAt"
              type="datetime-local"
              className={inputClass}
              value={form.arriveeAt}
              onChange={set("arriveeAt")}
              required
            />
          </div>

          {erreur && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erreur}
            </p>
          )}

          <button
            type="submit"
            disabled={etat === "envoi"}
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground disabled:opacity-60"
          >
            {etat === "envoi" ? "Enregistrement…" : "Valider mon arrivée"}
          </button>
        </form>
      </div>
    </div>
  );
}
