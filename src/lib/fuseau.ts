/**
 * Conversions de dates indépendantes du fuseau du serveur (UTC sur Cloudflare,
 * variable sur un VPS) : les dates saisies sont toujours interprétées à Paris.
 */
export const FUSEAU = "Europe/Paris";

/** Décalage (ms) entre l'heure de Paris et l'UTC à l'instant donné. */
function decalageParis(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const commeUtc = Date.UTC(
    v("year"),
    v("month") - 1,
    v("day"),
    v("hour"),
    v("minute"),
    v("second"),
  );
  return commeUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-10-06" + "08:30:00" (heure de Paris) → instant UTC. */
export function heureParisVersUtc(date: string, heure: string): Date {
  const naif = new Date(`${date}T${heure}Z`);
  return new Date(naif.getTime() - decalageParis(naif));
}

/**
 * Bornes UTC d'un filtre « Du (date + heure) / Au (date + heure) » saisi en heure
 * de Paris. Sans heure : début de journée pour « Du », fin de journée pour « Au ».
 */
export function bornesParis(f: {
  du?: string | undefined;
  heureDu?: string | undefined;
  au?: string | undefined;
  heureAu?: string | undefined;
}) {
  return {
    debut: f.du ? heureParisVersUtc(f.du, `${f.heureDu ?? "00:00"}:00`).toISOString() : undefined,
    fin: f.au
      ? heureParisVersUtc(f.au, f.heureAu ? `${f.heureAu}:59.999` : "23:59:59.999").toISOString()
      : undefined,
  };
}
