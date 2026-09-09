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