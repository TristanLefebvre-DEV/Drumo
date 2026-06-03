import path from "node:path";
import fs from "node:fs/promises";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";

// Chemins candidats MuseScore 4 par plateforme
const CANDIDATES: readonly string[] = (() => {
  if (process.platform === "win32") {
    return [
      "MuseScore4",
      "mscore4",
      "C:\\Program Files\\MuseScore 4\\bin\\MuseScore4.exe",
      "C:\\Program Files (x86)\\MuseScore 4\\bin\\MuseScore4.exe",
    ] as const;
  }
  if (process.platform === "darwin") {
    return [
      "mscore4",
      "/Applications/MuseScore 4.app/Contents/MacOS/mscore",
      "/usr/local/bin/mscore4",
      "/opt/homebrew/bin/mscore4",
    ] as const;
  }
  // Linux
  return [
    "mscore4",
    "musescore4",
    "/usr/bin/mscore4",
    "/usr/local/bin/mscore4",
    "/usr/bin/musescore4",
    "/usr/local/bin/musescore4",
    // Flatpak (nécessite de wrapper la commande différemment)
  ] as const;
})();

const NOT_FOUND_MSG =
  "MuseScore 4 introuvable.\n\n" +
  "Installez MuseScore 4 depuis https://musescore.org/fr/download\n" +
  "puis relancez Drumo.\n\n" +
  "Sur Linux, vérifiez que 'mscore4' ou 'musescore4' est dans votre PATH.";

// Tente un binaire : renvoie true si disponible
function tryBinary(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(bin, ["--version"], { timeout: 8_000 });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0 || code === 1)); // certaines versions renvoient 1 pour --version
  });
}

// Cherche le premier binaire fonctionnel
export async function findMuseScore(): Promise<string | null> {
  for (const bin of CANDIDATES) {
    if (await tryBinary(bin)) return bin;
  }
  return null;
}

// ── Résultats IPC ─────────────────────────────────────────────────────────────

export interface RenderResult {
  success: boolean;
  /** MusicXML produit par MuseScore — rendu ensuite par Verovio dans le renderer */
  musicXml?: string;
  /** Conservé pour compatibilité (toujours vide dans ce pipeline) */
  pages: string[];
  error?: string;
  warnings?: string[];
}

export interface ExportResult {
  success: boolean;
  pdfPath?: string;
  musicxmlPath?: string;
  error?: string;
}

export type ExportFormat = "pdf" | "musicxml" | "both";

// ── Exécution MuseScore ────────────────────────────────────────────────────────

function runMuseScore(
  bin: string,
  args: string[]
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    let stderr = "";
    const proc = spawn(bin, args, { timeout: 120_000 });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("error", (err) =>
      resolve({ success: false, error: `Erreur spawn : ${err.message}` })
    );
    proc.on("close", (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: `MuseScore code ${code}\n${stderr.slice(0, 800)}` });
    });
  });
}

// ── Conversion MIDI → MusicXML via MuseScore ─────────────────────────────────

/**
 * Convertit le MIDI batterie normalisé en MusicXML via MuseScore 4 (headless).
 * Le MusicXML est retourné en string — rien n'est écrit chez l'utilisateur.
 * Verovio (côté renderer) s'en charge ensuite pour produire le SVG interactif.
 */
export async function renderDrumScore(
  cleanMidiBytes: number[]
): Promise<RenderResult> {
  const bin = await findMuseScore();
  if (!bin) return { success: false, pages: [], musicXml: undefined, error: NOT_FOUND_MSG };

  const tmpDir     = mkdtempSync(path.join(os.tmpdir(), "drumo-ms-"));
  const midiPath   = path.join(tmpDir, "drum.mid");
  const xmlPath    = path.join(tmpDir, "score.musicxml");

  try {
    writeFileSync(midiPath, Buffer.from(cleanMidiBytes));
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
    return {
      success: false, pages: [],
      error: `Impossible d'écrire le fichier temporaire : ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // MuseScore convertit MIDI → MusicXML (headless, pas d'interface)
  const run = await runMuseScore(bin, ["-o", xmlPath, midiPath]);
  if (!run.success) {
    await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
    return { success: false, pages: [], error: run.error };
  }

  let musicXml: string;
  try {
    musicXml = await fs.readFile(xmlPath, "utf-8");
  } catch {
    await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
    return { success: false, pages: [], error: "MuseScore n'a pas généré le fichier MusicXML." };
  }

  await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
  // pages[] reste vide — le rendu SVG est fait côté renderer par Verovio
  return { success: true, pages: [], musicXml };
}

// ── Export fichier (PDF / MusicXML) ───────────────────────────────────────────

/**
 * Exporte la partition vers un fichier PDF ou MusicXML choisi par l'utilisateur.
 * Séparé du rendu pour garder les deux flux indépendants.
 */
export async function exportDrumScore(
  cleanMidiBytes: number[],
  format: ExportFormat,
  outputPath: string
): Promise<ExportResult> {
  const bin = await findMuseScore();
  if (!bin) return { success: false, error: NOT_FOUND_MSG };

  const tmpDir  = mkdtempSync(path.join(os.tmpdir(), "drumo-ms-"));
  const midiPath = path.join(tmpDir, "drum.mid");

  try {
    writeFileSync(midiPath, Buffer.from(cleanMidiBytes));
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
    return { success: false, error: `Impossible d'écrire le MIDI temporaire : ${err instanceof Error ? err.message : String(err)}` };
  }

  const result: ExportResult = { success: true };
  const formats: Array<"pdf" | "musicxml"> =
    format === "both" ? ["pdf", "musicxml"] : [format];

  for (const fmt of formats) {
    const ext  = fmt === "musicxml" ? "musicxml" : "pdf";
    const dest = format === "both"
      ? outputPath.replace(/\.[^./\\]+$/, `.${ext}`)
      : outputPath;

    const run = await runMuseScore(bin, ["-o", dest, midiPath]);
    if (!run.success) {
      await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
      return { success: false, error: run.error };
    }
    if (fmt === "pdf") result.pdfPath = dest;
    else result.musicxmlPath = dest;
  }

  await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
  return result;
}
