import { Check, Circle } from "lucide-react";
import { REGLES_MOT_DE_PASSE } from "@/lib/mot-de-passe";

/** Liste des règles, cochées en temps réel pendant la saisie. */
export function ReglesMotDePasse({ valeur, className }: { valeur: string; className?: string }) {
  return (
    <ul className={`space-y-0.5 text-xs ${className ?? ""}`} aria-label="Règles du mot de passe">
      {REGLES_MOT_DE_PASSE.map((r) => {
        const ok = r.ok(valeur);
        return (
          <li
            key={r.libelle}
            className={`flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-muted-foreground"}`}
          >
            {ok ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Circle className="h-3 w-3" aria-hidden="true" />
            )}
            <span>
              {r.libelle}
              <span className="sr-only">{ok ? " : respectée" : " : non respectée"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
