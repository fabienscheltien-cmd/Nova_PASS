# Déploiement de Nova Pass sur OVH

Cible : un **VPS OVH** (ou une instance Public Cloud) sous Debian 12 / Ubuntu 24.04.
L'hébergement web mutualisé OVH (PHP/statique) ne convient pas : l'application a besoin
d'un serveur Node.js pour ses fonctions serveur (enregistrement des visites, e-mails, comptes).

Architecture : `nginx (HTTPS) → Node.js (127.0.0.1:3000) → Supabase` + e-mails via le SMTP OVH.
La base de données et l'authentification restent sur **Supabase**.

Le projet reste compatible Lovable : `npm run build` produit toujours la version Cloudflare,
`npm run build:ovh` produit la version Node pour le VPS.

## 1. Prérequis Supabase

Il faut les **trois** valeurs du projet Supabase : URL, clé publique et **clé secrète serveur**
(`service_role` / `sb_secret_…`, menu *Settings › API*).

- Si la clé secrète du projet Lovable Cloud n'est pas accessible, créer un projet sur
  supabase.com (région UE), puis appliquer dans l'ordre les fichiers de
  `supabase/migrations/` et `drizzle/migrations/0000_site_logo.sql` (*SQL Editor*).
  Recréer ensuite le premier compte super admin (*Authentication › Users*, puis insérer
  ses lignes dans `profils` et `user_roles` avec le rôle `super_admin`).
- Dans *Authentication › URL Configuration* : **Site URL** = `https://accueil.votre-domaine.fr`
  et ajouter `https://accueil.votre-domaine.fr/reset-password` aux *Redirect URLs*
  (sinon les invitations et réinitialisations de mot de passe échouent).

## 2. DNS

Espace client OVH › *Domaines* › *Zone DNS* : enregistrement **A** `accueil` → IP du VPS.

## 3. Installation du serveur (une fois)

```sh
# En root sur le VPS
apt update && apt install -y nginx git curl certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs   # Node 22 LTS
useradd --system --create-home --home-dir /opt/nova-pass novapass
sudo -u novapass git clone https://github.com/fabienscheltien-cmd/Nova_PASS.git /opt/nova-pass

cp /opt/nova-pass/deploy/ovh/env.production.example /opt/nova-pass/.env.production
nano /opt/nova-pass/.env.production          # renseigner Supabase et SMTP
chown novapass /opt/nova-pass/.env.production && chmod 600 /opt/nova-pass/.env.production

cd /opt/nova-pass && sudo -u novapass npm install --no-audit --no-fund --no-save \
  && sudo -u novapass npm run build:ovh

cp deploy/ovh/nova-pass.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now nova-pass

cp deploy/ovh/nginx.conf /etc/nginx/sites-available/nova-pass   # adapter server_name
ln -s /etc/nginx/sites-available/nova-pass /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d accueil.votre-domaine.fr                       # certificat HTTPS gratuit
```

Pare-feu : n'ouvrir que 22, 80 et 443 (`ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable`).

## 4. E-mails à l'accueil

Créer une adresse (ex. `accueil@votre-domaine.fr`) dans l'offre e-mail OVH, puis renseigner
`SMTP_*` dans `.env.production`. Serveur SMTP OVH habituel : `ssl0.ovh.net`, port 465 (SSL) —
à confirmer dans l'espace client selon l'offre (MX Plan, Email Pro, Exchange).
Sans `SMTP_HOST`, l'application tente le service e-mail Lovable, sinon n'envoie rien
(la visite est quand même enregistrée).

## 5. Mises à jour

```sh
sudo -u novapass /opt/nova-pass/deploy/ovh/deployer.sh
```
(`deployer.sh` appelle `systemctl restart` : autoriser cette commande pour `novapass` via sudoers,
ou lancer le redémarrage en root.)

Logs : `journalctl -u nova-pass -f`.

## 6. Après la bascule

- **Réimprimer les affiches QR** depuis la nouvelle adresse (menu *Affiche PDF*) : les QR codes
  encodent l'adresse du site depuis lequel ils sont générés.
- Tester : scan d'un QR → formulaire → visite visible au registre → e-mail reçu.
