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
