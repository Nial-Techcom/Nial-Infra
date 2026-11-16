# Licence de Nial-Infra

Toute installation du serveur Nial-Infra demande une licence délivrée par Nial-Tech (**contact@nial-tech.com**).

## Pour un client (administrateur du serveur)

1. Installe le serveur normalement (INSTALLATION.md). Il fonctionne **14 jours** sans licence.
2. Connecte-toi en administrateur → **Administration → Licence**.
3. Clique sur **Demander une licence par e-mail** : un message est pré-rempli pour contact@nial-tech.com avec l'**identifiant d'installation** (à ajouter : société, nombre d'utilisateurs). Si ton client e-mail ne s'ouvre pas, copie l'identifiant et écris à contact@nial-tech.com.
4. Nial-Tech te répond avec un texte `NIAL1.…`. Colle-le dans **Installer la licence**.

Après les 14 jours sans licence, l'API est bloquée (code 402) : toutes les apps affichent « Une licence est requise » et seul un administrateur peut installer la licence. **Les données ne sont jamais supprimées** et reviennent dès l'installation.

Le serveur contacte `LICENSE_SERVER_URL` (par défaut `https://lcsinfra.nial-tech.com`, variable du `.env`) toutes les 6 h pour confirmer que la licence n'est pas révoquée. S'il ne peut pas le joindre, il continue de fonctionner **30 jours**, puis se bloque jusqu'à la prochaine confirmation (sortie HTTPS nécessaire vers ce domaine).

Une licence est liée à **une installation** : si tu réinstalles le serveur avec une base vide, l'identifiant change et il faut en demander une nouvelle. En restaurant une sauvegarde de la base, l'identifiant est conservé.

## Pour Nial-Tech

Voir le README du dépôt privé **Nial-Infra-Licensing** (émission, révocation, déploiement). Résumé : `npm run cli -- issue --customer … --email … --installation <uuid> --days 365`.

## Principe technique

- Licence : `NIAL1.<JSON en base64url>.<signature Ed25519>`. Seule la clé **publique** est dans ce dépôt (`apps/server/src/license/core.ts`) ; la clé privée n'existe que sur le serveur de licences.
- Les réponses du serveur de licences sont elles aussi signées et liées à un nonce : un faux serveur ne peut ni débloquer ni rejouer une réponse.
- Variables : `LICENSE_SERVER_URL` (vide = pas de vérification en ligne). La durée d'essai et la clé publique ne sont modifiables par variable qu'hors production.

## Limites (honnêteté)

Le code étant auto-hébergé, un client technique peut modifier son propre serveur pour retirer la vérification. La licence est une barrière contractuelle et pratique (essai, révocation, support), pas une protection absolue ; elle repose aussi sur la licence légale du dépôt.
