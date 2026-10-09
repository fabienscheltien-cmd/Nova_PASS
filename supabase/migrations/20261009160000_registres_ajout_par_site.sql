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
