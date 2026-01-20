const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

  closeLogin: () => ipcRenderer.send("close-login-window"),


  loginSuccess: (username) =>
    ipcRenderer.invoke("login-success", username),

  getLoggedUser: () =>
    ipcRenderer.invoke("get-logged-user"),

  openDWGRenamer: () => ipcRenderer.invoke("open-dwg-renamer"),
  openProjectManager: () => ipcRenderer.invoke("open-project-manager"),

  loadProjectData: () => ipcRenderer.invoke("load-project-data"),
  saveProjectData: (data) =>
    ipcRenderer.invoke("save-project-data", data),

  selectFolder: () => ipcRenderer.invoke("select-folder"),
  processar: (origem, destino, multiplicador, deleteOrigem) =>
    ipcRenderer.invoke(
      "processar",
      origem,
      destino,
      multiplicador,
      deleteOrigem
    )
});
