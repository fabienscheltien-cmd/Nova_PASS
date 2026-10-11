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
