# Mettre à jour le serveur Nial-Infra

## Le plus simple : `update.sh` (automatique)

Le script `scripts/update.sh` fait **tout ce qui est décrit plus bas** à ta place : sauvegarde, `git pull`, reconstruction, vérification. S'il y a un problème, il **revient tout seul à l'ancienne version** et restaure la base.

```bash
cd ~/Nial-Infra
./scripts/update.sh --check   # dit s'il y a une mise à jour, ne change rien
./scripts/update.sh           # met à jour maintenant
sudo ./scripts/update.sh --auto 4   # met à jour toutes les nuits à 4h17
```

- *Pourquoi une sauvegarde à chaque fois ?* La base est copiée dans `/var/backups/nial-infra/` (les 7 dernières sont gardées) **avant** de toucher à quoi que ce soit : c'est ce qui permet le retour arrière.
- *Pourquoi il peut refuser ?* Si tu as modifié un fichier du dépôt à la main, ou si l'historique distant a été réécrit, il s'arrête sans rien changer.
- Journal des mises à jour automatiques : `/var/log/nial-infra-update.log`. Pour arrêter : `sudo ./scripts/update.sh --no-auto`.
- Une mise à jour automatique redémarre le site quelques minutes : choisis une heure creuse. Elle installe tout ce qui est poussé sur la branche `server` ; si tu préfères relire avant, utilise seulement `--check` ou lance-la à la main.

Les étapes manuelles ci-dessous restent utiles pour comprendre, ou si le script échoue.

---

Ce tuto explique **comment** mettre à jour, et surtout **pourquoi** chaque étape existe. Compte 5 minutes. Il marche pour une install Docker classique et pour le LXC (c'est le même Docker dedans).

> Les commandes se tapent dans le dossier où tu as installé Nial-Infra (`cd ~/Nial-Infra`), dans la console du serveur (ou du LXC).

---

## Ce qui change dans cette version

- Nouvelle migration de base **`002_accounts_racks_media`** : baies, type de câble, accès par client, invitations, mot de passe oublié, réglages SMTP, catalogue d'équipements.
- **Les accès existants sont conservés** : tous les utilisateurs *technicien* et *lecteur* déjà présents sont automatiquement rattachés à **tous les clients déjà existants**, avec leur rôle. Les admins voient tout, comme avant.
- Les câbles existants deviennent **Ethernet (noir)** par défaut : repasse en fibre ceux qui le sont (fenêtre du câble).
- Nouvelle variable facultative `PUBLIC_URL` (adresse écrite dans les e-mails).

---

## Étape 1 — Sauvegarder (ne saute pas celle-là)

```bash
cd ~/Nial-Infra
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > ~/nial-infra-avant-maj-$(date +%F).sql.gz
cp .env ~/nial-infra-env-$(date +%F).bak
ls -lh ~/nial-infra-avant-maj-*.sql.gz
```

*Pourquoi ?* La migration modifie la base. Elle est testée, mais si quelque chose tourne mal (coupure de courant pendant la mise à jour, par exemple), cette copie est ton **retour en arrière**. Vérifie que le fichier n'est pas vide (`ls -lh`). Sur Proxmox, tu peux aussi faire un **snapshot** du CT avant (Sauvegarde → *Snapshot*) : c'est encore plus rapide.

## Étape 2 — Récupérer le nouveau code

```bash
git status            # doit dire "nothing to commit" ; sinon note ce que tu as modifié
git pull
```

*Pourquoi `git status` d'abord ?* Si tu as modifié des fichiers à la main, `git pull` peut refuser ou fusionner de travers. Mieux vaut le savoir avant. Ton `.env` n'est **pas** suivi par git : il ne sera pas touché.

## Étape 3 — (Facultatif) Ajouter `PUBLIC_URL`

```bash
nano .env
```
Ajoute à la fin (avec **ton** adresse) :
```
PUBLIC_URL=https://nial-infra.tondomaine.fr
```
*Pourquoi ?* Les liens des e-mails d'invitation et de mot de passe oublié sont construits avec cette adresse, **jamais** avec l'adresse de la requête reçue (sinon un tiers pourrait faire envoyer des liens vers son propre site). Tu peux aussi la régler plus tard dans **Administration**, sans toucher au fichier. Enregistre : `Ctrl+O`, `Entrée`, `Ctrl+X`.

## Étape 4 — Reconstruire et redémarrer

```bash
docker compose up -d --build
docker compose logs -f server
```
Attends de voir :
```
Migrations applied: 002_accounts_racks_media
Nial-Infra API listening on :5000
```
puis `Ctrl+C` (ça ne coupe pas le serveur, ça quitte seulement l'affichage des logs).

*Pourquoi ça ne perd rien ?* Tes données sont dans le volume Docker `postgres_data`, qui n'est pas recréé par `--build`. Seul le code du serveur et du site est reconstruit. Les migrations s'exécutent **une seule fois**, dans l'ordre, au démarrage, et sont verrouillées : même si tu relances deux fois, rien n'est appliqué en double.

## Étape 5 — Vérifier

```bash
curl -s http://localhost:5000/api/v1/health            # {"status":"ok"}
curl -s http://localhost:5000/api/v1/auth/config       # {"registrationEnabled":true,"emailEnabled":false}
```
Puis dans le navigateur (`Ctrl+F5` pour vider l'ancien site en cache) :
1. Connecte-toi : tes clients et schémas sont là.
2. En haut, le sélecteur **Schéma | Baies** apparaît.
3. Connecte-toi avec un compte technicien/lecteur existant : il voit toujours ses clients.

## Étape 6 — Configurer les e-mails

Menu en haut à droite → **Administration** :
1. Renseigne l'**adresse publique** (si tu n'as pas fait l'étape 3).
2. Renseigne le **SMTP** puis clique **Envoyer un e-mail de test**.
3. Décide si la **création de compte libre** reste cochée. Cochée : n'importe qui peut créer un compte, mais il ne voit **aucun client** sans invitation. Décochée : seules les personnes invitées peuvent s'inscrire.

Sans SMTP, tout fonctionne sauf l'envoi automatique : l'invitation affiche un lien à transmettre toi-même.

## Étape 7 — Mettre à jour les applications

- **Web** : rien à faire (le site a été reconstruit à l'étape 4).
- **Desktop / mobile** : installe les nouveaux fichiers (`.exe`/`.msi`, `.dmg`, `.apk`, `.ipa`) produits par les branches `windows`, `apple`, `android` (onglet *Actions* du dépôt GitHub). Les anciennes versions de l'app continuent de se connecter mais **ne montrent ni baies ni type de câble**.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| `git pull` refuse (modifications locales) | Fichier modifié à la main | `git stash`, `git pull`, puis `git stash pop` |
| Le conteneur `server` redémarre en boucle | Migration échouée ou `.env` invalide | `docker compose logs --tail 50 server` ; lis la première erreur |
| Un technicien ne voit plus de client | Compte créé **après** la migration (pas de rattachement automatique) | Administration → client → icône *personnes* → inviter son e-mail |
| Les e-mails n'arrivent pas | SMTP mal réglé / spam | Refais l'**e-mail de test** : l'erreur exacte du serveur s'affiche |
| Les liens d'e-mail pointent vers `localhost` | Adresse publique vide | Administration → *Adresse publique* |

### Revenir en arrière

Si la mise à jour échoue et que tu veux retrouver l'état d'avant :
```bash
docker compose down
git checkout <ancien-commit>          # noté avant le git pull : git log --oneline -1
docker compose up -d postgres
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE \"$POSTGRES_DB\";" -c "CREATE DATABASE \"$POSTGRES_DB\";"'
gunzip -c ~/nial-infra-avant-maj-AAAA-MM-JJ.sql.gz | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose up -d --build
```
*Pourquoi recréer la base ?* La sauvegarde contient les tables telles qu'elles étaient **avant** la migration : on repart d'une base vide pour qu'elle soit restaurée proprement. Pense à noter le commit avant le `git pull` (`git log --oneline -1`).
