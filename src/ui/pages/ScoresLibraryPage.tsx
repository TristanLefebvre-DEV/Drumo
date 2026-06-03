/**
 * Scores Library Page — "Mes partitions"
 *
 * File-explorer–style manager for personal scores.
 * Supports: PDF · MusicXML · MIDI
 * Features: folders, drag & drop, rename, delete, duplicate,
 *           context menu, search, preview panel, open in Composer.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useScoresStore } from "../../store/scoresStore";
import type { ScoreFile, ScoreFolder, ScoreFormat } from "../../store/scoresStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_COLOR: Record<ScoreFormat, string> = {
  midi:     "var(--accent)",
  pdf:      "#f87171",
  musicxml: "#4ade80",
};
const FORMAT_LABEL: Record<ScoreFormat, string> = {
  midi:     "MIDI",
  pdf:      "PDF",
  musicxml: "XML",
};

const formatSize = (b: number) =>
  b < 1024       ? `${b} o`
  : b < 1048576  ? `${(b / 1024).toFixed(1)} Ko`
                 : `${(b / 1048576).toFixed(1)} Mo`;

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const detectedFormat = (name: string): ScoreFormat => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mid" || ext === "midi") return "midi";
  if (ext === "pdf")                   return "pdf";
  return "musicxml";
};

/** Returns ordered breadcrumb from root to folderId. */
const buildPath = (folderId: string | null, folders: ScoreFolder[]): ScoreFolder[] => {
  if (!folderId) return [];
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return [];
  return [...buildPath(folder.parentId, folders), folder];
};

// ─── Drag state (module-level to avoid stale closures in onDrop) ─────────────

let _drag: { kind: "folder" | "file"; id: string } | null = null;

// ─── Icons ────────────────────────────────────────────────────────────────────

const IcoFolder = ({ open = false }: { open?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <path
      d={open
        ? "M2 7a2 2 0 012-2h3l1.5 1.5H16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"
        : "M2 6a2 2 0 012-2h3l1.5 1.5H16a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"}
      fill="var(--accent)"
      opacity="0.75"
    />
  </svg>
);

const IcoChevron = ({ open }: { open: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10" fill="none"
    style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
  >
    <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FileIcon = ({ format, size = 32 }: { format: ScoreFormat; size?: number }) => {
  const c = FORMAT_COLOR[format];
  if (format === "midi") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="2.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.1"/>
      <path d="M8 9.5v5M11 7v10M14 11v3M17 9.5v5" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
  if (format === "pdf") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="2.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.1"/>
      <path d="M7 8h10M7 12h10M7 16h6" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="2.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.1"/>
      <path d="M9 9l-2 3 2 3M15 9l2 3-2 3M13 8l-2 8" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface CtxItem { label: string; danger?: boolean; separator?: boolean; onClick: () => void }

const ContextMenu = ({
  x, y, items, onClose,
}: {
  x: number; y: number; items: CtxItem[]; onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  // Clamp to viewport
  const left = Math.min(x, window.innerWidth  - 180);
  const top  = Math.min(y, window.innerHeight - items.length * 30 - 12);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed", left, top, zIndex: 9999,
        background: "var(--bg-2)", border: "1px solid var(--sep-2)",
        borderRadius: 8, padding: "4px 0", minWidth: 170,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        backdropFilter: "blur(12px)",
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} style={{ height: 1, background: "var(--sep)", margin: "4px 0" }} />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            style={{
              display: "block", width: "100%", padding: "6px 14px",
              background: "transparent", border: "none", cursor: "pointer",
              textAlign: "left", fontSize: 12, fontWeight: 400,
              color: item.danger ? "#f87171" : "var(--tx-1)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
};

// ─── Inline rename input ──────────────────────────────────────────────────────

const RenameInput = ({
  value, onCommit, onCancel,
}: { value: string; onCommit: (v: string) => void; onCancel: () => void }) => {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => val.trim() ? onCommit(val.trim()) : onCancel()}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); val.trim() ? onCommit(val.trim()) : onCancel(); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      style={{
        flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500,
        background: "var(--bg-3)", border: "1px solid var(--accent)",
        borderRadius: 4, padding: "1px 5px", color: "var(--tx-1)", outline: "none",
      }}
    />
  );
};

// ─── Folder Tree Node ─────────────────────────────────────────────────────────

const FolderNode = ({
  folder, depth, selectedId, expandedIds,
  renamingId, folders,
  onSelect, onToggle, onRename, onStartRename, onCancelRename,
  onCtxMenu, onDrop,
}: {
  folder: ScoreFolder;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  renamingId: string | null;
  folders: ScoreFolder[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  onCtxMenu: (e: React.MouseEvent, id: string) => void;
  onDrop: (targetId: string | null) => void;
}) => {
  const [over, setOver] = useState(false);
  const isOpen = expandedIds.has(folder.id);
  const isSelected = selectedId === folder.id;
  const children = folders.filter(f => f.parentId === folder.id);

  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "center",
          padding: `4px 8px 4px ${12 + depth * 14}px`,
          borderRadius: 6, cursor: "pointer",
          background: over
            ? "rgba(99,102,241,0.18)"
            : isSelected ? "var(--accent-dim)" : "transparent",
          color: isSelected ? "var(--accent)" : "var(--tx-2)",
          userSelect: "none",
        }}
        onClick={() => { onSelect(folder.id); if (!isOpen) onToggle(folder.id); }}
        onDoubleClick={() => { /* navigate */ }}
        onContextMenu={e => { e.preventDefault(); onCtxMenu(e, folder.id); }}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onDrop(folder.id); }}
        draggable
        onDragStart={() => { _drag = { kind: "folder", id: folder.id }; }}
        onDragEnd={() => { _drag = null; }}
      >
        {/* Chevron */}
        <span
          style={{ marginRight: 4, color: "var(--tx-4)", flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onToggle(folder.id); }}
        >
          {children.length > 0 ? <IcoChevron open={isOpen} /> : <span style={{ width: 10, display: "inline-block" }} />}
        </span>

        <span style={{ marginRight: 5, flexShrink: 0 }}><IcoFolder open={isOpen && children.length > 0} /></span>

        {renamingId === folder.id ? (
          <RenameInput
            value={folder.name}
            onCommit={v => onRename(folder.id, v)}
            onCancel={onCancelRename}
          />
        ) : (
          <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {folder.name}
          </span>
        )}
      </div>

      {isOpen && children.map(child => (
        <FolderNode
          key={child.id}
          folder={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          renamingId={renamingId}
          folders={folders}
          onSelect={onSelect}
          onToggle={onToggle}
          onRename={onRename}
          onStartRename={onStartRename}
          onCancelRename={onCancelRename}
          onCtxMenu={onCtxMenu}
          onDrop={onDrop}
        />
      ))}
    </>
  );
};

// ─── File Card ────────────────────────────────────────────────────────────────

const FileCard = ({
  file, selected, renamingId,
  onSelect, onOpen, onCtxMenu, onRename, onCancelRename,
}: {
  file: ScoreFile;
  selected: boolean;
  renamingId: string | null;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  onCtxMenu: (e: React.MouseEvent, id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
}) => (
  <div
    style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 8, padding: "14px 10px 10px",
      borderRadius: 10, cursor: "pointer", width: 120,
      background: selected ? "var(--accent-dim)" : "var(--bg-2)",
      border: `1px solid ${selected ? "var(--accent-line)" : "var(--sep-2)"}`,
      transition: "background 0.13s, border-color 0.13s",
    }}
    onClick={() => onSelect(file.id)}
    onDoubleClick={() => onOpen ? onOpen(file.id) : onSelect(file.id)}
    onContextMenu={e => { e.preventDefault(); onCtxMenu(e, file.id); }}
    draggable
    onDragStart={() => { _drag = { kind: "file", id: file.id }; }}
    onDragEnd={() => { _drag = null; }}
    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-3)"; }}
    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
  >
    <FileIcon format={file.format} size={36} />

    {renamingId === file.id ? (
      <RenameInput
        value={file.name}
        onCommit={v => onRename(file.id, v)}
        onCancel={onCancelRename}
      />
    ) : (
      <span style={{
        fontSize: 11, fontWeight: 500, color: "var(--tx-1)",
        textAlign: "center", width: "100%",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        lineHeight: 1.3,
      }} title={file.name}>
        {file.name}
      </span>
    )}

    <span style={{
      padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
      background: `${FORMAT_COLOR[file.format]}22`,
      color: FORMAT_COLOR[file.format],
      letterSpacing: "0.05em",
    }}>
      {FORMAT_LABEL[file.format]}
    </span>
  </div>
);

// ─── Preview Panel ────────────────────────────────────────────────────────────

// ─── PDF Viewer Modal ─────────────────────────────────────────────────────────

const PdfViewerModal = ({
  file, onClose,
}: {
  file: ScoreFile;
  onClose: () => void;
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setDataUrl(null);
    window.drumApp.readPdfDataUrl(file.filePath)
      .then(url => {
        if (cancelled) return;
        if (url) setDataUrl(url);
        else     setError("Fichier introuvable ou illisible.");
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError("Erreur de lecture du fichier."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [file.filePath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Toolbar */}
      <div style={{
        height: 48, flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
        padding: "0 14px", background: "var(--bg-1)", borderBottom: "1px solid var(--sep)",
      }}>
        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 7,
            border: "1px solid var(--sep-2)", background: "var(--bg-2)",
            color: "var(--tx-2)", fontSize: 12, cursor: "pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-3)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-2)")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <FileIcon format="pdf" size={18} />

        <span style={{
          flex: 1, fontSize: 13, fontWeight: 600, color: "var(--tx-1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {file.name}
        </span>

        <span style={{ fontSize: 10, color: "var(--tx-4)", flexShrink: 0 }}>
          {formatSize(file.fileSize)}
        </span>

        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--tx-3)", fontSize: 18, lineHeight: 1, padding: "2px 6px",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--tx-1)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--tx-3)")}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 14, color: "var(--tx-3)",
          }}>
            {/* Spinner */}
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="18" cy="18" r="14" stroke="var(--sep-2)" strokeWidth="3"/>
              <path d="M18 4a14 14 0 0114 14" stroke="#f87171" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 13 }}>Chargement du PDF…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10,
          }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="17" stroke="#f87171" strokeWidth="2" fill="none" opacity="0.3"/>
              <path d="M20 12v10M20 27v2" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 13, color: "#f87171" }}>{error}</span>
          </div>
        )}
        {dataUrl && (
          <iframe
            src={dataUrl}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title={file.name}
          />
        )}
      </div>
    </div>
  );
};

// ─── Preview Panel ────────────────────────────────────────────────────────────

const PreviewPanel = ({
  file, folders, onOpenInComposer, onViewPdf, onClose,
}: {
  file: ScoreFile;
  folders: ScoreFolder[];
  onOpenInComposer?: (filePath: string) => void;
  onViewPdf?: () => void;
  onClose: () => void;
}) => {
  const path = buildPath(file.folderId, folders);
  const pathLabel = path.length ? path.map(f => f.name).join(" › ") : "Mes partitions";

  return (
    <div style={{
      width: 260, flexShrink: 0, borderLeft: "1px solid var(--sep)",
      background: "var(--bg-1)", display: "flex", flexDirection: "column",
      padding: "16px 14px", gap: 14, overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FileIcon format={file.format} size={40} />
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--tx-4)", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0,
          }}
        >×</button>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx-1)", wordBreak: "break-word", marginBottom: 4 }}>
          {file.name}
        </div>
        <span style={{
          padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700,
          background: `${FORMAT_COLOR[file.format]}22`, color: FORMAT_COLOR[file.format],
        }}>
          {FORMAT_LABEL[file.format]}
        </span>
      </div>

      {/* Metadata */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { label: "Dossier",    value: pathLabel },
          { label: "Importé le", value: formatDate(file.importedAt) },
          { label: "Taille",     value: formatSize(file.fileSize) },
          { label: "Fichier",    value: file.originalName },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--tx-4)" }}>
              {row.label}
            </span>
            <span style={{ fontSize: 11, color: "var(--tx-2)", wordBreak: "break-all" }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        {file.format === "midi" && onOpenInComposer && (
          <button
            onClick={() => onOpenInComposer(file.filePath)}
            style={{
              padding: "9px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "var(--accent)", color: "#fff",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.01em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M5 3l8 5-8 5V3z" fill="currentColor"/>
            </svg>
            Ouvrir dans Composer
          </button>
        )}
        {file.format === "pdf" && onViewPdf && (
          <button
            onClick={onViewPdf}
            style={{
              padding: "9px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#f87171", color: "#fff",
              fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Voir la partition
          </button>
        )}
        {file.format === "musicxml" && (
          <div style={{
            padding: "9px 14px", borderRadius: 8, background: "var(--bg-2)",
            border: "1px solid var(--sep-2)", fontSize: 11, color: "var(--tx-3)",
            textAlign: "center" as const, lineHeight: 1.4,
          }}>
            Aperçu MusicXML non disponible.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export interface ScoresLibraryPageProps {
  onOpenInComposer?: (filePath: string) => void;
}

export const ScoresLibraryPage = ({ onOpenInComposer }: ScoresLibraryPageProps) => {
  const {
    folders, files,
    createFolder, renameFolder, deleteFolder, moveFolder,
    addFile, renameFile, deleteFile, moveFile, duplicateFile,
    getDescendantIds,
  } = useScoresStore();

  // ── Navigation & selection ──────────────────────────────────────────────────
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFileId,   setSelectedFileId]   = useState<string | null>(null);
  const [expandedIds,      setExpandedIds]      = useState<Set<string>>(new Set());

  // ── Rename ──────────────────────────────────────────────────────────────────
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renamingFile,   setRenamingFile]   = useState<string | null>(null);

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctx, setCtx] = useState<{
    x: number; y: number;
    kind: "folder" | "file" | "bg";
    id?: string;
  } | null>(null);

  // ── PDF viewer ──────────────────────────────────────────────────────────────
  const [pdfViewerFile, setPdfViewerFile] = useState<ScoreFile | null>(null);

  // ── Search ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // ── Drag & drop visual feedback ─────────────────────────────────────────────
  const [dropOver, setDropOver] = useState<"root" | string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleFolder = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectFolder = useCallback((id: string | null) => {
    setSelectedFolderId(id);
    setSelectedFileId(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!window.drumApp?.openScoreFiles) return;
    const results = await window.drumApp.openScoreFiles();
    if (!results) return;
    for (const r of results) {
      addFile({
        name:         r.originalName.replace(/\.[^.]+$/, ""),
        originalName: r.originalName,
        folderId:     selectedFolderId,
        format:       r.format as ScoreFormat,
        filePath:     r.filePath,
        fileSize:     r.fileSize,
      });
    }
  }, [addFile, selectedFolderId]);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDropOver(null);
    const dropped = Array.from(e.dataTransfer.files);
    for (const file of dropped) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["mid", "midi", "pdf", "xml", "musicxml"].includes(ext)) continue;
      const filePath = (file as File & { path?: string }).path ?? file.name;
      addFile({
        name:         file.name.replace(/\.[^.]+$/, ""),
        originalName: file.name,
        folderId:     selectedFolderId,
        format:       detectedFormat(file.name),
        filePath,
        fileSize:     file.size,
      });
    }
  }, [addFile, selectedFolderId]);

  const handleDrop = useCallback((targetFolderId: string | null) => {
    if (!_drag) return;
    if (_drag.kind === "file") {
      moveFile(_drag.id, targetFolderId);
    } else {
      // Prevent moving a folder into itself or its descendants
      const dead = new Set(getDescendantIds(_drag.id));
      if (targetFolderId !== null && dead.has(targetFolderId)) return;
      moveFolder(_drag.id, targetFolderId);
    }
    _drag = null;
  }, [moveFile, moveFolder, getDescendantIds]);

  const handleCreateFolder = useCallback((parentId: string | null = selectedFolderId) => {
    const f = createFolder("Nouveau dossier", parentId);
    if (parentId) setExpandedIds(prev => new Set([...prev, parentId]));
    setSelectedFolderId(f.id);
    setRenamingFolder(f.id);
  }, [createFolder, selectedFolderId]);

  const handleDeleteFolder = useCallback((id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const hasChildren = folders.some(f => f.parentId === id) || files.some(f => f.folderId === id);
    const msg = hasChildren
      ? `Supprimer "${folder.name}" et tout son contenu ?`
      : `Supprimer le dossier "${folder.name}" ?`;
    if (!confirm(msg)) return;
    deleteFolder(id);
    if (selectedFolderId === id) setSelectedFolderId(null);
  }, [folders, files, deleteFolder, selectedFolderId]);

  const handleDeleteFile = useCallback((id: string) => {
    const file = files.find(f => f.id === id);
    if (!file) return;
    if (!confirm(`Supprimer "${file.name}" ?`)) return;
    deleteFile(id);
    if (selectedFileId === id) setSelectedFileId(null);
  }, [files, deleteFile, selectedFileId]);

  const handleOpenInComposer = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || file.format !== "midi" || !onOpenInComposer) return;
    onOpenInComposer(file.filePath);
  }, [files, onOpenInComposer]);

  const openPdfViewer = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || file.format !== "pdf") return;
    setPdfViewerFile(file);
  }, [files]);

  const handleFileOpen = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    if (file.format === "pdf") openPdfViewer(fileId);
    else if (file.format === "midi") handleOpenInComposer(fileId);
  }, [files, openPdfViewer, handleOpenInComposer]);

  // ── Context menu builders ────────────────────────────────────────────────────

  const folderCtxItems = (id: string): CtxItem[] => [
    { label: "Renommer",        onClick: () => setRenamingFolder(id) },
    { label: "Nouveau sous-dossier", onClick: () => handleCreateFolder(id) },
    { label: "Déplacer à la racine", onClick: () => moveFolder(id, null) },
    { label: "", separator: true, onClick: () => {} },
    { label: "Supprimer",       danger: true, onClick: () => handleDeleteFolder(id) },
  ];

  const fileCtxItems = (id: string): CtxItem[] => {
    const file = files.find(f => f.id === id);
    const items: CtxItem[] = [
      { label: "Renommer",   onClick: () => setRenamingFile(id) },
      { label: "Dupliquer",  onClick: () => duplicateFile(id) },
      { label: "Déplacer à la racine", onClick: () => moveFile(id, null) },
      { label: "", separator: true, onClick: () => {} },
      { label: "Supprimer",  danger: true, onClick: () => handleDeleteFile(id) },
    ];
    if (file?.format === "pdf") {
      items.unshift({ label: "Voir la partition", onClick: () => openPdfViewer(id) });
      items.splice(1, 0, { label: "", separator: true, onClick: () => {} });
    }
    if (file?.format === "midi" && onOpenInComposer) {
      items.unshift({ label: "Ouvrir dans Composer", onClick: () => handleOpenInComposer(id) });
      items.splice(1, 0, { label: "", separator: true, onClick: () => {} });
    }
    return items;
  };

  const bgCtxItems = (): CtxItem[] => [
    { label: "Nouveau dossier", onClick: () => handleCreateFolder(selectedFolderId) },
    { label: "Importer",        onClick: () => void handleImport() },
  ];

  // ── Visible files (filtered by folder + search) ──────────────────────────────

  const visibleFiles = files.filter(f => {
    const inFolder = f.folderId === selectedFolderId;
    if (!search) return inFolder;
    return f.name.toLowerCase().includes(search.toLowerCase()) ||
           f.originalName.toLowerCase().includes(search.toLowerCase());
  });

  const rootFolders  = folders.filter(f => f.parentId === null);
  const selectedFile = files.find(f => f.id === selectedFileId) ?? null;
  const breadcrumb   = buildPath(selectedFolderId, folders);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedFileId)   handleDeleteFile(selectedFileId);
        else if (selectedFolderId) handleDeleteFolder(selectedFolderId);
      }
      if (e.key === "F2") {
        if (selectedFileId)   setRenamingFile(selectedFileId);
        else if (selectedFolderId) setRenamingFolder(selectedFolderId);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedFileId, selectedFolderId, handleDeleteFile, handleDeleteFolder]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── Left: Folder Tree ── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: "1px solid var(--sep)",
        background: "var(--bg-1)", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 10px 8px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--sep)", flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-3)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            Mes partitions
          </span>
          <button
            title="Nouveau dossier"
            onClick={() => handleCreateFolder(null)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--tx-3)", padding: 3, borderRadius: 4, lineHeight: 1,
              display: "flex",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--tx-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--tx-3)")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Root row */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", cursor: "pointer", userSelect: "none",
            background: selectedFolderId === null && dropOver !== "root"
              ? "var(--accent-dim)" : dropOver === "root" ? "rgba(99,102,241,0.18)" : "transparent",
            color: selectedFolderId === null ? "var(--accent)" : "var(--tx-2)",
            borderRadius: 6, margin: "4px 4px 0",
          }}
          onClick={() => selectFolder(null)}
          onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, kind: "bg" }); }}
          onDragOver={e => { e.preventDefault(); setDropOver("root"); }}
          onDragLeave={() => setDropOver(null)}
          onDrop={e => { e.preventDefault(); setDropOver(null); handleDrop(null); }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M2 5a2 2 0 012-2h3l1.5 1.5H16a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"
              fill={selectedFolderId === null ? "var(--accent)" : "var(--tx-3)"} opacity="0.75"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Tout</span>
        </div>

        {/* Folder tree */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 4px" }}>
          {rootFolders.map(folder => (
            <FolderNode
              key={folder.id}
              folder={folder}
              depth={0}
              selectedId={selectedFolderId}
              expandedIds={expandedIds}
              renamingId={renamingFolder}
              folders={folders}
              onSelect={id => { setSelectedFolderId(id); setSelectedFileId(null); }}
              onToggle={toggleFolder}
              onRename={(id, name) => { renameFolder(id, name); setRenamingFolder(null); }}
              onStartRename={id => setRenamingFolder(id)}
              onCancelRename={() => setRenamingFolder(null)}
              onCtxMenu={(e, id) => setCtx({ x: e.clientX, y: e.clientY, kind: "folder", id })}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>

      {/* ── Center: File area ── */}
      <div
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleFileDrop}
        onContextMenu={e => {
          if ((e.target as HTMLElement).closest("[data-file-card]")) return;
          e.preventDefault();
          setCtx({ x: e.clientX, y: e.clientY, kind: "bg" });
        }}
      >
        {/* Toolbar */}
        <div style={{
          flexShrink: 0, padding: "8px 14px",
          borderBottom: "1px solid var(--sep)",
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--bg-1)",
        }}>
          {/* Breadcrumb */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden" }}>
            <span
              style={{ fontSize: 11, color: "var(--tx-3)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={() => selectFolder(null)}
            >
              Mes partitions
            </span>
            {breadcrumb.map(f => (
              <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <span style={{ color: "var(--tx-4)", fontSize: 11 }}>›</span>
                <span
                  style={{ fontSize: 11, color: "var(--tx-2)", cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={() => selectFolder(f.id)}
                >
                  {f.name}
                </span>
              </span>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <svg
              width="12" height="12" viewBox="0 0 16 16" fill="none"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--tx-4)" }}
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 26, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
                borderRadius: 7, border: "1px solid var(--sep-2)",
                background: "var(--bg-2)", color: "var(--tx-1)", fontSize: 11,
                outline: "none", width: 160,
              }}
            />
          </div>

          {/* New Folder */}
          <button
            onClick={() => handleCreateFolder(selectedFolderId)}
            style={{
              padding: "5px 10px", borderRadius: 7, border: "1px solid var(--sep-2)",
              background: "var(--bg-2)", color: "var(--tx-2)", cursor: "pointer",
              fontSize: 11, display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2 4a2 2 0 012-2h2.5l1.5 2H12a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"
                stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <path d="M8 6v4M6 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Nouveau dossier
          </button>

          {/* Import */}
          <button
            onClick={() => void handleImport()}
            style={{
              padding: "5px 12px", borderRadius: 7, border: "none",
              background: "var(--accent)", color: "#fff", cursor: "pointer",
              fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v9M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Importer
          </button>
        </div>

        {/* File grid */}
        <div
          style={{
            flex: 1, overflowY: "auto", padding: "16px 14px",
            display: "flex", flexWrap: "wrap" as const, gap: 12,
            alignContent: "flex-start",
          }}
          onClick={e => {
            if (!(e.target as HTMLElement).closest("[data-file-card]")) setSelectedFileId(null);
          }}
        >
          {/* Subfolders visible in this folder */}
          {folders
            .filter(f => f.parentId === selectedFolderId && (!search || f.name.toLowerCase().includes(search.toLowerCase())))
            .map(folder => (
              <div
                key={folder.id}
                data-file-card="1"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 8, padding: "14px 10px 10px", borderRadius: 10,
                  cursor: "pointer", width: 120,
                  background: "var(--bg-2)", border: "1px solid var(--sep-2)",
                  transition: "background 0.13s",
                }}
                onDoubleClick={() => { selectFolder(folder.id); if (!expandedIds.has(folder.id)) toggleFolder(folder.id); }}
                onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, kind: "folder", id: folder.id }); }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.18)"; }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
                onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; handleDrop(folder.id); }}
                draggable
                onDragStart={() => { _drag = { kind: "folder", id: folder.id }; }}
                onDragEnd={() => { _drag = null; }}
              >
                <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                  <path d="M4 12a4 4 0 014-4h7l3 3H32a4 4 0 014 4v15a4 4 0 01-4 4H8a4 4 0 01-4-4V12z"
                    fill="var(--accent)" opacity="0.7"/>
                </svg>
                {renamingFolder === folder.id ? (
                  <RenameInput
                    value={folder.name}
                    onCommit={v => { renameFolder(folder.id, v); setRenamingFolder(null); }}
                    onCancel={() => setRenamingFolder(null)}
                  />
                ) : (
                  <span style={{
                    fontSize: 11, fontWeight: 500, color: "var(--tx-1)",
                    textAlign: "center", width: "100%",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }} title={folder.name}>{folder.name}</span>
                )}
              </div>
            ))}

          {/* Files */}
          {visibleFiles.map(file => (
            <div key={file.id} data-file-card="1">
              <FileCard
                file={file}
                selected={selectedFileId === file.id}
                renamingId={renamingFile}
                onSelect={id => setSelectedFileId(id)}
                onOpen={handleFileOpen}
                onCtxMenu={(e, id) => setCtx({ x: e.clientX, y: e.clientY, kind: "file", id })}
                onRename={(id, name) => { renameFile(id, name); setRenamingFile(null); }}
                onCancelRename={() => setRenamingFile(null)}
              />
            </div>
          ))}

          {/* Empty state */}
          {visibleFiles.length === 0 && folders.filter(f => f.parentId === selectedFolderId).length === 0 && (
            <div style={{
              width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 10, paddingTop: 60, color: "var(--tx-4)",
            }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M6 14a4 4 0 014-4h9l3 4H38a4 4 0 014 4v18a4 4 0 01-4 4H10a4 4 0 01-4-4V14z"
                  stroke="currentColor" strokeWidth="1.8" fill="none" opacity="0.4"/>
                <path d="M24 22v8M21 27l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
              </svg>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {search ? "Aucun résultat" : "Dossier vide"}
                </div>
                <div style={{ fontSize: 11 }}>
                  {search ? "Essayez un autre terme" : "Glissez des partitions ici ou cliquez sur Importer"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Preview panel ── */}
      {selectedFile && (
        <PreviewPanel
          file={selectedFile}
          folders={folders}
          onOpenInComposer={onOpenInComposer}
          onViewPdf={selectedFile.format === "pdf" ? () => setPdfViewerFile(selectedFile) : undefined}
          onClose={() => setSelectedFileId(null)}
        />
      )}

      {/* ── Context menu ── */}
      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={
            ctx.kind === "folder" && ctx.id ? folderCtxItems(ctx.id) :
            ctx.kind === "file"   && ctx.id ? fileCtxItems(ctx.id)   :
            bgCtxItems()
          }
          onClose={() => setCtx(null)}
        />
      )}

      {/* ── PDF Viewer modal ── */}
      {pdfViewerFile && (
        <PdfViewerModal
          file={pdfViewerFile}
          onClose={() => setPdfViewerFile(null)}
        />
      )}
    </div>
  );
};
