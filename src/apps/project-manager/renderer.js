/* =========================
   CONFIG
========================= */

const API_URL = "https://lato-app-production.up.railway.app";
const TABLE_LOADING_MIN_MS = 1000;
let appEnv = "prod";

let projects = [];
let editingId = null;
let deleteId = null;

const modal = document.getElementById("modal");

let currentUser = "Usuário desconhecido";
let contextMenu;
let summaryTabsInitialized = false;
let modalBindingsInitialized = false;
let tableLoadingCounter = 0;
let progressEditProject = null;
let progressDraftPercent = 0;

const PROGRESS_STAGES = [
  { percent: 0, label: "Em Definição 🤔" },
  { percent: 25, label: "Desenho/Projeto 🖼️" },
  { percent: 50, label: "Corte e Dobra ✂️" },
  { percent: 65, label: "Acabamento 💎" },
  { percent: 90, label: "Montagem ⚙️" },
  { percent: 100, label: "Expedição 💵" }
];

/* =========================
   SOCKET.IO
========================= */

let socket;

function getApiHeaders() {
  return {
    "Content-Type": "application/json",
    "x-app-env": appEnv
  };
}

function resolveEnvironmentLabel(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["dev", "development", "local"].includes(raw)) {
    return "dev";
  }

  return "prod";
}

function initRealtime() {
  socket = io(API_URL, {
    query: { env: appEnv }
  });

  socket.on("connect", () => {
    console.log(`🟢 Conectado ao servidor em tempo real (${appEnv})`);
  });

  socket.on("projects:update", () => {
    loadProjects();
  });
}

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    currentUser = await window.api.getLoggedUser();
  } catch {
    currentUser = "Usuário desconhecido";
  }

  try {
    appEnv = resolveEnvironmentLabel(await window.api.getAppEnvironment());
  } catch {
    appEnv = "prod";
  }

  initRealtime();

  initModalBindings();
  loadProjects();
});

function initModalBindings() {
  if (modalBindingsInitialized) return;

  const inputAlimentador = document.getElementById("alimentador");
  inputAlimentador?.addEventListener("input", e => {
    updateAlimentadorSelecionado(e.target.value.trim());
  });

  enableKeyboardNavigation();
  modalBindingsInitialized = true;
}

/* =========================
   API
========================= */

async function loadProjects() {
  const loadingToken = beginTableLoading();

  try {
    const res = await fetch(`${API_URL}/projects?env=${encodeURIComponent(appEnv)}`, {
      headers: { "x-app-env": appEnv }
    });
    projects = await res.json();

    projects = projects.map(project => ({
      ...project,
      progresso_percent: project.progresso_percent ?? 0
    }));

    renderTable();
  } catch (err) {
    console.error("Erro ao carregar projetos:", err);
  } finally {
    endTableLoading(loadingToken);
  }
}

function beginTableLoading() {
  tableLoadingCounter += 1;

  const loadingEl = document.getElementById("tableLoading");
  if (loadingEl) {
    loadingEl.classList.add("active");
    loadingEl.setAttribute("aria-hidden", "false");
    loadingEl.closest(".list")?.classList.add("table-busy");
  }

  return {
    id: tableLoadingCounter,
    startedAt: Date.now()
  };
}

function endTableLoading(token) {
  const loadingEl = document.getElementById("tableLoading");
  if (!loadingEl) return;

  const elapsed = Date.now() - token.startedAt;
  const wait = Math.max(TABLE_LOADING_MIN_MS - elapsed, 0);

  setTimeout(() => {
    if (token.id !== tableLoadingCounter) return;

    loadingEl.classList.remove("active");
    loadingEl.setAttribute("aria-hidden", "true");
    loadingEl.closest(".list")?.classList.remove("table-busy");
  }, wait);
}

async function createProject(project) {
  await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(project)
  });
}

async function updateProject(id, project) {
  await fetch(`${API_URL}/projects/${id}`, {
    method: "PUT",
    headers: getApiHeaders(),
    body: JSON.stringify(project)
  });
}

async function deleteProject(id) {
  await fetch(`${API_URL}/projects/${id}`, {
    method: "DELETE",
    headers: { "x-app-env": appEnv }
  });
}

async function updateProjectProgress(id, percent) {
  await fetch(`${API_URL}/projects/${id}/progress`, {
    method: "PATCH",
    headers: getApiHeaders(),
    body: JSON.stringify({ progressPercent: percent })
  });
}

async function trackLauncherActivity(payload) {
  if (!window.api?.trackLauncherActivity) {
    return;
  }

  try {
    await window.api.trackLauncherActivity(payload);
  } catch {
    // Activity tracking should never interrupt PM actions.
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function formatDateValue(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function describeProjectChanges(previousProject, nextProject) {
  if (!previousProject || !nextProject) {
    return [];
  }

  const trackedFields = [
    { key: "obra", label: "Obra" },
    { key: "cliente", label: "Cliente" },
    { key: "unidade", label: "Unidade" },
    { key: "alimentador", label: "Alimentador" },
    { key: "observacao", label: "Observação" },
    { key: "entrega", label: "Data de Entrega", isDate: true },
    { key: "instalacao", label: "Data de Instalação", isDate: true }
  ];

  return trackedFields
    .filter(({ key, isDate }) => {
      const before = isDate ? (previousProject[key] || null) : normalizeText(previousProject[key]);
      const after = isDate ? (nextProject[key] || null) : normalizeText(nextProject[key]);
      return before !== after;
    })
    .map(({ key, label, isDate }) => {
      const beforeValue = isDate ? formatDateValue(previousProject[key]) : (normalizeText(previousProject[key]) || "-");
      const afterValue = isDate ? formatDateValue(nextProject[key]) : (normalizeText(nextProject[key]) || "-");
      return `${label}: ${beforeValue} -> ${afterValue}`;
    });
}

/* =========================
   MODAL HELPERS (ANIMAÇÃO)
========================= */

function openModalAnimated(modalEl) {
  modalEl.style.display = "flex";
  requestAnimationFrame(() => {
    modalEl.classList.add("active");
  });
}

function closeModalAnimated(modalEl) {
  modalEl.classList.remove("active");
  setTimeout(() => {
    modalEl.style.display = "none";
  }, 250);
}

/* =========================
   CONTEXT MENU
========================= */

function closeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

function openContextMenu(x, y, projectId) {
  closeContextMenu();

  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  contextMenu.innerHTML = `
    <button onclick="openModal(${projectId})">✏️ Editar</button>
    <button class="danger" onclick="askDelete(${projectId})">🗑️ Excluir</button>
  `;

  document.body.appendChild(contextMenu);

  setTimeout(() => {
    document.addEventListener("click", closeContextMenu, { once: true });
  }, 0);
}

/* =========================
   TABS DO MODAL
========================= */

document.addEventListener("click", e => {
  if (!e.target.classList.contains("tab")) return;

  const tabName = e.target.dataset.tab;

  document
    .querySelectorAll(".modal-tabs .tab")
    .forEach(b => b.classList.remove("active"));

  e.target.classList.add("active");

  document
    .querySelectorAll(".tab-content")
    .forEach(c => c.classList.remove("active"));

  document.getElementById(`tab-${tabName}`)?.classList.add("active");
});

/* =========================
   MODAL REGISTRO
========================= */

function openModal(id = null) {
  openModalAnimated(modal);
  editingId = id;

  clearForm();

  if (id) {
    const p = projects.find(p => p.id === id);
    if (p) fillForm(p);
  }

  setTimeout(() => {
    document.getElementById("obra")?.focus();
  }, 0);
}

function closeModal() {
  closeModalAnimated(modal);
  editingId = null;
}

function clearForm() {
  [
    "obra",
    "cliente",
    "unidade",
    "alimentador",
    "observacao",
    "entrega",
    "instalacao",
    "alimentador_aplicacao",
    "alimentador_tipo_produto",
    "alimentador_tipo_painel",
    "alimentador_local_botoeira",
    "alimentador_altura_entrega"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function fillForm(p) {
  document.getElementById("obra").value = p.obra || "";
  document.getElementById("cliente").value = p.cliente || "";
  document.getElementById("unidade").value = p.unidade || "";
  document.getElementById("alimentador").value = p.alimentador || "";
  document.getElementById("observacao").value = p.observacao || "";

  document.getElementById("entrega").value =
    p.entrega ? p.entrega.split("T")[0] : "";

  document.getElementById("instalacao").value =
    p.instalacao ? p.instalacao.split("T")[0] : "";

  // ===== ALIMENTADOR =====
  document.getElementById("alimentador_aplicacao").value =
    p.alimentador_aplicacao || "";

  document.getElementById("alimentador_tipo_produto").value =
    p.alimentador_tipo_produto || "";

  document.getElementById("alimentador_tipo_painel").value =
    p.alimentador_tipo_painel || "";

  document.getElementById("alimentador_local_botoeira").value =
    p.alimentador_local_botoeira || "";

  document.getElementById("alimentador_altura_entrega").value =
    p.alimentador_altura_entrega || "";

  // Atualiza destaque se existir
  updateAlimentadorSelecionado(p.alimentador || "");
}



/* =========================
   SAVE
========================= */

async function save() {
  const project = {
    obra: document.getElementById("obra").value.trim(),
    cliente: document.getElementById("cliente").value.trim(),
    unidade: document.getElementById("unidade").value.trim(),
    alimentador: document.getElementById("alimentador").value.trim(),
    entrega: document.getElementById("entrega").value || null,
    instalacao: document.getElementById("instalacao").value || null,
    observacao: document.getElementById("observacao").value.trim(),
    createdBy: currentUser,
    alimentador_aplicacao: document.getElementById("alimentador_aplicacao").value.trim(),
    alimentador_tipo_produto: document.getElementById("alimentador_tipo_produto").value.trim(),
    alimentador_tipo_painel: document.getElementById("alimentador_tipo_painel").value.trim(),
    alimentador_local_botoeira: document.getElementById("alimentador_local_botoeira").value.trim(),
    alimentador_altura_entrega: document.getElementById("alimentador_altura_entrega").value.trim()
  };

  if (!project.obra || !project.cliente || !project.observacao) {
    showValidation("Obra, Cliente e Observação são obrigatórios.");
    return;
  }

  try {
    if (editingId) {
      const previousProject = projects.find(p => p.id === editingId);
      const changes = describeProjectChanges(previousProject, project);
      const dateChanged = changes.some(change => change.startsWith("Data de Entrega") || change.startsWith("Data de Instalação"));

      await updateProject(editingId, project);

      await trackLauncherActivity({
        module: "project-manager",
        eventType: dateChanged ? "project-date-change" : "project-update",
        tone: "info",
        message: `Projeto ${project.obra || "sem nome"} atualizado`,
        user: currentUser,
        details: {
          projectId: editingId,
          obra: project.obra || "",
          changes
        }
      });
    } else {
      await createProject(project);

      await trackLauncherActivity({
        module: "project-manager",
        eventType: "project-create",
        tone: "ok",
        message: `Projeto ${project.obra || "sem nome"} criado`,
        user: currentUser,
        details: {
          obra: project.obra || "",
          cliente: project.cliente || ""
        }
      });
    }
    closeModal();
  } catch (err) {
    console.error("Erro ao salvar:", err);
  }
}

/* =========================
   DELETE
========================= */

function askDelete(id) {
  deleteId = id;
  openModalAnimated(document.getElementById("confirmModal"));
}

function closeConfirm() {
  deleteId = null;
  closeModalAnimated(document.getElementById("confirmModal"));
}

function closeConfirmImmediate() {
  const confirmModal = document.getElementById("confirmModal");
  if (!confirmModal) return;

  confirmModal.classList.remove("active");
  confirmModal.style.display = "none";
}

async function confirmDelete() {
  if (!deleteId) return;

  const idToDelete = deleteId;
  const projectToDelete = projects.find(p => p.id === idToDelete);
  deleteId = null;
  closeConfirmImmediate();

  try {
    await deleteProject(idToDelete);

    await trackLauncherActivity({
      module: "project-manager",
      eventType: "project-delete",
      tone: "info",
      message: `Projeto ${(projectToDelete?.obra || "sem nome")} excluído`,
      user: currentUser,
      details: {
        projectId: idToDelete,
        obra: projectToDelete?.obra || ""
      }
    });
  } catch (err) {
    console.error("Erro ao excluir:", err);
  }
}

/* =========================
   RENDER TABLE
========================= */

function renderTable() {
  const tbody = document.getElementById("items");
  const tooltip = document.getElementById("hoverTooltip");

  tbody.innerHTML = "";

  if (!projects.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; color:#94a3b8;">
          Nenhum registro cadastrado
        </td>
      </tr>
    `;
    return;
  }

  projects.forEach(p => {
    const tr = document.createElement("tr");
    const createdBy = p.created_by || "Desconhecido";
    const progress = getProjectProgress(p);
    const tone = getProgressTone(progress.percent);

    tr.innerHTML = `
      <td>${p.obra}</td>
      <td>${p.cliente || "-"}</td>
      <td>${p.unidade || "-"}</td>
      <td>${p.alimentador || "-"}</td>
      <td>${p.girafa || "-"}</td>
      <td>${p.esteira || "-"}</td>
      <td>${formatDateBR(p.entrega)}</td>
      <td>${formatDateBR(p.instalacao)}</td>
      <td>
        <button class="progress-pill" type="button" data-progress-id="${p.id}">
          <span class="progress-pill-bar" style="--progress:${progress.percent}%; --progress-fill:${tone.gradient}; --progress-glow-a:${tone.glowA}; --progress-glow-b:${tone.glowB};"></span>
          <span class="progress-pill-text">${progress.percent}%</span>
        </button>
      </td>
    `;
    // <td class="obs-cell">${p.observacao}</td> (removido da tabela para evitar poluição visual, mas permanece na modal de resumo)

    tr.addEventListener("click", e => {
      if (e.button !== 0) return;
      openSummary(p);
    });

    tr.addEventListener("contextmenu", e => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, p.id);
    });

    tr.addEventListener("mousemove", e => {
      tooltip.style.left = e.clientX + 14 + "px";
      tooltip.style.top = e.clientY + 14 + "px";
      tooltip.innerHTML = `Adicionado por <strong>${createdBy}</strong>`;
      tooltip.style.opacity = "1";
    });

    tr.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
    });

    const progressBtn = tr.querySelector(`[data-progress-id="${p.id}"]`);
    progressBtn?.addEventListener("click", e => {
      e.stopPropagation();
      openProgressModal(p.id);
    });

    progressBtn?.addEventListener("mousemove", e => {
      e.stopPropagation();
      tooltip.style.left = e.clientX + 14 + "px";
      tooltip.style.top = e.clientY + 14 + "px";
      tooltip.innerHTML = `<strong>${progress.percent}%</strong> - ${progress.label}`;
      tooltip.style.opacity = "1";
    });

    progressBtn?.addEventListener("mouseleave", e => {
      e.stopPropagation();
      tooltip.style.opacity = "0";
    });

    tbody.appendChild(tr);
  });
}

function getProjectProgress(project) {
  const value = Number(project.progresso_percent ?? 0);
  const safePercent = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  let currentStage = PROGRESS_STAGES[0];

  PROGRESS_STAGES.forEach(stage => {
    if (safePercent >= stage.percent) {
      currentStage = stage;
    }
  });

  return {
    percent: currentStage.percent,
    label: currentStage.label
  };
}

function getProgressTone(percent) {
  if (percent >= 100) {
    return {
      gradient: "linear-gradient(90deg, #16a34a 0%, #22c55e 55%, #86efac 100%)",
      glowA: "rgba(34, 197, 94, 0.5)",
      glowB: "rgba(134, 239, 172, 0.38)"
    };
  }

  if (percent >= 65) {
    return {
      gradient: "linear-gradient(90deg, #2563eb 0%, #0284c7 45%, #06b6d4 100%)",
      glowA: "rgba(37, 99, 235, 0.5)",
      glowB: "rgba(6, 182, 212, 0.35)"
    };
  }

  return {
    gradient: "linear-gradient(90deg, #f59e0b 0%, #fb923c 50%, #fbbf24 100%)",
    glowA: "rgba(245, 158, 11, 0.48)",
    glowB: "rgba(251, 191, 36, 0.36)"
  };
}

function openProgressModal(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  progressEditProject = project;
  progressDraftPercent = getProjectProgress(project).percent;

  const projectName = document.getElementById("progressProjectName");
  if (projectName) {
    projectName.textContent = `${project.obra || "Projeto"} - ${project.cliente || "Sem cliente"}`;
  }

  renderProgressDraft();
  openModalAnimated(document.getElementById("progressModal"));
}

function closeProgressModal() {
  progressEditProject = null;
  progressDraftPercent = 0;
  closeModalAnimated(document.getElementById("progressModal"));
}

function renderProgressDraft() {
  const heroValue = document.getElementById("progressHeroValue");
  const heroLabel = document.getElementById("progressHeroLabel");
  const stepsWrap = document.getElementById("progressSteps");

  if (!heroValue || !heroLabel || !stepsWrap) return;

  const stage = PROGRESS_STAGES.find(s => s.percent === progressDraftPercent) || PROGRESS_STAGES[0];
  heroValue.textContent = `${stage.percent}%`;
  heroLabel.textContent = stage.label;

  stepsWrap.innerHTML = "";

  PROGRESS_STAGES.forEach((item, index) => {
    const checked = item.percent <= progressDraftPercent;
    const stepEl = document.createElement("button");
    stepEl.type = "button";
    stepEl.className = `progress-step ${checked ? "done" : ""} ${item.percent === progressDraftPercent ? "current" : ""}`;

    stepEl.innerHTML = `
      <span class="progress-step-check">${checked ? "✓" : "○"}</span>
      <span class="progress-step-main">
        <strong>${item.percent}%</strong>
        <small>${item.label}</small>
      </span>
    `;

    stepEl.addEventListener("click", () => {
      if (item.percent < progressDraftPercent) {
        progressDraftPercent = item.percent;
      } else if (item.percent > progressDraftPercent) {
        progressDraftPercent = item.percent;
      } else {
        progressDraftPercent = index > 0 ? PROGRESS_STAGES[index - 1].percent : 0;
      }

      renderProgressDraft();
    });

    stepsWrap.appendChild(stepEl);
  });
}

async function saveProgress() {
  if (!progressEditProject) return;

  try {
    const previousPercent = getProjectProgress(progressEditProject).percent;
    await updateProjectProgress(progressEditProject.id, progressDraftPercent);

    await trackLauncherActivity({
      module: "project-manager",
      eventType: "project-progress-update",
      tone: "ok",
      message: `Progresso de ${progressEditProject.obra || "projeto"} alterado para ${progressDraftPercent}%`,
      user: currentUser,
      details: {
        projectId: progressEditProject.id,
        obra: progressEditProject.obra || "",
        fromPercent: previousPercent,
        toPercent: progressDraftPercent
      }
    });

    closeProgressModal();
  } catch (err) {
    console.error("Erro ao salvar progresso:", err);
  }
}

/* =========================
   SUMMARY MODAL
========================= */

function openSummary(project) {
  initSummaryTabs();

  // limpa abas
  document.querySelectorAll(".summary-tab").forEach(t =>
    t.classList.remove("active")
  );

  document.querySelectorAll(".summary-content").forEach(c =>
    c.classList.remove("active")
  );

  // ativa aba Geral por padrão
  const defaultTab = document.querySelector('[data-tab="summary-geral"]');
  const defaultContent = document.getElementById("summary-geral");

  if (defaultTab) defaultTab.classList.add("active");
  if (defaultContent) defaultContent.classList.add("active");

  /* ===== GERAL ===== */
  document.getElementById("sum-obra").textContent = project.obra || "-";
  document.getElementById("sum-cliente").textContent = project.cliente || "-";
  document.getElementById("sum-unidade").textContent = project.unidade || "-";
  document.getElementById("sum-alimentador").textContent = project.alimentador || "-";
  document.getElementById("sum-girafa").textContent = project.girafa || "-";
  document.getElementById("sum-esteira").textContent = project.esteira || "-";
  document.getElementById("sum-entrega").textContent = formatDateBR(project.entrega);
  document.getElementById("sum-instalacao").textContent = formatDateBR(project.instalacao);
  document.getElementById("sum-observacao").textContent = project.observacao || "-";

  /* ===== ALIMENTADOR ===== */
  document.getElementById("sum-alimentador-aplicacao").textContent =
    project.alimentador_aplicacao || "-";

  document.getElementById("sum-alimentador-tipo-produto").textContent =
    project.alimentador_tipo_produto || "-";

  document.getElementById("sum-alimentador-tipo-painel").textContent =
    project.alimentador_tipo_painel || "-";

  document.getElementById("sum-alimentador-local-botoeira").textContent =
    project.alimentador_local_botoeira || "-";

  document.getElementById("sum-alimentador-altura-entrega").textContent =
    project.alimentador_altura_entrega || "-";

  /* ===== CARD DE DESTAQUE (IGUAL AO REGISTRO) ===== */
  const card = document.getElementById("sum-alimentador-selecionado");

  if (project.alimentador) {
    card.textContent = project.alimentador;
    card.classList.add("filled");
  } else {
    card.textContent = "Nenhum alimentador informado";
    card.classList.remove("filled");
  }

  openModalAnimated(document.getElementById("summaryModal"));
}

function closeSummary() {
  closeModalAnimated(document.getElementById("summaryModal"));
}

/* =========================
   VALIDATION MODAL
========================= */

function showValidation(message) {
  document.getElementById("validationMessage").textContent = message;
  openModalAnimated(document.getElementById("validationModal"));
}

function closeValidation() {
  closeModalAnimated(document.getElementById("validationModal"));
}

/* =========================
   HELPERS
========================= */

function formatDateBR(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

/* =========================
   KEYBOARD NAVIGATION
========================= */

function enableKeyboardNavigation() {
  const fields = Array.from(document.querySelectorAll("#modal input"));

  fields.forEach((field, index) => {
    if (field.dataset.navBound === "true") return;

    field.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (index < fields.length - 1) {
          fields[index + 1].focus();
        } else {
          save();
        }
      }
      if (e.key === "Escape") closeModal();
    });

    field.dataset.navBound = "true";
  });
}

function updateAlimentadorSelecionado(valor) {
  const el = document.getElementById("alimentador-selecionado");
  if (!el) return;

  if (!valor) {
    el.textContent = "Nenhum alimentador informado";
    el.classList.remove("filled");
  } else {
    el.textContent = valor;
    el.classList.add("filled");
  }
}

function initSummaryTabs() {
  if (summaryTabsInitialized) return;

  const tabs = document.querySelectorAll(".summary-tab");
  const contents = document.querySelectorAll(".summary-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      tab.classList.add("active");

      const content = document.getElementById(tab.dataset.tab);
      if (content) content.classList.add("active");
    });
  });

  summaryTabsInitialized = true;
}

function exportProjects() {
  if (!projects.length) {
    alert("Nenhum projeto para exportar.");
    return;
  }
  const headers = [
    "ID",
    "Obra",
    "Cliente",
    "Unidade",
    "Alimentador",
    "Girafa",
    "Esteira",
    "Entrega",
    "Instalação",
    "Progresso",
    "Observação",
    "Criado por",
    "Data criação",
    "Aplicação Alimentador"
  ];

  const keys = [
    "id",
    "obra",
    "cliente",
    "unidade",
    "alimentador",
    "girafa",
    "esteira",
    "entrega",
    "instalacao",
    "progresso_percent",
    "observacao",
    "created_by",
    "created_at",
    "alimentador_aplicacao"
  ];

  const csvRows = [];

  csvRows.push(headers.join(";"));

  projects.forEach(p => {
    const row = keys.map(key => {
      let value = p[key] ?? "";

      if (key === "entrega" || key === "instalacao" || key === "created_at") {
        if (value) {
          value = new Date(value).toLocaleDateString("pt-BR");
        }
      }

      value = String(value).replace(/"/g, '""');

      return `"${value}"`;
    });

    csvRows.push(row.join(";"));
  });

  const csvString = csvRows.join("\n");

  const blob = new Blob(["\uFEFF" + csvString], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const hoje = new Date().toISOString().split("T")[0];

  const link = document.createElement("a");
  link.href = url;
  link.download = `backup_projetos_${hoje}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}
