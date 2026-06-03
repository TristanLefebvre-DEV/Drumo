import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { normalizeDrumMidi } from "../../musescore/drumMidiNormalizer";
import { exportProjectToMidiBytes } from "../../core/midiExporter";
import {
  renderMusicXml,
  getNoteIdAtTimeSync,
  tickToMs,
  type MutablePiece,
  type ScorePage,
  type TimemapEntry,
} from "../../musescore/verovioRenderer";
import type { ParsedDrumProject } from "../../core/types";

// ── Cache module-level (survit aux changements d'onglet) ─────────────────────
// Le composant est démonté/remonté à chaque switch d'onglet.
// Ce cache évite de relancer MuseScore si le projet n'a pas changé.

interface RenderCache {
  sig:      string;
  musicXml: string;
  pages:    ScorePage[];
  timemap:  TimemapEntry[];
  warnings: string[];
}
let _cache: RenderCache | null = null;

/** Signature légère du projet — invalide le cache si les hits ou le tempo changent */
const projectSig = (p: ParsedDrumProject): string =>
  `${p.sourceName}|${p.hits.length}|${p.tempoBpm}|${p.ppq}|${p.timeSignature.numerator}/${p.timeSignature.denominator}`;

// ── Pièces masquables ────────────────────────────────────────────────────────

const MUTABLE_PIECES: { id: MutablePiece; label: string }[] = [
  { id: "kick",        label: "Kick"       },
  { id: "snare",       label: "Snare"      },
  { id: "hihatClosed", label: "HH Fermé"   },
  { id: "hihatOpen",   label: "HH Ouvert"  },
  { id: "crash",       label: "Crash"      },
  { id: "ride",        label: "Ride"       },
  { id: "tomLow",      label: "Tom Bas"    },
  { id: "tomMid",      label: "Tom Mid"    },
  { id: "tomHigh",     label: "Tom Haut"   },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  project: ParsedDrumProject | null;
}

// ── Composant ────────────────────────────────────────────────────────────────

export const MuseScorePanel = ({ project }: Props) => {
  const { activeTick, isPlaying, play, pause } = useProjectStore();
  const tickRef = useRef(activeTick);
  tickRef.current = activeTick; // toujours à jour sans recréer le RAF

  // État de génération
  const [status, setStatus]     = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [pages, setPages]       = useState<ScorePage[]>([]);
  const [musicXml, setMusicXml] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Affichage
  const [timemap, setTimemap]   = useState<TimemapEntry[]>([]);
  const timemapRef              = useRef<TimemapEntry[]>([]);
  timemapRef.current = timemap;

  const [zoom, setZoom]         = useState(1.0);
  const [exporting, setExporting] = useState(false);

  // Pièces masquées (pratique)
  const [mutedPieces, setMutedPieces] = useState<Set<MutablePiece>>(new Set());

  // Playhead — manipulation DOM directe (pas de setState → pas de re-render)
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const playheadRef     = useRef<HTMLDivElement>(null);
  const rafRef          = useRef<number>(0);

  // ── Restaurer le cache ou auto-générer au montage ────────────────────────
  useEffect(() => {
    if (!project) return;
    const sig = projectSig(project);
    if (_cache && _cache.sig === sig) {
      // Projet inchangé → restauration instantanée depuis le cache
      setMusicXml(_cache.musicXml);
      setPages(_cache.pages);
      setTimemap(_cache.timemap);
      setWarnings(_cache.warnings);
      setStatus("done");
    } else {
      // Nouveau projet ou premier affichage → générer automatiquement
      void generate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-render Verovio quand les pièces masquées changent ─────────────────
  useEffect(() => {
    if (!musicXml) return;
    void (async () => {
      const result = await renderMusicXml(musicXml, mutedPieces);
      setPages(result.pages);
      setTimemap(result.timemap);
    })();
  }, [musicXml, mutedPieces]);

  // ── Playhead synchrone via RAF (manipulation DOM directe, zéro re-render) ─
  //
  // Source audio : toujours le MIDI (project.hits → PlaybackEngine → MidiScheduler).
  // MuseScorePanel ne produit aucun son — il suit visuellement la lecture MIDI.
  useEffect(() => {
    const cursor = playheadRef.current;
    if (!cursor) return;

    if (!isPlaying || !project || pages.length === 0) {
      cursor.style.display = "none";
      return;
    }

    const bpm     = project.tempoBpm;
    const ppq     = project.ppq;
    let   lastId  = "";   // évite les requêtes DOM inutiles si l'ID n'a pas changé
    let   scrollScheduled = false;

    const update = () => {
      const ms = tickToMs(tickRef.current, ppq, bpm);
      const id = getNoteIdAtTimeSync(ms, timemapRef.current);

      if (id && svgContainerRef.current) {
        const container = svgContainerRef.current;

        // Ne recherche l'élément que si l'ID a changé
        if (id !== lastId) {
          lastId = id;
          const el = container.querySelector<Element>(`[id="${id}"]`);

          if (el) {
            const cRect = container.getBoundingClientRect();
            const eRect = el.getBoundingClientRect();

            // ── Position horizontale du curseur (relative au contenu scrollable) ──
            const x = eRect.left - cRect.left + container.scrollLeft + eRect.width / 2;
            cursor.style.display = "block";
            cursor.style.left    = `${Math.max(0, Math.round(x - 1))}px`;

            // ── Scroll vertical automatique — suit la page courante ──────────────
            // La partition peut s'étendre sur plusieurs pages empilées verticalement.
            // On scrolle pour que la note active soit toujours visible dans le viewport.
            if (!scrollScheduled) {
              scrollScheduled = true;
              const noteY       = eRect.top    - cRect.top  + container.scrollTop;
              const viewTop     = container.scrollTop;
              const viewBottom  = container.scrollTop + container.clientHeight;
              const margin      = 120; // px déclenchant le scroll

              if (noteY < viewTop + margin || noteY > viewBottom - margin) {
                const target = Math.max(0, noteY - container.clientHeight * 0.32);
                container.scrollTo({ top: target, behavior: "smooth" });
              }

              // Throttle : un scroll toutes les 400 ms max pour ne pas saccader
              setTimeout(() => { scrollScheduled = false; }, 400);
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(rafRef.current);
      cursor.style.display = "none";
      lastId = "";
    };
  }, [isPlaying, project, pages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Invalider le cache si le projet change pendant que le panneau est affiché
  useEffect(() => {
    if (!project) return;
    const sig = projectSig(project);
    if (_cache && _cache.sig !== sig) {
      // Le projet a été modifié (nouveau MIDI, édition de notes) → re-générer
      _cache = null;
      void generate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.hits.length, project?.tempoBpm, project?.sourceName]);

  // ── Génération de la partition ────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!project || status === "rendering") return;
    setStatus("rendering");
    setPages([]);
    setMusicXml(null);
    setError(null);
    setWarnings([]);

    try {
      const rawBytes   = exportProjectToMidiBytes(project);
      const normalized = normalizeDrumMidi(new Uint8Array(rawBytes));

      // 1. MuseScore → MusicXML (headless, arrière-plan)
      const ipcResult = await window.drumApp.renderDrumScore({
        midiBytes: Array.from(normalized.bytes),
        warnings:  normalized.warnings,
      });

      if (!ipcResult.success || !ipcResult.musicXml) {
        setError(ipcResult.error ?? "MuseScore n'a pas retourné de MusicXML.");
        setStatus("error");
        return;
      }

      setWarnings(ipcResult.warnings ?? []);
      setMusicXml(ipcResult.musicXml);

      // 2. Verovio → SVG + timemap (dans le renderer, instantané)
      const rendered = await renderMusicXml(ipcResult.musicXml, mutedPieces);
      setPages(rendered.pages);
      setTimemap(rendered.timemap);
      setStatus("done");

      // 3. Mettre en cache pour les prochains changements d'onglet
      _cache = {
        sig:      projectSig(project),
        musicXml: ipcResult.musicXml,
        pages:    rendered.pages,
        timemap:  rendered.timemap,
        warnings: [...(ipcResult.warnings ?? [])],
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [project, status, mutedPieces]);

  // ── Export fichier ────────────────────────────────────────────────────────
  const exportScore = async (format: "pdf" | "musicxml" | "both") => {
    if (!project || exporting) return;
    setExporting(true);
    try {
      const rawBytes   = exportProjectToMidiBytes(project);
      const normalized = normalizeDrumMidi(new Uint8Array(rawBytes));
      await window.drumApp.exportDrumScore({
        midiBytes: Array.from(normalized.bytes),
        format,
      });
    } finally {
      setExporting(false);
    }
  };

  // ── Toggle masquage d'une pièce ───────────────────────────────────────────
  const toggleMute = (piece: MutablePiece) => {
    setMutedPieces((prev) => {
      const next = new Set(prev);
      if (next.has(piece)) next.delete(piece);
      else next.add(piece);
      return next;
    });
  };

  // ── Vue vide ──────────────────────────────────────────────────────────────
  if (!project) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50">
        <p className="text-xs text-zinc-600">Charge un fichier MIDI pour générer la partition.</p>
      </div>
    );
  }

  // ── Vue partition (SVG) ───────────────────────────────────────────────────
  if (status === "done" && pages.length > 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">

        {/* ── Toolbar ── */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-1.5">
          <button
            type="button"
            onClick={() => { _cache = null; setStatus("idle"); setPages([]); setMusicXml(null); }}
            className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          >
            ↺ Régénérer
          </button>

          <div className="h-4 w-px bg-zinc-700" />

          {/* Zoom */}
          <span className="text-[10px] text-zinc-600">Zoom</span>
          {[0.5, 0.75, 1.0, 1.25, 1.5].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`rounded px-2 py-0.5 text-[11px] font-mono transition ${
                zoom === z ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {Math.round(z * 100)}%
            </button>
          ))}

          {/* Lecture — source audio : MIDI uniquement (project.hits → PlaybackEngine) */}
          <div className="h-4 w-px bg-zinc-700" />
          <button
            type="button"
            onClick={() => void (isPlaying ? pause() : play())}
            disabled={!project}
            title={isPlaying ? "Pause — lecture MIDI" : "Lecture MIDI avec suivi partition"}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
              isPlaying
                ? "border-red-500/40 bg-red-500/10 text-red-300 hover:border-red-500/60"
                : "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:border-blue-500/60"
            }`}
          >
            {isPlaying ? (
              <><span style={{ fontSize: 9 }}>⏸</span> Pause</>
            ) : (
              <><span style={{ fontSize: 9 }}>▶</span> Lire</>
            )}
          </button>
          {isPlaying && (
            <span className="text-[10px] text-blue-400/70" title="La partition suit la lecture MIDI">
              ↓ suivi partition
            </span>
          )}

          {/* Export */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600">Export</span>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportScore("pdf")}
              className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-40"
            >
              PDF
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportScore("musicxml")}
              className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-40"
            >
              MusicXML
            </button>
          </div>
        </div>

        {/* ── Masquage pièces (entraînement) ── */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-1.5">
          <span className="text-[10px] text-zinc-600 shrink-0">Masquer :</span>
          {MUTABLE_PIECES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleMute(id)}
              className={`rounded border px-2 py-0.5 text-[10px] font-medium transition ${
                mutedPieces.has(id)
                  ? "border-red-500/50 bg-red-600/20 text-red-300 line-through"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
          {mutedPieces.size > 0 && (
            <button
              type="button"
              onClick={() => setMutedPieces(new Set())}
              className="ml-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition"
            >
              Tout afficher
            </button>
          )}
        </div>

        {/* ── Warnings normalisation ── */}
        {warnings.length > 0 && (
          <div className="shrink-0 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2">
            {warnings.map((w, i) => (
              <p key={i} className="text-[10px] text-amber-400/80">⚠ {w}</p>
            ))}
          </div>
        )}

        {/* ── Pages SVG scrollables + playhead ── */}
        <div
          ref={svgContainerRef}
          className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          {/* Curseur de lecture — positionné par RAF via ref, sans setState */}
          <div
            ref={playheadRef}
            style={{
              display:       "none",
              position:      "absolute",
              top:           0,
              width:         2,
              height:        "100%",
              background:    "rgba(96,165,250,0.85)",
              borderRadius:  2,
              boxShadow:     "0 0 8px 3px rgba(96,165,250,0.5)",
              pointerEvents: "none",
              zIndex:        20,
            }}
          />

          <div className="flex flex-col items-center gap-6">
            {pages.map((page) => (
              <div
                key={page.pageIndex}
                className="bg-white shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
                style={{ width: `${Math.round(800 * zoom)}px` }}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: page.svg }}
              />
            ))}
          </div>
        </div>

      </div>
    );
  }

  // ── Vue idle / loading / erreur ───────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-xl border border-zinc-800 bg-zinc-950/90 p-10">

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-blue-400">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-sm font-semibold text-zinc-100">Partition Batterie</h2>
        <p className="mt-1 max-w-xs text-xs text-zinc-500">
          MuseScore 4 convertit le MIDI en notation musicale correcte.
          Verovio l'affiche directement dans Drumo avec playhead et masquage d'instruments.
        </p>
      </div>

      {status === "error" && error && (
        <div className="w-full max-w-md rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3 text-xs text-red-300">
          <p className="whitespace-pre-wrap">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={status === "rendering"}
        className="flex items-center gap-2 rounded-lg border border-blue-600/40 bg-blue-600/20 px-8 py-2.5 text-sm font-semibold text-blue-300 transition hover:border-blue-500/60 hover:bg-blue-600/30 disabled:cursor-wait disabled:opacity-50"
      >
        {status === "rendering" ? (
          <>
            <span className="h-2 w-2 animate-ping rounded-full bg-blue-400" />
            Rendu en cours…
          </>
        ) : status === "error" ? "Réessayer" : "Générer la partition"}
      </button>

      <p className="text-[10px] text-zinc-700">
        Requiert <span className="font-mono">MuseScore 4</span> installé
      </p>
    </div>
  );
};
