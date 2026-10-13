#!/usr/bin/env bash
# Copie sur le VPS les images de l'application (logo Nova Serenity, logo NOVA PASS,
# photo d'accueil) qui sont hébergées par Lovable sous /__l5e/…, pour que le site
# hébergé sur OVH ne dépende plus de Lovable. À lancer depuis /opt/nova-pass,
# TANT QUE le site Lovable est encore publié. nginx les sert ensuite (voir nginx.conf).
set -euo pipefail
SOURCE="${1:-https://novapass.lovable.app}"
CIBLE="${2:-/opt/nova-pass/medias}"
for f in src/assets/*.asset.json; do
  chemin=$(sed -n 's/.*"url": *"\([^"]*\)".*/\1/p' "$f")
  [ -n "$chemin" ] || continue
  mkdir -p "$CIBLE$(dirname "$chemin")"
  curl -fsSL "$SOURCE$chemin" -o "$CIBLE$chemin"
  echo "✔ $chemin"
done
