#!/usr/bin/env bash
# Mise à jour de Nova Pass sur le VPS : à lancer en root depuis /opt/nova-pass
#   cd /opt/nova-pass && bash deploy/ovh/deployer.sh
set -euo pipefail
cd /opt/nova-pass
# Le code et le build appartiennent à l'utilisateur novapass ; seul le redémarrage exige root.
# bun.lock pointe vers le registre privé Lovable : on installe avec npm.
sudo -u novapass bash -c 'git pull --ff-only && npm install --no-audit --no-fund --no-save && npm run build:ovh'
systemctl restart nova-pass
sleep 2
curl -fsS -o /dev/null http://127.0.0.1:3000/checkin && echo "Nova Pass redémarré ✔"
