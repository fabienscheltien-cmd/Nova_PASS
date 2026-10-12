ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS depart_at TIMESTAMPTZ;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS depart_par UUID;
GRANT UPDATE (depart_at, depart_par) ON public.visites TO authenticated;
DROP POLICY IF EXISTS "Enregistrer le depart d'un visiteur" ON public.visites;
CREATE POLICY "Enregistrer le depart d'un visiteur" ON public.visites
FOR UPDATE TO authenticated
USING (depart_at IS NULL AND (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid())))
WITH CHECK (depart_at IS NOT NULL AND depart_par = auth.uid() AND (public.has_role(auth.uid(), 'super_admin') OR site_id = public.site_utilisateur(auth.uid())));