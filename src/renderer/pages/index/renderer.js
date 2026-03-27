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
  activity: []
};
const MODULE_STATUS_POLL_MS = 60 * 1000;

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

function renderModuleStatusBadge(elementId, status) {
  const badge = document.getElementById(elementId);
  if (!badge) return;

  badge.classList.remove("ok", "update", "updated", "info");

  if (!status) {
    badge.classList.add("info");
    badge.textContent = "Verificando...";
    return;
  }

  if (status.error) {
    badge.classList.add("info");
    badge.textContent = "SEM DADOS";
    return;
  }

  if (status.isUpdatable) {
    badge.classList.add("update");
    badge.textContent = "ATUALIZÁVEL";
    return;
  }

  badge.classList.add("updated");
  badge.textContent = "ATUALIZADO";
}

function renderModuleVersion(elementId, status) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!status) {
    el.textContent = "v-";
    return;
  }

  const current = status.currentVersion ? `v${status.currentVersion}` : "v-";
  const latest = status.latestVersion ? `v${status.latestVersion}` : current;

  if (status.isUpdatable && latest !== current) {
    el.textContent = `${current} -> ${latest}`;
    return;
  }

  el.textContent = current;
}

async function loadModuleUpdateStatus(force = false) {
  renderModuleStatusBadge("dwg-status", null);
  renderModuleStatusBadge("pm-status", null);
  renderModuleVersion("dwg-version", null);
  renderModuleVersion("pm-version", null);

  try {
    const updateStatus = await window.api.getModuleUpdateStatus({ force });
    renderModuleStatusBadge("dwg-status", updateStatus?.dwg);
    renderModuleStatusBadge("pm-status", updateStatus?.pm);
    renderModuleVersion("dwg-version", updateStatus?.dwg);
    renderModuleVersion("pm-version", updateStatus?.pm);
  } catch {
    renderModuleStatusBadge("dwg-status", { error: true });
    renderModuleStatusBadge("pm-status", { error: true });
    renderModuleVersion("dwg-version", null);
    renderModuleVersion("pm-version", null);
  }
}

function renderActivity() {
  const activityList = document.getElementById("activity-list");
  if (!activityList) return;

  activityList.innerHTML = "";

  const activity = launcherState.activity.length
    ? launcherState.activity
    : [
      {
        message: "Aguardando eventos do launcher",
        tone: "info"
      }
    ];

  activity.slice(0, 4).forEach((entry) => {
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
      activity: Array.isArray(loaded.activity) ? loaded.activity : []
    };
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
    const activity = [
      {
        message: "Sincronização manual executada",
        tone: "info",
        at: syncAt
      },
      ...launcherState.activity
    ].slice(0, 12);

    launcherState.context.lastSyncAt = syncAt;
    launcherState.activity = activity;
    renderLauncher();

    await persistLauncherPatch({
      lastSyncAt: syncAt,
      activity
    });

    try {
      await window.api.checkAppUpdate();
    } catch {
      // Ignore manual update check failures to keep launcher responsive.
    }

    await loadModuleUpdateStatus(true);
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
    loadModuleUpdateStatus();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadModuleUpdateStatus();
    }
  });

  setInterval(() => {
    loadModuleUpdateStatus();
  }, MODULE_STATUS_POLL_MS);

  await loadLauncherState();
  await loadModuleUpdateStatus();
});

