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
