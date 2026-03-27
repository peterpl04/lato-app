let launcherState = {
  context: {
    user: "Operador",
    environment: "Produção",
    version: "v1.0.0",
    lastSyncAt: null
  },
  moduleMetrics: {
    dwgLaunches: 0,
    pmLaunches: 0
  },
  moduleLastUsedAt: {
    dwg: null,
    pm: null
  },
  recents: [],
  activity: [],
  dismissedActivityKeys: []
};
const APP_STATUS_POLL_MS = 60 * 1000;
const ACTIVITY_PREVIEW_ITEMS = 5;
const ACTIVITY_STATE_LIMIT = 32;
const ACTIVITY_FEED_POLL_MS = 12000;
const DEFAULT_ACTIVITY_API_URL = "https://lato-app-production.up.railway.app";

let lastSuccessfulUpdateStatus = null;
let activityModalElements = null;
let activitySocket = null;
let activityApiUrl = DEFAULT_ACTIVITY_API_URL;
let activityEnv = "prod";
const dismissedActivityKeys = new Set();

function hydrateDismissedKeys(keys) {
  dismissedActivityKeys.clear();

  if (!Array.isArray(keys)) {
    return;
  }

  keys.forEach((key) => {
    if (typeof key === "string" && key.trim()) {
      dismissedActivityKeys.add(key.trim());
    }
  });
}

async function persistDismissedKeys() {
  const keys = Array.from(dismissedActivityKeys);
  launcherState.dismissedActivityKeys = keys;

  try {
    await persistLauncherPatch({ dismissedActivityKeys: keys });
  } catch {
    // Keep UI responsive even if persistence fails.
  }
}

function openDWG() {
  window.api.openDWGRenamer();
}

function openProjectManager() {
  window.api.openProjectManager();
}

function formatTime(iso) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatActivityTime(iso) {
  if (!iso) return "";

  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatActivityDate(iso) {
  if (!iso) return "--/--/----";

  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapModuleLabel(moduleName) {
  if (moduleName === "project-manager") return "Project Manager";
  if (moduleName === "dwg-renamer") return "DWG Renamer";
  return "Launcher";
}

function normalizeRealtimeEnvironment(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["dev", "development", "local"].includes(raw)) {
    return "dev";
  }

  return "prod";
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

function getVisibleActivityEntries() {
  return (launcherState.activity || []).filter((entry) => {
    const key = getActivityEntryKey(entry);
    return key && !dismissedActivityKeys.has(key);
  });
}

function mergeActivityEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return;
  }

  const next = [entry, ...(launcherState.activity || [])]
    .filter((item, index, list) => {
      if (!item?.id) {
        return index === list.findIndex((candidate) =>
          candidate?.message === item?.message && candidate?.at === item?.at
        );
      }

      return index === list.findIndex((candidate) => candidate?.id === item.id);
    })
    .slice(0, ACTIVITY_STATE_LIMIT);

  launcherState.activity = next;
  renderActivity();

  if (
    activityModalElements?.backdrop &&
    !activityModalElements.backdrop.classList.contains("is-hidden")
  ) {
    getDailyActivityEntries().then(renderActivityDayList);
  }
}

function mergeActivityEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return;
  }

  let changed = false;
  entries.forEach((entry) => {
    const beforeSize = (launcherState.activity || []).length;
    mergeActivityEntry(entry);
    const afterSize = (launcherState.activity || []).length;

    if (afterSize !== beforeSize || (launcherState.activity && launcherState.activity[0]?.id === entry?.id)) {
      changed = true;
    }
  });

  if (changed) {
    renderActivity();
  }
}

async function initActivityRealtime() {
  if (typeof io !== "function") {
    return;
  }

  try {
    const config = await window.api.getActivityRealtimeConfig();
    const configuredUrl = String(config?.apiUrl || "").trim().replace(/\/+$/, "");

    if (configuredUrl) {
      activityApiUrl = configuredUrl;
    }

    activityEnv = normalizeRealtimeEnvironment(config?.env);
  } catch {
    activityApiUrl = DEFAULT_ACTIVITY_API_URL;
    activityEnv = "prod";
  }

  activitySocket = io(activityApiUrl, {
    query: { env: activityEnv }
  });

  activitySocket.on("activity:new", (entry) => {
    mergeActivityEntry(entry);
  });
}

function formatEntryDetails(details) {
  if (!details || typeof details !== "object") {
    return "";
  }

  if (Array.isArray(details.changes) && details.changes.length) {
    return details.changes.join(" | ");
  }

  if (
    Number.isFinite(details.fromPercent) &&
    Number.isFinite(details.toPercent)
  ) {
    return `Progresso: ${details.fromPercent}% -> ${details.toPercent}%`;
  }

  const bits = [];
  if (details.obra) bits.push(`Obra: ${details.obra}`);
  if (details.cliente) bits.push(`Cliente: ${details.cliente}`);
  return bits.join(" | ");
}

function formatAgo(iso) {
  if (!iso) return "nunca";

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;

  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function normalizeUserLabel(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
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

function renderContext() {
  const { context } = launcherState;
  const user = document.getElementById("ctx-user");
  const env = document.getElementById("ctx-env");
  const sync = document.getElementById("ctx-sync");
  const version = document.getElementById("ctx-version");

  if (user) user.textContent = `Usuário: ${normalizeUserLabel(context.user)}`;
  if (env) env.textContent = `Ambiente: ${context.environment || "Produção"}`;
  if (sync) sync.textContent = `Sync: ${formatTime(context.lastSyncAt)}`;
  if (version) version.textContent = ` ${context.version || "v1.0.0"}`;
}

function renderMetrics() {
  const dwgMeta = document.getElementById("dwg-meta");
  const pmMeta = document.getElementById("pm-meta");
  const dwgLast = document.getElementById("dwg-last-use");
  const pmLast = document.getElementById("pm-last-use");

  if (dwgMeta) dwgMeta.textContent = `${launcherState.moduleMetrics.dwgLaunches || 0} execs hoje`;
  if (pmMeta) pmMeta.textContent = `${launcherState.moduleMetrics.pmLaunches || 0} execs hoje`;
  if (dwgLast) dwgLast.textContent = `Último uso: ${formatAgo(launcherState.moduleLastUsedAt.dwg)}`;
  if (pmLast) pmLast.textContent = `Último uso: ${formatAgo(launcherState.moduleLastUsedAt.pm)}`;
}

function renderGlobalUpdateBadge(status) {
  const badge = document.getElementById("ctx-update-status");
  if (!badge) return;

  badge.classList.remove("ok", "update", "updated", "info");
  badge.title = "";

  if (!status) {
    badge.classList.add("info");
    badge.textContent = "Verificando...";
    badge.title = "Consultando versão remota...";
    return;
  }

  if (status.error || status.isOutdated == null) {
    badge.classList.add("ok");
    badge.textContent = "Atualizado";
    const errorDetail = status.errorMsg ? ` (${status.errorMsg})` : "";
    badge.title = `Sem confirmação remota no momento. Mantendo último estado conhecido${errorDetail}`;
    return;
  }

  const currentLabel = status.currentVersion ? `v${status.currentVersion}` : "v-";
  const latestLabel = status.latestVersion ? `v${status.latestVersion}` : "v-";
  badge.title = `Atual: ${currentLabel} | Remota: ${latestLabel}`;

  if (status.isOutdated) {
    badge.classList.add("update");
    badge.textContent = "Desatualizado";
    return;
  }

  badge.classList.add("ok");
  badge.textContent = "Atualizado";
}

async function loadGlobalUpdateStatus(force = false) {
  renderGlobalUpdateBadge(null);

  try {
    const updateStatus = await window.api.getGlobalAppUpdateStatus({ force });
    lastSuccessfulUpdateStatus = updateStatus;
    renderGlobalUpdateBadge(updateStatus);
  } catch (err) {
    // On failure, keep showing the last known good status instead of error state
    if (lastSuccessfulUpdateStatus) {
      renderGlobalUpdateBadge(lastSuccessfulUpdateStatus);
    } else {
      const errorMsg = err?.message || String(err);
      const currentVersion = (launcherState?.context?.version || "").replace(/^v/i, "") || null;

      renderGlobalUpdateBadge({
        error: true,
        errorMsg,
        currentVersion,
        latestVersion: currentVersion,
        isOutdated: false
      });
    }
  }
}

function renderActivity() {
  const activityList = document.getElementById("activity-list");
  if (!activityList) return;

  activityList.innerHTML = "";

  const visibleActivity = getVisibleActivityEntries();
  const previewItems = visibleActivity.length
    ? visibleActivity.slice(0, ACTIVITY_PREVIEW_ITEMS)
    : [
      {
        message: "Aguardando eventos do launcher",
        tone: "info",
        at: null
      }
    ];

  previewItems.forEach((entry) => {
    const item = document.createElement("li");
    const dot = document.createElement("span");
    const message = document.createElement("span");
    const time = document.createElement("span");

    dot.className = `dot ${entry.tone || "info"}`;
    message.className = "activity-message";
    message.textContent = entry.message;
    time.className = "activity-time";
    time.textContent = formatActivityTime(entry.at);

    item.append(dot, message, time);
    activityList.appendChild(item);
  });
}

async function clearActivityCardNotifications() {
  const visibleEntries = getVisibleActivityEntries();

  visibleEntries.forEach((entry) => {
    const key = getActivityEntryKey(entry);
    if (key) {
      dismissedActivityKeys.add(key);
    }
  });

  renderActivity();
  await persistDismissedKeys();
}

async function getDailyActivityEntries() {
  const dayKey = getDateKey();

  try {
    const response = await fetch(
      `${activityApiUrl}/activities?day=${encodeURIComponent(dayKey)}&env=${encodeURIComponent(activityEnv)}`,
      {
        headers: {
          "x-app-env": activityEnv
        }
      }
    );

    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch {
    // Fallback to local launcher state when backend is unavailable.
  }

  try {
    const list = await window.api.getLauncherActivityDay({ day: dayKey });
    if (Array.isArray(list)) {
      return list;
    }
  } catch {
    // Fallback to local loaded state when IPC is unavailable.
  }

  return (launcherState.activity || [])
    .filter((entry) => getDateKey(entry.at) === dayKey)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

async function fetchRecentActivities() {
  try {
    const response = await fetch(
      `${activityApiUrl}/activities?day=${encodeURIComponent(getDateKey())}&env=${encodeURIComponent(activityEnv)}&limit=${ACTIVITY_STATE_LIMIT}`,
      {
        headers: {
          "x-app-env": activityEnv
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    const list = await response.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function refreshActivityFeed() {
  const recent = await fetchRecentActivities();
  if (!recent.length) {
    return;
  }

  mergeActivityEntries(recent);

  if (
    activityModalElements?.backdrop &&
    !activityModalElements.backdrop.classList.contains("is-hidden")
  ) {
    renderActivityDayList(recent);
  }
}

function renderActivityDayList(entries) {
  if (!activityModalElements?.list || !activityModalElements?.subtitle) return;

  activityModalElements.list.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "activity-day-item";
    empty.textContent = "Sem atividades registradas para hoje.";
    activityModalElements.list.appendChild(empty);
    activityModalElements.subtitle.textContent = "Nenhum evento registrado hoje";
    return;
  }

  activityModalElements.subtitle.textContent = `${entries.length} evento(s) em ${formatActivityDate(entries[0].at)}`;

  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "activity-day-item";

    const head = document.createElement("div");
    head.className = "activity-day-item-head";

    const dot = document.createElement("span");
    dot.className = `dot ${entry.tone || "info"}`;

    const time = document.createElement("span");
    time.className = "activity-day-item-time";
    time.textContent = formatActivityTime(entry.at);

    const user = document.createElement("span");
    user.className = "activity-day-item-user";
    user.textContent = entry.user || "Operador";

    head.append(dot, time, user);

    const message = document.createElement("div");
    message.className = "activity-day-item-message";
    message.textContent = entry.message || "Evento registrado";

    const meta = document.createElement("div");
    meta.className = "activity-day-item-meta";
    meta.textContent = `Módulo: ${mapModuleLabel(entry.module)}`;

    const details = formatEntryDetails(entry.details);
    if (details) {
      const detailsLine = document.createElement("div");
      detailsLine.className = "activity-day-item-meta";
      detailsLine.textContent = details;
      item.append(head, message, meta, detailsLine);
      activityModalElements.list.appendChild(item);
      return;
    }

    item.append(head, message, meta);
    activityModalElements.list.appendChild(item);
  });
}

async function openActivityModal() {
  if (!activityModalElements?.backdrop) return;

  activityModalElements.backdrop.classList.remove("is-hidden");
  activityModalElements.backdrop.setAttribute("aria-hidden", "false");

  const entries = await getDailyActivityEntries();
  renderActivityDayList(entries);
}

function closeActivityModal() {
  if (!activityModalElements?.backdrop) return;

  activityModalElements.backdrop.classList.add("is-hidden");
  activityModalElements.backdrop.setAttribute("aria-hidden", "true");
}

function bindActivityInteractions() {
  const card = document.getElementById("activity-card");
  const backdrop = document.getElementById("activity-modal");
  const closeButton = document.getElementById("activity-modal-close");
  const clearButton = document.getElementById("activity-clear-btn");
  const list = document.getElementById("activity-day-list");
  const subtitle = document.getElementById("activity-modal-subtitle");

  activityModalElements = {
    card,
    backdrop,
    closeButton,
    clearButton,
    list,
    subtitle
  };

  card?.addEventListener("click", openActivityModal);
  card?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openActivityModal();
  });

  closeButton?.addEventListener("click", closeActivityModal);
  clearButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    void clearActivityCardNotifications();
  });

  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeActivityModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activityModalElements?.backdrop && !activityModalElements.backdrop.classList.contains("is-hidden")) {
      closeActivityModal();
    }
  });
}

function renderLauncher() {
  renderContext();
  renderMetrics();
  renderActivity();
}

async function persistLauncherPatch(patch) {
  await window.api.saveLauncherState(patch);
}

async function loadLauncherState() {
  try {
    const loaded = await window.api.getLauncherState();
    launcherState = {
      ...launcherState,
      ...loaded,
      context: {
        ...launcherState.context,
        ...(loaded.context || {})
      },
      moduleMetrics: {
        ...launcherState.moduleMetrics,
        ...(loaded.moduleMetrics || {})
      },
      moduleLastUsedAt: {
        ...launcherState.moduleLastUsedAt,
        ...(loaded.moduleLastUsedAt || {})
      },
      recents: Array.isArray(loaded.recents) ? loaded.recents : [],
      activity: Array.isArray(loaded.activity) ? loaded.activity : [],
      dismissedActivityKeys: Array.isArray(loaded.dismissedActivityKeys)
        ? loaded.dismissedActivityKeys
        : []
    };

    hydrateDismissedKeys(launcherState.dismissedActivityKeys);
  } catch {
    // Keep defaults when IPC is unavailable.
  }

  renderLauncher();
}

async function handleAction(action) {
  if (action === "open-dwg") {
    openDWG();
    setTimeout(loadLauncherState, 120);
    return;
  }

  if (action === "open-pm") {
    openProjectManager();
    setTimeout(loadLauncherState, 120);
    return;
  }

  if (action === "refresh") {
    const syncAt = new Date().toISOString();

    launcherState.context.lastSyncAt = syncAt;
    renderLauncher();

    await persistLauncherPatch({ lastSyncAt: syncAt });

    try {
      await window.api.trackLauncherActivity({
        module: "launcher",
        eventType: "manual-sync",
        message: "Sincronização manual executada",
        tone: "info"
      });
      await loadLauncherState();
    } catch {
      // Ignore tracking failures to keep manual sync responsive.
    }

    try {
      await window.api.checkAppUpdate();
    } catch {
      // Ignore manual update check failures to keep launcher responsive.
    }

    await loadGlobalUpdateStatus(true);
  }
}

function shouldIgnoreShortcutTarget(target) {
  if (!target) return false;

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable;
}

function isSyncShortcut(event) {
  return (
    event.key === "-" ||
    event.code === "Minus" ||
    event.code === "NumpadSubtract"
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  bindActivityInteractions();

  const cards = document.querySelectorAll(".app-card[data-app]");
  const favoriteButtons = document.querySelectorAll(".favorite-chip[data-app]");

  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 70}ms`;

    card.addEventListener("click", async () => {
      const app = card.dataset.app;
      if (app === "dwg") {
        await handleAction("open-dwg");
        return;
      }

      if (app === "pm") {
        await handleAction("open-pm");
      }
    });
  });

  favoriteButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.app === "dwg") {
        await handleAction("open-dwg");
        return;
      }

      if (button.dataset.app === "pm") {
        await handleAction("open-pm");
      }
    });
  });

  document.addEventListener("keydown", async (event) => {
    if (shouldIgnoreShortcutTarget(event.target)) {
      return;
    }

    if (!isSyncShortcut(event)) {
      return;
    }

    event.preventDefault();
    await handleAction("refresh");
  });

  window.addEventListener("focus", () => {
    loadGlobalUpdateStatus(true);
    refreshActivityFeed();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadGlobalUpdateStatus(true);
      refreshActivityFeed();
    }
  });

  setInterval(() => {
    loadGlobalUpdateStatus();
  }, APP_STATUS_POLL_MS);

  setInterval(() => {
    refreshActivityFeed();
  }, ACTIVITY_FEED_POLL_MS);

  await loadLauncherState();
  await initActivityRealtime();
  await refreshActivityFeed();
  await loadGlobalUpdateStatus();
});

