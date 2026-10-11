/** Règles communes des mots de passe (écran et serveur). */
export const REGLES_MOT_DE_PASSE = [
  { libelle: "Au moins 8 caractères", ok: (m: string) => m.length >= 8 },
  {
    libelle: "Au moins une lettre majuscule et une lettre minuscule",
    ok: (m: string) => /\p{Lu}/u.test(m) && /\p{Ll}/u.test(m),
  },
  { libelle: "Au moins un chiffre", ok: (m: string) => /\d/.test(m) },
] as const;

/** Message en français listant les règles non respectées, ou null si tout est bon. */
export function erreurMotDePasse(mdp: string): string | null {
  const manquantes = REGLES_MOT_DE_PASSE.filter((r) => !r.ok(mdp)).map((r) =>
    r.libelle.toLowerCase(),
  );
  if (manquantes.length === 0) return null;
  return `Le mot de passe ne respecte pas les règles : ${manquantes.join(" ; ")}.`;
}
