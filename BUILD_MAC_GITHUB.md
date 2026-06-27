# Build macOS avec GitHub Actions

Drumo ne peut pas produire un vrai `.dmg` macOS depuis Windows. Le build macOS doit passer par GitHub Actions sur un runner `macos-latest`.

## Build manuel

1. Va sur GitHub > `Actions`.
2. Ouvre le workflow `Build macOS`.
3. Clique `Run workflow`.
4. Laisse `publish_release` sur `false` pour produire seulement un artefact.
5. Une fois fini, télécharge l'artefact `Drumo-macOS-*`.

Le workflow génère les DMG dans `release/*.dmg` pour `x64` et `arm64`.

## Publier une release macOS

1. Vérifie que `package.json` contient la bonne version.
2. Commit et push :

```bash
git add .
git commit -m "Build macOS release workflow"
git push origin main
```

3. Crée un tag identique à la version du `package.json` :

```bash
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions lance alors le build macOS et publie les fichiers sur la GitHub Release du tag.

## Signature macOS

Pour le moment, le build est non signé :

```yaml
CSC_IDENTITY_AUTO_DISCOVERY: false
```

Le `.dmg` peut donc demander à l'utilisateur de faire clic droit > Ouvrir au premier lancement. Pour une app distribuée publiquement, ajoute ensuite les secrets Apple Developer (`CSC_LINK`, `CSC_KEY_PASSWORD`, puis notarisation).
