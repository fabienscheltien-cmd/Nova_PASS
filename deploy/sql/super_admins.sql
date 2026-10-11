-- =====================================================================
-- Nova Pass — comptes super admin : création ou réparation, et mot de passe.
-- Rejouable sans risque. À coller dans Lovable (« exécute exactement ce SQL
-- sur la base ») ou dans l'éditeur SQL de Supabase.
--
-- Avant d'exécuter : sur la ligne « mdp CONSTANT text := '…' » ci-dessous,
-- mettez entre les apostrophes le mot de passe voulu (8 caractères minimum,
-- majuscule, minuscule, chiffre). Il n'est volontairement pas enregistré dans
-- le dépôt.
--
-- Pour chaque adresse de la liste :
--   1. crée le compte de connexion s'il n'existe pas (e-mail déjà confirmé),
--      sinon remplace son mot de passe et confirme l'e-mail ;
--   2. lui donne le rôle super_admin et retire le rôle hotesse ;
--   3. crée ou corrige son profil, sans site (accès à tous les sites).
-- =====================================================================

DO $$
DECLARE
  mdp CONSTANT text := 'METTRE_LE_MOT_DE_PASSE_ICI';
  admins CONSTANT text[] := ARRAY[
    'aurelie.godin@nova-serenity.fr',
    'fabien.scheltien@nova-serenity.fr'
  ];
  adresse text;
  uid uuid;
  hash text;
BEGIN
  IF position('METTRE' in mdp) > 0 OR length(mdp) < 8
     OR mdp !~ '[A-Z]' OR mdp !~ '[a-z]' OR mdp !~ '[0-9]' THEN
    RAISE EXCEPTION 'Indiquez sur la ligne mdp un mot de passe valide (8 caractères, majuscule, minuscule, chiffre).';
  END IF;

  FOREACH adresse IN ARRAY admins LOOP
    hash := extensions.crypt(mdp, extensions.gen_salt('bf', 10));
    SELECT id INTO uid FROM auth.users WHERE lower(email) = adresse LIMIT 1;

    IF uid IS NULL THEN
      uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        adresse, hash, now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', ''
      );
      INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        uid::text, uid,
        jsonb_build_object('sub', uid::text, 'email', adresse, 'email_verified', true),
        'email', now(), now(), now()
      );
      RAISE NOTICE 'Compte créé : %', adresse;
    ELSE
      UPDATE auth.users
      SET encrypted_password = hash,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          banned_until = NULL,
          deleted_at = NULL,
          updated_at = now()
      WHERE id = uid;
      RAISE NOTICE 'Mot de passe redéfini : %', adresse;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    DELETE FROM public.user_roles WHERE user_id = uid AND role = 'hotesse';

    INSERT INTO public.profils (user_id, email, site_id)
    VALUES (uid, adresse, NULL)
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, site_id = NULL;
  END LOOP;
END $$;

-- Contrôle : chaque ligne doit afficher super_admin = true, hotesse = false,
-- site_id vide et email_confirme = true.
SELECT u.email,
       u.email_confirmed_at IS NOT NULL AS email_confirme,
       public.has_role(u.id, 'super_admin') AS super_admin,
       public.has_role(u.id, 'hotesse') AS hotesse,
       p.site_id
FROM auth.users u
LEFT JOIN public.profils p ON p.user_id = u.id
WHERE lower(u.email) IN ('aurelie.godin@nova-serenity.fr', 'fabien.scheltien@nova-serenity.fr');
