-- =====================================================================
-- Nova Pass — schéma complet de la base, pour un NOUVEAU projet Supabase
-- (hébergement hors Lovable, par exemple sur OVH).
-- À exécuter UNE fois, dans l'éditeur SQL d'un projet Supabase vide.
-- Contenu : toutes les migrations du dépôt, dans l'ordre
--   supabase/migrations/*.sql puis drizzle/migrations/*.sql.
-- Ne pas exécuter sur la base Lovable Cloud existante (déjà à jour).
-- Ensuite : deploy/sql/super_admins.sql pour créer les comptes super admin.
-- =====================================================================


-- ---------------------------------------------------------------------
-- supabase/migrations/20260909151747_79e398fc-b8a9-48af-8a55-576c96ede0ad.sql
-- ---------------------------------------------------------------------
CREATE TABLE public.visites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  entreprise TEXT NOT NULL,
  personne_visitee TEXT NOT NULL,
  entreprise_visitee TEXT NOT NULL,
  arrivee_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.visites TO authenticated;
GRANT ALL ON public.visites TO service_role;
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Personnel connecte peut lire le registre"
ON public.visites FOR SELECT TO authenticated USING (true);

CREATE INDEX visites_arrivee_at_idx ON public.visites (arrivee_at DESC);

CREATE TABLE public.reglages (
  id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  email_accueil TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT reglages_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.reglages TO authenticated;
GRANT ALL ON public.reglages TO service_role;
ALTER TABLE public.reglages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Personnel connecte peut lire les reglages"
ON public.reglages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Personnel connecte peut creer les reglages"
ON public.reglages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Personnel connecte peut modifier les reglages"
ON public.reglages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.reglages (id, email_accueil) VALUES (1, NULL);


-- ---------------------------------------------------------------------
-- supabase/migrations/20260913073159_59a9eaa6-988c-45cb-9f39-411dd5d1c5c0.sql
-- ---------------------------------------------------------------------
-- Rôles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'hotesse');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- Sites
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  adresse TEXT NOT NULL DEFAULT '',
  code_postal TEXT NOT NULL DEFAULT '',
  ville TEXT NOT NULL DEFAULT '',
  pays TEXT NOT NULL DEFAULT 'France',
  email_accueil TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rôles utilisateurs
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profils (compte -> site)
CREATE TABLE public.profils (
  user_id UUID NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profils TO authenticated;
GRANT ALL ON public.profils TO service_role;
ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profils_updated_at BEFORE UPDATE ON public.profils
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.site_utilisateur(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT site_id FROM public.profils WHERE user_id = _user_id
$$;

-- Politiques
CREATE POLICY "Comptes authentifies lisent les sites" ON public.sites
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin gere les sites" ON public.sites
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Chacun lit ses roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Chacun lit son profil" ON public.profils
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Visites : rattachement au site
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS visites_site_id_idx ON public.visites (site_id);

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visites' LOOP
    EXECUTE format('DROP POLICY %I ON public.visites', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Lecture des visites de son site" ON public.visites
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR site_id = public.site_utilisateur(auth.uid())
);


-- ---------------------------------------------------------------------
-- supabase/migrations/20260913073210_a93c51a7-d959-469e-80de-e35a4a2a6805.sql
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.site_utilisateur(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.site_utilisateur(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- supabase/migrations/20261009120000_registres_accueil.sql
-- ---------------------------------------------------------------------
-- Registres de l'accueil : saisie manuelle des visiteurs, objets trouvés,
-- courrier / colis / clés. Lecture et ajout limités au site du compte
-- (toutes les données pour la super admin). Aucune modification ni
-- suppression possible depuis l'application : le registre est en ajout seul.

-- Visites : traçabilité des saisies manuelles
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS saisie_manuelle BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS cree_par UUID;

REVOKE UPDATE, DELETE, TRUNCATE ON public.visites FROM authenticated, anon;
GRANT INSERT ON public.visites TO authenticated;

CREATE POLICY "Ajout manuel de visites sur son site" ON public.visites
FOR INSERT TO authenticated
WITH CHECK (
  saisie_manuelle
  AND cree_par = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR site_id = public.site_utilisateur(auth.uid())
  )
);

-- Objets trouvés
CREATE TABLE public.objets_trouves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  trouve_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  objet TEXT NOT NULL,
  emplacement TEXT NOT NULL DEFAULT '',
  observation TEXT NOT NULL DEFAULT '',
  cree_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX objets_trouves_site_date_idx ON public.objets_trouves (site_id, trouve_at DESC);

-- Courrier, colis, clés et autres dépôts
DO $$ BEGIN
  CREATE TYPE public.categorie_depot AS ENUM ('courrier', 'colis', 'cles', 'autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.courriers_colis (
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
CREATE INDEX courriers_colis_site_date_idx ON public.courriers_colis (site_id, recu_at DESC);

-- Droits : lecture + ajout uniquement
-- (Supabase accorde ALL par défaut aux nouvelles tables : on retire explicitement le reste.)
REVOKE ALL ON public.objets_trouves, public.courriers_colis FROM anon, authenticated;
GRANT SELECT, INSERT ON public.objets_trouves, public.courriers_colis TO authenticated;
GRANT ALL ON public.objets_trouves, public.courriers_colis TO service_role;
ALTER TABLE public.objets_trouves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courriers_colis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture des objets trouves de son site" ON public.objets_trouves
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid()));

CREATE POLICY "Ajout d'objets trouves sur son site" ON public.objets_trouves
FOR INSERT TO authenticated
WITH CHECK (
  cree_par = auth.uid()
  AND (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid()))
);

CREATE POLICY "Lecture du courrier de son site" ON public.courriers_colis
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid()));

CREATE POLICY "Ajout de courrier sur son site" ON public.courriers_colis
FOR INSERT TO authenticated
WITH CHECK (
  cree_par = auth.uid()
  AND (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid()))
);



-- ---------------------------------------------------------------------
-- supabase/migrations/20261009160000_registres_ajout_par_site.sql
-- ---------------------------------------------------------------------
-- Seul le compte rattaché à un site ajoute des entrées dans les registres
-- (visiteurs saisis à la main, objets trouvés, courrier / colis / clés).
-- La super admin garde la lecture de tous les sites mais n'ajoute rien.

DROP POLICY IF EXISTS "Ajout manuel de visites sur son site" ON public.visites;
CREATE POLICY "Ajout manuel de visites sur son site" ON public.visites
FOR INSERT TO authenticated
WITH CHECK (
  saisie_manuelle
  AND cree_par = auth.uid()
  AND site_id = public.site_utilisateur(auth.uid())
);

DROP POLICY IF EXISTS "Ajout d'objets trouves sur son site" ON public.objets_trouves;
CREATE POLICY "Ajout d'objets trouves sur son site" ON public.objets_trouves
FOR INSERT TO authenticated
WITH CHECK (cree_par = auth.uid() AND site_id = public.site_utilisateur(auth.uid()));

DROP POLICY IF EXISTS "Ajout de courrier sur son site" ON public.courriers_colis;
CREATE POLICY "Ajout de courrier sur son site" ON public.courriers_colis
FOR INSERT TO authenticated
WITH CHECK (cree_par = auth.uid() AND site_id = public.site_utilisateur(auth.uid()));



-- ---------------------------------------------------------------------
-- supabase/migrations/20261009180000_statuts_registres.sql
-- ---------------------------------------------------------------------
-- Statut des objets trouvés (en attente → restitué) et des plis / colis / clés
-- (reçu → remis). Seule modification permise dans les registres : le passage
-- au statut final, une seule fois, par le compte du site, avec date et auteur.
-- Aucune autre colonne n'est modifiable ; aucune suppression.

ALTER TABLE public.objets_trouves
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'restitue')),
  ADD COLUMN IF NOT EXISTS statut_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS statut_par UUID;

ALTER TABLE public.courriers_colis
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'recu'
    CHECK (statut IN ('recu', 'remis')),
  ADD COLUMN IF NOT EXISTS statut_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS statut_par UUID;

-- Droit de mise à jour limité aux seules colonnes de statut.
GRANT UPDATE (statut, statut_at, statut_par) ON public.objets_trouves, public.courriers_colis TO authenticated;

CREATE POLICY "Restitution d'un objet de son site" ON public.objets_trouves
FOR UPDATE TO authenticated
USING (statut = 'en_attente' AND site_id = public.site_utilisateur(auth.uid()))
WITH CHECK (
  statut = 'restitue'
  AND statut_par = auth.uid()
  AND site_id = public.site_utilisateur(auth.uid())
);

CREATE POLICY "Remise d'un pli de son site" ON public.courriers_colis
FOR UPDATE TO authenticated
USING (statut = 'recu' AND site_id = public.site_utilisateur(auth.uid()))
WITH CHECK (
  statut = 'remis'
  AND statut_par = auth.uid()
  AND site_id = public.site_utilisateur(auth.uid())
);



-- ---------------------------------------------------------------------
-- supabase/migrations/20261011150000_restreindre_sites_reglages.sql
-- ---------------------------------------------------------------------
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



-- ---------------------------------------------------------------------
-- drizzle/migrations/0000_site_logo.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS logo_url TEXT;


-- ---------------------------------------------------------------------
-- drizzle/migrations/0001_registres_a_appliquer.sql
-- ---------------------------------------------------------------------
-- 1. Visites : traçabilité des saisies manuelles
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

-- 2. Objets trouvés
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

-- 3. Courrier, colis, clés, autre
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

-- 4. Droits : lecture + ajout ; seule la colonne de statut est modifiable
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

-- 5. Réparation : un compte super admin ne doit pas être l'accès d'un site
DELETE FROM public.user_roles
WHERE role = 'hotesse'
  AND user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin');
UPDATE public.profils SET site_id = NULL
WHERE site_id IS NOT NULL
  AND user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin');

-- 6. Recharge le cache de l'API
NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- drizzle/migrations/0002_depart_visiteur.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS depart_at TIMESTAMPTZ;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS depart_par UUID;
GRANT UPDATE (depart_at, depart_par) ON public.visites TO authenticated;
DROP POLICY IF EXISTS "Enregistrer le depart d'un visiteur" ON public.visites;
CREATE POLICY "Enregistrer le depart d'un visiteur" ON public.visites
FOR UPDATE TO authenticated
USING (depart_at IS NULL AND (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid())))
WITH CHECK (depart_at IS NOT NULL AND depart_par = auth.uid() AND (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid())));


-- ---------------------------------------------------------------------
-- drizzle/migrations/0003_statut_nom_registres.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.objets_trouves ADD COLUMN IF NOT EXISTS statut_nom TEXT;
ALTER TABLE public.courriers_colis ADD COLUMN IF NOT EXISTS statut_nom TEXT;
GRANT UPDATE (statut_nom) ON public.objets_trouves, public.courriers_colis TO authenticated;
