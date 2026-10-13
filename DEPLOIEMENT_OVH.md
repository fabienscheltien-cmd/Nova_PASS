# Héberger Nova Pass sur OVH

Adresse visée : **https://novapass.nova-serenity.fr**, avec
**www.nova-serenity.fr/NovaStore/NovaPass** qui y redirige.

```
Visiteur ──► novapass.nova-serenity.fr ──► VPS OVH : nginx (HTTPS) ──► Node.js (Nova Pass)
                                                                          │
www.nova-serenity.fr/NovaStore/NovaPass ──(redirection 301)──┘            ▼
                                                              Supabase (base + comptes)
                                                              SMTP OVH (e-mails à l'accueil)
```

## Pourquoi un sous-domaine et pas directement `/NovaStore/NovaPass`

- Nova Pass est une application Node.js : elle a besoin d'un **VPS OVH**. L'hébergement web
  mutualisé OVH (celui qui sert en général www.nova-serenity.fr) n'exécute pas Node.js et ne
  peut pas relayer un sous-dossier vers un autre serveur.
- L'application utilise des adresses à la racine (`/checkin`, `/registre`, `/_serverFn/…`,
  `/assets/…`) : la servir dans un sous-dossier demanderait de la reconfigurer entièrement.
- Le sous-domaine + une redirection donnent le même résultat pour l'utilisateur :
  `www.nova-serenity.fr/NovaStore/NovaPass` ouvre Nova Pass. Les QR codes pointent vers
  `https://novapass.nova-serenity.fr/checkin?site=…`.

## Ce qu'il faut avant de commencer

| Élément | Où |
|---|---|
| Un VPS OVH sous Debian 12 ou Ubuntu 24.04 (la plus petite offre suffit) | Espace client OVH › Bare Metal Cloud › VPS |
| Le domaine nova-serenity.fr géré chez OVH | Espace client OVH › Noms de domaine |
| Une adresse e-mail OVH pour l'accueil (ex. `accueil@nova-serenity.fr`) et son mot de passe | Espace client OVH › E-mails |
| Un compte Supabase (gratuit pour démarrer) | https://supabase.com |
| Le code : dépôt GitHub `fabienscheltien-cmd/Nova_PASS` (ou l'archive fournie) | — |

## Étape 1 — Base de données : votre propre projet Supabase

Le serveur a besoin de la **clé secrète** (service role) de la base. Lovable Cloud ne la
fournit pas : il faut un projet Supabase à vous.

1. Sur supabase.com : *New project*, région **Europe (Paris ou Frankfurt)**, choisir un mot de
   passe de base (à conserver).
2. *SQL Editor* › *New query* : coller tout le fichier **`deploy/sql/schema_complet.sql`**,
   puis *Run*. Il crée toutes les tables, règles d'accès et fonctions de l'application.
3. Nouvelle requête : coller **`deploy/sql/super_admins.sql`**, remplacer
   `METTRE_LE_MOT_DE_PASSE_ICI` par le mot de passe voulu, puis *Run*. Les deux comptes
   super admin sont créés (le tableau final doit afficher `super_admin = true`).
4. *Authentication › URL Configuration* :
   - **Site URL** : `https://novapass.nova-serenity.fr`
   - **Redirect URLs** : ajouter `https://novapass.nova-serenity.fr/reset-password`
5. *Authentication › Emails › SMTP Settings* : activer **Custom SMTP** avec l'adresse OVH de
   l'accueil (hôte `ssl0.ovh.net`, port 465, identifiant et mot de passe de l'adresse).
   Indispensable : sans cela, Supabase n'envoie les e-mails de mot de passe (« Envoyer un
   lien », « Mot de passe oublié ») qu'aux membres de votre équipe Supabase, et au plus
   2 par heure.
6. *Project Settings › API* : noter l'**URL du projet**, la **clé publique**
   (`anon` / `sb_publishable_…`) et la **clé secrète** (`service_role` / `sb_secret_…`).

**Données existantes** : les comptes et mots de passe de Lovable Cloud ne sont pas
transférables. Les registres ayant été remis à zéro, le plus simple est de repartir d'une
base vide : recréer les sites (menu *Sites et accès*, avec leur logo), puis leurs accès et
mots de passe. Pour récupérer des données, exporter chaque registre en Excel depuis l'ancien
site avant la bascule.

## Étape 2 — DNS

Espace client OVH › *Noms de domaine* › nova-serenity.fr › *Zone DNS* › *Ajouter une entrée* :
type **A**, sous-domaine **`novapass`**, cible = **adresse IPv4 du VPS**.
(La propagation prend de quelques minutes à quelques heures.)

## Étape 3 — Installer Nova Pass sur le VPS

Se connecter au VPS (`ssh debian@IP-DU-VPS` ou `ssh ubuntu@IP-DU-VPS`), passer root
(`sudo -i`), puis :

```sh
apt update && apt install -y nginx git curl certbot python3-certbot-nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs   # Node 22 LTS

useradd --system --create-home --home-dir /opt/nova-pass novapass
sudo -u novapass git clone https://github.com/fabienscheltien-cmd/Nova_PASS.git /opt/nova-pass
# (sans GitHub : envoyer l'archive sur le VPS et la décompresser dans /opt/nova-pass)

cd /opt/nova-pass
cp deploy/ovh/env.production.example .env.production
nano .env.production    # Supabase (étape 1), SMTP OVH, VITE_URL_PUBLIQUE
chown novapass .env.production && chmod 600 .env.production

# Images de l'application (à faire tant que le site Lovable est encore en ligne)
sudo -u novapass bash deploy/ovh/recuperer-medias.sh

sudo -u novapass npm install --no-audit --no-fund --no-save
sudo -u novapass npm run build:ovh

cp deploy/ovh/nova-pass.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now nova-pass

cp deploy/ovh/nginx.conf /etc/nginx/sites-available/nova-pass
ln -s /etc/nginx/sites-available/nova-pass /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d novapass.nova-serenity.fr     # certificat HTTPS gratuit, renouvelé seul

ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

Vérifier : `systemctl status nova-pass` (doit être *active (running)*), puis ouvrir
https://novapass.nova-serenity.fr.

## Étape 4 — Redirection depuis www.nova-serenity.fr/NovaStore/NovaPass

Si www.nova-serenity.fr est sur l'hébergement web OVH : ajouter dans le fichier
**`.htaccess`** à la racine du site (dossier `www`, par FTP ou via le gestionnaire de
fichiers OVH) la ligne de `deploy/ovh/htaccess-redirection.txt` :

```
Redirect 301 /NovaStore/NovaPass https://novapass.nova-serenity.fr
```

Si le site est un WordPress ou un autre outil, créer la même redirection 301 avec son module
de redirections.

## Étape 5 — E-mails à l'accueil

Renseigner `SMTP_*` dans `.env.production` avec l'adresse OVH de l'accueil. Serveur habituel :
`ssl0.ovh.net`, port 465 (à confirmer dans l'espace client selon l'offre e-mail). Puis
`systemctl restart nova-pass`.

## Étape 6 — Après la mise en ligne

1. Se connecter avec un compte super admin, recréer les sites et leurs accès
   (*Sites et accès* › *Définir le mot de passe*).
2. **Réimprimer toutes les affiches et QR codes** (menu *Affiche PPT*) : les anciens pointent
   vers novapass.lovable.app.
3. Tester : scan d'un QR → formulaire → visite au registre → e-mail reçu par l'accueil.

## Mises à jour

```sh
cd /opt/nova-pass && bash deploy/ovh/deployer.sh      # en root
```

Toute modification d'une variable `VITE_*` de `.env.production` demande de relancer le build
(`deployer.sh` le fait). Journal : `journalctl -u nova-pass -f`.

## Limites hors Lovable

- **Assistant « Poser une question sur les visites »** : il utilise le service d'IA de Lovable
  et affiche « Assistant non configuré » sur OVH. Le reste de l'application fonctionne.
- **E-mails** : ceux de l'application (arrivée d'un visiteur) passent par le SMTP OVH de
  `.env.production` ; ceux des mots de passe passent par le SMTP configuré dans Supabase
  (étape 1.5). Le service e-mail Lovable n'est pas disponible.
- **Images** : copiées depuis Lovable par `recuperer-medias.sh`, à lancer avant d'arrêter le
  site Lovable.
- **Comptes et données** : les mots de passe de Lovable Cloud ne sont pas transférables ;
  les comptes sont à recréer.
- **Modifications faites ensuite dans Lovable** : elles arrivent sur GitHub mais ne sont pas
  mises en ligne seules sur OVH (lancer `deployer.sh`). L'aperçu Lovable continue d'utiliser
  la base Lovable Cloud, pas la vôtre ; une modification de la base faite par Lovable
  (nouveau fichier dans `supabase/migrations/` ou `drizzle/migrations/`) doit être exécutée
  à la main dans l'éditeur SQL de votre projet Supabase.
