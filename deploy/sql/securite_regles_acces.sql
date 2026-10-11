-- Sécurité : plus aucune règle d'accès « ouverte à tous » (USING (true)).
-- Rejouable : peut être exécutée même si elle a déjà été appliquée.

-- 1. Sites : un compte de site ne lit que son propre site ; la super admin
--    lit et gère tous les sites. (Le formulaire visiteur et l'écran d'accueil
--    passent par le serveur, qui n'est pas concerné par ces règles.)
DROP POLICY IF EXISTS "Comptes authentifies lisent les sites" ON public.sites;
DROP POLICY IF EXISTS "Un compte lit son site" ON public.sites;
CREATE POLICY "Un compte lit son site" ON public.sites
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR id = public.site_utilisateur(auth.uid())
);

-- 2. Réglages (ancienne table, plus utilisée par l'application) : réservés à
--    la super admin.
DROP POLICY IF EXISTS "Personnel connecte peut lire les reglages" ON public.reglages;
DROP POLICY IF EXISTS "Personnel connecte peut creer les reglages" ON public.reglages;
DROP POLICY IF EXISTS "Personnel connecte peut modifier les reglages" ON public.reglages;
DROP POLICY IF EXISTS "Super admin gere les reglages" ON public.reglages;
CREATE POLICY "Super admin gere les reglages" ON public.reglages
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
REVOKE ALL ON public.reglages FROM anon;

NOTIFY pgrst, 'reload schema';
