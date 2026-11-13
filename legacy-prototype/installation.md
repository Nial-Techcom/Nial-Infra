# Installation sur Debian vierge

Ce guide installe Infra-Tech sur une machine Debian neuve avec un hébergement local simple et reproductible.

## 1. Mettre la machine à jour

```bash
sudo apt update
sudo apt upgrade -y
```

## 2. Installer Nginx et les outils utiles

```bash
sudo apt install -y nginx git curl unzip
```

## 3. Récupérer le projet

```bash
cd /var/www
sudo git clone https://github.com/ton-compte/Infra-Tech.git infra-tech
cd infra-tech
```

Si tu copies les fichiers autrement, il faut juste que `index.html`, `styles.css` et `app.js` se trouvent dans le même dossier.

## 4. Donner les bons droits

```bash
sudo chown -R www-data:www-data /var/www/infra-tech
sudo chmod -R 755 /var/www/infra-tech
```

## 5. Créer la configuration Nginx

Crée le fichier `/etc/nginx/sites-available/infra-tech` :

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/infra-tech;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Puis active le site :

```bash
sudo ln -s /etc/nginx/sites-available/infra-tech /etc/nginx/sites-enabled/infra-tech
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Accéder au site

Ouvre un navigateur sur l'adresse IP de la machine Debian.

Si tu es en local:

```bash
curl http://localhost
```

## 7. Utilisation

- Clique sur un équipement dans la bibliothèque pour l'ajouter au canvas.
- Déplace les nœuds à la souris.
- Active le mode lien pour relier deux équipements.
- Sélectionne un nœud ou un lien pour modifier ses propriétés dans l'inspecteur.
- Sauvegarde localement si tu veux retrouver la topologie au prochain chargement.

## 8. Export et persistance

- Le bouton `Export JSON` télécharge la topologie complète.
- Le bouton `Save local` sauvegarde l'état dans le navigateur.
- Le bouton `Load local` recharge la dernière sauvegarde.

## 9. Dépannage rapide

- Si la page ne charge pas, vérifie `sudo systemctl status nginx`.
- Si le CSS ou le JS ne s'affiche pas, vérifie que les fichiers sont bien dans le dossier racine du site.
- Si tu veux mettre le site derrière un nom de domaine, remplace `server_name _;` par ton domaine.