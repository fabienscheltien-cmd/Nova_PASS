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
});

export type NouvelleVisite = z.infer<typeof visiteSchema>;

function formatFr(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
}

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
      })
      .select("id, arrivee_at")
      .single();

    if (error) throw new Error(error.message);

    let emailEnvoye = false;
    try {
      const { data: reglages } = await supabaseAdmin
        .from("reglages")
        .select("email_accueil")
        .eq("id", 1)
        .maybeSingle();

      const destinataire = reglages?.email_accueil;
      const apiKey = process.env["LOVABLE_API_KEY"];
      const senderDomain = process.env["LOVABLE_EMAIL_DOMAIN"];

      if (destinataire && apiKey && senderDomain) {
        const { sendLovableEmail } = await import("@lovable.dev/email-js");
        const lignes = [
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

const filtresSchema = z.object({
  du: z.string().optional(),
  au: z.string().optional(),
  recherche: z.string().max(120).optional(),
});

export const listerVisites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filtresSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let requete = context.supabase
      .from("visites")
      .select(
        "id, nom, prenom, entreprise, personne_visitee, entreprise_visitee, arrivee_at",
      )
      .order("arrivee_at", { ascending: false })
      .limit(1000);

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
    return rows ?? [];
  });

export const lireReglages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reglages")
      .select("email_accueil")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { emailAccueil: data?.email_accueil ?? "" };
  });

export const enregistrerReglages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ emailAccueil: z.string().trim().email().max(255) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reglages")
      .upsert({ id: 1, email_accueil: data.emailAccueil, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
