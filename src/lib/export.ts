/**
 * Empêche Excel/LibreOffice d'interpréter une saisie visiteur comme une formule
 * (=, +, -, @, tabulation, retour chariot en tête de cellule) lors d'un export CSV.
 */
export function neutraliserFormule(valeur: string) {
  return /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
}

/** Échappe une valeur avant de l'insérer dans du HTML (e-mail). */
export function echapperHtml(valeur: string) {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
