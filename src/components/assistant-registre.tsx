import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { interrogerRegistre } from "@/lib/assistant.functions";

const EXEMPLES = [
  "Qui est venu cette semaine ?",
  "Combien de visiteurs de la société Dupont ce mois-ci ?",
  "Quelles visites pour Mme Martin hier ?",
];

export function AssistantRegistre() {
  const interroger = useServerFn(interrogerRegistre);
  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [reponse, setReponse] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(q: string) {
    if (q.trim().length < 3 || enCours) return;
    setEnCours(true);
    setErreur(null);
    setReponse(null);
    try {
      const r = await interroger({ data: { question: q } });
      if (r.ok) setReponse(r.reponse);
      else setErreur(r.erreur);
    } catch {
      setErreur("L'assistant n'a pas pu répondre.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Poser une question sur les visites</h2>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void envoyer(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ex. : Qui a rendu visite au service RH la semaine dernière ?"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="submit"
          disabled={enCours || question.trim().length < 3}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {enCours ? "Recherche…" : "Demander"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXEMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQuestion(ex);
              void envoyer(ex);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
      {enCours && <p className="mt-3 text-sm text-muted-foreground">Analyse du registre en cours…</p>}
      {erreur && <p className="mt-3 text-sm text-destructive">{erreur}</p>}
      {reponse && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm text-foreground">{reponse}</div>
      )}
    </section>
  );
}
