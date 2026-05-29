/// <reference types="vite/client" />

declare global {
  interface Window {
    drumApp: {
      openMidiFile: () => Promise<{ filePath: string; bytes: number[] } | null>;
      saveProject: (payload: unknown) => Promise<string | null>;
      loadProject: () => Promise<{ filePath: string; content: string } | null>;
      exportPdf: () => Promise<string | null>;
      exportMidi: (bytes: number[]) => Promise<string | null>;
      exportSvg: (svgText: string) => Promise<string | null>;
      setFullscreen: (enabled: boolean) => Promise<boolean>;
    };
  }
}

export {};
