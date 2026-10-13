/**
 * Adresse publique de Nova Pass, utilisée dans tous les QR codes : un QR scanné
 * depuis la prévisualisation Lovable, une tablette ou une affiche imprimée doit
 * toujours ouvrir le site publié, jamais l'adresse de prévisualisation (qui exige
 * une connexion Lovable). Hébergement OVH : définir VITE_URL_PUBLIQUE au build.
 */
export const URL_PUBLIQUE_NOVA_PASS = (
  (import.meta.env?.["VITE_URL_PUBLIQUE"] as string | undefined) || "https://novapass.lovable.app"
).replace(/\/+$/, "");

/** Lien du formulaire visiteur, propre à un site si `siteId` est fourni. */
export function urlCheckin(siteId?: string | null) {
  return siteId
    ? `${URL_PUBLIQUE_NOVA_PASS}/checkin?site=${encodeURIComponent(siteId)}`
    : `${URL_PUBLIQUE_NOVA_PASS}/checkin`;
}

/**
 * Page de dépôt d'avis Google de Nova Serenity, ouverte par les étoiles après
 * l'enregistrement d'un visiteur. À remplacer par le lien « Demander des avis »
 * de la fiche Google Business Profile (https://g.page/r/…/review), ou à définir
 * au build avec VITE_URL_AVIS_GOOGLE. Par défaut : fiche Google Maps de Nova Serenity.
 */
export const URL_AVIS_GOOGLE =
  (import.meta.env?.["VITE_URL_AVIS_GOOGLE"] as string | undefined) ||
  "https://www.google.com/maps/search/?api=1&query=Nova%20Serenity";
