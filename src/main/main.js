if (process.env.NODE_ENV === "development") {
  require("dotenv").config();

  require("electron-reload")(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`)
  });
}

const { app, BrowserWindow, dialog, ipcMain, shell, globalShortcut, safeStorage } = require("electron");
const archiver = require("archiver");
const path = require("path");
const fs = require("fs");
const DATA_PATH = path.join(__dirname, "data", "project-manager.json");
const ESTOQUE_DATA_PATH = path.join(__dirname, "data", "estoque.json");
const GLOBAL_UPDATE_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes instead of 1
const MANUAL_APP_UPDATE_TRIGGER = false;
const DEFAULT_ACTIVITY_API_URL = "https://lato-app-production.up.railway.app";

app.setPath("userData", path.join(app.getPath("documents"), "LatoApps"));
app.setAppUserModelId("com.latoapps.desktop");
const LAUNCHER_STATE_PATH = path.join(app.getPath("userData"), "launcher-state.json");
const SESSION_PATH = path.join(app.getPath("userData"), "session.dat");
const SESSION_PATH_PLAIN = path.join(app.getPath("userData"), "session.json");

const { autoUpdater } = require("electron-updater");

let ghToken = process.env.GH_TOKEN;
const GITHUB_OWNER = "peterpl04";
const GITHUB_REPO = "lato-app";
let globalUpdateStatusCache = null;
let globalUpdateStatusCacheAt = 0;
let ghTokenDisabled = false;

function hasUsableGhToken() {
  return (
    !ghTokenDisabled &&
    ghToken &&
    ghToken !== "undefined" &&
    ghToken !== "null"
  );
}

function disableGhToken(reason) {
  if (ghTokenDisabled) return;
  ghTokenDisabled = true;
  log.info(`GH_TOKEN desabilitado em runtime (${reason}). Usando acesso anônimo ao GitHub.`);
  if (autoUpdater.requestHeaders && autoUpdater.requestHeaders.Authorization) {
    delete autoUpdater.requestHeaders.Authorization;
  }
}

if (hasUsableGhToken()) {
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
let fiscalWindow;
let estoqueWindow;
let loggedUser = null;
let splashDelayDone = false;
let updateCheckResolved = false;
let updateIsAvailable = false;
let isUpdateCheckInProgress = false;
const SPLASH_HANDOFF_MS = 340;
const ACTIVITY_PREVIEW_LIMIT = 32;
const ACTIVITY_LOG_LIMIT = 2000;
const ACTIVITY_RETENTION_DAYS = 30;
const ACTIVITY_API_URL = String(
  process.env.ACTIVITY_API_URL ||
  process.env.PROJECT_MANAGER_API_URL ||
  DEFAULT_ACTIVITY_API_URL
)
  .trim()
  .replace(/\/+$/, "");

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

function ensureUserDataDir() {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
  } catch (err) {
    log.warn("Não foi possível criar pasta userData:", err?.message || err);
  }
}

function saveSession(user) {
  try {
    ensureUserDataDir();
    const payload = JSON.stringify({ user, savedAt: new Date().toISOString() });

    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(payload);
      fs.writeFileSync(SESSION_PATH, encrypted);
      try { fs.unlinkSync(SESSION_PATH_PLAIN); } catch (_) {}
    } else {
      fs.writeFileSync(SESSION_PATH_PLAIN, payload, "utf-8");
      try { fs.unlinkSync(SESSION_PATH); } catch (_) {}
    }
  } catch (err) {
    log.warn("Falha ao salvar sessão:", err?.message || err);
  }
}

function loadSession() {
  try {
    if (fs.existsSync(SESSION_PATH) && safeStorage && safeStorage.isEncryptionAvailable()) {
      const buf = fs.readFileSync(SESSION_PATH);
      const plain = safeStorage.decryptString(buf);
      const data = JSON.parse(plain);
      return data && data.user ? data.user : null;
    }

    if (fs.existsSync(SESSION_PATH_PLAIN)) {
      const plain = fs.readFileSync(SESSION_PATH_PLAIN, "utf-8");
      const data = JSON.parse(plain);
      return data && data.user ? data.user : null;
    }
  } catch (err) {
    log.warn("Falha ao ler sessão salva:", err?.message || err);
  }

  return null;
}

function clearSession() {
  try { fs.unlinkSync(SESSION_PATH); } catch (_) {}
  try { fs.unlinkSync(SESSION_PATH_PLAIN); } catch (_) {}
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

function getEnvironmentLabel(key) {
  return key === "prod" ? "Produção" : "Desenvolvimento";
}

function normalizeEnvironment(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["dev", "development", "local"].includes(raw)) {
    return "dev";
  }

  return "prod";
}

function toDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value) {
  if (typeof value !== "string") {
    return toDateKey();
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return toDateKey();
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

function buildGithubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "LatoApps",
    "Cache-Control": "no-cache",
    Pragma: "no-cache"
  };

  if (hasUsableGhToken()) {
    headers.Authorization = `token ${ghToken}`;
  }

  return headers;
}

async function fetchGithubJson(url) {
  const withAuthHeaders = buildGithubHeaders();
  let response = await fetch(url, { headers: withAuthHeaders });

  // Public repositories can be queried without token. If token is invalid/expired/rate-limited,
  // retry without Authorization to avoid hard-failing status checks.
  if ((response.status === 401 || response.status === 403) && withAuthHeaders.Authorization) {
    disableGhToken(`GitHub respondeu ${response.status}`);

    const anonymousHeaders = {
      Accept: "application/vnd.github+json",
      "User-Agent": "LatoApps",
      "Cache-Control": "no-cache",
      Pragma: "no-cache"
    };

    response = await fetch(url, { headers: anonymousHeaders });
  }

  if (!response.ok) {
    throw new Error(`GitHub releases request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchGithubReleases() {
  const releases = await fetchGithubJson(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=100&t=${Date.now()}`
  );
  return Array.isArray(releases) ? releases : [];
}

function extractSemver(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const match = text.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return `${Number.parseInt(match[1], 10)}.${Number.parseInt(match[2], 10)}.${Number.parseInt(match[3], 10)}`;
}

async function fetchLatestStableVersionFromGithub() {
  try {
    const release = await fetchGithubJson(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest?t=${Date.now()}`
    );
    if (!release || release.draft || release.prerelease) {
      return null;
    }

    return extractSemver(release.tag_name) || extractSemver(release.name);
  } catch {
    return null;
  }
}

function pickLatestStableVersionFromReleases(releases) {
  let latest = null;

  for (const release of releases) {
    if (!release || release.draft || release.prerelease) {
      continue;
    }

    const version = extractSemver(release.tag_name) || extractSemver(release.name);
    if (!version) {
      continue;
    }

    if (!latest || compareVersions(version, latest) > 0) {
      latest = version;
    }
  }

  return latest;
}

async function getGlobalAppUpdateStatus(options = {}) {
  const forceRefresh = Boolean(options?.force);
  const now = Date.now();

  if (
    !forceRefresh &&
    globalUpdateStatusCache &&
    now - globalUpdateStatusCacheAt < GLOBAL_UPDATE_STATUS_CACHE_TTL_MS
  ) {
    return globalUpdateStatusCache;
  }

  const currentVersion = app.getVersion();

  try {
    let latestVersion = await fetchLatestStableVersionFromGithub();

    if (!latestVersion) {
      const releases = await fetchGithubReleases();
      latestVersion = pickLatestStableVersionFromReleases(releases);
    }

    if (!latestVersion) {
      throw new Error("Nenhuma release estável encontrada");
    }

    globalUpdateStatusCache = {
      checkedAt: new Date().toISOString(),
      currentVersion,
      latestVersion,
      isOutdated: compareVersions(latestVersion, currentVersion) > 0
    };
    globalUpdateStatusCacheAt = now;

    return globalUpdateStatusCache;
  } catch (err) {
    log.warn("Falha ao verificar status global de atualização:", err?.message || err);

    // Always prefer returning cached status over error state
    if (globalUpdateStatusCache) {
      return globalUpdateStatusCache;
    }

    // Only return error if this is the first check with no cache available
    globalUpdateStatusCache = {
      checkedAt: new Date().toISOString(),
      currentVersion,
      latestVersion: currentVersion,
      isOutdated: Boolean(updateIsAvailable)
    };
    globalUpdateStatusCacheAt = now;

    return globalUpdateStatusCache;
  }
}

function tryOpenLoginAfterStartup() {
  if (!splashDelayDone || !updateCheckResolved || updateIsAvailable || loginWindow) {
    return;
  }

  const savedUser = loadSession();
  const skipLogin = Boolean(savedUser);

  if (skipLogin) {
    loggedUser = normalizeUserName(savedUser);
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("splash-start-exit");

    setTimeout(() => {
      if (skipLogin) {
        createMainWindow();
      } else {
        createLoginWindow();
      }

      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
          splashWindow = null;
        }
      }, 120);
    }, SPLASH_HANDOFF_MS);

    return;
  }

  if (skipLogin) {
    createMainWindow();
  } else {
    createLoginWindow();
  }
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
      title: "Feche as instâncias",
      message: "O launcher não pode ser fechado enquanto houver qualquer instância aberta.",
      detail: "Feche o DWG Renamer, o Project Manager e o Fiscal antes de sair do launcher.",
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
      (projectManagerWindow && !projectManagerWindow.isDestroyed()) ||
      (fiscalWindow && !fiscalWindow.isDestroyed())
  );
}

function focusFirstOpenAppWindow() {
  if (dwgRenamerWindow && !dwgRenamerWindow.isDestroyed()) {
    dwgRenamerWindow.focus();
    return;
  }

  if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
    projectManagerWindow.focus();
    return;
  }

  if (fiscalWindow && !fiscalWindow.isDestroyed()) {
    fiscalWindow.focus();
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

function openFiscal() {
  if (fiscalWindow && !fiscalWindow.isDestroyed()) {
    fiscalWindow.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 760,
    height: 620,
    resizable: false,
    title: "FISCAL",
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  if (process.platform === "win32") {
    win.setAppDetails({
      appId: "com.latoapps.fiscal",
      appIconPath: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
      relaunchCommand: process.execPath,
      relaunchDisplayName: "FISCAL"
    });
  }

  fiscalWindow = win;
  recordLauncherEvent("fiscal");

  win.on("closed", () => {
    fiscalWindow = null;
  });

  win.setMenu(null);
  win.loadFile(path.join(__dirname, "../apps/fiscal/index.html"));
}

function openEstoque() {
  if (estoqueWindow && !estoqueWindow.isDestroyed()) {
    estoqueWindow.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    resizable: true,
    show: false,
    title: "ESTOQUE",
    icon: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js")
    }
  });

  if (process.platform === "win32") {
    win.setAppDetails({
      appId: "com.latoapps.estoque",
      appIconPath: path.join(__dirname, "..", "assets", "icons", "lato-infinite.ico"),
      relaunchCommand: process.execPath,
      relaunchDisplayName: "ESTOQUE"
    });
  }

  estoqueWindow = win;
  recordLauncherEvent("estoque");
  win.maximize();
  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("closed", () => {
    estoqueWindow = null;
  });

  win.setMenu(null);
  win.loadFile(path.join(__dirname, "../apps/estoque/index.html"));
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

function readEstoqueData() {
  if (!fs.existsSync(ESTOQUE_DATA_PATH)) {
    fs.mkdirSync(path.dirname(ESTOQUE_DATA_PATH), { recursive: true });
    fs.writeFileSync(
      ESTOQUE_DATA_PATH,
      JSON.stringify({ items: { pneumatica: [], fixadores: [], eletrica: [] } }, null, 2)
    );
  }

  return JSON.parse(fs.readFileSync(ESTOQUE_DATA_PATH, "utf-8"));
}

function writeEstoqueData(data) {
  fs.writeFileSync(ESTOQUE_DATA_PATH, JSON.stringify(data, null, 2));
}

function defaultLauncherState() {
  return {
    lastSyncAt: null,
    moduleMetrics: {
      dwgLaunches: 0,
      pmLaunches: 0,
      fiscalLaunches: 0,
      estoqueLaunches: 0
    },
    moduleLastUsedAt: {
      dwg: null,
      pm: null,
      fiscal: null,
      estoque: null
    },
    recents: [],
    activity: [],
    activityLog: [],
    dismissedActivityKeys: []
  };
}

function normalizeDismissedKeys(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = [];
  value.forEach((item) => {
    if (typeof item !== "string") return;
    const trimmed = item.trim();
    if (!trimmed) return;
    if (!unique.includes(trimmed)) {
      unique.push(trimmed);
    }
  });

  return unique.slice(0, ACTIVITY_LOG_LIMIT);
}

function getActivityEntryKey(entry) {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  if (entry.id) {
    return `id:${entry.id}`;
  }

  return `fallback:${entry.message || ""}|${entry.at || ""}`;
}

function collectActivityKeys(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map(getActivityEntryKey)
    .filter(Boolean);
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
      activity: pruneActivitiesByRetention(Array.isArray(parsed.activity) ? parsed.activity : []),
      activityLog: Array.isArray(parsed.activityLog)
        ? pruneActivitiesByRetention(parsed.activityLog)
        : pruneActivitiesByRetention(Array.isArray(parsed.activity) ? parsed.activity : []),
      dismissedActivityKeys: normalizeDismissedKeys(parsed.dismissedActivityKeys)
    };
  } catch {
    return defaultLauncherState();
  }
}

function writeLauncherState(state) {
  fs.writeFileSync(LAUNCHER_STATE_PATH, JSON.stringify(state, null, 2));
}

function normalizeActivityEntry(rawEntry) {
  const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
  const at = entry.at || new Date().toISOString();
  const environment = getAppEnvironmentKey();

  return {
    id: entry.id || `${Date.now()}-${Math.round(Math.random() * 100000)}`,
    message: String(entry.message || "Evento registrado"),
    tone: entry.tone || "info",
    at,
    day: normalizeDateKey(entry.day || toDateKey(at)),
    user: normalizeUserName(entry.user || loggedUser),
    module: String(entry.module || "launcher"),
    eventType: String(entry.eventType || "generic"),
    details: entry.details && typeof entry.details === "object" ? entry.details : {},
    environment: normalizeEnvironment(entry.environment || entry.env || environment)
  };
}

function filterActivitiesByEnvironment(list, env) {
  if (!Array.isArray(list)) {
    return [];
  }

  const normalizedEnv = normalizeEnvironment(env);
  return list
    .map(normalizeActivityEntry)
    .filter((entry) => normalizeEnvironment(entry.environment) === normalizedEnv);
}

function isActivityWithinRetention(entry) {
  if (!entry?.at) {
    return false;
  }

  const atMs = new Date(entry.at).getTime();
  if (Number.isNaN(atMs)) {
    return false;
  }

  const retentionMs = ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - atMs <= retentionMs;
}

function pruneActivitiesByRetention(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list.filter(isActivityWithinRetention);
}

function registerActivity(state, payload = {}) {
  const entry = normalizeActivityEntry({
    ...payload,
    at: payload.at || new Date().toISOString(),
    user: payload.user || loggedUser
  });

  const currentPreview = Array.isArray(state.activity) ? state.activity : [];
  const currentLog = Array.isArray(state.activityLog) ? state.activityLog : currentPreview;

  state.activity = pruneActivitiesByRetention([entry, ...currentPreview]).slice(0, ACTIVITY_PREVIEW_LIMIT);
  state.activityLog = pruneActivitiesByRetention([entry, ...currentLog]).slice(0, ACTIVITY_LOG_LIMIT);

  return entry;
}

async function syncActivityToBackend(entry, environment) {
  if (!ACTIVITY_API_URL) {
    return { synced: false, reason: "missing-api-url" };
  }

  try {
    const response = await fetch(`${ACTIVITY_API_URL}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-env": environment
      },
      body: JSON.stringify({
        ...entry,
        env: environment
      })
    });

    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const remoteEntry = await response.json();
    return { synced: true, entry: remoteEntry };
  } catch (err) {
    log.warn("Falha ao sincronizar activity no backend:", err?.message || err);
    return { synced: false, reason: err?.message || "unknown" };
  }
}

function pushRecent(recents, item) {
  const next = [item, ...recents.filter(entry => entry.label !== item.label)];
  return next.slice(0, 12);
}

function recordLauncherEvent(type) {
  const now = new Date().toISOString();
  const state = readLauncherState();
  const userName = normalizeUserName(loggedUser);
  const env = getAppEnvironmentKey();
  let trackedEntry = null;

  if (type === "dwg") {
    state.moduleMetrics.dwgLaunches += 1;
    state.moduleLastUsedAt.dwg = now;
    state.recents = pushRecent(state.recents, {
      label: "DWG Renamer aberto",
      action: "open-dwg",
      keywords: "dwg renamer abertura",
      at: now
    });
    trackedEntry = registerActivity(state, {
      module: "dwg-renamer",
      eventType: "open-module",
      message: "DWG Renamer aberto",
      tone: "ok",
      user: userName,
      at: now
    });
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
    trackedEntry = registerActivity(state, {
      module: "project-manager",
      eventType: "open-module",
      message: "Project Manager aberto",
      tone: "ok",
      user: userName,
      at: now
    });
  }

  if (type === "fiscal") {
    state.moduleMetrics.fiscalLaunches += 1;
    state.moduleLastUsedAt.fiscal = now;
    state.recents = pushRecent(state.recents, {
      label: "FISCAL aberto",
      action: "open-fiscal",
      keywords: "fiscal nota fiscal busca arquivo",
      at: now
    });
    trackedEntry = registerActivity(state, {
      module: "fiscal",
      eventType: "open-module",
      message: "FISCAL aberto",
      tone: "ok",
      user: userName,
      at: now
    });
  }

  writeLauncherState(state);

  if (trackedEntry) {
    void syncActivityToBackend(trackedEntry, env);
  }
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


ipcMain.handle("login-success", (_, username, remember) => {
  loggedUser = normalizeUserName(username);

  if (remember) {
    saveSession(username);
  } else {
    clearSession();
  }

  if (loginWindow) {
    loginWindow.close();
    loginWindow = null;
  }

  createMainWindow();
});

ipcMain.handle("logout", () => {
  clearSession();
  loggedUser = null;

  const toClose = [
    mainWindow,
    dwgRenamerWindow,
    projectManagerWindow,
    fiscalWindow,
    estoqueWindow
  ];

  for (const win of toClose) {
    if (win && !win.isDestroyed()) {
      try { win.close(); } catch (_) {}
    }
  }

  mainWindow = null;
  dwgRenamerWindow = null;
  projectManagerWindow = null;
  fiscalWindow = null;
  estoqueWindow = null;

  if (!loginWindow) {
    createLoginWindow();
  }
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

ipcMain.handle("open-fiscal", () => {
  openFiscal();
});

ipcMain.handle("open-estoque", () => {
  openEstoque();
});

ipcMain.handle("fiscal-search-files", async (_, folderPath, invoiceNumber) => {
  const baseFolder = String(folderPath || "").trim();
  const query = String(invoiceNumber || "").trim();

  if (!baseFolder) {
    throw new Error("Pasta não informada.");
  }

  if (!query) {
    throw new Error("Número da nota fiscal não informado.");
  }

  let folderStats;
  try {
    folderStats = await fs.promises.stat(baseFolder);
  } catch {
    throw new Error("A pasta selecionada não existe.");
  }

  if (!folderStats.isDirectory()) {
    throw new Error("O caminho informado não é uma pasta.");
  }

  const normalizedQuery = query.replace(/\D/g, "");
  const matches = [];
  let scannedFiles = 0;
  const impressasFolder = path.join(baseFolder, "IMPRESSAS");

  async function ensureUniqueDestination(fileName) {
    const parsed = path.parse(fileName);
    let suffix = 0;

    while (true) {
      const candidateName = suffix === 0
        ? fileName
        : `${parsed.name} (${suffix})${parsed.ext}`;
      const candidatePath = path.join(impressasFolder, candidateName);

      try {
        await fs.promises.access(candidatePath);
        suffix += 1;
      } catch {
        return {
          name: candidateName,
          path: candidatePath
        };
      }
    }
  }

  async function walkDirectory(currentFolder) {
    const entries = await fs.promises.readdir(currentFolder, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentFolder, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === "impressas") {
          continue;
        }

        await walkDirectory(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      scannedFiles += 1;

      const baseName = path.parse(entry.name).name;
      const hasRawMatch = baseName.toLowerCase().includes(query.toLowerCase());
      const baseNameDigits = baseName.replace(/\D/g, "");
      const hasDigitMatch = normalizedQuery
        ? baseNameDigits.includes(normalizedQuery)
        : false;

      if (!hasRawMatch && !hasDigitMatch) {
        continue;
      }

      matches.push({
        name: entry.name,
        path: absolutePath,
        relativePath: path.relative(baseFolder, absolutePath)
      });
    }
  }

  await walkDirectory(baseFolder);

  let movedFiles = 0;
  if (matches.length > 0) {
    await fs.promises.mkdir(impressasFolder, { recursive: true });

    for (const match of matches) {
      const target = await ensureUniqueDestination(match.name);
      await fs.promises.rename(match.path, target.path);
      movedFiles += 1;

      match.movedTo = target.path;
      match.movedToRelativePath = path.relative(baseFolder, target.path);
    }
  }

  return {
    scannedFiles,
    totalMatches: matches.length,
    movedFiles,
    destinationFolder: impressasFolder,
    matches
  };
});

ipcMain.handle("get-launcher-state", () => {
  const state = readLauncherState();
  const env = getAppEnvironmentKey();
  const activity = filterActivitiesByEnvironment(state.activity, env).slice(0, ACTIVITY_PREVIEW_LIMIT);
  const activityLog = filterActivitiesByEnvironment(state.activityLog, env).slice(0, ACTIVITY_LOG_LIMIT);

  const validDismissedKeys = normalizeDismissedKeys(state.dismissedActivityKeys)
    .filter((key) => collectActivityKeys(activityLog).includes(key));

  if (validDismissedKeys.length !== state.dismissedActivityKeys.length) {
    state.dismissedActivityKeys = validDismissedKeys;
    writeLauncherState(state);
  }

  return {
    context: {
      user: normalizeUserName(loggedUser),
      environment: getEnvironmentLabel(env),
      version: `v${app.getVersion()}`,
      lastSyncAt: state.lastSyncAt
    },
    moduleMetrics: state.moduleMetrics,
    moduleLastUsedAt: state.moduleLastUsedAt,
    recents: state.recents,
    activity,
    dismissedActivityKeys: state.dismissedActivityKeys
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
    activity: Array.isArray(patch?.activity)
      ? pruneActivitiesByRetention(patch.activity.map(normalizeActivityEntry)).slice(0, ACTIVITY_PREVIEW_LIMIT)
      : state.activity,
    activityLog: Array.isArray(patch?.activityLog)
      ? pruneActivitiesByRetention(patch.activityLog.map(normalizeActivityEntry)).slice(0, ACTIVITY_LOG_LIMIT)
      : state.activityLog,
    dismissedActivityKeys: Array.isArray(patch?.dismissedActivityKeys)
      ? normalizeDismissedKeys(patch.dismissedActivityKeys)
      : normalizeDismissedKeys(state.dismissedActivityKeys),
    lastSyncAt: patch?.lastSyncAt || state.lastSyncAt
  };

  if (!Array.isArray(nextState.activityLog) || !nextState.activityLog.length) {
    nextState.activityLog = (nextState.activity || []).map(normalizeActivityEntry);
  }

  const allowedKeys = collectActivityKeys(nextState.activityLog);
  nextState.dismissedActivityKeys = normalizeDismissedKeys(nextState.dismissedActivityKeys)
    .filter((key) => allowedKeys.includes(key));

  writeLauncherState(nextState);
  return true;
});

ipcMain.handle("track-launcher-activity", async (_, payload) => {
  const state = readLauncherState();
  const entry = registerActivity(state, payload || {});
  writeLauncherState(state);
  const env = getAppEnvironmentKey();
  const syncResult = await syncActivityToBackend(entry, env);
  return {
    entry,
    environment: env,
    synced: Boolean(syncResult?.synced)
  };
});

ipcMain.handle("get-launcher-activity-day", (_, options) => {
  const state = readLauncherState();
  const day = normalizeDateKey(options?.day);
  const env = getAppEnvironmentKey();
  const source = Array.isArray(state.activityLog) && state.activityLog.length
    ? state.activityLog
    : state.activity;

  return filterActivitiesByEnvironment(source, env)
    .filter(entry => normalizeDateKey(entry.day || toDateKey(entry.at)) === day)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
});

ipcMain.handle("get-global-app-update-status", async (_, options) => {
  return getGlobalAppUpdateStatus(options);
});

ipcMain.handle("get-activity-realtime-config", () => {
  return {
    apiUrl: ACTIVITY_API_URL,
    env: getAppEnvironmentKey()
  };
});

ipcMain.handle("check-app-update", async () => {
  if (!app.isPackaged) {
    return { started: false, reason: "development" };
  }

  if (isUpdateCheckInProgress) {
    return { started: false, reason: "in-progress" };
  }

  isUpdateCheckInProgress = true;

  try {
    await autoUpdater.checkForUpdatesAndNotify();
    return { started: true };
  } catch (err) {
    log.error("Falha ao verificar atualizações manualmente:", err);
    return { started: false, reason: "error" };
  } finally {
    isUpdateCheckInProgress = false;
  }
});

ipcMain.handle("load-project-data", () => {
  return readProjectData();
});

ipcMain.handle("save-project-data", (_, data) => {
  writeProjectData(data);
  return true;
});

ipcMain.handle("load-estoque-data", () => {
  return readEstoqueData();
});

ipcMain.handle("save-estoque-data", (_, data) => {
  writeEstoqueData(data);
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
  globalUpdateStatusCache = {
    checkedAt: new Date().toISOString(),
    currentVersion: app.getVersion(),
    latestVersion: info?.version || app.getVersion(),
    isOutdated: true
  };
  globalUpdateStatusCacheAt = Date.now();

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
  globalUpdateStatusCache = {
    checkedAt: new Date().toISOString(),
    currentVersion: app.getVersion(),
    latestVersion: app.getVersion(),
    isOutdated: false
  };
  globalUpdateStatusCacheAt = Date.now();
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
  log.info(`GH_TOKEN configurado: ${hasUsableGhToken()}`);

  if (!app.isPackaged) {
    log.info("Modo desenvolvimento: liberando login sem bloquear por autoUpdater.");
    updateIsAvailable = false;
    updateCheckResolved = true;
    tryOpenLoginAfterStartup();
    return;
  }

  if (MANUAL_APP_UPDATE_TRIGGER) {
    log.info("Modo manual de atualização: verificação somente por comando do usuário.");
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

