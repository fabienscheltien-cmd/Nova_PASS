import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function exigerSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé à la super administratrice.");
}

/** Un compte super admin ne doit jamais être modifié depuis la gestion des accès des sites. */
async function refuserSiSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    throw new Error(
      "Cette adresse est celle d'un compte super admin : elle ne peut pas servir d'accès à un site. Choisissez une autre adresse d'accueil.",
    );
  }
}

const siteSchema = z.object({
  id: z.string().uuid().optional(),
  nom: z.string().trim().min(1).max(120),
  adresse: z.string().trim().max(200).default(""),
  codePostal: z.string().trim().max(20).default(""),
  ville: z.string().trim().max(120).default(""),
  pays: z.string().trim().max(80).default("France"),
  emailAccueil: z.string().trim().email().max(255).or(z.literal("")).optional(),
  logoUrl: z.string().max(700000).nullable().optional(),
});

export const enregistrerSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => siteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    if (data.emailAccueil) {
      // L'e-mail d'accueil d'un site ne peut pas être celui d'un compte super admin.
      const { data: profil } = await context.supabase
        .from("profils")
        .select("user_id")
        .eq("email", data.emailAccueil.toLowerCase())
        .maybeSingle();
      if (profil) await refuserSiSuperAdmin(profil.user_id);
    }
    const ligne = {
      nom: data.nom,
      adresse: data.adresse,
      code_postal: data.codePostal,
      ville: data.ville,
      pays: data.pays,
      email_accueil: data.emailAccueil || null,
      ...(data.logoUrl !== undefined ? { logo_url: data.logoUrl } : {}),
    };
    if (data.id) {
      const { error } = await context.supabase.from("sites").update(ligne).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: cree, error } = await context.supabase
      .from("sites")
      .insert(ligne)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: cree.id as string };
  });

export const supprimerSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    const { error } = await context.supabase.from("sites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listerComptes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigerSuperAdmin(context);
    const { data: profils, error } = await context.supabase
      .from("profils")
      .select("user_id, email, site_id, created_at, sites(nom)")
      .order("email");
    if (error) throw new Error(error.message);

    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    return (profils ?? []).map((p: any) => ({
      userId: p.user_id as string,
      email: p.email as string,
      siteId: (p.site_id as string | null) ?? null,
      siteNom: (p.sites?.nom as string | undefined) ?? null,
      estSuperAdmin: (roles ?? []).some(
        (r: any) => r.user_id === p.user_id && r.role === "super_admin",
      ),
    }));
  });

export const creerCompte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        motDePasse: z.string().min(8).max(72),
        siteId: z.string().uuid(),
        superAdmin: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cree, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.motDePasse,
      email_confirm: true,
    });
    if (error || !cree.user) throw new Error(error?.message ?? "Création impossible");

    const { error: errProfil } = await supabaseAdmin
      .from("profils")
      .upsert({ user_id: cree.user.id, email: data.email.toLowerCase(), site_id: data.siteId });
    const { error: errRole } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: cree.user.id, role: data.superAdmin ? "super_admin" : "hotesse" },
        { onConflict: "user_id,role" },
      );
    if (errProfil || errRole) {
      // Pas de compte à moitié configuré : on annule la création.
      await supabaseAdmin.auth.admin.deleteUser(cree.user.id);
      throw new Error((errProfil ?? errRole)!.message);
    }
    return { ok: true };
  });

export const modifierCompte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        siteId: z.string().uuid().nullable().optional(),
        motDePasse: z.string().min(8).max(72).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    await refuserSiSuperAdmin(data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.siteId !== undefined) {
      const { error } = await supabaseAdmin
        .from("profils")
        .update({ site_id: data.siteId })
        .eq("user_id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (data.motDePasse) {
      // Adresse choisie par la super admin : confirmée pour que le mot de passe fonctionne tout de suite.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.motDePasse,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const supprimerCompte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    await refuserSiSuperAdmin(data.userId);
    if (data.userId === context.userId)
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profils").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function motDePasseAleatoire() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const special = "@#!%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  let mdp = "";
  for (let i = 0; i < 12; i++) mdp += alphabet[bytes[i]! % alphabet.length];
  return mdp + special[bytes[12]! % special.length] + String(bytes[13]! % 10);
}

/** Génère un nouveau mot de passe, l'applique et le renvoie une seule fois en clair. */
export const genererMotDePasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    await refuserSiSuperAdmin(data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const motDePasse = motDePasseAleatoire();
    // L'adresse a été choisie par la super admin : on la considère confirmée pour que le mot de passe fonctionne tout de suite.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: motDePasse,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { motDePasse };
  });

/**
 * Crée (ou rattache) l'accès d'un site sans dépendre de l'envoi d'un e-mail :
 * le compte est créé confirmé, avec le mot de passe choisi par la super admin,
 * ou à défaut un mot de passe aléatoire inconnu (à définir ensuite ou via un lien).
 */
export const inviterCompte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        siteId: z.string().uuid(),
        motDePasse: z.string().min(8).max(72).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    let userId: string | undefined;
    const { data: cree, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.motDePasse ?? motDePasseAleatoire() + motDePasseAleatoire(),
      email_confirm: true,
    });
    if (cree?.user) {
      userId = cree.user.id;
    } else if (error && /already|exists|registered/i.test(error.message)) {
      // Compte déjà présent (ex. tentative précédente) : on le retrouve et on le rattache.
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data: liste, error: errListe } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (errListe) throw new Error(errListe.message);
        userId = liste.users.find((u) => u.email?.toLowerCase() === email)?.id;
        if (liste.users.length < 200) break;
      }
    }
    if (!userId) throw new Error(error?.message ?? "Création de l'accès impossible");
    if (!cree?.user) {
      // Compte existant : jamais un super admin, ni l'accès d'un autre site.
      await refuserSiSuperAdmin(userId);
      const { data: profilExistant } = await supabaseAdmin
        .from("profils")
        .select("site_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (profilExistant?.site_id && profilExistant.site_id !== data.siteId) {
        throw new Error(
          "Cette adresse est déjà l'accès d'un autre site. Choisissez une autre adresse.",
        );
      }
    }
    if (!cree?.user && data.motDePasse) {
      const { error: errMdp } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.motDePasse,
        email_confirm: true,
      });
      if (errMdp) throw new Error(errMdp.message);
    }

    const { error: errProfil } = await supabaseAdmin
      .from("profils")
      .upsert({ user_id: userId, email, site_id: data.siteId });
    if (errProfil) throw new Error(errProfil.message);
    const { error: errRole } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "hotesse" }, { onConflict: "user_id,role" });
    if (errRole) throw new Error(errRole.message);
    return { ok: true };
  });

/** Renvoie un e-mail permettant de (re)choisir son mot de passe. */
export const envoyerLienMotDePasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().email(), origine: z.string().url().max(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigerSuperAdmin(context);
    const { error } = await context.supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${data.origine}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
