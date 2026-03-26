const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

  onUpdateAvailable: cb =>
    ipcRenderer.on("update-available", (_, v) => cb(v)),

  onUpdateProgress: cb =>
    ipcRenderer.on("update-progress", (_, p) => cb(p)),

  onUpdateDone: cb =>
    ipcRenderer.on("update-done", cb),

  onSplashStartExit: cb =>
    ipcRenderer.on("splash-start-exit", cb),

  closeLogin: () => ipcRenderer.send("close-login-window"),


  loginSuccess: (username) =>
    ipcRenderer.invoke("login-success", username),

  getLoggedUser: () =>
    ipcRenderer.invoke("get-logged-user"),

  getAppEnvironment: () =>
    ipcRenderer.invoke("get-app-environment"),

  openDWGRenamer: () => ipcRenderer.invoke("open-dwg-renamer"),
  openProjectManager: () => ipcRenderer.invoke("open-project-manager"),
  getModuleUpdateStatus: (options) => ipcRenderer.invoke("get-module-update-status", options),
  checkAppUpdate: () => ipcRenderer.invoke("check-app-update"),

  getLauncherState: () => ipcRenderer.invoke("get-launcher-state"),
  saveLauncherState: (state) => ipcRenderer.invoke("save-launcher-state", state),

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
