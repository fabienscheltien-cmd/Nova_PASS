import { useState } from "react";
import { Star } from "lucide-react";
import { URL_AVIS_GOOGLE } from "@/lib/config";

/** 5 étoiles dorées : un clic ouvre la page de dépôt d'avis Google. */
export function AvisGoogle() {
  const [survol, setSurvol] = useState(0);
  return (
    <div className="mt-6 border-t border-hero-line pt-5">
      <p className="text-sm font-medium text-hero-foreground">
        Comment s'est passé votre accueil chez Nova Serenity ?
      </p>
      <div
        className="mt-3 flex justify-center gap-1.5"
        role="group"
        aria-label="Donner un avis Google"
        onMouseLeave={() => setSurvol(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <a
            key={n}
            href={URL_AVIS_GOOGLE}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${n} étoile${n > 1 ? "s" : ""} sur 5 — laisser un avis Google`}
            onMouseEnter={() => setSurvol(n)}
            onFocus={() => setSurvol(n)}
            onBlur={() => setSurvol(0)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Star
              aria-hidden="true"
              className={`h-9 w-9 text-amber-400 drop-shadow ${n <= (survol || 5) ? "fill-amber-400" : "fill-transparent"} ${survol && n > survol ? "opacity-40" : ""}`}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
