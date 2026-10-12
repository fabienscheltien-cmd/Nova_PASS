ALTER TABLE public.objets_trouves ADD COLUMN IF NOT EXISTS statut_nom TEXT;
ALTER TABLE public.courriers_colis ADD COLUMN IF NOT EXISTS statut_nom TEXT;
GRANT UPDATE (statut_nom) ON public.objets_trouves, public.courriers_colis TO authenticated;