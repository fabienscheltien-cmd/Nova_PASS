import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const champ = (max: number) => z.string().trim().min(1).max(max);

const visiteSchema = z.object({
  nom: champ(80),
  prenom: champ(80),
  entreprise: champ(120),
  personneVisitee: champ(120),
  entrepriseVisitee: champ(120),
  arriveeAt: z.string().min(1).max(40),
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
    .select("id, nom, adresse, code_postal, ville")
    .order("nom");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const enregistrerVisite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => visiteSchema.parse(data))
  .handler(async ({ data }) => {
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
      const apiKey = process.env["LOVABLE_API_KEY"];
      const senderDomain = process.env["LOVABLE_EMAIL_DOMAIN"];

      if (destinataire && apiKey && senderDomain) {
        const { sendLovableEmail } = await import("@lovable.dev/email-js");
        const lignes = [
          ["Site", `${site?.nom ?? ""} — ${site?.adresse ?? ""} ${site?.code_postal ?? ""} ${site?.ville ?? ""}`],
          ["Nom", data.nom],
          ["Prénom", data.prenom],
          ["Entreprise du visiteur", data.entreprise],
          ["Personne visitée", data.personneVisitee],
          ["Entreprise visitée", data.entrepriseVisitee],
          ["Arrivée", formatFr(visite.arrivee_at)],
        ];
        await sendLovableEmail(
          {
            to: destinataire,
            from: `accueil@${senderDomain}`,
            subject: `Nouveau visiteur : ${data.prenom} ${data.nom} (${data.entreprise})`,
            html: `<h2>Nouveau visiteur à l'accueil</h2><table>${lignes
              .map(
                ([k, v]) =>
                  `<tr><td style="padding:4px 12px 4px 0"><strong>${k}</strong></td><td>${v}</td></tr>`,
              )
              .join("")}</table>`,
            text: lignes.map(([k, v]) => `${k}: ${v}`).join("\n"),
          },
          { apiKey },
        );
        emailEnvoye = true;
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
        .select("email, site_id, sites(nom, ville)")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);

    const estSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    return {
      email: profil?.email ?? String(context.claims["email"] ?? ""),
      siteId: profil?.site_id ?? null,
      siteNom: (profil as { sites?: { nom?: string } } | null)?.sites?.nom ?? null,
      estSuperAdmin,
    };
  });

const filtresSchema = z.object({
  du: z.string().optional(),
  au: z.string().optional(),
  recherche: z.string().max(120).optional(),
  siteId: z.string().uuid().optional(),
});

export const listerVisites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filtresSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let requete = context.supabase
      .from("visites")
      .select(
        "id, nom, prenom, entreprise, personne_visitee, entreprise_visitee, arrivee_at, site_id, sites(nom, adresse, code_postal, ville)",
      )
      .order("arrivee_at", { ascending: false })
      .limit(2000);

    if (data.siteId) requete = requete.eq("site_id", data.siteId);
    if (data.du) requete = requete.gte("arrivee_at", new Date(`${data.du}T00:00:00`).toISOString());
    if (data.au) requete = requete.lte("arrivee_at", new Date(`${data.au}T23:59:59`).toISOString());

    const terme = data.recherche?.trim();
    if (terme) {
      const like = `%${terme.replace(/[%,()]/g, "")}%`;
      requete = requete.or(
        `nom.ilike.${like},prenom.ilike.${like},entreprise.ilike.${like},personne_visitee.ilike.${like},entreprise_visitee.ilike.${like}`,
      );
    }

    const { data: rows, error } = await requete;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as Array<{
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
      .select("id, nom, adresse, code_postal, ville, pays, email_accueil")
      .order("nom");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
