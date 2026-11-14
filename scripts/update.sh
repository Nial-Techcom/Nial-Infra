#!/usr/bin/env bash
# Nial-Infra — mise à jour automatique du serveur.
#
#   ./scripts/update.sh              met à jour si une nouvelle version existe
#   ./scripts/update.sh --check      dit seulement s'il y a une mise à jour (ne touche à rien)
#   ./scripts/update.sh --force      reconstruit même s'il n'y a rien de nouveau
#   ./scripts/update.sh --auto [HH]  programme une mise à jour chaque nuit à HH h (défaut 4) puis quitte
#   ./scripts/update.sh --no-auto    supprime la programmation
#
# Ce que fait le script : sauvegarde de la base -> git pull -> docker compose up --build
# -> attend que /health réponde -> sinon, retour automatique à l'ancienne version + base restaurée.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/nial-infra}"   # sauvegardes avant mise à jour
KEEP="${KEEP_BACKUPS:-7}"                           # nombre de sauvegardes conservées
WAIT_SECONDS="${WAIT_SECONDS:-240}"                 # délai max pour que le serveur redémarre
LOG_FILE="${LOG_FILE:-/var/log/nial-infra-update.log}"
CRON_FILE=/etc/cron.d/nial-infra-update

MODE=update
case "${1:-}" in
  "" ) ;;
  --check ) MODE=check ;;
  --force ) MODE=force ;;
  --auto ) MODE=auto ;;
  --no-auto ) MODE=noauto ;;
  -h|--help ) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  * ) echo "Option inconnue : $1 (voir --help)"; exit 2 ;;
esac

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }
die() { log "ERREUR : $*"; exit 1; }

# --- programmation (cron) -------------------------------------------------
if [ "$MODE" = auto ]; then
  [ "$(id -u)" = 0 ] || die "Lance --auto en root."
  HOUR="${2:-4}"
  [[ "$HOUR" =~ ^([0-9]|1[0-9]|2[0-3])$ ]] || die "Heure invalide : $HOUR (0 à 23)."
  command -v cron >/dev/null 2>&1 || command -v crond >/dev/null 2>&1 \
    || { apt-get update -qq && apt-get install -y -qq cron >/dev/null; systemctl enable --now cron >/dev/null 2>&1 || true; }
  # Le cron tourne en root : le script ne doit pas être modifiable par d'autres utilisateurs.
  for f in "$ROOT/scripts/update.sh" "$ROOT/scripts"; do
    perm="$(stat -c %a "$f")"
    if [ "$(stat -c %U "$f")" != root ] || [ $(( 0${perm: -2:1} & 2 )) -ne 0 ] || [ $(( 0${perm: -1} & 2 )) -ne 0 ]; then
      die "$f doit appartenir à root et ne pas être modifiable par un autre utilisateur (chown -R root:root $ROOT && chmod -R go-w $ROOT)."
    fi
  done
  touch "$LOG_FILE"; chmod 600 "$LOG_FILE"
  printf '# Généré par scripts/update.sh --auto\n17 %s * * * root %s >> %s 2>&1\n' \
    "$HOUR" "$ROOT/scripts/update.sh" "$LOG_FILE" > "$CRON_FILE"
  chmod 644 "$CRON_FILE"
  log "Mise à jour automatique programmée chaque nuit à ${HOUR}h17. Journal : $LOG_FILE"
  exit 0
fi
if [ "$MODE" = noauto ]; then
  rm -f "$CRON_FILE"; log "Mise à jour automatique désactivée."; exit 0
fi

# --- vérifications --------------------------------------------------------
command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || die "Docker Compose introuvable."
command -v git >/dev/null 2>&1 || die "git introuvable."
[ -f .env ] || die ".env introuvable dans $ROOT (Nial-Infra est-il installé ici ?)."
[ -d .git ] || die "$ROOT n'est pas un dépôt git."

# un seul exemplaire à la fois (cron + lancement manuel)
LOCK_FILE="${LOCK_FILE:-/var/lock/nial-infra-update.lock}"
[ -w "$(dirname "$LOCK_FILE")" ] || LOCK_FILE="$BACKUP_DIR/.update.lock"
mkdir -p "$(dirname "$LOCK_FILE")"
[ ! -L "$LOCK_FILE" ] || die "$LOCK_FILE est un lien symbolique : refusé."
exec 9>"$LOCK_FILE"
flock -n 9 || die "Une mise à jour est déjà en cours."

git() { command git -c safe.directory="$ROOT" "$@"; }
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
case "$REMOTE_URL" in https://*|ssh://*|git@*) ;; *) die "Le dépôt 'origin' doit être en https:// ou ssh (trouvé : ${REMOTE_URL:-rien}).";; esac
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" != HEAD ] || die "Dépôt en 'detached HEAD' : fais git checkout server d'abord."
PORT="$(grep -E '^WEB_PORT=' .env | tail -1 | cut -d= -f2 | tr -d '\r"' || true)"; PORT="${PORT:-3000}"
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] || die "WEB_PORT invalide dans .env : $PORT"
HEALTH="http://localhost:${PORT}/api/v1/health"

if grep -qE '^(JWT_SECRET|POSTGRES_PASSWORD|ADMIN_PASSWORD)=.*(change-me|generate-)' .env; then
  die ".env contient encore des valeurs d'exemple (change-me / generate-) : remplace-les avant de mettre à jour."
fi

OLD="$(git rev-parse HEAD)"
git fetch -q origin "$BRANCH" || die "Impossible de joindre GitHub (réseau ?)."
NEW="$(git rev-parse "origin/$BRANCH")"

if [ "$OLD" = "$NEW" ] && [ "$MODE" != force ]; then
  log "Déjà à jour (${OLD:0:7}, branche $BRANCH)."
  exit 0
fi
if [ "$MODE" = check ]; then
  log "Mise à jour disponible : ${OLD:0:7} -> ${NEW:0:7}"
  git log --oneline "$OLD..$NEW" | head -20
  exit 10
fi

# Fichiers suivis modifiés à la main : on ne les écrase pas.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  die "Des fichiers du dépôt ont été modifiés à la main : mise à jour annulée (rien n'a été changé)."
fi
git merge-base --is-ancestor "$OLD" "$NEW" || [ "$MODE" = force ] \
  || die "L'historique distant a été réécrit : mise à jour annulée par sécurité."

# --- 1. sauvegarde --------------------------------------------------------
log "Mise à jour ${OLD:0:7} -> ${NEW:0:7} (branche $BRANCH)"
umask 077
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
STAMP="$(date +%F_%H%M%S)"
DUMP="$BACKUP_DIR/nial-infra-$STAMP.sql.gz"
log "1/4 Sauvegarde de la base -> $DUMP"
docker compose up -d postgres >/dev/null
# Serveur installé avec d'anciens noms de base/utilisateur : on les fige dans .env pour qu'ils ne changent jamais.
for var in POSTGRES_USER POSTGRES_DB; do
  if ! grep -q "^${var}=" .env; then
    val="$(docker compose exec -T postgres printenv "$var" 2>/dev/null | tr -d '\r' || true)"
    [[ "$val" =~ ^[A-Za-z0-9_]+$ ]] && printf '\n%s=%s\n' "$var" "$val" >> .env
  fi
done
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$DUMP.part"
[ "$(stat -c %s "$DUMP.part")" -gt 200 ] || { rm -f "$DUMP.part"; die "Sauvegarde vide : mise à jour annulée."; }
gzip -t "$DUMP.part" || { rm -f "$DUMP.part"; die "Sauvegarde corrompue : mise à jour annulée."; }
mv "$DUMP.part" "$DUMP"
cp .env "$BACKUP_DIR/env-$STAMP.bak"
# ne garde que les N plus récentes
ls -1t "$BACKUP_DIR"/nial-infra-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
ls -1t "$BACKUP_DIR"/env-*.bak 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

wait_healthy() {
  local i
  for i in $(seq 1 $((WAIT_SECONDS / 3))); do
    curl -fs "$HEALTH" >/dev/null 2>&1 && return 0
    sleep 3
  done
  return 1
}

# --- 2. code --------------------------------------------------------------
log "2/4 Récupération du code"
git merge --ff-only -q "origin/$BRANCH" 2>/dev/null || git reset -q --hard "origin/$BRANCH"

# --- 3. reconstruction ----------------------------------------------------
log "3/4 Reconstruction et redémarrage (quelques minutes)"
if docker compose up -d --build >/dev/null 2>&1 && wait_healthy; then
  log "4/4 Nial-Infra répond : mise à jour réussie (${NEW:0:7})."
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

# --- échec : retour arrière ----------------------------------------------
log "ÉCHEC : la nouvelle version ne répond pas. Retour à ${OLD:0:7}."
docker compose logs --tail 40 server 2>&1 | sed 's/^/    /' || true
git reset -q --hard "$OLD"
docker compose down >/dev/null 2>&1 || true
docker compose up -d postgres >/dev/null
sleep 5
if ! { docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -q -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" -c "CREATE DATABASE \"$POSTGRES_DB\";"' >/dev/null \
       && gunzip -c "$DUMP" | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q' >/dev/null; }; then
  log "La restauration de la base a échoué. Sauvegarde intacte : $DUMP — suis « Revenir en arrière » de docs/UPDATE.md."
  exit 1
fi
docker compose up -d --build >/dev/null 2>&1 || true
if wait_healthy; then
  log "Ancienne version rétablie (base restaurée depuis $DUMP). La mise à jour a échoué : regarde les lignes ci-dessus."
else
  log "Le retour arrière a aussi échoué. Sauvegarde : $DUMP — suis la section « Revenir en arrière » de docs/UPDATE.md."
fi
exit 1
