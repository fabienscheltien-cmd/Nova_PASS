#!/usr/bin/env bash
# Mise à jour de Nova Pass sur le VPS : à lancer depuis /opt/nova-pass en tant que novapass.
set -euo pipefail
git pull --ff-only
# bun.lock pointe vers le registre privé Lovable : on installe avec npm.
npm install --no-audit --no-fund --no-save
npm run build:ovh
sudo systemctl restart nova-pass
sleep 2
curl -fsS -o /dev/null http://127.0.0.1:3000/checkin && echo "Nova Pass redémarré ✔"
