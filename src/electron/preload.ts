import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("drumApp", {
  openMidiFile: () => ipcRenderer.invoke("dialog:openMidi"),
  saveProject: (payload: unknown) => ipcRenderer.invoke("project:save", payload),
  loadProject: () => ipcRenderer.invoke("project:load"),
  exportPdf: () => ipcRenderer.invoke("score:exportPdf"),
  exportMidi: (bytes: number[]) => ipcRenderer.invoke("score:exportMidi", bytes),
  exportSvg: (svgText: string) => ipcRenderer.invoke("score:exportSvg", svgText),
  setFullscreen: (enabled: boolean) => ipcRenderer.invoke("window:setFullscreen", enabled)
});
