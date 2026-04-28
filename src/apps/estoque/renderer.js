// State management
let currentState = {
  currentView: 'category',
  currentCategory: null,
  currentItem: null,
  items: {
    pneumatica: [],
    fixadores: [],
    eletrica: []
  },
  movementType: null
};

// DOM Elements
const estoque = document.querySelector('.estoque-app');
const categoryView = document.getElementById('categoryView');
const itemsView = document.getElementById('itemsView');
const itemDetailsView = document.getElementById('itemDetailsView');
const categoryTitle = document.getElementById('categoryTitle');
const categorySubtitle = document.getElementById('categorySubtitle');
const itemTitle = document.getElementById('itemTitle');
const itemsList = document.getElementById('itemsList');
const movementsList = document.getElementById('movementsList');
const movementCount = document.getElementById('movementCount');
const toastContainer = document.getElementById('toastContainer');

// Buttons
const btnBackToCategories = document.getElementById('btnBackToCategories');
const btnBackToItems = document.getElementById('btnBackToItems');
const btnAddItem = document.getElementById('btnAddItem');
const btnAddEntry = document.getElementById('btnAddEntry');
const btnAddExit = document.getElementById('btnAddExit');
const btnDeleteItem = document.getElementById('btnDeleteItem');

// Modals
const itemModal = document.getElementById('itemModal');
const itemForm = document.getElementById('itemForm');
const btnCloseItemModal = document.getElementById('btnCloseItemModal');
const btnCancelItemForm = document.getElementById('btnCancelItemForm');
const itemName = document.getElementById('itemName');
const itemCode = document.getElementById('itemCode');
const itemInitialQuantity = document.getElementById('itemInitialQuantity');

const movementModal = document.getElementById('movementModal');
const movementForm = document.getElementById('movementForm');
const btnCloseMovementModal = document.getElementById('btnCloseMovementModal');
const btnCancelMovementForm = document.getElementById('btnCancelMovementForm');
const movementModalTitle = document.getElementById('movementModalTitle');
const movementDate = document.getElementById('movementDate');
const movementQuantity = document.getElementById('movementQuantity');
const movementAddress = document.getElementById('movementAddress');
const exitAddressGroup = document.getElementById('exitAddressGroup');
const btnSubmitMovement = document.getElementById('btnSubmitMovement');

const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');
const btnCancelDelete = document.getElementById('btnCancelDelete');

// Category data
const categories = {
  pneumatica: { name: 'Pneumática', icon: '🔧' },
  fixadores: { name: 'Fixadores', icon: '⚙️' },
  eletrica: { name: 'Elétrica', icon: '⚡' }
};

// Initialize
async function init() {
  console.log('Inicializando módulo Estoque...');
  setDefaultDate();
  await loadData();
  attachEventListeners();
  renderCategoryView();
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  movementDate.value = today;
}

async function loadData() {
  try {
    const data = await window.api.loadEstoqueData();
    console.log('Dados carregados:', data);
    if (data && data.items) {
      currentState.items = data.items;
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showToast('Erro ao carregar dados do estoque', 'error');
  }
}

async function saveData() {
  try {
    await window.api.saveEstoqueData(currentState.items);
    console.log('Dados salvos com sucesso');
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    showToast('Erro ao salvar dados do estoque', 'error');
  }
}

// Event Listeners
function attachEventListeners() {
  console.log('Anexando event listeners...');

  // Category buttons - CORRIGIDO PARA .category-btn
  const categoryBtns = document.querySelectorAll('.category-btn');
  console.log('Botões de categoria encontrados:', categoryBtns.length);

  categoryBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.dataset.category;
      console.log('Categoria clicada:', category);
      selectCategory(category);
    });
  });

  // Navigation
  btnBackToCategories.addEventListener('click', goToCategories);
  btnBackToItems.addEventListener('click', goToItems);

  // Item actions
  btnAddItem.addEventListener('click', openItemModal);
  btnAddEntry.addEventListener('click', () => openMovementModal('entrada'));
  btnAddExit.addEventListener('click', () => openMovementModal('saida'));
  btnDeleteItem.addEventListener('click', openDeleteModal);

  // Item form
  itemForm.addEventListener('submit', handleAddItem);
  btnCloseItemModal.addEventListener('click', closeItemModal);
  btnCancelItemForm.addEventListener('click', closeItemModal);

  // Movement form
  movementForm.addEventListener('submit', handleAddMovement);
  btnCloseMovementModal.addEventListener('click', closeMovementModal);
  btnCancelMovementForm.addEventListener('click', closeMovementModal);

  // Delete confirmation
  btnConfirmDelete.addEventListener('click', handleDeleteItem);
  btnCancelDelete.addEventListener('click', closeDeleteModal);

  // Click outside modals to close
  document.addEventListener('click', (e) => {
    if (e.target === itemModal) closeItemModal();
    if (e.target === movementModal) closeMovementModal();
    if (e.target === confirmDeleteModal) closeDeleteModal();
  });

  console.log('Event listeners anexados com sucesso');
}

// Navigation
function switchView(viewName) {
  console.log('Mudando para view:', viewName);
  categoryView.classList.remove('view-active');
  itemsView.classList.remove('view-active');
  itemDetailsView.classList.remove('view-active');

  switch (viewName) {
    case 'category':
      categoryView.classList.add('view-active');
      break;
    case 'items':
      itemsView.classList.add('view-active');
      break;
    case 'details':
      itemDetailsView.classList.add('view-active');
      break;
  }

  currentState.currentView = viewName;
}

function selectCategory(categoryKey) {
  console.log('Selecionando categoria:', categoryKey);
  currentState.currentCategory = categoryKey;
  renderItemsView();
  switchView('items');
}

function goToCategories() {
  currentState.currentItem = null;
  renderCategoryView();
  switchView('category');
}

function goToItems() {
  currentState.currentItem = null;
  renderItemsView();
  switchView('items');
}

// Rendering
function renderCategoryView() {
  console.log('Renderizando category view');
  // CORRIGIDO PARA .category-badge
  document.querySelectorAll('.category-badge').forEach(el => {
    const cat = el.dataset.count;
    const count = (currentState.items[cat] || []).length;
    el.textContent = count;
  });
}

function renderItemsView() {
  const category = currentState.currentCategory;
  const categoryData = categories[category];

  console.log('Renderizando items view para:', category);

  if (!categoryData) {
    showToast('Categoria inválida', 'error');
    return;
  }

  categoryTitle.textContent = categoryData.name;
  categorySubtitle.textContent = `${(currentState.items[category] || []).length} itens`;

  const items = currentState.items[category] || [];
  itemsList.innerHTML = '';

  if (items.length === 0) {
    itemsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${categoryData.icon}</div>
        <p>Nenhum item nesta categoria</p>
        <p style="font-size: 11px; margin-top: 4px;">Use o botão "+ Novo Item" para adicionar</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const quantity = item.quantity || 0;
    const isLow = quantity < 5;

    const card = document.createElement('div');
    card.className = 'item-card';

    card.innerHTML = `
      <div class="item-card-info">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.code)}</p>
      </div>
      <div class="item-card-qty ${isLow ? 'low' : ''}">${quantity}</div>
      <div class="item-card-arrow">→</div>
    `;

    card.addEventListener('click', () => viewItem(item.id));
    itemsList.appendChild(card);
  });
}

function renderItemDetailsView() {
  const item = currentState.currentItem;
  if (!item) return;

  console.log('Renderizando details view para:', item.name);

  itemTitle.textContent = item.name;
  document.getElementById('detailItemName').textContent = escapeHtml(item.name);
  document.getElementById('detailItemCode').textContent = escapeHtml(item.code);

  const quantity = item.quantity || 0;
  const quantityBadge = document.getElementById('detailItemQuantity');
  quantityBadge.textContent = quantity;
  quantityBadge.classList.toggle('low', quantity < 5);

  const movements = item.movements || [];
  if (movements.length > 0) {
    const lastMovement = movements[movements.length - 1];
    const date = new Date(lastMovement.date).toLocaleDateString('pt-BR');
    const type = lastMovement.type === 'entrada' ? 'Entrada' : 'Saída';
    document.getElementById('detailLastMovement').textContent = `${date} (${type})`;
  } else {
    document.getElementById('detailLastMovement').textContent = 'Nenhuma movimentação';
  }

  renderMovements();
}

function renderMovements() {
  const item = currentState.currentItem;
  if (!item) return;

  const movements = item.movements || [];
  movementsList.innerHTML = '';
  movementCount.textContent = movements.length;

  if (movements.length === 0) {
    movementsList.innerHTML = `
      <li class="empty-state" style="margin: 20px; text-align: center; color: var(--text-muted);">
        <p style="margin: 0; font-size: 13px;">Nenhuma movimentação registrada</p>
      </li>
    `;
    return;
  }

  // Sort by date descending
  const sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(movement => {
    const li = document.createElement('li');
    li.className = 'movement-item';

    const date = new Date(movement.date).toLocaleDateString('pt-BR');
    const type = movement.type === 'entrada' ? 'Entrada' : 'Saída';
    const badge = movement.type === 'entrada' ? '↓' : '↑';
    const badgeClass = movement.type;

    let addressInfo = '';
    if (movement.address) {
      addressInfo = `<small>Endereço: ${escapeHtml(movement.address)}</small>`;
    }

    li.innerHTML = `
      <div class="movement-badge ${badgeClass}">${badge}</div>
      <div class="movement-info">
        <p>${type}</p>
        <small>${date}</small>
        ${addressInfo}
      </div>
      <div class="movement-qty">+${movement.quantity}</div>
    `;

    movementsList.appendChild(li);
  });
}

function viewItem(itemId) {
  const category = currentState.currentCategory;
  const item = (currentState.items[category] || []).find(i => i.id === itemId);
  if (item) {
    currentState.currentItem = item;
    renderItemDetailsView();
    switchView('details');
  }
}

// Item Management
function openItemModal() {
  itemForm.reset();
  itemName.focus();
  itemModal.classList.remove('is-hidden');
}

function closeItemModal() {
  itemModal.classList.add('is-hidden');
  itemForm.reset();
}

async function handleAddItem(e) {
  e.preventDefault();

  const name = itemName.value.trim();
  const code = itemCode.value.trim();
  const quantity = parseInt(itemInitialQuantity.value) || 0;

  if (!name || !code) {
    showToast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  const category = currentState.currentCategory;
  const id = `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const newItem = {
    id,
    name,
    code,
    quantity,
    movements: quantity > 0 ? [{
      type: 'entrada',
      date: new Date().toISOString().split('T')[0],
      quantity,
      address: null
    }] : []
  };

  if (!currentState.items[category]) {
    currentState.items[category] = [];
  }

  currentState.items[category].push(newItem);
  await saveData();
  renderItemsView();
  renderCategoryView();
  closeItemModal();
  showToast('✓ Item adicionado com sucesso', 'success');
}

// Movement Management
function openMovementModal(type) {
  currentState.movementType = type;
  movementForm.reset();
  setDefaultDate();

  if (type === 'entrada') {
    movementModalTitle.textContent = '↓ Registrar Entrada';
    exitAddressGroup.classList.add('is-hidden');
  } else {
    movementModalTitle.textContent = '↑ Registrar Saída';
    exitAddressGroup.classList.remove('is-hidden');
  }

  btnSubmitMovement.textContent = 'Registrar Movimentação';
  movementModal.classList.remove('is-hidden');
  movementQuantity.focus();
}

function closeMovementModal() {
  movementModal.classList.add('is-hidden');
  movementForm.reset();
  currentState.movementType = null;
}

async function handleAddMovement(e) {
  e.preventDefault();

  const date = movementDate.value;
  const quantity = parseInt(movementQuantity.value) || 0;
  const address = movementAddress.value.trim() || null;

  if (!date || quantity <= 0) {
    showToast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  const type = currentState.movementType;
  const item = currentState.currentItem;

  const movement = {
    type,
    date,
    quantity,
    address: type === 'saida' ? address : null
  };

  if (!item.movements) {
    item.movements = [];
  }

  item.movements.push(movement);

  // Update quantity
  if (type === 'entrada') {
    item.quantity = (item.quantity || 0) + quantity;
  } else {
    item.quantity = Math.max(0, (item.quantity || 0) - quantity);
  }

  const category = currentState.currentCategory;
  const itemIndex = (currentState.items[category] || []).findIndex(i => i.id === item.id);
  if (itemIndex >= 0) {
    currentState.items[category][itemIndex] = item;
  }

  await saveData();
  renderItemDetailsView();
  renderItemsView();
  renderCategoryView();
  closeMovementModal();
  showToast('✓ Movimentação registrada com sucesso', 'success');
}

// Delete Management
function openDeleteModal() {
  confirmDeleteModal.classList.remove('is-hidden');
}

function closeDeleteModal() {
  confirmDeleteModal.classList.add('is-hidden');
}

async function handleDeleteItem() {
  const item = currentState.currentItem;
  const category = currentState.currentCategory;

  const items = currentState.items[category] || [];
  const index = items.findIndex(i => i.id === item.id);

  if (index >= 0) {
    const itemName = items[index].name;
    items.splice(index, 1);
    await saveData();
    renderItemsView();
    renderCategoryView();
    closeDeleteModal();
    goToItems();
    showToast(`✓ Item "${itemName}" deletado com sucesso`, 'success');
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlide 0.3s cubic-bezier(0.22, 1, 0.36, 1) reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Helpers
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Start
window.addEventListener('DOMContentLoaded', init);
// Also call init immediately in case DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
