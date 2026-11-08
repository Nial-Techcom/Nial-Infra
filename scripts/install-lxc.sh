#!/usr/bin/env bash
# NetForge server installer for a clean Debian/Ubuntu machine (made for a Proxmox LXC).
# Run it as root from inside the cloned repository:   ./scripts/install-lxc.sh
# Options: --env-only   only create the .env file (no Docker, no start)
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_ONLY=0
[ "${1:-}" = "--env-only" ] && ENV_ONLY=1
[ "$ENV_ONLY" = 1 ] || [ "$(id -u)" = 0 ] || { echo "Lance ce script en root (su - ou sudo)."; exit 1; }

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

if [ "$ENV_ONLY" = 0 ]; then
  say "1/4 Paquets de base"
  apt-get update -qq
  apt-get install -y -qq curl git openssl ca-certificates >/dev/null

  say "2/4 Docker"
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "Docker et Compose sont déjà installés."
  else
    curl -fsSL https://get.docker.com | sh
  fi
fi

say "3/4 Configuration (.env)"
if [ -f .env ]; then
  echo ".env existe déjà : je ne le touche pas."
else
  read -r -p "E-mail de l'administrateur [admin@netforge.local] : " ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@netforge.local}
  read -r -s -p "Mot de passe admin (8+ caractères, vide = en générer un) : " ADMIN_PASSWORD; echo
  GENERATED=0
  if [ -z "$ADMIN_PASSWORD" ]; then ADMIN_PASSWORD=$(openssl rand -hex 8); GENERATED=1; fi
  [ "${#ADMIN_PASSWORD}" -ge 8 ] || { echo "Mot de passe trop court (8 minimum)."; exit 1; }
  read -r -p "Port du site [3000] : " WEB_PORT
  WEB_PORT=${WEB_PORT:-3000}
  umask 077
  cat > .env <<ENV
# Généré par scripts/install-lxc.sh le $(date -I). NE JAMAIS publier ce fichier.
# Le mot de passe de la base est en hexadécimal pour ne pas casser l'URL de connexion.
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
WEB_PORT=$WEB_PORT
ENV
  echo ".env créé (lisible uniquement par root)."
  [ "$GENERATED" = 1 ] && echo "Mot de passe admin généré : $ADMIN_PASSWORD   <- note-le maintenant"
  echo "IMPORTANT : copie ENCRYPTION_KEY (dans .env) dans ton gestionnaire de mots de passe."
fi
[ "$ENV_ONLY" = 1 ] && exit 0

say "4/4 Démarrage de NetForge (3 à 8 minutes la première fois)"
docker compose up -d --build

PORT=$(grep -E '^WEB_PORT=' .env | cut -d= -f2); PORT=${PORT:-3000}
printf "Attente du serveur"
for _ in $(seq 1 60); do
  if curl -fs "http://localhost:${PORT}/api/v1/health" >/dev/null 2>&1; then
    IP=$(hostname -I | awk '{print $1}')
    printf '\n\n\033[1;32mNetForge fonctionne.\033[0m Ouvre http://%s:%s\n' "$IP" "$PORT"
    exit 0
  fi
  printf '.'; sleep 3
done
echo; echo "Le serveur ne répond pas encore. Regarde : docker compose logs --tail 50 server"; exit 1
