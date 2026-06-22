# Serveur de mises à jour Drumo

Drumo consulte automatiquement :

`https://github.com/TristanLefebvre-DEV/Drumo/releases/latest/download/latest.json`

L'adresse reste modifiable dans **Administration > Système > Mises à jour connectées**.

## Publier une version

1. Augmenter `version` dans `package.json` et `package-lock.json`.
2. Committer puis pousser les changements.
3. Créer et pousser le tag correspondant :

```bash
git tag v1.2.0
git push origin main --tags
```

Le workflow GitHub Actions compile Windows et macOS, crée la GitHub Release et publie automatiquement l'installateur avec `latest.json`.

Le client refuse les serveurs distants non HTTPS et vérifie l'empreinte SHA-256 de l'installateur avant de proposer son installation silencieuse.
