/**
 * Sample Kit Engine
 *
 * Charge des fichiers audio (MP3, WAV, OGG, FLAC, AIFF, M4A) depuis le
 * disque et crée des DrumVoice Tone.js compatibles avec le moteur de lecture.
 *
 * Chaque voix utilise un pool de Tone.Player pour éviter la coupure lors de
 * frappes rapides successives (ex. hi-hat en double-croche).
 */

import * as Tone from "tone";
import type { DrumVoice } from "./drumSampler";

// ─── Formats acceptés ─────────────────────────────────────────────────────────

export const ACCEPTED_AUDIO_EXTENSIONS = [
  "mp3", "wav", "ogg", "flac", "aac", "m4a", "aiff", "aif", "opus",
] as const;

export function isAudioFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (ACCEPTED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

// ─── Conversion chemin → URL ──────────────────────────────────────────────────

/**
 * Transforme un chemin fichier absolu (Windows ou POSIX) en URL utilisable
 * par Tone.Player dans Electron.
 */
export function filePathToUrl(path: string): string {
  if (
    path.startsWith("file://") ||
    path.startsWith("blob:")   ||
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }
  // Windows : C:\Users\... → file:///C:/Users/...
  return "file:///" + path.replace(/\\/g, "/");
}

// ─── Construction d'une voix depuis un fichier ────────────────────────────────

const POOL_SIZE = 4;  // instances Tone.Player par pièce (polyphonie)

/**
 * Charge un fichier audio et retourne une DrumVoice avec pool de lecteurs.
 * Appeler await sur cette fonction — le chargement est asynchrone.
 */
export async function buildSampleVoice(
  filePath: string,
  output: Tone.ToneAudioNode
): Promise<DrumVoice> {
  const url = filePathToUrl(filePath);

  // Chargement du buffer une seule fois (économie mémoire)
  const buffer = await Tone.ToneAudioBuffer.fromUrl(url);

  // Pool de lecteurs partageant le même buffer
  const players = Array.from({ length: POOL_SIZE }, () =>
    new Tone.Player(buffer).connect(output)
  );

  let poolIdx = 0;

  return {
    trigger: (v = 0.75, time?) => {
      const player = players[poolIdx];
      poolIdx = (poolIdx + 1) % POOL_SIZE;
      if (!player.loaded) return;
      player.volume.value = Tone.gainToDb(Math.max(0.001, Math.min(1, v ?? 0.75)));
      player.start(time ?? (Tone.now() + 0.006));
    },
    dispose: () => {
      players.forEach((p) => { try { p.dispose(); } catch { /**/ } });
      try { buffer.dispose(); } catch { /**/ }
    },
  };
}

/**
 * Prévisualise un fichier audio immédiatement (sans l'affecter à une pièce).
 * Retourne un cancel pour couper le son.
 */
export async function previewSampleFile(filePath: string): Promise<() => void> {
  await Tone.start();
  const out    = new Tone.Gain(0.85).toDestination();
  const voice  = await buildSampleVoice(filePath, out);
  voice.trigger(0.80);
  const cancel = () => { voice.dispose(); out.dispose(); };
  setTimeout(cancel, 8000); // auto-dispose après 8 s
  return cancel;
}
