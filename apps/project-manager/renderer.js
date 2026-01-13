let data = {
  obras: [],
  locais: [],
  alimentadores: []
};

let currentType = "obras";
let editingId = null;
let deleteId = null;
let modal;
let list;
let count;


/* =========================
   🚀 CARREGA DADOS AO ABRIR
========================= */
window.onload = async () => {
  modal = document.getElementById("modal");
  count = document.getElementById("count-obras");
  data = await window.api.loadProjectData();
  render();
};


/* =========================
   📂 ABRIR GERENCIADOR
========================= */
function openManager(type) {
  currentType = type;
  editingId = null;
  render();
}

/* =========================
   ➕✏️ MODAL
========================= */
function openModal(id = null) {
  modal.style.display = "flex";
  editingId = null;

  document.getElementById("obra").value = "";
  document.getElementById("local").value = "";
  document.getElementById("alimentador").value = "";
  document.getElementById("observacao").value = "";
  document.getElementById("girafa").value = "";
  document.getElementById("esteira").value = "";
  document.getElementById("entrega").value = "";
  document.getElementById("instalacao").value = "";

  if (id) {
    const item = data[currentType].find(i => i.id === id);
    if (item) {
      editingId = id;
      document.getElementById("obra").value = item.obra;
      document.getElementById("local").value = item.local;
      document.getElementById("alimentador").value = item.alimentador;
      document.getElementById("observacao").value = item.observacao;
      document.getElementById("girafa").value = item.girafa;
      document.getElementById("esteira").value = item.esteira;
      document.getElementById("entrega").value = item.entrega || "";
      document.getElementById("instalacao").value = item.instalacao || "";
    }
  }

  setTimeout(() => {
    document.getElementById("obra").focus();
    enableKeyboardNavigation();
  }, 0);
}



function askDelete(id) {
  deleteId = id;
  document.getElementById("confirmModal").style.display = "flex";
}

function closeConfirm() {
  deleteId = null;
  document.getElementById("confirmModal").style.display = "none";
}



function closeModal() {
  modal.style.display = "none";
  editingId = null;
}




/* =========================
   💾 SALVAR (CREATE / UPDATE)
========================= */
async function save() {
  const item = {
    id: editingId || Date.now(),
    obra: document.getElementById("obra").value.trim(),
    local: document.getElementById("local").value.trim(),
    alimentador: document.getElementById("alimentador").value.trim(),
    observacao: document.getElementById("observacao").value.trim(),
    girafa: document.getElementById("girafa").value.trim(),
    esteira: document.getElementById("esteira").value.trim(),
    entrega: document.getElementById("entrega").value,
    instalacao: document.getElementById("instalacao").value
  };

  if (!item.obra || !item.local || !item.observacao) {
    showValidation("Obra, Local e Observação são obrigatórios.");
    return;
  }

  if (editingId) {
    const index = data[currentType].findIndex(i => i.id === editingId);
    data[currentType][index] = item;
  } else {
    data[currentType].push(item);
  }

  await window.api.saveProjectData(data);
  closeModal();
  render();
}



/* =========================
   🗑️ REMOVER
========================= */
async function removeItem(id) {
  // ❌ NÃO usar confirm() em Electron
  const ok = true; // depois trocamos por modal próprio
  if (!ok) return;

  data[currentType] = data[currentType].filter(i => i.id !== id);
  editingId = null;

  await window.api.saveProjectData(data);
  render();
}

async function confirmDelete() {
  if (!deleteId) return;

  data[currentType] = data[currentType].filter(i => i.id !== deleteId);
  deleteId = null;

  await window.api.saveProjectData(data);
  document.getElementById("confirmModal").style.display = "none";
  render();
}




/* =========================
   📋 RENDER
========================= */
function render() {
  const tbody = document.getElementById("items");
  tbody.innerHTML = "";

  const items = data[currentType];

  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="9" style="color:#94a3b8; text-align:center;">
        Nenhum registro cadastrado
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  items.forEach(i => {
    const tr = document.createElement("tr");
      tr.innerHTML = `
    <td>${i.obra}</td>
    <td>${i.local}</td>
    <td>${i.alimentador}</td>
    <td>${i.observacao}</td>
    <td>${i.girafa}</td>
    <td>${i.esteira}</td>
    <td>${formatDateBR(i.entrega)}</td>
    <td>${formatDateBR(i.instalacao)}</td>
    <td>
      <button onclick="openModal(${i.id})">✏️</button>
      <button onclick="askDelete(${i.id})">🗑️</button>
    </td>
  `;

    tbody.appendChild(tr);
  });
}


function enableKeyboardNavigation() {
  const fields = Array.from(
    document.querySelectorAll("#modal [data-field]")
  );

  fields.forEach((field, index) => {
    field.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();

        if (e.shiftKey) {
          // volta
          if (index > 0) fields[index - 1].focus();
        } else {
          // avança
          if (index < fields.length - 1) {
            fields[index + 1].focus();
          } else {
            save(); // último campo → salva
          }
        }
      }

      if (e.key === "Escape") {
        closeModal();
      }
    });
  });
}

function showValidation(message) {
  document.getElementById("validationMessage").textContent = message;
  document.getElementById("validationModal").style.display = "flex";
}

function closeValidation() {
  document.getElementById("validationModal").style.display = "none";

  // devolve foco ao primeiro campo obrigatório
  setTimeout(() => {
    document.getElementById("obra").focus();
  }, 0);
}

function formatDateBR(date) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}



