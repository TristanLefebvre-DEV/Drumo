# Backend central Drumo

Le serveur partage les utilisateurs, rôles, cours, partitions MIDI, réglages globaux et Coach entre toutes les installations Drumo.

## Démarrage local

```powershell
$env:DRUMO_ADMIN_PASSWORD="un-mot-de-passe-fort"
npm run server:build
npm run server:start
```

L'API écoute sur `http://localhost:8787`. Configure ensuite cette adresse depuis l'écran de connexion Drumo. Le HTTP est accepté uniquement pour `localhost`; un serveur distant doit obligatoirement utiliser HTTPS.

## Déploiement Docker

```bash
DRUMO_ADMIN_PASSWORD='un-mot-de-passe-fort' docker compose -f docker-compose.server.yml up -d --build
```

Placez un proxy HTTPS devant le port 8787 et conservez le volume `drumo-data`. Variables utiles :

- `DRUMO_ADMIN_USERNAME`
- `DRUMO_ADMIN_PASSWORD`
- `DRUMO_DATA_FILE` (défaut Docker : `/data/drumo-data.json`)
- `TRUST_PROXY=true` derrière un proxy
- `DRUMO_CORS_ORIGIN` seulement si un client web est ajouté

## Migrer les comptes locaux

Fermez Drumo, puis copiez le fichier `%APPDATA%\Drumo\drumo-data.json` vers le volume du serveur sous `/data/drumo-data.json`. Les mots de passe sont déjà hashés avec Scrypt et restent utilisables. Ne publiez jamais ce fichier dans Git.

## Sauvegarde

Sauvegardez régulièrement le volume `/data`. Le serveur écrit la base de manière atomique et crée une copie des fichiers corrompus au démarrage.
