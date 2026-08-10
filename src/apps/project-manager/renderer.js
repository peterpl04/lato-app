/* =========================
   CONFIG
========================= */

const API_URL = "https://lato-app-production.up.railway.app";
const TABLE_LOADING_MIN_MS = 1000;
let appEnv = "prod";

let projects = [];
let editingId = null;
let deleteId = null;
let filters = {
  obra: "",
  cliente: "",
  unidade: "",
  alimentador: "",
  girafa: ""
};

const modal = document.getElementById("modal");

let currentUser = "Usuário desconhecido";
let contextMenu;
let summaryTabsInitialized = false;
let modalBindingsInitialized = false;
let tableLoadingCounter = 0;
let progressEditProject = null;
let progressDraftPercent = 0;
let currentSummaryProjectId = null;

/* Attachments (aba Geral) */
const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_MAX_COUNT = 20;
const ATTACHMENT_ACCEPT_MIME = /^(image\/|application\/pdf$)/i;
let pendingAttachments = [];       // arquivos escolhidos, ainda não enviados
let existingAttachments = [];      // metadata carregada do servidor (id, filename...)
let attachmentsToDelete = new Set();
let attachmentDropzoneBound = false;

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

  // Quando estoque registra saída vinculada a um projeto,
  // recarrega o consumo se o resumo estiver aberto naquele projeto.
  socket.on("project:stock-update", (payload) => {
    const projId = payload?.projectId;
    if (!projId) return;
    const summaryOpen = document.getElementById("summaryModal")?.classList.contains("active");
    if (summaryOpen && currentSummaryProjectId === projId) {
      const project = projects.find(p => p.id === projId);
      if (project) loadStockConsumption(project);
    }
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
  initFilters();
  loadProjects();
});

function initModalBindings() {
  if (modalBindingsInitialized) return;

  const inputAlimentador = document.getElementById("alimentador");
  inputAlimentador?.addEventListener("input", e => {
    updateAlimentadorSelecionado(e.target.value.trim());
  });

  initAttachmentsDropzone();

  enableKeyboardNavigation();
  modalBindingsInitialized = true;
}

function initFilters() {
  const filterObra = document.getElementById("filterObra");
  const filterCliente = document.getElementById("filterCliente");
  const filterUnidade = document.getElementById("filterUnidade");
  const filterAlimentador = document.getElementById("filterAlimentador");
  const filterGirafa = document.getElementById("filterGirafa");

  filterObra?.addEventListener("input", e => {
    filters.obra = e.target.value.trim().toLowerCase();
    applyFilters();
  });

  filterCliente?.addEventListener("change", e => {
    filters.cliente = e.target.value.trim().toLowerCase();
    applyFilters();
  });

  filterUnidade?.addEventListener("change", e => {
    filters.unidade = e.target.value.trim().toLowerCase();
    applyFilters();
  });

  filterAlimentador?.addEventListener("change", e => {
    filters.alimentador = e.target.value.trim().toLowerCase();
    applyFilters();
  });

  filterGirafa?.addEventListener("change", e => {
    filters.girafa = e.target.value.trim().toLowerCase();
    applyFilters();
  });
}

function updateFilterOptions() {
  const clientesSet = new Set();
  const unidadesSet = new Set();
  const alimentadoresSet = new Set();
  const girafasSet = new Set();

  projects.forEach(p => {
    if (p.cliente) clientesSet.add(p.cliente);
    if (p.unidade) unidadesSet.add(p.unidade);
    if (p.alimentador) alimentadoresSet.add(p.alimentador);
    if (p.girafa_codigo) girafasSet.add(p.girafa_codigo);
  });

  const filterCliente = document.getElementById("filterCliente");
  const filterUnidade = document.getElementById("filterUnidade");
  const filterAlimentador = document.getElementById("filterAlimentador");
  const filterGirafa = document.getElementById("filterGirafa");

  if (filterCliente) {
    const selectedValue = filterCliente.value;
    filterCliente.innerHTML = '<option value="">Todos</option>';
    Array.from(clientesSet).sort().forEach(cliente => {
      const option = document.createElement("option");
      option.value = cliente.toLowerCase();
      option.textContent = cliente;
      filterCliente.appendChild(option);
    });
    filterCliente.value = selectedValue;
  }

  if (filterUnidade) {
    const selectedValue = filterUnidade.value;
    filterUnidade.innerHTML = '<option value="">Todos</option>';
    Array.from(unidadesSet).sort().forEach(unidade => {
      const option = document.createElement("option");
      option.value = unidade.toLowerCase();
      option.textContent = unidade;
      filterUnidade.appendChild(option);
    });
    filterUnidade.value = selectedValue;
  }

  if (filterAlimentador) {
    const selectedValue = filterAlimentador.value;
    filterAlimentador.innerHTML = '<option value="">Todos</option>';
    Array.from(alimentadoresSet).sort().forEach(alimentador => {
      const option = document.createElement("option");
      option.value = alimentador.toLowerCase();
      option.textContent = alimentador;
      filterAlimentador.appendChild(option);
    });
    filterAlimentador.value = selectedValue;
  }

  if (filterGirafa) {
    const selectedValue = filterGirafa.value;
    filterGirafa.innerHTML = '<option value="">Todos</option>';
    Array.from(girafasSet).sort().forEach(girafa => {
      const option = document.createElement("option");
      option.value = girafa.toLowerCase();
      option.textContent = girafa;
      filterGirafa.appendChild(option);
    });
    filterGirafa.value = selectedValue;
  }
}

function getFilteredProjects() {
  return projects.filter(p => {
    const obraMatch = !filters.obra || (p.obra || "").toLowerCase().includes(filters.obra);
    const clienteMatch = !filters.cliente || (p.cliente || "").toLowerCase() === filters.cliente;
    const unidadeMatch = !filters.unidade || (p.unidade || "").toLowerCase() === filters.unidade;
    const alimentadorMatch = !filters.alimentador || (p.alimentador || "").toLowerCase() === filters.alimentador;
    const girafaMatch = !filters.girafa || (p.girafa_codigo || "").toLowerCase() === filters.girafa;

    return obraMatch && clienteMatch && unidadeMatch && alimentadorMatch && girafaMatch;
  });
}

function applyFilters() {
  renderTable();
}

function clearFilters() {
  filters = {
    obra: "",
    cliente: "",
    unidade: "",
    alimentador: "",
    girafa: ""
  };

  document.getElementById("filterObra").value = "";
  document.getElementById("filterCliente").value = "";
  document.getElementById("filterUnidade").value = "";
  document.getElementById("filterAlimentador").value = "";
  document.getElementById("filterGirafa").value = "";

  renderTable();
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

    updateFilterOptions();
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
  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(project)
  });
  if (!res.ok) {
    throw new Error("Falha ao criar projeto");
  }
  return res.json();
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

/* =========================
   ATTACHMENTS (aba Geral)
========================= */

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function isImageMime(mime) {
  return String(mime || "").toLowerCase().startsWith("image/");
}

function attachmentDownloadUrl(projectId, attId, forceDownload = false) {
  const suffix = forceDownload ? "?download=1" : "";
  return `${API_URL}/projects/${projectId}/attachments/${attId}${suffix}`;
}

async function loadProjectAttachments(projectId) {
  try {
    const res = await fetch(`${API_URL}/projects/${projectId}/attachments`, {
      headers: { "x-app-env": appEnv }
    });
    if (!res.ok) throw new Error("Falha ao listar anexos");
    const rows = await res.json();
    existingAttachments = Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error("Erro ao carregar anexos:", err);
    existingAttachments = [];
  }
  renderAttachmentsList();
}

async function uploadPendingAttachments(projectId) {
  if (!pendingAttachments.length) return;

  const form = new FormData();
  pendingAttachments.forEach(file => form.append("files", file, file.name));
  form.append("uploadedBy", currentUser || "Operador");

  try {
    const res = await fetch(`${API_URL}/projects/${projectId}/attachments`, {
      method: "POST",
      headers: { "x-app-env": appEnv },
      body: form
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Falha ao enviar anexos");
    }
  } catch (err) {
    console.error("Erro ao enviar anexos:", err);
    showValidation(err.message || "Não foi possível enviar os anexos.");
  }
}

async function deleteMarkedAttachments(projectId) {
  const ids = Array.from(attachmentsToDelete);
  if (!ids.length) return;

  await Promise.all(
    ids.map(id =>
      fetch(`${API_URL}/projects/${projectId}/attachments/${id}`, {
        method: "DELETE",
        headers: { "x-app-env": appEnv }
      }).catch(err => console.error("Erro ao excluir anexo", id, err))
    )
  );
}

function resetAttachmentsState() {
  pendingAttachments = [];
  existingAttachments = [];
  attachmentsToDelete = new Set();
  const input = document.getElementById("attachmentsInput");
  if (input) input.value = "";
  renderAttachmentsList();
}

function validateAttachmentFile(file) {
  if (!ATTACHMENT_ACCEPT_MIME.test(file.type || "")) {
    return "Tipo não permitido. Envie PDF ou imagens.";
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return `"${file.name}" excede 15 MB.`;
  }
  return null;
}

function addPendingAttachments(fileList) {
  if (!fileList || !fileList.length) return;

  const totalCount =
    pendingAttachments.length +
    existingAttachments.length -
    attachmentsToDelete.size;

  const files = Array.from(fileList);
  const errors = [];

  for (const file of files) {
    if (totalCount + pendingAttachments.length >= ATTACHMENT_MAX_COUNT) {
      errors.push(`Máximo de ${ATTACHMENT_MAX_COUNT} anexos por projeto.`);
      break;
    }
    const err = validateAttachmentFile(file);
    if (err) {
      errors.push(err);
      continue;
    }
    pendingAttachments.push(file);
  }

  if (errors.length) {
    showValidation(errors[0]);
  }

  renderAttachmentsList();
}

function removePendingAttachment(index) {
  pendingAttachments.splice(index, 1);
  renderAttachmentsList();
}

function markExistingAttachmentForDeletion(id) {
  attachmentsToDelete.add(Number(id));
  renderAttachmentsList();
}

function unmarkExistingAttachmentForDeletion(id) {
  attachmentsToDelete.delete(Number(id));
  renderAttachmentsList();
}

function openExistingAttachment(projectId, attId) {
  const url = attachmentDownloadUrl(projectId, attId, false);
  try {
    if (window.api && typeof window.api.openExternal === "function") {
      window.api.openExternal(url);
      return;
    }
  } catch (_) { /* ignore */ }
  window.open(url, "_blank", "noopener");
}

function attachmentIconForMime(mime) {
  if (isImageMime(mime)) return "fa-solid fa-image";
  if (String(mime || "").toLowerCase() === "application/pdf") return "fa-solid fa-file-pdf";
  return "fa-solid fa-paperclip";
}

function renderAttachmentsList() {
  const list = document.getElementById("attachmentsList");
  if (!list) return;

  list.innerHTML = "";

  // Existentes (que não estão marcados para deleção)
  existingAttachments.forEach(att => {
    const marked = attachmentsToDelete.has(Number(att.id));

    const li = document.createElement("li");
    li.className = `attachment-chip is-existing${marked ? " is-removed" : ""}`;

    const thumb = document.createElement("div");
    thumb.className = "attachment-thumb";
    if (isImageMime(att.mime_type) && editingId) {
      const img = document.createElement("img");
      img.src = attachmentDownloadUrl(editingId, att.id, false);
      img.alt = att.filename;
      img.loading = "lazy";
      thumb.appendChild(img);
    } else {
      const icon = document.createElement("i");
      icon.className = attachmentIconForMime(att.mime_type);
      thumb.appendChild(icon);
    }

    const info = document.createElement("div");
    info.className = "attachment-info";
    const name = document.createElement("span");
    name.className = "attachment-name";
    name.textContent = att.filename;
    name.title = att.filename;
    const meta = document.createElement("span");
    meta.className = "attachment-meta";
    meta.textContent = formatBytes(att.size_bytes);
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "attachment-actions";

    if (!marked && editingId) {
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "attachment-btn attachment-open";
      openBtn.title = "Abrir";
      openBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
      openBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openExistingAttachment(editingId, att.id);
      });
      actions.appendChild(openBtn);
    }

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "attachment-btn attachment-remove";
    if (marked) {
      toggleBtn.title = "Restaurar";
      toggleBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        unmarkExistingAttachmentForDeletion(att.id);
      });
    } else {
      toggleBtn.title = "Remover";
      toggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        markExistingAttachmentForDeletion(att.id);
      });
    }
    actions.appendChild(toggleBtn);

    li.appendChild(thumb);
    li.appendChild(info);
    li.appendChild(actions);
    list.appendChild(li);
  });

  // Pendentes
  pendingAttachments.forEach((file, index) => {
    const li = document.createElement("li");
    li.className = "attachment-chip is-pending";

    const thumb = document.createElement("div");
    thumb.className = "attachment-thumb";
    if (isImageMime(file.type)) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      img.addEventListener("load", () => URL.revokeObjectURL(img.src), { once: true });
      thumb.appendChild(img);
    } else {
      const icon = document.createElement("i");
      icon.className = attachmentIconForMime(file.type);
      thumb.appendChild(icon);
    }

    const info = document.createElement("div");
    info.className = "attachment-info";
    const name = document.createElement("span");
    name.className = "attachment-name";
    name.textContent = file.name;
    name.title = file.name;
    const meta = document.createElement("span");
    meta.className = "attachment-meta";
    meta.innerHTML = `<span class="attachment-badge">Novo</span> ${formatBytes(file.size)}`;
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "attachment-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "attachment-btn attachment-remove";
    removeBtn.title = "Remover";
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removePendingAttachment(index);
    });
    actions.appendChild(removeBtn);

    li.appendChild(thumb);
    li.appendChild(info);
    li.appendChild(actions);
    list.appendChild(li);
  });

  const dropzone = document.getElementById("attachmentsDropzone");
  if (dropzone) {
    dropzone.classList.toggle(
      "has-files",
      pendingAttachments.length + existingAttachments.length > 0
    );
  }
}

function initAttachmentsDropzone() {
  if (attachmentDropzoneBound) return;
  const dropzone = document.getElementById("attachmentsDropzone");
  const input = document.getElementById("attachmentsInput");
  if (!dropzone || !input) return;

  input.addEventListener("change", () => {
    addPendingAttachments(input.files);
    input.value = "";
  });

  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ["dragenter", "dragover"].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      prevent(e);
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "dragend"].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      prevent(e);
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    prevent(e);
    dropzone.classList.remove("is-dragover");
    if (e.dataTransfer?.files?.length) {
      addPendingAttachments(e.dataTransfer.files);
    }
  });

  attachmentDropzoneBound = true;
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
    { key: "girafa_codigo", label: "Girafa" },
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
    loadProjectAttachments(id);
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
    "alimentador_altura_entrega",
    "girafa_codigo",
    "girafa_altura_recepcao",
    "girafa_altura_entrega",
    "girafa_tipo_produto",
    "girafa_largura_fita",
    "girafa_comprimento_fita",
    "girafa_modelo_fita",
    "girafa_taliscas",
    "girafa_tirantes",
    "esteira_codigo",
    "esteira_altura_recepcao",
    "esteira_altura_entrega",
    "esteira_tipo_produto",
    "esteira_largura_fita",
    "esteira_comprimento_fita",
    "esteira_modelo_fita",
    "esteira_taliscas",
    "esteira_tirantes"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === "checkbox") {
        el.checked = false;
      } else {
        el.value = "";
      }
    }
  });

  resetAttachmentsState();
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

  // ===== GIRAFA =====
  document.getElementById("girafa_codigo").value =
    p.girafa_codigo || "";

  document.getElementById("girafa_altura_recepcao").value =
    p.girafa_altura_recepcao || "";

  document.getElementById("girafa_altura_entrega").value =
    p.girafa_altura_entrega || "";

  document.getElementById("girafa_tipo_produto").value =
    p.girafa_tipo_produto || "";

  document.getElementById("girafa_largura_fita").value =
    p.girafa_largura_fita || "";

  document.getElementById("girafa_comprimento_fita").value =
    p.girafa_comprimento_fita || "";

  document.getElementById("girafa_modelo_fita").value =
    p.girafa_modelo_fita || "";

  document.getElementById("girafa_taliscas").value =
    p.girafa_taliscas || "";

  document.getElementById("girafa_tirantes").checked =
    p.girafa_tirantes === true || p.girafa_tirantes === "true";

  // ===== ESTEIRA =====
  document.getElementById("esteira_codigo").value = p.esteira_codigo || p.esteira || "";
  document.getElementById("esteira_altura_recepcao").value = p.esteira_altura_recepcao || "";
  document.getElementById("esteira_altura_entrega").value = p.esteira_altura_entrega || "";
  document.getElementById("esteira_tipo_produto").value = p.esteira_tipo_produto || "";
  document.getElementById("esteira_largura_fita").value = p.esteira_largura_fita || "";
  document.getElementById("esteira_comprimento_fita").value = p.esteira_comprimento_fita || "";
  document.getElementById("esteira_modelo_fita").value = p.esteira_modelo_fita || "";
  document.getElementById("esteira_taliscas").value = p.esteira_taliscas || "";
  document.getElementById("esteira_tirantes").checked =
    p.esteira_tirantes === true || p.esteira_tirantes === "true";

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
    alimentador_altura_entrega: document.getElementById("alimentador_altura_entrega").value.trim(),
    girafa_codigo: document.getElementById("girafa_codigo").value.trim(),
    girafa_altura_recepcao: document.getElementById("girafa_altura_recepcao").value.trim(),
    girafa_altura_entrega: document.getElementById("girafa_altura_entrega").value.trim(),
    girafa_tipo_produto: document.getElementById("girafa_tipo_produto").value.trim(),
    girafa_largura_fita: document.getElementById("girafa_largura_fita").value.trim(),
    girafa_comprimento_fita: document.getElementById("girafa_comprimento_fita").value.trim(),
    girafa_modelo_fita: document.getElementById("girafa_modelo_fita").value.trim(),
    girafa_taliscas: document.getElementById("girafa_taliscas").value.trim(),
    girafa_tirantes: document.getElementById("girafa_tirantes").checked,
    esteira_codigo: document.getElementById("esteira_codigo").value.trim(),
    esteira: document.getElementById("esteira_codigo").value.trim(),
    esteira_altura_recepcao: document.getElementById("esteira_altura_recepcao").value.trim(),
    esteira_altura_entrega: document.getElementById("esteira_altura_entrega").value.trim(),
    esteira_tipo_produto: document.getElementById("esteira_tipo_produto").value.trim(),
    esteira_largura_fita: document.getElementById("esteira_largura_fita").value.trim(),
    esteira_comprimento_fita: document.getElementById("esteira_comprimento_fita").value.trim(),
    esteira_modelo_fita: document.getElementById("esteira_modelo_fita").value.trim(),
    esteira_taliscas: document.getElementById("esteira_taliscas").value.trim(),
    esteira_tirantes: document.getElementById("esteira_tirantes").checked
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

      await deleteMarkedAttachments(editingId);
      await uploadPendingAttachments(editingId);

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
      const created = await createProject(project);
      const newId = created?.id;

      if (newId) {
        await uploadPendingAttachments(newId);
      }

      await trackLauncherActivity({
        module: "project-manager",
        eventType: "project-create",
        tone: "ok",
        message: `Projeto ${project.obra || "sem nome"} criado`,
        user: currentUser,
        details: {
          projectId: newId,
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
  const filteredProjects = getFilteredProjects();

  tbody.innerHTML = "";

  if (!filteredProjects.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-row">
          Nenhum registro encontrado
        </td>
      </tr>
    `;
    renderKanban();
    return;
  }

  filteredProjects.forEach(p => {
    const tr = document.createElement("tr");
    const createdBy = p.created_by || "Desconhecido";
    const progress = getProjectProgress(p);
    const tone = getProgressTone(progress.percent);
    const esteiraLabel = p.esteira_codigo || p.esteira || "-";

    tr.dataset.projectId = p.id;
    tr.draggable = true;

    tr.innerHTML = `
      <td class="handle-cell" aria-label="Arrastar">
        <span class="drag-handle" title="Arraste para reordenar">
          <i class="fa-solid fa-grip-vertical"></i>
        </span>
      </td>
      <td>${p.obra}</td>
      <td>${p.cliente || "-"}</td>
      <td>${p.unidade || "-"}</td>
      <td>${p.alimentador || "-"}</td>
      <td>${p.girafa_codigo || "-"}</td>
      <td>${esteiraLabel}</td>
      <td>${renderDateChip(p.entrega)}</td>
      <td>${renderDateChip(p.instalacao)}</td>
      <td>
        <button class="progress-pill" type="button" data-progress-id="${p.id}">
          <span class="progress-pill-bar" style="--progress:${progress.percent}%; --progress-fill:${tone.gradient}; --progress-glow-a:${tone.glowA}; --progress-glow-b:${tone.glowB};"></span>
          <span class="progress-pill-text">${progress.percent}%</span>
        </button>
      </td>
    `;

    attachRowDragHandlers(tr);

    tr.addEventListener("click", e => {
      if (e.button !== 0) return;
      if (e.target.closest(".drag-handle")) return;
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

  renderKanban();
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
  currentSummaryProjectId = project?.id || null;

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
  document.getElementById("sum-girafa").textContent = project.girafa_codigo || "-";
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

  /* ===== GIRAFA ===== */
  document.getElementById("sum-girafa-altura-recepcao").textContent =
    project.girafa_altura_recepcao || "-";

  document.getElementById("sum-girafa-altura-entrega").textContent =
    project.girafa_altura_entrega || "-";

  document.getElementById("sum-girafa-tipo-produto").textContent =
    project.girafa_tipo_produto || "-";

  document.getElementById("sum-girafa-largura-fita").textContent =
    project.girafa_largura_fita || "-";

  document.getElementById("sum-girafa-comprimento-fita").textContent =
    project.girafa_comprimento_fita || "-";

  document.getElementById("sum-girafa-modelo-fita").textContent =
    project.girafa_modelo_fita || "-";

  document.getElementById("sum-girafa-taliscas").textContent =
    project.girafa_taliscas || "-";

  document.getElementById("sum-girafa-tirantes").textContent =
    project.girafa_tirantes ? "Sim" : "Não";

  /* ===== CARD DE DESTAQUE GIRAFA (IGUAL AO ALIMENTADOR) ===== */
  const giraCard = document.getElementById("sum-girafa-selecionada");

  if (project.girafa_codigo) {
    giraCard.textContent = project.girafa_codigo;
    giraCard.classList.add("filled");
  } else {
    giraCard.textContent = "Nenhuma girafa informada";
    giraCard.classList.remove("filled");
  }

  /* ===== ESTEIRA ===== */
  const esteiraCodigo = project.esteira_codigo || project.esteira || "";
  document.getElementById("sum-esteira-altura-recepcao").textContent = project.esteira_altura_recepcao || "-";
  document.getElementById("sum-esteira-altura-entrega").textContent = project.esteira_altura_entrega || "-";
  document.getElementById("sum-esteira-tipo-produto").textContent = project.esteira_tipo_produto || "-";
  document.getElementById("sum-esteira-largura-fita").textContent = project.esteira_largura_fita || "-";
  document.getElementById("sum-esteira-comprimento-fita").textContent = project.esteira_comprimento_fita || "-";
  document.getElementById("sum-esteira-modelo-fita").textContent = project.esteira_modelo_fita || "-";
  document.getElementById("sum-esteira-taliscas").textContent = project.esteira_taliscas || "-";
  document.getElementById("sum-esteira-tirantes").textContent = project.esteira_tirantes ? "Sim" : "Não";

  const estCard = document.getElementById("sum-esteira-selecionada");
  if (esteiraCodigo) {
    estCard.textContent = esteiraCodigo;
    estCard.classList.add("filled");
  } else {
    estCard.textContent = "Nenhuma esteira informada";
    estCard.classList.remove("filled");
  }

  /* ===== CONSUMO DE ESTOQUE (vínculo com módulo ESTOQUE) ===== */
  loadStockConsumption(project);

  openModalAnimated(document.getElementById("summaryModal"));
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadStockConsumption(project) {
  const alimList = document.getElementById("stock-list-alimentador");
  const giraList = document.getElementById("stock-list-girafa");
  const alimCount = document.getElementById("stock-count-alimentador");
  const giraCount = document.getElementById("stock-count-girafa");

  // Reset state
  if (alimList) alimList.innerHTML = '<p class="stock-consumption-empty">Carregando...</p>';
  if (giraList) giraList.innerHTML = '<p class="stock-consumption-empty">Carregando...</p>';
  if (alimCount) alimCount.textContent = "0";
  if (giraCount) giraCount.textContent = "0";

  let movements = [];
  try {
    const res = await fetch(`${API_URL}/projects/${project.id}/stock-movements`, {
      headers: getApiHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    movements = await res.json();
  } catch (err) {
    console.error("Erro ao carregar consumo de estoque:", err);
    const errorMsg = '<p class="stock-consumption-empty">⚠️ Falha ao carregar itens de estoque.</p>';
    if (alimList) alimList.innerHTML = errorMsg;
    if (giraList) giraList.innerHTML = errorMsg;
    return;
  }

  const alimMovements = movements.filter(m => m.equipment_type === "alimentador");
  const giraMovements = movements.filter(m => m.equipment_type === "girafa");

  renderStockMovementsList(alimList, alimMovements, "alimentador");
  renderStockMovementsList(giraList, giraMovements, "girafa");
  if (alimCount) alimCount.textContent = String(alimMovements.length);
  if (giraCount) giraCount.textContent = String(giraMovements.length);
}

function renderStockMovementsList(container, movements, equipmentType) {
  if (!container) return;

  if (movements.length === 0) {
    const label = equipmentType === "alimentador" ? "alimentador" : "girafa";
    container.innerHTML = `<p class="stock-consumption-empty">Nenhum item de estoque vinculado a este ${label}.</p>`;
    return;
  }

  // Aggregate by item (sum quantities across multiple saídas)
  const aggregated = new Map();
  for (const m of movements) {
    const key = m.item_code_id || `${m.item_name}|${m.item_code}`;
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        name: m.item_name,
        code: m.item_code,
        category: m.item_category,
        totalQuantity: 0,
        lastDate: m.movement_date,
        occurrences: 0
      });
    }
    const entry = aggregated.get(key);
    entry.totalQuantity += Number(m.quantity || 0);
    entry.occurrences += 1;
    if (new Date(m.movement_date) > new Date(entry.lastDate)) {
      entry.lastDate = m.movement_date;
    }
  }

  const items = Array.from(aggregated.values()).sort((a, b) =>
    new Date(b.lastDate) - new Date(a.lastDate)
  );

  container.innerHTML = items.map(item => `
    <div class="stock-consumption-item">
      <div class="stock-consumption-item-info">
        <p class="stock-consumption-item-name">${escapeHtml(item.name)}</p>
        <p class="stock-consumption-item-meta">
          <span>Código: ${escapeHtml(item.code)}</span>
          <span>${escapeHtml(item.category || "")}</span>
          <span>Última saída: ${formatDateBR(item.lastDate)}</span>
        </p>
      </div>
      <div class="stock-consumption-item-qty">
        <span class="qty-number">${item.totalQuantity}</span>
        <span class="qty-label">${item.occurrences > 1 ? `${item.occurrences} saídas` : "unidades"}</span>
      </div>
    </div>
  `).join("");
}

function closeSummary() {
  closeModalAnimated(document.getElementById("summaryModal"));
  currentSummaryProjectId = null;
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

  // Se for uma string no formato yyyy-mm-dd, faz parse manual
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [year, month, day] = date.split("T")[0].split("-");
    const d = new Date(year, parseInt(month) - 1, day);
    return d.toLocaleDateString("pt-BR");
  }

  // Caso contrário, usa new Date normalmente
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
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
    "Girafa Código",
    "Girafa Altura Recepção",
    "Girafa Altura Entrega",
    "Girafa Tipo Produto",
    "Girafa Largura Fita",
    "Girafa Comprimento Fita",
    "Girafa Modelo Fita",
    "Girafa Taliscas",
    "Girafa Tirantes",
    "Esteira",
    "Esteira Código",
    "Esteira Altura Recepção",
    "Esteira Altura Entrega",
    "Esteira Tipo Produto",
    "Esteira Largura Fita",
    "Esteira Comprimento Fita",
    "Esteira Modelo Fita",
    "Esteira Taliscas",
    "Esteira Tirantes",
    "Entrega",
    "Instalação",
    "Progresso",
    "Observação",
    "Criado por",
    "Data criação",
    "Alimentador Aplicação",
    "Alimentador Tipo Produto",
    "Alimentador Tipo Painel",
    "Alimentador Local Botoeira",
    "Alimentador Altura Entrega"
  ];

  const keys = [
    "id",
    "obra",
    "cliente",
    "unidade",
    "alimentador",
    "girafa",
    "girafa_codigo",
    "girafa_altura_recepcao",
    "girafa_altura_entrega",
    "girafa_tipo_produto",
    "girafa_largura_fita",
    "girafa_comprimento_fita",
    "girafa_modelo_fita",
    "girafa_taliscas",
    "girafa_tirantes",
    "esteira",
    "esteira_codigo",
    "esteira_altura_recepcao",
    "esteira_altura_entrega",
    "esteira_tipo_produto",
    "esteira_largura_fita",
    "esteira_comprimento_fita",
    "esteira_modelo_fita",
    "esteira_taliscas",
    "esteira_tirantes",
    "entrega",
    "instalacao",
    "progresso_percent",
    "observacao",
    "created_by",
    "created_at",
    "alimentador_aplicacao",
    "alimentador_tipo_produto",
    "alimentador_tipo_painel",
    "alimentador_local_botoeira",
    "alimentador_altura_entrega"
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

      if (key === "girafa_tirantes" || key === "esteira_tirantes") {
        value = value ? "Sim" : "Não";
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

/* =========================
   DATE CHIP
========================= */

const MONTH_ABBR_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function renderDateChip(value) {
  if (!value) return `<span class="date-chip date-chip--empty">—</span>`;

  let year, month, day;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split("T")[0].split("-");
    year = Number(y); month = Number(m) - 1; day = Number(d);
  } else {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return `<span class="date-chip date-chip--empty">—</span>`;
    year = d.getFullYear(); month = d.getMonth(); day = d.getDate();
  }

  const today = new Date();
  const target = new Date(year, month, day);
  const diffDays = Math.round((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);

  let tone = "future";
  if (diffDays < 0) tone = "past";
  else if (diffDays <= 7) tone = "soon";

  const label = `${String(day).padStart(2, "0")}/${MONTH_ABBR_PT[month]}`;
  const yearBadge = year !== today.getFullYear() ? `<em>${String(year).slice(-2)}</em>` : "";
  return `<span class="date-chip date-chip--${tone}" title="${formatDateBR(value)}"><i class="fa-regular fa-calendar"></i>${label}${yearBadge}</span>`;
}

/* =========================
   DRAG & DROP REORDER
========================= */

let dragState = { rowId: null, indicator: null };

function attachRowDragHandlers(tr) {
  tr.addEventListener("dragstart", e => {
    if (activeView !== "list") { e.preventDefault(); return; }
    dragState.rowId = tr.dataset.projectId;
    tr.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", tr.dataset.projectId); } catch (_) {}
    }
  });

  tr.addEventListener("dragend", () => {
    tr.classList.remove("dragging");
    clearDropIndicator();
    persistCurrentOrder();
    dragState.rowId = null;
  });

  tr.addEventListener("dragover", e => {
    if (!dragState.rowId || dragState.rowId === tr.dataset.projectId) return;
    e.preventDefault();
    const rect = tr.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    showDropIndicator(tr, before);
  });

  tr.addEventListener("drop", e => {
    e.preventDefault();
    if (!dragState.rowId || dragState.rowId === tr.dataset.projectId) return;
    const tbody = document.getElementById("items");
    const draggingRow = tbody.querySelector(`tr[data-project-id="${dragState.rowId}"]`);
    if (!draggingRow) return;
    const rect = tr.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    if (before) tbody.insertBefore(draggingRow, tr);
    else tbody.insertBefore(draggingRow, tr.nextSibling);
    clearDropIndicator();
  });
}

function showDropIndicator(tr, before) {
  clearDropIndicator();
  const bar = document.createElement("div");
  bar.className = "drop-indicator";
  dragState.indicator = bar;
  document.body.appendChild(bar);
  const rect = tr.getBoundingClientRect();
  bar.style.left = `${rect.left}px`;
  bar.style.width = `${rect.width}px`;
  bar.style.top = `${before ? rect.top : rect.bottom}px`;
}

function clearDropIndicator() {
  if (dragState.indicator) {
    dragState.indicator.remove();
    dragState.indicator = null;
  }
}

async function persistCurrentOrder() {
  const tbody = document.getElementById("items");
  const orderedIds = Array.from(tbody.querySelectorAll("tr[data-project-id]"))
    .map(tr => Number(tr.dataset.projectId))
    .filter(Number.isFinite);

  if (!orderedIds.length) return;

  const previousOrder = projects.map(p => p.id);
  const idIndex = new Map(orderedIds.map((id, i) => [id, i]));
  projects.sort((a, b) => {
    const ai = idIndex.has(a.id) ? idIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = idIndex.has(b.id) ? idIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const sameOrder = previousOrder.every((id, i) => id === projects[i]?.id);
  if (sameOrder) return;

  try {
    await fetch(`${API_URL}/projects/reorder`, {
      method: "PATCH",
      headers: getApiHeaders(),
      body: JSON.stringify({ orderedIds })
    });
  } catch (err) {
    console.error("Erro ao salvar nova ordem:", err);
  }
}

/* =========================
   VIEW TOGGLE (Lista / Kanban)
========================= */

let activeView = "list";

document.addEventListener("click", e => {
  const btn = e.target.closest(".view-toggle-btn");
  if (!btn) return;
  const view = btn.dataset.view;
  if (!view || view === activeView) return;
  setActiveView(view);
});

function setActiveView(view) {
  activeView = view;
  const listEl = document.getElementById("listView");
  const kanbanEl = document.getElementById("kanbanView");
  document.querySelectorAll(".view-toggle-btn").forEach(b => {
    const isActive = b.dataset.view === view;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  if (listEl) listEl.hidden = view !== "list";
  if (kanbanEl) kanbanEl.hidden = view !== "kanban";
  if (view === "kanban") renderKanban();
}

/* =========================
   KANBAN VIEW
========================= */

function renderKanban() {
  const board = document.getElementById("kanbanBoard");
  if (!board) return;

  const list = getFilteredProjects();
  const buckets = new Map(PROGRESS_STAGES.map(s => [s.percent, []]));
  list.forEach(p => {
    const pct = getProjectProgress(p).percent;
    if (!buckets.has(pct)) buckets.set(pct, []);
    buckets.get(pct).push(p);
  });

  board.innerHTML = "";
  PROGRESS_STAGES.forEach(stage => {
    const items = buckets.get(stage.percent) || [];
    const col = document.createElement("div");
    col.className = "kanban-col";
    col.dataset.stage = String(stage.percent);
    const tone = getProgressTone(stage.percent);
    col.style.setProperty("--stage-accent", tone.glowA);

    col.innerHTML = `
      <header class="kanban-col-header">
        <div class="kanban-col-title">
          <span class="kanban-col-dot"></span>
          <strong>${stage.label}</strong>
        </div>
        <span class="kanban-col-count">${items.length}</span>
      </header>
      <div class="kanban-col-body"></div>
    `;

    const body = col.querySelector(".kanban-col-body");
    if (!items.length) {
      body.innerHTML = `<div class="kanban-empty">—</div>`;
    } else {
      items.forEach(p => body.appendChild(buildKanbanCard(p, stage)));
    }

    col.addEventListener("dragover", e => {
      if (!dragState.kanbanCardId) return;
      e.preventDefault();
      col.classList.add("drop-target");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drop-target"));
    col.addEventListener("drop", async e => {
      e.preventDefault();
      col.classList.remove("drop-target");
      const cardId = Number(dragState.kanbanCardId);
      if (!Number.isFinite(cardId)) return;
      const targetPct = Number(col.dataset.stage);
      const project = projects.find(pr => pr.id === cardId);
      if (!project) return;
      const currentPct = getProjectProgress(project).percent;
      if (currentPct === targetPct) return;
      try {
        await updateProjectProgress(cardId, targetPct);
        await trackLauncherActivity({
          module: "project-manager",
          eventType: "project-progress-update",
          tone: "ok",
          message: `Progresso de ${project.obra || "projeto"} alterado para ${targetPct}%`,
          user: currentUser,
          details: {
            projectId: cardId,
            obra: project.obra || "",
            fromPercent: currentPct,
            toPercent: targetPct
          }
        });
      } catch (err) {
        console.error("Erro ao mover card:", err);
      }
    });

    board.appendChild(col);
  });
}

function buildKanbanCard(project, stage) {
  const card = document.createElement("article");
  card.className = "kanban-card";
  card.draggable = true;
  card.dataset.projectId = project.id;
  const tone = getProgressTone(stage.percent);
  card.style.setProperty("--card-accent", tone.glowA);

  card.innerHTML = `
    <div class="kanban-card-title">${project.obra || "Sem obra"}</div>
    <div class="kanban-card-sub">${project.cliente || "Sem cliente"}</div>
    <div class="kanban-card-meta">
      ${project.entrega ? renderDateChip(project.entrega) : ""}
      ${project.alimentador ? `<span class="kanban-chip">${project.alimentador}</span>` : ""}
      ${project.girafa_codigo ? `<span class="kanban-chip">${project.girafa_codigo}</span>` : ""}
    </div>
  `;

  card.addEventListener("dragstart", e => {
    dragState.kanbanCardId = project.id;
    card.classList.add("dragging");
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    dragState.kanbanCardId = null;
    document.querySelectorAll(".kanban-col.drop-target").forEach(c => c.classList.remove("drop-target"));
  });
  card.addEventListener("click", () => openSummary(project));

  return card;
}
