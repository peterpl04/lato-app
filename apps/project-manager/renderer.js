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
  currentUser = await window.api.getLoggedUser();
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
   MODAL
========================= */

function closeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

document.addEventListener("click", e => {
  if (!e.target.classList.contains("tab")) return;

  const tabName = e.target.dataset.tab;

  // botão ativo
  document.querySelectorAll(".modal-tabs .tab")
    .forEach(b => b.classList.remove("active"));
  e.target.classList.add("active");

  // conteúdo ativo
  document.querySelectorAll(".tab-content")
    .forEach(c => c.classList.remove("active"));

  document.getElementById(`tab-${tabName}`)
    .classList.add("active");
});


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

  // Fecha ao clicar fora
  setTimeout(() => {
    document.addEventListener("click", closeContextMenu, { once: true });
  }, 0);
}


function openModal(id = null) {
  modal.style.display = "flex";
  editingId = id;

  clearForm();

  if (id) {
    const p = projects.find(p => p.id === id);
    if (p) fillForm(p);
  }

  setTimeout(() => {
    document.getElementById("obra").focus();
    enableKeyboardNavigation();
  }, 0);
}

function closeModal() {
  modal.style.display = "none";
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
   SAVE (CREATE / UPDATE)
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
  document.getElementById("confirmModal").style.display = "flex";
}

function closeConfirm() {
  deleteId = null;
  document.getElementById("confirmModal").style.display = "none";
}

async function confirmDelete() {
  if (!deleteId) return;

  try {
    await deleteProject(deleteId);
  } catch (err) {
    console.error("Erro ao excluir:", err);
  }

  deleteId = null;
  document.getElementById("confirmModal").style.display = "none";
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
  <td class="obs-cell">
    ${p.observacao}
  </td>
`;

    tr.addEventListener("contextmenu", e => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, p.id);
    });


    // 🖱️ Hover inteligente seguindo o mouse
    tr.addEventListener("mousemove", e => {
      tooltip.style.left = e.clientX + 14 + "px";
      tooltip.style.top = e.clientY + 14 + "px";
      tooltip.innerHTML = `Adicionado por <strong>${createdBy}</strong>`;
      tooltip.style.opacity = "1";
      tooltip.style.transform = "translateY(0)";
    });

    tr.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(6px)";
    });

    tbody.appendChild(tr);
  });
}

/* =========================
   HELPERS
========================= */

function formatDateBR(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

/* =========================
   VALIDATION MODAL
========================= */

function showValidation(message) {
  document.getElementById("validationMessage").textContent = message;
  document.getElementById("validationModal").style.display = "flex";
}

function closeValidation() {
  document.getElementById("validationModal").style.display = "none";
  setTimeout(() => document.getElementById("obra").focus(), 0);
}

/* =========================
   KEYBOARD NAVIGATION
========================= */

function enableKeyboardNavigation() {
  const fields = Array.from(
    document.querySelectorAll("#modal input")
  );

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
