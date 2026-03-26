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
const MODULE_VERSIONS_PATH = path.join(__dirname, "..", "..", "data", "module-versions.json");
const MODULE_UPDATE_CACHE_TTL_MS = 5 * 60 * 1000;

app.setPath("userData", path.join(app.getPath("documents"), "LatoApps"));
app.setAppUserModelId("com.latoapps.desktop");
const LAUNCHER_STATE_PATH = path.join(app.getPath("userData"), "launcher-state.json");

const { autoUpdater } = require("electron-updater");

const ghToken = process.env.GH_TOKEN;
const GITHUB_OWNER = "peterpl04";
const GITHUB_REPO = "lato-app";
let moduleUpdateCache = null;
let moduleUpdateCacheAt = 0;

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
let dwgRenamerWindow;
let projectManagerWindow;
let loggedUser = null;
let splashDelayDone = false;
let updateCheckResolved = false;
let updateIsAvailable = false;
const SPLASH_HANDOFF_MS = 340;

function normalizeUserName(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "Operador";
  }

  if (value && typeof value === "object") {
    const candidates = [
      value.username,
      value.user,
      value.name,
      value.displayName,
      value.email
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return "Operador";
}

function getAppEnvironmentKey() {
  const raw = String(process.env.APP_ENV || "").trim().toLowerCase();
  if (["dev", "development", "local"].includes(raw)) {
    return "dev";
  }

  if (["prod", "production"].includes(raw)) {
    return "prod";
  }

  return app.isPackaged ? "prod" : "dev";
}

function parseVersion(version) {
  const clean = String(version || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];
  const parts = clean.split(".").map(part => Number.parseInt(part, 10) || 0);

  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);

  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }

  return 0;
}

function readModuleVersionConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MODULE_VERSIONS_PATH, "utf-8"));

    return {
      dwg: {
        currentVersion: parsed?.dwg?.currentVersion || "1.0.0",
        releaseTagPrefix: parsed?.dwg?.releaseTagPrefix || "dwg-renamer-v"
      },
      pm: {
        currentVersion: parsed?.pm?.currentVersion || "1.0.0",
        releaseTagPrefix: parsed?.pm?.releaseTagPrefix || "project-manager-v"
      }
    };
  } catch {
    return {
      dwg: { currentVersion: "1.0.0", releaseTagPrefix: "dwg-renamer-v" },
      pm: { currentVersion: "1.0.0", releaseTagPrefix: "project-manager-v" }
    };
  }
}

function buildGithubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "LatoApps"
  };

  if (ghToken && ghToken !== "undefined" && ghToken !== "null") {
    headers.Authorization = `token ${ghToken}`;
  }

  return headers;
}

async function fetchGithubReleases() {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=100`,
    { headers: buildGithubHeaders() }
  );

  if (!response.ok) {
    throw new Error(`GitHub releases request failed: ${response.status}`);
  }

  const releases = await response.json();
  return Array.isArray(releases) ? releases : [];
}

function getLatestReleaseTag(releases) {
  const latest = releases.find(release => !release?.draft && !release?.prerelease);
  return latest?.tag_name || null;
}

async function fetchModuleVersionConfigFromReleaseTag(tagName) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/module-versions.json?ref=${encodeURIComponent(tagName)}`,
    { headers: buildGithubHeaders() }
  );

  if (!response.ok) {
    return null;
  }

  const contentResponse = await response.json();
  const encoded = contentResponse?.content;
  if (!encoded) {
    return null;
  }

  const decoded = Buffer.from(String(encoded).replace(/\n/g, ""), "base64").toString("utf-8");
  const parsed = JSON.parse(decoded);

  return {
    dwg: {
      currentVersion: parsed?.dwg?.currentVersion || "1.0.0",
      releaseTagPrefix: parsed?.dwg?.releaseTagPrefix || "dwg-renamer-v"
    },
    pm: {
      currentVersion: parsed?.pm?.currentVersion || "1.0.0",
      releaseTagPrefix: parsed?.pm?.releaseTagPrefix || "project-manager-v"
    }
  };
}

function findLatestReleaseVersionForPrefix(releases, prefix) {
  let latest = null;

  releases.forEach(release => {
    const tag = String(release?.tag_name || "").trim();
    if (!tag.toLowerCase().startsWith(String(prefix).toLowerCase())) {
      return;
    }

    const version = tag.slice(prefix.length).replace(/^v/i, "").trim();
    if (!version) {
      return;
    }

    if (!latest || compareVersions(version, latest) > 0) {
      latest = version;
    }
  });

  return latest;
}

async function getModuleUpdateStatus() {
  const now = Date.now();
  if (moduleUpdateCache && (now - moduleUpdateCacheAt) < MODULE_UPDATE_CACHE_TTL_MS) {
    return moduleUpdateCache;
  }

  const localConfig = readModuleVersionConfig();

  try {
    const releases = await fetchGithubReleases();
    const latestReleaseTag = getLatestReleaseTag(releases);
    const remoteConfig = latestReleaseTag
      ? await fetchModuleVersionConfigFromReleaseTag(latestReleaseTag)
      : null;

    const dwgLatestFromReleaseFile = remoteConfig?.dwg?.currentVersion;
    const pmLatestFromReleaseFile = remoteConfig?.pm?.currentVersion;

    const dwgLatestFromTag = findLatestReleaseVersionForPrefix(
      releases,
      localConfig.dwg.releaseTagPrefix
    );
    const pmLatestFromTag = findLatestReleaseVersionForPrefix(
      releases,
      localConfig.pm.releaseTagPrefix
    );

    const dwgLatest = dwgLatestFromReleaseFile || dwgLatestFromTag || localConfig.dwg.currentVersion;
    const pmLatest = pmLatestFromReleaseFile || pmLatestFromTag || localConfig.pm.currentVersion;

    moduleUpdateCache = {
      checkedAt: new Date().toISOString(),
      dwg: {
        currentVersion: localConfig.dwg.currentVersion,
        latestVersion: dwgLatest,
        isUpdatable: compareVersions(dwgLatest, localConfig.dwg.currentVersion) > 0
      },
      pm: {
        currentVersion: localConfig.pm.currentVersion,
        latestVersion: pmLatest,
        isUpdatable: compareVersions(pmLatest, localConfig.pm.currentVersion) > 0
      }
    };
    moduleUpdateCacheAt = now;
    return moduleUpdateCache;
  } catch {
    moduleUpdateCache = {
      checkedAt: new Date().toISOString(),
      dwg: {
        currentVersion: localConfig.dwg.currentVersion,
        latestVersion: localConfig.dwg.currentVersion,
        isUpdatable: false
      },
      pm: {
        currentVersion: localConfig.pm.currentVersion,
        latestVersion: localConfig.pm.currentVersion,
        isUpdatable: false
      }
    };
    moduleUpdateCacheAt = now;
    return moduleUpdateCache;
  }
}

function tryOpenLoginAfterStartup() {
  if (!splashDelayDone || !updateCheckResolved || updateIsAvailable || loginWindow) {
    return;
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("splash-start-exit");

    setTimeout(() => {
      createLoginWindow();

      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
          splashWindow = null;
        }
      }, 120);
    }, SPLASH_HANDOFF_MS);

    return;
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
      preload: path.join(__dirname, "../preload/preload.js"),
      backgroundThrottling: false
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
    show: false,
    frame: false,               // 🔥 remove barra do Windows
    autoHideMenuBar: true,
    backgroundColor: "#081022",
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  loginWindow.once("ready-to-show", () => {
    loginWindow.setOpacity(0);
    loginWindow.show();

    let opacity = 0;
    const step = 0.12;
    const timer = setInterval(() => {
      opacity = Math.min(1, opacity + step);

      if (!loginWindow || loginWindow.isDestroyed()) {
        clearInterval(timer);
        return;
      }

      loginWindow.setOpacity(opacity);

      if (opacity >= 1) {
        clearInterval(timer);
      }
    }, 16);
  });

  loginWindow.on("closed", () => {
    loginWindow = null;
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

  mainWindow.on("close", async event => {
    if (!hasOpenAppWindows()) {
      return;
    }

    event.preventDefault();

    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Feche os apps primeiro",
      message: "O launcher nao pode ser fechado enquanto houver app aberto.",
      detail: "Feche o DWG Renamer e o Project Manager antes de sair do launcher.",
      buttons: ["OK"]
    });

    focusFirstOpenAppWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

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

function hasOpenAppWindows() {
  return Boolean(
    (dwgRenamerWindow && !dwgRenamerWindow.isDestroyed()) ||
      (projectManagerWindow && !projectManagerWindow.isDestroyed())
  );
}

function focusFirstOpenAppWindow() {
  if (dwgRenamerWindow && !dwgRenamerWindow.isDestroyed()) {
    dwgRenamerWindow.focus();
    return;
  }

  if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
    projectManagerWindow.focus();
  }
}


function openDWGRenamer() {
  if (dwgRenamerWindow && !dwgRenamerWindow.isDestroyed()) {
    dwgRenamerWindow.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 560,
    height: 630,
    resizable: false,
    title: "DWG Renamer",
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  if (process.platform === "win32") {
    win.setAppDetails({
      appId: "com.latoapps.dwg-renamer",
      appIconPath: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
      relaunchCommand: process.execPath,
      relaunchDisplayName: "DWG Renamer"
    });
  }

  dwgRenamerWindow = win;
  recordLauncherEvent("dwg");
  win.on("closed", () => {
    dwgRenamerWindow = null;
  });

  win.setMenu(null);
  win.loadFile(path.join(__dirname, "../apps/dwg-renamer/index.html"));
}

function openProjectManager() {
  if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
    projectManagerWindow.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    resizable: true,
    show: false,
    title: "Project Manager",
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  if (process.platform === "win32") {
    win.setAppDetails({
      appId: "com.latoapps.project-manager",
      appIconPath: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
      relaunchCommand: process.execPath,
      relaunchDisplayName: "Project Manager"
    });
  }

  projectManagerWindow = win;
  recordLauncherEvent("pm");
  win.maximize();
  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("closed", () => {
    projectManagerWindow = null;
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

function defaultLauncherState() {
  return {
    lastSyncAt: null,
    moduleMetrics: {
      dwgLaunches: 0,
      pmLaunches: 0
    },
    moduleLastUsedAt: {
      dwg: null,
      pm: null
    },
    recents: [],
    activity: []
  };
}

function ensureLauncherStateFile() {
  if (!fs.existsSync(LAUNCHER_STATE_PATH)) {
    fs.mkdirSync(path.dirname(LAUNCHER_STATE_PATH), { recursive: true });
    fs.writeFileSync(
      LAUNCHER_STATE_PATH,
      JSON.stringify(defaultLauncherState(), null, 2)
    );
  }
}

function readLauncherState() {
  ensureLauncherStateFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(LAUNCHER_STATE_PATH, "utf-8"));

    return {
      ...defaultLauncherState(),
      ...parsed,
      moduleMetrics: {
        ...defaultLauncherState().moduleMetrics,
        ...(parsed.moduleMetrics || {})
      },
      moduleLastUsedAt: {
        ...defaultLauncherState().moduleLastUsedAt,
        ...(parsed.moduleLastUsedAt || {})
      },
      recents: Array.isArray(parsed.recents) ? parsed.recents : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : []
    };
  } catch {
    return defaultLauncherState();
  }
}

function writeLauncherState(state) {
  fs.writeFileSync(LAUNCHER_STATE_PATH, JSON.stringify(state, null, 2));
}

function pushActivity(activity, message, tone = "info") {
  activity.unshift({
    message,
    tone,
    at: new Date().toISOString()
  });

  return activity.slice(0, 12);
}

function pushRecent(recents, item) {
  const next = [item, ...recents.filter(entry => entry.label !== item.label)];
  return next.slice(0, 12);
}

function recordLauncherEvent(type) {
  const now = new Date().toISOString();
  const state = readLauncherState();
  const userName = normalizeUserName(loggedUser);

  if (type === "dwg") {
    state.moduleMetrics.dwgLaunches += 1;
    state.moduleLastUsedAt.dwg = now;
    state.recents = pushRecent(state.recents, {
      label: "DWG Renamer aberto",
      action: "open-dwg",
      keywords: "dwg renamer abertura",
      at: now
    });
    state.activity = pushActivity(
      state.activity,
      `DWG Renamer aberto por ${userName}`,
      "ok"
    );
  }

  if (type === "pm") {
    state.moduleMetrics.pmLaunches += 1;
    state.moduleLastUsedAt.pm = now;
    state.recents = pushRecent(state.recents, {
      label: "Project Manager aberto",
      action: "open-pm",
      keywords: "project manager abertura",
      at: now
    });
    state.activity = pushActivity(
      state.activity,
      `Project Manager aberto por ${userName}`,
      "ok"
    );
  }

  writeLauncherState(state);
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
  loggedUser = normalizeUserName(username);

  if (loginWindow) {
    loginWindow.close();
    loginWindow = null;
  }

  createMainWindow();
});

ipcMain.handle("get-logged-user", () => {
  return normalizeUserName(loggedUser);
});

ipcMain.handle("get-app-environment", () => {
  return getAppEnvironmentKey();
});


ipcMain.handle("open-dwg-renamer", () => {
  openDWGRenamer();
});

ipcMain.handle("open-project-manager", () => {
  openProjectManager();
});

ipcMain.handle("get-launcher-state", () => {
  const state = readLauncherState();

  return {
    context: {
      user: normalizeUserName(loggedUser),
      environment: app.isPackaged ? "Produção" : "Desenvolvimento",
      version: `v${app.getVersion()}`,
      lastSyncAt: state.lastSyncAt
    },
    moduleMetrics: state.moduleMetrics,
    moduleLastUsedAt: state.moduleLastUsedAt,
    recents: state.recents,
    activity: state.activity
  };
});

ipcMain.handle("save-launcher-state", (_, patch) => {
  const state = readLauncherState();

  const nextState = {
    ...state,
    ...patch,
    moduleMetrics: {
      ...state.moduleMetrics,
      ...(patch && patch.moduleMetrics ? patch.moduleMetrics : {})
    },
    moduleLastUsedAt: {
      ...state.moduleLastUsedAt,
      ...(patch && patch.moduleLastUsedAt ? patch.moduleLastUsedAt : {})
    },
    recents: Array.isArray(patch?.recents) ? patch.recents.slice(0, 12) : state.recents,
    activity: Array.isArray(patch?.activity) ? patch.activity.slice(0, 12) : state.activity,
    lastSyncAt: patch?.lastSyncAt || state.lastSyncAt
  };

  writeLauncherState(nextState);
  return true;
});

ipcMain.handle("get-module-update-status", async () => {
  return getModuleUpdateStatus();
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
        const match = name.match(/(\d+)\s*PC$/i);
        if (!match) return;

        const qtd = Number(match[1]);
        const novaQtd = qtd * mult;

        const novoNomeSemExt = name.replace(/(\d+)\s*PC$/i, `${novaQtd}PC`);
        const novoNome = `${novoNomeSemExt}${ext}`;

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

  if (!app.isPackaged) {
    log.info("Modo desenvolvimento: liberando login sem bloquear por autoUpdater.");
    updateIsAvailable = false;
    updateCheckResolved = true;
    tryOpenLoginAfterStartup();
    return;
  }

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

