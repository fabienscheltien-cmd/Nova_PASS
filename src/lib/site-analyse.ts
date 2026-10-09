import { useSyncExternalStore } from "react";

/**
 * Site que la super admin a choisi d'analyser (registre, statistiques, affiche).
 * Conservé pour l'onglet en cours ; effacé à la connexion et à la déconnexion
 * pour que le choix soit refait à chaque session.
 */
const CLE = "nova-pass:site-analyse";
const abonnes = new Set<() => void>();

function lire() {
  try {
    return sessionStorage.getItem(CLE) ?? "";
  } catch {
    return "";
  }
}

export function choisirSiteAnalyse(siteId: string) {
  try {
    if (siteId) sessionStorage.setItem(CLE, siteId);
    else sessionStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible : le choix reste en mémoire le temps de la page */
  }
  abonnes.forEach((f) => f());
}

export function useSiteAnalyse() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    lire,
    () => "",
  );
}

/** Site de travail : celui choisi par la super admin, sinon le site du compte. */
export function useSiteDeTravail(
  profil: { estSuperAdmin: boolean; siteId: string | null } | undefined,
) {
  const choisi = useSiteAnalyse();
  if (!profil) return undefined;
  return profil.estSuperAdmin ? choisi || undefined : (profil.siteId ?? undefined);
}
