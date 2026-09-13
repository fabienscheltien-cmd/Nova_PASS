import { createServerFn } from "@tanstack/react-start";

/** Création unique du compte super administrateur (idempotent). */
export const initialiserSuperAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = "aureli.godin@nova-serenity.fr";

  const { data: existants } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1);
  if (existants && existants.length > 0) return { cree: false };

  const { data: cree, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "21Platon!",
    email_confirm: true,
  });
  if (error || !cree.user) throw new Error(error?.message ?? "Création impossible");

  await supabaseAdmin.from("profils").upsert({ user_id: cree.user.id, email, site_id: null });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: cree.user.id, role: "super_admin" }, { onConflict: "user_id,role" });

  return { cree: true };
});
