-- =====================================================================
-- Nova Pass — registres de l'accueil : script unique à exécuter sur la base
-- (équivalent des migrations 20261009120000, 20261009160000, 20261009180000).
-- Rejouable sans risque : il peut être relancé même s'il a déjà été appliqué
-- en tout ou partie. À coller dans Lovable (« exécute ce SQL sur la base »)
-- ou dans l'éditeur SQL de Supabase.
-- =====================================================================

-- 1. Visites : traçabilité des saisies manuelles ------------------------
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS saisie_manuelle BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS cree_par UUID;

REVOKE UPDATE, DELETE, TRUNCATE ON public.visites FROM authenticated, anon;
GRANT INSERT ON public.visites TO authenticated;

DROP POLICY IF EXISTS "Ajout manuel de visites sur son site" ON public.visites;
CREATE POLICY "Ajout manuel de visites sur son site" ON public.visites
FOR INSERT TO authenticated
WITH CHECK (
  saisie_manuelle
  AND cree_par = auth.uid()
  AND site_id = public.site_utilisateur(auth.uid())
);

-- 2. Objets trouvés -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objets_trouves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  trouve_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  objet TEXT NOT NULL,
  emplacement TEXT NOT NULL DEFAULT '',
  observation TEXT NOT NULL DEFAULT '',
  cree_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS objets_trouves_site_date_idx ON public.objets_trouves (site_id, trouve_at DESC);
ALTER TABLE public.objets_trouves
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'restitue')),
  ADD COLUMN IF NOT EXISTS statut_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS statut_par UUID;

-- 3. Courrier, colis, clés, autre ---------------------------------------
DO $$ BEGIN
  CREATE TYPE public.categorie_depot AS ENUM ('courrier', 'colis', 'cles', 'autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.courriers_colis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  categorie public.categorie_depot NOT NULL,
  recu_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  destinataire TEXT NOT NULL,
  expediteur TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cree_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS courriers_colis_site_date_idx ON public.courriers_colis (site_id, recu_at DESC);
ALTER TABLE public.courriers_colis
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'recu'
    CHECK (statut IN ('recu', 'remis')),
  ADD COLUMN IF NOT EXISTS statut_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS statut_par UUID;

-- 4. Droits : lecture + ajout ; seule la colonne de statut est modifiable --
REVOKE ALL ON public.objets_trouves, public.courriers_colis FROM anon, authenticated;
GRANT SELECT, INSERT ON public.objets_trouves, public.courriers_colis TO authenticated;
GRANT UPDATE (statut, statut_at, statut_par) ON public.objets_trouves, public.courriers_colis TO authenticated;
GRANT ALL ON public.objets_trouves, public.courriers_colis TO service_role;
ALTER TABLE public.objets_trouves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courriers_colis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture des objets trouves de son site" ON public.objets_trouves;
CREATE POLICY "Lecture des objets trouves de son site" ON public.objets_trouves
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid()));

DROP POLICY IF EXISTS "Ajout d'objets trouves sur son site" ON public.objets_trouves;
CREATE POLICY "Ajout d'objets trouves sur son site" ON public.objets_trouves
FOR INSERT TO authenticated
WITH CHECK (cree_par = auth.uid() AND site_id = public.site_utilisateur(auth.uid()));

DROP POLICY IF EXISTS "Restitution d'un objet de son site" ON public.objets_trouves;
CREATE POLICY "Restitution d'un objet de son site" ON public.objets_trouves
FOR UPDATE TO authenticated
USING (statut = 'en_attente' AND site_id = public.site_utilisateur(auth.uid()))
WITH CHECK (statut = 'restitue' AND statut_par = auth.uid() AND site_id = public.site_utilisateur(auth.uid()));

DROP POLICY IF EXISTS "Lecture du courrier de son site" ON public.courriers_colis;
CREATE POLICY "Lecture du courrier de son site" ON public.courriers_colis
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid()));

DROP POLICY IF EXISTS "Ajout de courrier sur son site" ON public.courriers_colis;
CREATE POLICY "Ajout de courrier sur son site" ON public.courriers_colis
FOR INSERT TO authenticated
WITH CHECK (cree_par = auth.uid() AND site_id = public.site_utilisateur(auth.uid()));

DROP POLICY IF EXISTS "Remise d'un pli de son site" ON public.courriers_colis;
CREATE POLICY "Remise d'un pli de son site" ON public.courriers_colis
FOR UPDATE TO authenticated
USING (statut = 'recu' AND site_id = public.site_utilisateur(auth.uid()))
WITH CHECK (statut = 'remis' AND statut_par = auth.uid() AND site_id = public.site_utilisateur(auth.uid()));

-- 5. Recharge le cache de l'API (fait disparaître « schema cache ») -------
NOTIFY pgrst, 'reload schema';
