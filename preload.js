const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  openDWGRenamer: () => ipcRenderer.invoke("open-dwg-renamer"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  processar: (origem, destino, multiplicador) =>
    ipcRenderer.invoke("processar", origem, destino, multiplicador)
});
