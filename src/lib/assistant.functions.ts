import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_VISITES = 1500;

/**
 * Assistant du registre : répond en langage naturel à partir des seules visites
 * que le compte connecté a le droit de lire (RLS appliquée via context.supabase).
 */
export const interrogerRegistre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ question: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, erreur: "Assistant non configuré." };

    const { data: visites, error } = await context.supabase
      .from("visites")
      .select("arrivee_at, nom, prenom, entreprise, personne_visitee, entreprise_visitee, saisie_manuelle, sites(nom, ville)")
      .order("arrivee_at", { ascending: false })
      .limit(MAX_VISITES);
    if (error) return { ok: false as const, erreur: "Lecture du registre impossible." };

    const lignes = (visites ?? []).map((v) => {
      const s = v.sites as { nom: string; ville: string } | null;
      const date = new Date(v.arrivee_at).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      });
      return [date, `${v.prenom} ${v.nom}`, v.entreprise, v.personne_visitee, v.entreprise_visitee, s?.nom ?? "", v.saisie_manuelle ? "manuel" : "QR"].join(" | ");
    });

    const maintenant = new Date().toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" });
    const instructions = `Tu es l'assistant du registre d'accueil Nova Pass. Nous sommes le ${maintenant} (heure de Paris).
Réponds en français, de façon concise, uniquement à partir des visites fournies ci-dessous (${lignes.length} visites, les plus récentes d'abord${lignes.length >= MAX_VISITES ? ", historique tronqué" : ""}).
Liste les visites correspondantes (date, visiteur, entreprise, personne visitée) puis donne un court résumé (nombre, tendances). Si aucune visite ne correspond, dis-le clairement. N'invente rien. Mise en forme : texte simple avec tirets, sans tableau.
Format des lignes : date | visiteur | entreprise | personne visitée | entreprise visitée | site | mode.

${lignes.join("\n") || "(aucune visite)"}`;

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        system: instructions,
        messages: [{ role: "user", content: data.question }],
        maxRetries: 0,
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const texte = await result.text;
      return { ok: true as const, reponse: texte || "Aucune réponse." };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      const erreur =
        status === 429
          ? "Trop de demandes, réessayez dans un instant."
          : status === 402
            ? "Crédits IA épuisés pour l'espace de travail."
            : status === 403
              ? "Accès à l'assistant refusé."
              : "L'assistant n'a pas pu répondre.";
      console.error("assistant registre", status, e);
      return { ok: false as const, erreur };
    }
  });
