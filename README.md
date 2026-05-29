# Drum MIDI Scorer Pro

Application desktop offline (Windows/Mac/Linux) pour convertir un MIDI batterie en partition de batterie lisible, editable et exportable.

## Fonctionnalites principales

- Import MIDI intelligent (canal 10 + fallback GM drum map)
- Fusion automatique de pistes batterie detectees
- Quantization configurable: `1/4`, `1/8`, `1/16`, `1/32`, `8T`, `16T`
- Preserve groove + detection automatique de swing
- Regroupement automatique en accords batterie (stack vertical)
- Rendu VexFlow sur portee percussion 5 lignes
- Ghost notes, accents, differenciation visuelle des cymbales
- Playback interne avec synchronisation curseur
- Export PDF, MIDI, SVG
- Sauvegarde / chargement projet JSON
- UI sombre type DAW avec timeline + panneau d'options

## Stack

- Electron
- React + TypeScript
- TailwindCSS
- @tonejs/midi
- Tone.js
- VexFlow
- Zustand (store central)

## Architecture

```txt
src/
  core/
    midiParser.ts
    drumMapper.ts
    quantizer.ts
    rhythmEngine.ts
    midiExporter.ts
    types.ts
  render/
    staffRenderer.ts
    vexflowAdapter.ts
  audio/
    midiPlayer.ts
  ui/
    components/
      TopBar.tsx
      ScoreCanvas.tsx
      RightPanel.tsx
    pages/
      DrumScorePage.tsx
  store/
    projectStore.ts
  renderer/
    main.tsx
    styles/index.css
  electron/
    main.ts
    preload.ts
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run package`
- `npm run generate:demo-midi`

## Demo rapide

```bash
npm install
npm run generate:demo-midi
npm run dev
```

Puis importer `assets/demo.mid`.
