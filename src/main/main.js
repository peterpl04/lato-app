if (process.env.NODE_ENV === "development") {
  require("dotenv").config();

  require("electron-reload")(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`)
  });
}

const { app, BrowserWindow, dialog, ipcMain, shell, globalShortcut} = require("electron");
const archiver = require("archiver");
const path = require("path");
const fs = require("fs");
const DATA_PATH = path.join(__dirname, "data", "project-manager.json");

app.setPath("userData", path.join(app.getPath("documents"), "LatoApps"));

const { autoUpdater } = require("electron-updater");

const ghToken = process.env.GH_TOKEN;

if (ghToken && ghToken !== "undefined" && ghToken !== "null") {
  autoUpdater.requestHeaders = {
    Authorization: `token ${ghToken}`
  };
}

const log = require("electron-log");

log.transports.file.level = "info";
autoUpdater.logger = log;

log.info("Aplicação iniciada");

let loginWindow;
let mainWindow;
let splashWindow;
let updateWindow;
let loggedUser = null;
let splashDelayDone = false;
let updateCheckResolved = false;
let updateIsAvailable = false;

function tryOpenLoginAfterStartup() {
  if (!splashDelayDone || !updateCheckResolved || updateIsAvailable || loginWindow) {
    return;
  }

  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }

  createLoginWindow();
}

function createUpdateWindow() {
  updateWindow = new BrowserWindow({
    width: 560,
    height: 320,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    backgroundColor: "#041527",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  updateWindow.setMenu(null);

  updateWindow.loadFile(
    path.join(__dirname, "../renderer/pages/update/update.html")
  );

  updateWindow.on("closed", () => {
    updateWindow = null;
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 400,
    frame: false,          // ❌ sem borda
    transparent: true,     // fundo transparente
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    center: true,
    skipTaskbar: true,     // não aparece na barra
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  splashWindow.loadFile(
    path.join(__dirname, "../renderer/pages/splash/splash.html")
  );
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    frame: false,               // 🔥 remove barra do Windows
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc", // evita flicker
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  loginWindow.loadFile(
    path.join(__dirname, "../renderer/pages/login/login.html")
  ); }


function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, "../renderer/pages/index/index.html"));

  // 🔁 Ctrl + R → reload da janela principal
  globalShortcut.register("CommandOrControl+R", () => {
    if (mainWindow) {
      mainWindow.reload();
    }
  });

  // 🔧 Ctrl + Shift + I → DevTools
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });
}


function openDWGRenamer() {
  const win = new BrowserWindow({
    width: 560,
    height: 630,
    resizable: false,
    parent: mainWindow,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  win.setMenu(null);
  win.loadFile(path.join(__dirname, "../apps/dwg-renamer/index.html"));
}

function openProjectManager() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    resizable: true,
    parent: mainWindow,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  win.setMenu(null);
  win.loadFile(path.join(__dirname, "../apps/project-manager/index.html"));
}

function readProjectData() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify({ obras: [], locais: [], alimentadores: [] }, null, 2)
    );
  }

  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}

function writeProjectData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}



function zipDestino(destino) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(destino, "MUDAR_NOME.zip");

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", err => reject(err));

    archive.pipe(output);

    // adiciona TODOS os arquivos da pasta destino
    // archive.directory(destino, false);

    archive.glob("**/*", {
      cwd: destino,
      ignore: ["MUDAR_NOME.zip"]
    });


    archive.finalize();
  });
}


/* ===== IPC ===== */

ipcMain.on("close-login-window", () => {
  if (loginWindow) {
    loginWindow.close();
  }
});


ipcMain.handle("login-success", (_, username) => {
  loggedUser = username;

  if (loginWindow) {
    loginWindow.close();
    loginWindow = null;
  }

  createMainWindow();
});

ipcMain.handle("get-logged-user", () => {
  return loggedUser;
});


ipcMain.handle("open-dwg-renamer", () => {
  openDWGRenamer();
});

ipcMain.handle("open-project-manager", () => {
  openProjectManager();
});

ipcMain.handle("load-project-data", () => {
  return readProjectData();
});

ipcMain.handle("save-project-data", (_, data) => {
  writeProjectData(data);
  return true;
});


ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle(
  "processar",
  async (_, origem, destino, multiplicador, deleteOrigem) => {

    const mult = Number(multiplicador);

    if (!Number.isFinite(mult) || mult <= 0) {
      throw new Error("Multiplicador inválido");
    }

    if (path.resolve(origem) === path.resolve(destino)) {
      throw new Error("Origem e destino não podem ser a mesma pasta");
    }

    const arquivos = fs.readdirSync(origem);
    let processados = 0;

    arquivos.forEach(arquivo => {
      const origemArquivo = path.join(origem, arquivo);
      const { name, ext } = path.parse(arquivo);

      // PDF
      if (ext.toLowerCase() === ".pdf") {
        fs.copyFileSync(
          origemArquivo,
          path.join(destino, arquivo)
        );
        processados++;
        return;
      }

      // DWG
      if (ext.toLowerCase() === ".dwg") {
        const match = name.match(/_(\d+)PC$/i);
        if (!match) return;

        const qtd = Number(match[1]);
        const novaQtd = qtd * mult;

        const base = name.replace(/_(\d+)PC$/i, "");
        const novoNome = `${base}_${novaQtd}PC${ext}`;

        fs.copyFileSync(
          origemArquivo,
          path.join(destino, novoNome)
        );

        processados++;
      }
    });

    // 🧹 Apaga origem SOMENTE se marcado
    if (deleteOrigem && processados > 0) {
      const arquivosOrigem = fs.readdirSync(origem);

      arquivosOrigem.forEach(arquivo => {
        const caminho = path.join(origem, arquivo);

        // garante que é arquivo, não pasta
        if (fs.lstatSync(caminho).isFile()) {
          fs.unlinkSync(caminho);
        }
      });
    }


    // 📦 cria o zip automaticamente
    await zipDestino(destino);


    // 📂 abre a pasta de destino no Explorer
    shell.openPath(destino);


    return processados;
  }
);



/* ===== APP ===== */

app.whenReady().then(() => {
  createSplashWindow();

  initAutoUpdater();

  setTimeout(() => {
    splashDelayDone = true;
    tryOpenLoginAfterStartup();
  }, 2800);
});

autoUpdater.on("update-available", info => {
  log.info("Atualização disponível:", info.version);
  updateIsAvailable = true;
  updateCheckResolved = true;

  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }

  if (!updateWindow) {
    createUpdateWindow();
  }

  updateWindow.webContents.once("did-finish-load", () => {
    updateWindow.webContents.send("update-available", info.version);
  });
});

autoUpdater.on("download-progress", progress => {
  if (updateWindow) {
    updateWindow.webContents.send("update-progress", {
      percent: Math.round(progress.percent),
      speed: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  }
});


autoUpdater.on("update-downloaded", () => {
  if (updateWindow) {
    updateWindow.webContents.send("update-done");
  }

  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true);
  }, 1500);
});

autoUpdater.on("update-not-available", () => {
  updateIsAvailable = false;
  updateCheckResolved = true;
  tryOpenLoginAfterStartup();
});

autoUpdater.on("error", () => {
  if (!updateCheckResolved) {
    updateIsAvailable = false;
    updateCheckResolved = true;
    tryOpenLoginAfterStartup();
  }
});


autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";



app.on("window-all-closed", () => {
  app.quit();
});


function initAutoUpdater() {
  log.info("Inicializando autoUpdater");
  log.info(`App empacotado: ${app.isPackaged}`);
  log.info(`GH_TOKEN configurado: ${Boolean(ghToken && ghToken !== "undefined" && ghToken !== "null")}`);

  autoUpdater.on("checking-for-update", () => {
    log.info("Verificando atualização...");
  });

  autoUpdater.on("update-available", info => {
    log.info("Atualização disponível:", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    log.info("Nenhuma atualização disponível");
  });

  autoUpdater.on("error", err => {
    log.error("Erro no autoUpdater:", err);
  });

  autoUpdater.on("download-progress", progress => {
    log.info(`Download ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", () => {
    log.info("Atualização baixada, reiniciando...");
  });

  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    log.error("Falha ao verificar atualizações:", err);
  });
}

