# Drumo

Drumo est un logiciel desktop de creation musicale oriente batterie, MIDI et beatmaking. Il permet de composer, editer, mixer et exporter rapidement des idees rythmiques dans une interface sombre inspiree des outils DAW modernes.

Le projet fonctionne en local par defaut, avec une architecture preparee pour les comptes utilisateurs, la synchronisation cloud, les licences et les mises a jour distantes.

## Fonctionnalites principales

- Composition MIDI pour batterie et grooves rythmiques
- Import MIDI avec detection et mapping batterie
- Piano roll, pads, edition de notes et timeline
- Mixer MIDI avec sauvegarde des mix dans la bibliotheque
- Bibliotheque locale de projets, presets et sons
- Metronome avance avec subdivisions configurables
- Sons de metronome par subdivision, avec import MP3/WAV/OGG
- Export audio, MIDI, SVG/PDF selon les vues disponibles
- Lecture interne synchronisee avec le projet
- Interface desktop sombre, moderne et responsive
- Mode local complet, sans obligation de connexion
- Preparation Supabase pour auth, profils, cloud sync et releases
- Systeme de verification des mises a jour distantes
- Builds Windows NSIS et macOS DMG via GitHub Actions

## Cloud et comptes

Drumo garde la bibliotheque locale comme base fiable. Le cloud est ajoute progressivement comme une amelioration :

- Authentification Supabase prevue
- Profiles utilisateurs
- Synchronisation locale/cloud des elements de bibliotheque
- Gestion des versions distantes
- Licences et espace admin preparables cote serveur

Voir [README_SETUP_CLOUD.md](./README_SETUP_CLOUD.md) pour la configuration Supabase.

## Stack technique

- Electron
- React
- TypeScript
- Vite
- TailwindCSS
- Tone.js
- @tonejs/midi
- Zustand
- Supabase-ready services
- Electron Builder

## Lancer en local

```bash
npm install
npm run dev
```

## Builds

Build application :

```bash
npm run build
```

Build Windows local :

```bash
npm run build
npx electron-builder --win nsis --publish never
```

Build macOS DMG :

Le DMG doit etre genere sur macOS. Le depot contient des GitHub Actions qui construisent le `.dmg` sur runner `macos-latest` lors des tags de release.

```bash
git tag v1.2.0
git push origin v1.2.0
```

## Releases

Les releases GitHub publient les assets de telechargement :

- `Drumo Setup x.y.z.exe` pour Windows
- `Drumo-x.y.z.dmg` pour macOS
- `latest.json` pour la verification de mise a jour

## Objectif produit

Drumo vise a devenir un outil simple et rapide pour batteurs, beatmakers et producteurs qui veulent capturer une idee, construire un groove, mixer les elements principaux et exporter sans friction.
