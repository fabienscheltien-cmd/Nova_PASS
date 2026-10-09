import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { echapperHtml } from "@/lib/export";
import { bornesParis } from "@/lib/fuseau";

const champ = (max: number) => z.string().trim().min(1).max(max);

const visiteSchema = z.object({
  nom: champ(80),
  prenom: champ(80),
  entreprise: champ(120),
  personneVisitee: champ(120),
  entrepriseVisitee: champ(120),
  // Instant ISO avec fuseau (converti par le navigateur), au plus 24 h dans le passé
  // et 15 min dans le futur pour éviter les dates aberrantes ou antidatées.
  arriveeAt: z
    .string()
    .datetime({ offset: true })
    .refine((v) => {
      const ecart = new Date(v).getTime() - Date.now();
      return ecart <= 15 * 60 * 1000 && ecart >= -24 * 60 * 60 * 1000;
    }, "Date d'arrivée hors plage"),
  siteId: z.string().uuid(),
});

export type NouvelleVisite = z.infer<typeof visiteSchema>;

function formatFr(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
}

/** Liste publique des sites (pour le QR code et le formulaire visiteur). */
export const listerSitesPublics = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("sites")
    .select("id, nom, adresse, code_postal, ville, logo_url")
    .order("nom");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const enregistrerVisite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => visiteSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifierLimiteDebit, envoyerEmail } = await import("@/lib/serveur.server");
    verifierLimiteDebit();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: visite, error } = await supabaseAdmin
      .from("visites")
      .insert({
        nom: data.nom,
        prenom: data.prenom,
        entreprise: data.entreprise,
        personne_visitee: data.personneVisitee,
        entreprise_visitee: data.entrepriseVisitee,
        arrivee_at: new Date(data.arriveeAt).toISOString(),
        site_id: data.siteId,
      })
      .select("id, arrivee_at")
      .single();

    if (error) throw new Error(error.message);

    let emailEnvoye = false;
    try {
      const { data: site } = await supabaseAdmin
        .from("sites")
        .select("nom, adresse, code_postal, ville, email_accueil")
        .eq("id", data.siteId)
        .maybeSingle();

      const destinataire = site?.email_accueil;
      if (destinataire) {
        const lignes = [
          [
            "Site",
            `${site?.nom ?? ""} — ${site?.adresse ?? ""} ${site?.code_postal ?? ""} ${site?.ville ?? ""}`,
          ],
          ["Nom", data.nom],
          ["Prénom", data.prenom],
          ["Entreprise du visiteur", data.entreprise],
          ["Personne visitée", data.personneVisitee],
          ["Entreprise visitée", data.entrepriseVisitee],
          ["Arrivée", formatFr(visite.arrivee_at)],
        ];
        emailEnvoye = await envoyerEmail({
          to: destinataire,
          subject: `Nouveau visiteur : ${data.prenom} ${data.nom} (${data.entreprise})`.replace(
            /[\r\n]+/g,
            " ",
          ),
          html: `<h2>Nouveau visiteur à l'accueil</h2><table>${lignes
            .map(
              ([k, v]) =>
                `<tr><td style="padding:4px 12px 4px 0"><strong>${k}</strong></td><td>${echapperHtml(v ?? "")}</td></tr>`,
            )
            .join("")}</table>`,
          text: lignes.map(([k, v]) => `${k}: ${v}`).join("\n"),
        });
      }
    } catch (e) {
      console.error("Envoi e-mail accueil impossible", e);
    }

    return { id: visite.id, emailEnvoye };
  });

/** Rôle + site du compte connecté. */
export const monProfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profil }, { data: roles }] = await Promise.all([
      context.supabase
        .from("profils")
        .select("email, site_id, sites(nom, ville, logo_url)")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);

    const estSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    return {
      email: profil?.email ?? String(context.claims["email"] ?? ""),
      siteId: profil?.site_id ?? null,
      siteNom: (profil as { sites?: { nom?: string } } | null)?.sites?.nom ?? null,
      siteLogo:
        (profil as { sites?: { logo_url?: string | null } } | null)?.sites?.logo_url ?? null,
      estSuperAdmin,
    };
  });

const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const heureMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const filtresSchema = z.object({
  du: jour.optional(),
  au: jour.optional(),
  heureDu: heureMinute.optional(),
  heureAu: heureMinute.optional(),
  recherche: z.string().max(120).optional(),
  siteId: z.string().uuid().optional(),
});

export const listerVisites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filtresSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const construire = (debut: number, fin: number) => {
      let requete = context.supabase
        .from("visites")
        .select(
          "id, nom, prenom, entreprise, personne_visitee, entreprise_visitee, arrivee_at, site_id, saisie_manuelle, sites(nom, adresse, code_postal, ville)",
        )
        .order("arrivee_at", { ascending: false })
        .order("id")
        .range(debut, fin);

      if (data.siteId) requete = requete.eq("site_id", data.siteId);
      // Bornes calculées en heure de Paris, quel que soit le fuseau du serveur.
      const bornes = bornesParis(data);
      if (bornes.debut) requete = requete.gte("arrivee_at", bornes.debut);
      if (bornes.fin) requete = requete.lte("arrivee_at", bornes.fin);

      const terme = data.recherche?.trim();
      if (terme) {
        const like = `%${terme.replace(/[%,()]/g, "")}%`;
        requete = requete.or(
          `nom.ilike.${like},prenom.ilike.${like},entreprise.ilike.${like},personne_visitee.ilike.${like},entreprise_visitee.ilike.${like}`,
        );
      }
      return requete;
    };

    // Supabase plafonne chaque réponse (1000 lignes par défaut) : on pagine.
    const TAILLE_PAGE = 1000;
    const MAX_LIGNES = 50_000;
    const rows: unknown[] = [];
    for (let debut = 0; debut < MAX_LIGNES; debut += TAILLE_PAGE) {
      const { data: page, error } = await construire(debut, debut + TAILLE_PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(page ?? []));
      if (!page || page.length < TAILLE_PAGE) break;
    }
    return rows as unknown as Array<{
      id: string;
      nom: string;
      prenom: string;
      entreprise: string;
      personne_visitee: string;
      entreprise_visitee: string;
      arrivee_at: string;
      site_id: string | null;
      sites: { nom: string; adresse: string; code_postal: string; ville: string } | null;
    }>;
  });

/** Sites visibles par le compte connecté (tous pour la super admin). */
export const listerSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sites")
      .select("id, nom, adresse, code_postal, ville, pays, email_accueil, logo_url")
      .order("nom");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
