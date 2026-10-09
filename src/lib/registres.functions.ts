import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { bornesParis } from "@/lib/fuseau";
import { z } from "zod";

/*
 * Registres de l'accueil : ajout manuel de visiteurs, objets trouvés,
 * courrier / colis / clés. Ajout et lecture uniquement — aucune fonction de
 * modification ou de suppression n'existe, et la base les refuse (RLS + droits).
 */

type Contexte = { supabase: SupabaseClient<Database>; userId: string };

const champ = (max: number) => z.string().trim().min(1).max(max);
const texteLibre = (max: number) => z.string().trim().max(max).default("");

// Saisie manuelle : jusqu'à 31 jours dans le passé, 15 min dans le futur.
const instantSaisi = z
  .string()
  .datetime({ offset: true })
  .refine((v) => {
    const ecart = new Date(v).getTime() - Date.now();
    return ecart <= 15 * 60 * 1000 && ecart >= -31 * 24 * 60 * 60 * 1000;
  }, "Date hors plage (31 jours maximum dans le passé)");

const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const heureMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const filtresBase = z.object({
  du: jour.optional(),
  heureDu: heureMinute.optional(),
  au: jour.optional(),
  heureAu: heureMinute.optional(),
  recherche: z.string().max(120).optional(),
  siteId: z.string().uuid().optional(),
});

export const CATEGORIES_DEPOT = ["courrier", "colis", "cles", "autre"] as const;
export type CategorieDepot = (typeof CATEGORIES_DEPOT)[number];

/**
 * Site sur lequel écrire : toujours celui du compte (la valeur envoyée par le
 * navigateur n'est pas prise en compte). La super admin consulte les registres
 * mais n'y ajoute pas d'entrées : seul le compte d'un site le fait.
 */
async function siteCible(context: Contexte) {
  const [{ data: profil }, { data: roles }] = await Promise.all([
    context.supabase.from("profils").select("site_id").eq("user_id", context.userId).maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
  ]);
  if ((roles ?? []).some((r) => r.role === "super_admin")) {
    throw new Error(
      "Les entrées du registre sont ajoutées par le compte du site, pas par la super admin.",
    );
  }
  if (!profil?.site_id) throw new Error("Aucun site n'est rattaché à ce compte.");
  return profil.site_id;
}

type Requete = {
  gte(colonne: string, valeur: string): Requete;
  lte(colonne: string, valeur: string): Requete;
  eq(colonne: string, valeur: string): Requete;
  or(filtre: string): Requete;
};

/** Filtres communs : site, dates (heure de Paris) et recherche plein texte. */
function filtrer<Q>(
  requete: Q,
  colonneDate: string,
  colonnesRecherche: string[],
  f: z.infer<typeof filtresBase>,
): Q {
  let q = requete as unknown as Requete;
  if (f.siteId) q = q.eq("site_id", f.siteId);
  const { debut, fin } = bornesParis(f);
  if (debut) q = q.gte(colonneDate, debut);
  if (fin) q = q.lte(colonneDate, fin);
  const terme = f.recherche?.trim();
  if (terme) {
    const like = `%${terme.replace(/[%,()]/g, "")}%`;
    q = q.or(colonnesRecherche.map((c) => `${c}.ilike.${like}`).join(","));
  }
  return q as unknown as Q;
}

/** Supabase plafonne chaque réponse (1000 lignes par défaut) : on pagine. */
async function toutesLesPages<T>(
  page: (
    debut: number,
    fin: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const TAILLE = 1000;
  const lignes: T[] = [];
  for (let debut = 0; debut < 50_000; debut += TAILLE) {
    const { data, error } = await page(debut, debut + TAILLE - 1);
    if (error) throw new Error(error.message);
    lignes.push(...(data ?? []));
    if (!data || data.length < TAILLE) break;
  }
  return lignes;
}

// ---------- Visiteurs (saisie manuelle) ----------

export const ajouterVisiteManuelle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nom: champ(80),
        prenom: champ(80),
        entreprise: champ(120),
        personneVisitee: champ(120),
        entrepriseVisitee: champ(120),
        arriveeAt: instantSaisi,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const siteId = await siteCible(context);
    const { error } = await context.supabase.from("visites").insert({
      nom: data.nom,
      prenom: data.prenom,
      entreprise: data.entreprise,
      personne_visitee: data.personneVisitee,
      entreprise_visitee: data.entrepriseVisitee,
      arrivee_at: new Date(data.arriveeAt).toISOString(),
      site_id: siteId,
      saisie_manuelle: true,
      cree_par: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Objets trouvés ----------

export type ObjetTrouve = {
  id: string;
  trouve_at: string;
  objet: string;
  emplacement: string;
  observation: string;
  statut: "en_attente" | "restitue";
  statut_at: string | null;
  site_id: string | null;
  sites: { nom: string } | null;
};

export const listerObjetsTrouves = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    filtresBase.extend({ statut: z.enum(["en_attente", "restitue"]).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const lignes = await toutesLesPages((debut, fin) =>
      filtrer(
        context.supabase
          .from("objets_trouves")
          .select(
            "id, trouve_at, objet, emplacement, observation, statut, statut_at, site_id, sites(nom)",
          )
          .match(data.statut ? { statut: data.statut } : {})
          .order("trouve_at", { ascending: false })
          .order("id")
          .range(debut, fin),
        "trouve_at",
        ["objet", "emplacement", "observation"],
        data,
      ),
    );
    return lignes as unknown as ObjetTrouve[];
  });

export const ajouterObjetTrouve = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        objet: champ(160),
        emplacement: texteLibre(160),
        observation: texteLibre(2000),
        trouveAt: instantSaisi,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const siteId = await siteCible(context);
    const { error } = await context.supabase.from("objets_trouves").insert({
      objet: data.objet,
      emplacement: data.emplacement,
      observation: data.observation,
      trouve_at: new Date(data.trouveAt).toISOString(),
      site_id: siteId,
      cree_par: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Courrier, colis, clés, autre ----------

export type Depot = {
  id: string;
  categorie: CategorieDepot;
  recu_at: string;
  destinataire: string;
  expediteur: string;
  description: string;
  statut: "recu" | "remis";
  statut_at: string | null;
  site_id: string | null;
  sites: { nom: string } | null;
};

export const listerDepots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    filtresBase
      .extend({
        categorie: z.enum(CATEGORIES_DEPOT).optional(),
        statut: z.enum(["recu", "remis"]).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const lignes = await toutesLesPages((debut, fin) => {
      let q = context.supabase
        .from("courriers_colis")
        .select(
          "id, categorie, recu_at, destinataire, expediteur, description, statut, statut_at, site_id, sites(nom)",
        )
        .order("recu_at", { ascending: false })
        .order("id")
        .range(debut, fin);
      if (data.categorie) q = q.eq("categorie", data.categorie);
      if (data.statut) q = q.eq("statut", data.statut);
      return filtrer(q, "recu_at", ["destinataire", "expediteur", "description"], data);
    });
    return lignes as unknown as Depot[];
  });

export const ajouterDepot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        categorie: z.enum(CATEGORIES_DEPOT),
        destinataire: champ(160),
        expediteur: texteLibre(160),
        description: texteLibre(2000),
        recuAt: instantSaisi,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const siteId = await siteCible(context);
    const { error } = await context.supabase.from("courriers_colis").insert({
      categorie: data.categorie,
      destinataire: data.destinataire,
      expediteur: data.expediteur,
      description: data.description,
      recu_at: new Date(data.recuAt).toISOString(),
      site_id: siteId,
      cree_par: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Statuts (seule modification permise, à sens unique) ----------

/** Passe un objet trouvé à « restitué » (compte du site uniquement, une seule fois). */
export const marquerObjetRestitue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await siteCible(context);
    const { data: lignes, error } = await context.supabase
      .from("objets_trouves")
      .update({
        statut: "restitue",
        statut_at: new Date().toISOString(),
        statut_par: context.userId,
      })
      .eq("id", data.id)
      .eq("statut", "en_attente")
      .select("id");
    if (error) throw new Error(error.message);
    if (!lignes?.length) throw new Error("Objet déjà restitué ou non modifiable.");
    return { ok: true };
  });

/** Passe un pli / colis / clé à « remis » (compte du site uniquement, une seule fois). */
export const marquerDepotRemis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await siteCible(context);
    const { data: lignes, error } = await context.supabase
      .from("courriers_colis")
      .update({ statut: "remis", statut_at: new Date().toISOString(), statut_par: context.userId })
      .eq("id", data.id)
      .eq("statut", "recu")
      .select("id");
    if (error) throw new Error(error.message);
    if (!lignes?.length) throw new Error("Déjà remis ou non modifiable.");
    return { ok: true };
  });
