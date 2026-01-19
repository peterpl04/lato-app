/* =========================
   CONFIG
========================= */

const API_URL = "https://lato-app-production.up.railway.app";

let projects = [];
let editingId = null;
let deleteId = null;

const modal = document.getElementById("modal");

let currentUser = "Usuário desconhecido";
let contextMenu;

/* =========================
   SOCKET.IO
========================= */

const socket = io(API_URL);

socket.on("connect", () => {
  console.log("🟢 Conectado ao servidor em tempo real");
});

socket.on("projects:update", () => {
  loadProjects();
});

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    currentUser = await window.api.getLoggedUser();
  } catch {
    currentUser = "Usuário desconhecido";
  }

  loadProjects();
});

/* =========================
   API
========================= */

async function loadProjects() {
  try {
    const res = await fetch(`${API_URL}/projects`);
    projects = await res.json();
    renderTable();
  } catch (err) {
    console.error("Erro ao carregar projetos:", err);
  }
}

async function createProject(project) {
  await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project)
  });
}

async function updateProject(id, project) {
  await fetch(`${API_URL}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project)
  });
}

async function deleteProject(id) {
  await fetch(`${API_URL}/projects/${id}`, {
    method: "DELETE"
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
    enableKeyboardNavigation();
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
    "girafa",
    "esteira",
    "entrega",
    "instalacao"
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
  document.getElementById("girafa").value = p.girafa || "";
  document.getElementById("esteira").value = p.esteira || "";
  document.getElementById("entrega").value = p.entrega ? p.entrega.split("T")[0] : "";
  document.getElementById("instalacao").value = p.instalacao ? p.instalacao.split("T")[0] : "";
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
    girafa: document.getElementById("girafa").value.trim(),
    esteira: document.getElementById("esteira").value.trim(),
    entrega: document.getElementById("entrega").value || null,
    instalacao: document.getElementById("instalacao").value || null,
    observacao: document.getElementById("observacao").value.trim(),
    createdBy: currentUser
  };

  if (!project.obra || !project.cliente || !project.observacao) {
    showValidation("Obra, Cliente e Observação são obrigatórios.");
    return;
  }

  try {
    if (editingId) {
      await updateProject(editingId, project);
    } else {
      await createProject(project);
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

async function confirmDelete() {
  if (!deleteId) return;

  try {
    await deleteProject(deleteId);
  } catch (err) {
    console.error("Erro ao excluir:", err);
  }

  deleteId = null;
  closeModalAnimated(document.getElementById("confirmModal"));
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
        <td colspan="9" style="text-align:center; color:#94a3b8;">
          Nenhum registro cadastrado
        </td>
      </tr>
    `;
    return;
  }

  projects.forEach(p => {
    const tr = document.createElement("tr");
    const createdBy = p.created_by || "Desconhecido";

    tr.innerHTML = `
      <td>${p.obra}</td>
      <td>${p.cliente || "-"}</td>
      <td>${p.unidade || "-"}</td>
      <td>${p.alimentador || "-"}</td>
      <td>${p.girafa || "-"}</td>
      <td>${p.esteira || "-"}</td>
      <td>${formatDateBR(p.entrega)}</td>
      <td>${formatDateBR(p.instalacao)}</td>
      <td class="obs-cell">${p.observacao}</td>
    `;

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

    tbody.appendChild(tr);
  });
}

/* =========================
   SUMMARY MODAL
========================= */

function openSummary(project) {
  document.getElementById("sum-obra").textContent = project.obra || "-";
  document.getElementById("sum-cliente").textContent = project.cliente || "-";
  document.getElementById("sum-unidade").textContent = project.unidade || "-";
  document.getElementById("sum-alimentador").textContent = project.alimentador || "-";
  document.getElementById("sum-girafa").textContent = project.girafa || "-";
  document.getElementById("sum-esteira").textContent = project.esteira || "-";
  document.getElementById("sum-entrega").textContent = formatDateBR(project.entrega);
  document.getElementById("sum-instalacao").textContent = formatDateBR(project.instalacao);
  document.getElementById("sum-observacao").textContent = project.observacao || "-";

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
  });
}
