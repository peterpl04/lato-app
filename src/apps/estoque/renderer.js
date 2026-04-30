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
  movementType: null,
  fixadorSelection: {
    type: null,
    size: null
  },
  activeFilters: {
    type: null,
    size: null,
    medida: null
  },
  modalMode: 'add' // 'add' or 'filter'
};

// API Configuration
const API_BASE_URL = "https://lato-app-production.up.railway.app";
const REQUEST_TIMEOUT = 10000;

// Helper para fazer requisições
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-App-Env': 'prod'
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
      timeout: REQUEST_TIMEOUT
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

// DOM Elements
const estoque = document.querySelector('.estoque-app');
const categoryView = document.getElementById('categoryView');
const itemsView = document.getElementById('itemsView');
const itemDetailsView = document.getElementById('itemDetailsView');
const itemsLoading = document.getElementById('itemsLoading');
const detailsLoading = document.getElementById('detailsLoading');
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
const btnFilterItems = document.getElementById('btnFilterItems');
const btnClearActiveFilters = document.getElementById('btnClearActiveFilters');
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

// Fixador Modals
const fixadorTypeModal = document.getElementById('fixadorTypeModal');
const fixadorSizeModal = document.getElementById('fixadorSizeModal');
const btnCloseFixadorTypeModal = document.getElementById('btnCloseFixadorTypeModal');
const btnCloseFixadorSizeModal = document.getElementById('btnCloseFixadorSizeModal');
const fixadorSizeTitle = document.getElementById('fixadorSizeTitle');

// Filter elements
const filterExtraFields = document.getElementById('filterExtraFields');
const filterMedida = document.getElementById('filterMedida');
const btnApplyFilter = document.getElementById('btnApplyFilter');
const btnClearFilter = document.getElementById('btnClearFilter');
const activeFilters = document.getElementById('activeFilters');
const filterTags = document.getElementById('filterTags');
const btnClearAllFilters = document.getElementById('btnClearAllFilters');

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
  initBatchExitSystem();
  renderCategoryView();

  // Iniciar sistema de atualizações em tempo real
  startRealTimeUpdates();
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  movementDate.value = today;
}

// Real-time updates system
let pollingInterval = null;
let isPolling = false;
let lastDataHash = null;
const POLLING_INTERVAL = 5000; // 5 segundos

// Função para gerar hash dos dados para detectar mudanças
function generateDataHash(data) {
  return JSON.stringify(data).length + '_' + Object.keys(data).map(category =>
    (data[category] || []).reduce((sum, item) => sum + (item.quantity || 0), 0)
  ).join('_');
}

// Função para detectar se houve mudanças nos dados
function hasDataChanged(newData) {
  const newHash = generateDataHash(newData);
  if (lastDataHash === null) {
    lastDataHash = newHash;
    return false;
  }

  if (newHash !== lastDataHash) {
    lastDataHash = newHash;
    return true;
  }

  return false;
}

async function loadData() {
  try {
    console.log('Carregando dados do estoque...');

    for (const category of Object.keys(categories)) {
      const items = await apiCall(`/estoque/items/${category}`);

      // Buscar movimentações para cada item
      const itemsWithMovements = await Promise.all(
        items.map(async (item) => {
          try {
            const data = await apiCall(`/estoque/items/${item.item_id}/movements`);

            // Mapear movimentos para o formato correto
            const movements = (data.movements || []).map(m => ({
              id: m.id,
              type: m.movement_type,
              date: m.movement_date,
              quantity: m.quantity,
              address: m.address
            }));

            return {
              id: item.item_id,
              name: item.name,
              code: item.code,
              quantity: item.quantity,
              movements
            };
          } catch (err) {
            console.error(`Erro ao carregar movimentos do item ${item.item_id}:`, err);
            return {
              id: item.item_id,
              name: item.name,
              code: item.code,
              quantity: item.quantity,
              movements: []
            };
          }
        })
      );

      currentState.items[category] = itemsWithMovements;
    }

    console.log('Dados carregados com sucesso:', currentState.items);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showToast('⚠️ Erro ao carregar dados do estoque', 'error');
  }
}

async function saveData() {
  // Dados são salvos automaticamente na API via endpoints individuais
  console.log('Dados sincronizados com banco de dados');
}

// Real-time updates functions
async function loadDataSilently() {
  try {
    const newData = {};

    for (const category of Object.keys(categories)) {
      const items = await apiCall(`/estoque/items/${category}`);

      const itemsWithMovements = await Promise.all(
        items.map(async (item) => {
          try {
            const data = await apiCall(`/estoque/items/${item.item_id}/movements`);

            const movements = (data.movements || []).map(m => ({
              id: m.id,
              type: m.movement_type,
              date: m.movement_date,
              quantity: m.quantity,
              address: m.address
            }));

            return {
              id: item.item_id,
              name: item.name,
              code: item.code,
              quantity: item.quantity,
              movements
            };
          } catch (err) {
            console.error(`Erro ao carregar movimentos do item ${item.item_id}:`, err);
            return {
              id: item.item_id,
              name: item.name,
              code: item.code,
              quantity: item.quantity,
              movements: []
            };
          }
        })
      );

      newData[category] = itemsWithMovements;
    }

    // Verificar se houve mudanças
    if (hasDataChanged(newData)) {
      console.log('🔄 Dados atualizados detectados, sincronizando interface...');

      // Atualizar dados locais
      currentState.items = newData;

      // Atualizar interface baseado na view atual
      if (currentState.currentView === 'categories') {
        renderCategoryView();
      } else if (currentState.currentView === 'items') {
        renderItemsView();
      } else if (currentState.currentView === 'details' && currentState.currentItem) {
        // Atualizar item atual com dados frescos
        const category = currentState.currentCategory;
        const updatedItem = (currentState.items[category] || []).find(i => i.id === currentState.currentItem.id);
        if (updatedItem) {
          currentState.currentItem = updatedItem;
          renderItemDetailsView();
        }
      }

      // Mostrar notificação discreta
      showToast('📊 Dados atualizados automaticamente', 'info', 2000);
    }

  } catch (error) {
    console.error('Erro no polling de dados:', error);
    // Não mostrar toast para evitar spam de erros
  }
}

function startRealTimeUpdates() {
  if (isPolling) return;

  isPolling = true;
  console.log('🔄 Sistema de atualizações em tempo real iniciado');

  pollingInterval = setInterval(() => {
    // Só fazer polling se a aba estiver ativa
    if (!document.hidden) {
      loadDataSilently();
    }
  }, POLLING_INTERVAL);

  // Pausar polling quando aba não está ativa (economizar recursos)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('⏸️ Aba inativa, pausando atualizações');
    } else {
      console.log('▶️ Aba ativa, retomando atualizações');
      // Fazer uma verificação imediata quando voltar
      loadDataSilently();
    }
  });
}

function stopRealTimeUpdates() {
  if (!isPolling) return;

  isPolling = false;
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  console.log('⏹️ Sistema de atualizações em tempo real parado');
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
  btnFilterItems.addEventListener('click', openFilterModal);
  btnClearActiveFilters.addEventListener('click', clearAllFilters);
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

  // Clear validation errors on input
  movementAddress.addEventListener('input', () => {
    movementAddress.classList.remove('required-error');
  });

  batchExitAddress.addEventListener('input', () => {
    batchExitAddress.classList.remove('required-error');
  });

  // Delete confirmation
  btnConfirmDelete.addEventListener('click', handleDeleteItem);
  btnCancelDelete.addEventListener('click', closeDeleteModal);

  // Fixador modals
  btnCloseFixadorTypeModal.addEventListener('click', closeFixadorTypeModal);
  btnCloseFixadorSizeModal.addEventListener('click', closeFixadorSizeModal);

  // Filter actions
  btnApplyFilter.addEventListener('click', applyFilter);
  btnClearFilter.addEventListener('click', clearCurrentFilter);
  btnClearAllFilters.addEventListener('click', clearAllFilters);

  // Click outside modals to close
  document.addEventListener('click', (e) => {
    if (e.target === itemModal) closeItemModal();
    if (e.target === movementModal) closeMovementModal();
    if (e.target === confirmDeleteModal) closeDeleteModal();
    if (e.target === fixadorTypeModal) closeFixadorTypeModal();
    if (e.target === fixadorSizeModal) closeFixadorSizeModal();
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
  showItemsLoading();
  renderItemsView();
  switchView('items');
  setTimeout(() => hideItemsLoading(), 300);
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

  // Show/hide fixadores-specific buttons
  if (category === 'fixadores') {
    btnFilterItems.style.display = 'flex';
    btnBatchExit.style.display = 'flex';

    // Show clear filters button only when there are active filters
    if (hasActiveFilters()) {
      btnClearActiveFilters.style.display = 'flex';
    } else {
      btnClearActiveFilters.style.display = 'none';
    }
  } else {
    btnFilterItems.style.display = 'none';
    btnClearActiveFilters.style.display = 'none';
    btnBatchExit.style.display = 'none';
  }

  let items = currentState.items[category] || [];

  // Apply filters if active
  items = applyActiveFilters(items);

  categorySubtitle.textContent = `${items.length} itens`;

  itemsList.innerHTML = '';

  if (items.length === 0) {
    const hasFilters = hasActiveFilters();
    itemsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${categoryData.icon}</div>
        <p>${hasFilters ? 'Nenhum item encontrado com os filtros aplicados' : 'Nenhum item nesta categoria'}</p>
        <p style="font-size: 11px; margin-top: 4px;">${hasFilters ? 'Tente ajustar ou limpar os filtros' : 'Use o botão "+ Novo Item" para adicionar'}</p>
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
      <div class="item-card-info" onclick="viewItem('${item.id}')">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.code)}</p>
      </div>
      <div class="item-card-qty-section">
        <div class="item-card-actions">
          <button class="btn-inline-entry" onclick="openInlineMovementModal('entrada', '${item.id}')" title="Registrar Entrada">
            <span class="icon">↓</span>
          </button>
          <button class="btn-inline-exit" onclick="openInlineMovementModal('saida', '${item.id}')" title="Registrar Saída">
            <span class="icon">↑</span>
          </button>
        </div>
        <div class="item-card-qty ${isLow ? 'low' : ''}">${quantity}</div>
      </div>
      <div class="item-card-arrow" onclick="viewItem('${item.id}')">→</div>
    `;

    itemsList.appendChild(card);
  });

  // Update active filters display
  updateActiveFiltersDisplay();
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
    try {
      const dateObj = new Date(lastMovement.date);
      const date = dateObj.toLocaleDateString('pt-BR');
      const type = lastMovement.type === 'entrada' ? 'Entrada' : 'Saída';
      document.getElementById('detailLastMovement').textContent = `${date} (${type})`;
    } catch (e) {
      document.getElementById('detailLastMovement').textContent = `${lastMovement.date} (${lastMovement.type === 'entrada' ? 'Entrada' : 'Saída'})`;
    }
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
  const sorted = [...movements].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  sorted.forEach(movement => {
    const li = document.createElement('li');
    li.className = 'movement-item';

    let dateStr = 'Data inválida';
    try {
      const dateObj = new Date(movement.date);
      dateStr = dateObj.toLocaleDateString('pt-BR');
    } catch (e) {
      dateStr = movement.date || 'Data inválida';
    }

    const type = movement.type === 'entrada' ? 'Entrada' : 'Saída';
    const badge = movement.type === 'entrada' ? '↓' : '↑';
    const badgeClass = movement.type === 'entrada' ? 'entrada' : 'saida';
    const quantityDisplay = movement.type === 'entrada' ? `+${movement.quantity}` : `-${movement.quantity}`;
    const quantityClass = movement.type === 'entrada' ? 'positive' : 'negative';

    let addressInfo = '';
    if (movement.address) {
      addressInfo = `<small>Endereço: ${escapeHtml(movement.address)}</small>`;
    }

    li.innerHTML = `
      <div class="movement-badge ${badgeClass}">${badge}</div>
      <div class="movement-info">
        <p>${type}</p>
        <small>${dateStr}</small>
        ${addressInfo}
      </div>
      <div class="movement-qty ${quantityClass}">${quantityDisplay}</div>
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
    // Navegação instantânea - sem loading para dados já carregados
  }
}

// Item Management
function openItemModal() {
  // Se a categoria atual for fixadores, abrir o fluxo especializado
  if (currentState.currentCategory === 'fixadores') {
    currentState.modalMode = 'add';
    openFixadorTypeModal();
    return;
  }

  // Fluxo normal para outras categorias
  itemForm.reset();
  itemName.focus();
  itemModal.classList.remove('is-hidden');
}

function openFilterModal() {
  if (currentState.currentCategory === 'fixadores') {
    currentState.modalMode = 'filter';
    openFixadorTypeModal();
  }
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

  // Validar se o código já existe na categoria
  const existingItems = currentState.items[category] || [];
  const codeExists = existingItems.some(item =>
    item.code.toLowerCase() === code.toLowerCase()
  );

  if (codeExists) {
    showToast(`⚠️ Já existe um item com o código "${code}" nesta categoria`, 'error');
    itemCode.focus();
    itemCode.select();
    return;
  }

  const id = `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    showItemsLoading();

    // Criar item no banco de dados SEM quantidade inicial
    const newItem = await apiCall('/estoque/items', {
      method: 'POST',
      body: JSON.stringify({
        itemId: id,
        category,
        name,
        code,
        quantity: 0  // Começar com 0
      })
    });

    // Se houver quantidade inicial, registrar movimento de entrada
    if (quantity > 0) {
      const today = new Date().toISOString().split('T')[0];
      await apiCall(`/estoque/items/${id}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          movementType: 'entrada',
          quantity,
          movementDate: today,
          address: null
        })
      });
    }

    // Recarregar dados
    await loadData();
    renderItemsView();
    renderCategoryView();
    closeItemModal();
    showToast('✓ Item adicionado com sucesso', 'success');
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    showToast('Erro ao adicionar item', 'error');
  } finally {
    hideItemsLoading();
  }
}

// Movement Management
function openMovementModal(type) {
  currentState.movementType = type;
  movementForm.reset();
  setDefaultDate();

  if (type === 'entrada') {
    movementModalTitle.textContent = '↓ Registrar Entrada';
    exitAddressGroup.classList.add('is-hidden');
    movementAddress.removeAttribute('required');
  } else {
    movementModalTitle.textContent = '↑ Registrar Saída';
    exitAddressGroup.classList.remove('is-hidden');
    movementAddress.setAttribute('required', 'required');
  }

  // Remove error classes
  movementAddress.classList.remove('required-error');

  btnSubmitMovement.textContent = 'Registrar Movimentação';
  movementModal.classList.remove('is-hidden');
  movementQuantity.focus();
}

// Inline Movement Management (from listing)
function openInlineMovementModal(type, itemId) {
  // Find and set the current item
  const category = currentState.currentCategory;
  const items = currentState.items[category] || [];
  const item = items.find(i => i.id === itemId);

  if (!item) {
    showToast('Item não encontrado', 'error');
    return;
  }

  currentState.currentItem = item;
  openMovementModal(type);
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

  // Validação obrigatória para saídas
  if (type === 'saida' && !address) {
    showToast('⚠️ Endereço/Local de Saída é obrigatório para operações de saída', 'error');
    movementAddress.classList.add('required-error');
    movementAddress.focus();
    return;
  }

  // Remove error class if validation passes
  movementAddress.classList.remove('required-error');

  const item = currentState.currentItem;

  try {
    showDetailsLoading();

    // Registrar movimento na API
    await apiCall(`/estoque/items/${item.id}/movements`, {
      method: 'POST',
      body: JSON.stringify({
        movementType: type,
        quantity,
        movementDate: date,
        address: type === 'saida' ? address : null
      })
    });

    // Recarregar dados
    await loadData();

    // Atualizar item atual
    const category = currentState.currentCategory;
    const updatedItem = (currentState.items[category] || []).find(i => i.id === item.id);
    if (updatedItem) {
      currentState.currentItem = updatedItem;
    }

    renderItemDetailsView();
    renderItemsView();
    renderCategoryView();
    closeMovementModal();
    showToast('✓ Movimentação registrada com sucesso', 'success');
  } catch (error) {
    console.error('Erro ao registrar movimento:', error);
    showToast('Erro ao registrar movimento', 'error');
  } finally {
    hideDetailsLoading();
  }
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
  const itemName = item.name;

  try {
    showDetailsLoading();

    // Deletar item da API
    await apiCall(`/estoque/items/${item.id}`, {
      method: 'DELETE'
    });

    // Recarregar dados
    await loadData();
    renderItemsView();
    renderCategoryView();
    closeDeleteModal();
    goToItems();
    showToast(`✓ Item "${itemName}" deletado com sucesso`, 'success');
  } catch (error) {
    console.error('Erro ao deletar item:', error);
    showToast('Erro ao deletar item', 'error');
  } finally {
    hideDetailsLoading();
  }
}

// Fixador Management
function openFixadorTypeModal() {
  // Reset selection state completely
  currentState.fixadorSelection = {
    type: null,
    size: null
  };

  fixadorTypeModal.classList.remove('is-hidden');

  // Remove existing listeners and clean visual state
  const typeButtons = document.querySelectorAll('.fixador-type-btn');
  typeButtons.forEach(btn => {
    btn.classList.remove('selected');
    btn.replaceWith(btn.cloneNode(true));
  });

  // Add fresh event listeners for type selection buttons
  document.querySelectorAll('.fixador-type-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const type = this.dataset.type;
      selectFixadorType(type);
    });
  });
}

function closeFixadorTypeModal() {
  fixadorTypeModal.classList.add('is-hidden');
  clearFixadorModalState();
}

function selectFixadorType(type) {
  currentState.fixadorSelection.type = type;
  closeFixadorTypeModal();
  openFixadorSizeModal(type);
}

function openFixadorSizeModal(type) {
  fixadorSizeTitle.textContent = `Selecionar Tamanho para ${type}`;
  fixadorSizeModal.classList.remove('is-hidden');

  // Show/hide filter fields based on mode
  if (currentState.modalMode === 'filter') {
    filterExtraFields.style.display = 'block';
    filterMedida.value = '';
  } else {
    filterExtraFields.style.display = 'none';
  }

  // Remove existing listeners and clean visual state
  const sizeButtons = document.querySelectorAll('.fixador-size-btn');
  sizeButtons.forEach(btn => {
    btn.classList.remove('selected');
    btn.replaceWith(btn.cloneNode(true));
  });

  // Add fresh event listeners for size selection buttons
  document.querySelectorAll('.fixador-size-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const size = this.dataset.size;

      if (currentState.modalMode === 'filter') {
        // For filter mode, just store the selection and don't close yet
        currentState.fixadorSelection.size = size;

        // Highlight selected size
        document.querySelectorAll('.fixador-size-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
      } else {
        // For add mode, proceed as before
        selectFixadorSize(size);
      }
    });
  });
}

function closeFixadorSizeModal() {
  fixadorSizeModal.classList.add('is-hidden');

  // Clear visual state when closing
  clearFixadorModalState();
}

function clearFixadorModalState() {
  // Clear all visual selections
  document.querySelectorAll('.fixador-type-btn').forEach(btn => {
    btn.classList.remove('selected');
  });

  document.querySelectorAll('.fixador-size-btn').forEach(btn => {
    btn.classList.remove('selected');
  });

  // Clear filter fields
  if (filterMedida) {
    filterMedida.value = '';
  }
}

function selectFixadorSize(size) {
  currentState.fixadorSelection.size = size;
  closeFixadorSizeModal();

  // Generate item name and open main form
  const itemName = `${currentState.fixadorSelection.type} ${size}`;
  openMainItemModalWithName(itemName);
}

function openMainItemModalWithName(name) {
  itemForm.reset();
  document.getElementById('itemName').value = name;

  // Focus on code field since name is pre-filled
  document.getElementById('itemCode').focus();

  itemModal.classList.remove('is-hidden');
}

// Filter System
function applyFilter() {
  if (!currentState.fixadorSelection.size) {
    showToast('Selecione um tamanho para aplicar o filtro', 'error');
    return;
  }

  const medida = filterMedida.value.trim();

  // Set active filters
  currentState.activeFilters = {
    type: currentState.fixadorSelection.type,
    size: currentState.fixadorSelection.size,
    medida: medida || null
  };

  closeFixadorSizeModal();
  renderItemsView();
  showToast('✓ Filtro aplicado com sucesso', 'success');
}

function clearCurrentFilter() {
  currentState.activeFilters = {
    type: null,
    size: null,
    medida: null
  };

  closeFixadorSizeModal();
  renderItemsView();
  showToast('✓ Filtros removidos', 'success');
}

function clearAllFilters() {
  currentState.activeFilters = {
    type: null,
    size: null,
    medida: null
  };

  renderItemsView();
  showToast('✓ Todos os filtros removidos', 'success');
}

function hasActiveFilters() {
  const filters = currentState.activeFilters;
  return filters.type || filters.size || filters.medida;
}

function applyActiveFilters(items) {
  if (!hasActiveFilters()) return items;

  const filters = currentState.activeFilters;

  return items.filter(item => {
    const name = item.name.toLowerCase();

    // Check type filter
    if (filters.type) {
      const typeWords = filters.type.toLowerCase().split(' ');
      const hasAllTypeWords = typeWords.every(word => name.includes(word));
      if (!hasAllTypeWords) return false;
    }

    // Check size filter
    if (filters.size) {
      if (!name.includes(filters.size.toLowerCase())) return false;
    }

    // Check medida filter
    if (filters.medida) {
      const medidaWords = filters.medida.toLowerCase().split(' ');
      const hasAnyMedidaWord = medidaWords.some(word => word && name.includes(word));
      if (!hasAnyMedidaWord) return false;
    }

    return true;
  });
}

function updateActiveFiltersDisplay() {
  if (!hasActiveFilters()) {
    activeFilters.style.display = 'none';
    return;
  }

  activeFilters.style.display = 'block';
  filterTags.innerHTML = '';

  const filters = currentState.activeFilters;

  if (filters.type) {
    const tag = createFilterTag('Tipo', filters.type, () => {
      currentState.activeFilters.type = null;
      renderItemsView();
    });
    filterTags.appendChild(tag);
  }

  if (filters.size) {
    const tag = createFilterTag('Tamanho', filters.size, () => {
      currentState.activeFilters.size = null;
      renderItemsView();
    });
    filterTags.appendChild(tag);
  }

  if (filters.medida) {
    const tag = createFilterTag('Medida', filters.medida, () => {
      currentState.activeFilters.medida = null;
      renderItemsView();
    });
    filterTags.appendChild(tag);
  }
}

function createFilterTag(label, value, onRemove) {
  const tag = document.createElement('div');
  tag.className = 'filter-tag';

  tag.innerHTML = `
    <span>${label}: ${escapeHtml(value)}</span>
    <span class="remove">×</span>
  `;

  tag.querySelector('.remove').addEventListener('click', onRemove);

  return tag;
}

// Toast Notifications
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlide 0.3s cubic-bezier(0.22, 1, 0.36, 1) reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
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

function showItemsLoading() {
  itemsLoading.classList.add('active');
  itemsLoading.setAttribute('aria-hidden', 'false');
}

function hideItemsLoading() {
  itemsLoading.classList.remove('active');
  itemsLoading.setAttribute('aria-hidden', 'true');
}

function showDetailsLoading() {
  detailsLoading.classList.add('active');
  detailsLoading.setAttribute('aria-hidden', 'false');
}

function hideDetailsLoading() {
  detailsLoading.classList.remove('active');
  detailsLoading.setAttribute('aria-hidden', 'true');
}

// =====================================
// BATCH EXIT SYSTEM
// =====================================

// State for selected items
let batchSelectedItems = new Map(); // Map<itemId, {item, quantity}>
let currentCategoryFilter = 'all';

// Elements
const btnBatchExit = document.getElementById('btnBatchExit');
const batchExitModal = document.getElementById('batchExitModal');
const batchSearchInput = document.getElementById('batchSearchInput');
const batchAvailableList = document.getElementById('batchAvailableList');
const batchSelectedList = document.getElementById('batchSelectedList');
const batchSelectedCount = document.getElementById('batchSelectedCount');
const btnConfirmBatchExit = document.getElementById('btnConfirmBatchExit');
const btnCancelBatchExit = document.getElementById('btnCancelBatchExit');
const batchExitAddress = document.getElementById('batchExitAddress');
const availableItemsTitle = document.getElementById('availableItemsTitle');
const btnSelectAllVisible = document.getElementById('btnSelectAllVisible');
const btnClearSelection = document.getElementById('btnClearSelection');

// Initialize batch exit system
function initBatchExitSystem() {
  btnBatchExit?.addEventListener('click', openBatchExitModal);
  btnConfirmBatchExit?.addEventListener('click', handleBatchExit);
  btnCancelBatchExit?.addEventListener('click', closeBatchExitModal);

  // Search input
  batchSearchInput?.addEventListener('input', filterAvailableItems);

  // Bulk actions
  btnSelectAllVisible?.addEventListener('click', selectAllVisibleItems);
  btnClearSelection?.addEventListener('click', clearAllSelections);

  // Category filter buttons
  setTimeout(() => {
    const categoryBtns = document.querySelectorAll('.category-filter-btn');
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        setCategoryFilter(e.target.closest('.category-filter-btn').dataset.filter);
      });
    });
  }, 100);

  // Close modal on overlay click
  const overlay = batchExitModal?.querySelector('.modal-overlay');
  overlay?.addEventListener('click', closeBatchExitModal);

  // Close on modal close button
  const closeBtn = batchExitModal?.querySelector('[data-close="batchExitModal"]');
  closeBtn?.addEventListener('click', closeBatchExitModal);
}

function openBatchExitModal() {
  // Clear previous state
  batchSelectedItems.clear();
  batchSearchInput.value = '';
  batchExitAddress.value = '';
  currentCategoryFilter = 'all';

  // Reset category filter buttons
  setTimeout(() => {
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
  }, 50);

  // Populate available items
  populateAvailableItems();
  updateSelectedItemsList();

  // Show modal
  batchExitModal.classList.remove('is-hidden');
}

function closeBatchExitModal() {
  batchExitModal.classList.add('is-hidden');
}

function setCategoryFilter(filter) {
  currentCategoryFilter = filter;

  // Update button states
  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Update title
  const titles = {
    'all': 'Todos os Itens',
    'parafusos': 'Parafusos',
    'porcas': 'Porcas',
    'arruelas': 'Arruelas'
  };
  availableItemsTitle.textContent = titles[filter] || 'Itens Disponíveis';

  // Re-filter items
  filterAvailableItems();
}

function populateAvailableItems() {
  filterAvailableItems();
}

function getItemCategory(item) {
  const name = item.name.toLowerCase();

  if (name.includes('parafuso')) return 'parafusos';
  if (name.includes('porca')) return 'porcas';
  if (name.includes('arruela')) return 'arruelas';

  return 'outros';
}

function filterAvailableItems() {
  const searchTerm = batchSearchInput.value.toLowerCase().trim();
  const category = currentState.currentCategory;
  const categoryItems = currentState.items[category] || [];

  // Filter items by category filter, search term and stock
  let filteredItems = categoryItems.filter(item => {
    if ((item.quantity || 0) <= 0) return false;

    // Category filter
    if (currentCategoryFilter !== 'all') {
      const itemCategory = getItemCategory(item);
      if (itemCategory !== currentCategoryFilter) return false;
    }

    // Search term
    if (searchTerm) {
      return (
        item.name.toLowerCase().includes(searchTerm) ||
        item.code.toLowerCase().includes(searchTerm)
      );
    }

    return true;
  });

  renderAvailableItems(filteredItems);
}

function renderAvailableItems(items) {
  batchAvailableList.innerHTML = '';

  if (items.length === 0) {
    batchAvailableList.innerHTML = `
      <div class="empty-selection">
        <p>Nenhum item disponível com os filtros aplicados</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'batch-item-available';

    const isSelected = batchSelectedItems.has(item.id);
    if (isSelected) {
      itemDiv.classList.add('selected');
    }

    itemDiv.innerHTML = `
      <input
        type="checkbox"
        class="batch-item-checkbox"
        data-item-id="${item.id}"
        ${isSelected ? 'checked' : ''}
      />
      <div class="batch-item-info">
        <h4 class="batch-item-name">${escapeHtml(item.name)}</h4>
        <p class="batch-item-code">Código: ${escapeHtml(item.code)}</p>
        <p class="batch-item-stock">Estoque: ${item.quantity || 0}</p>
      </div>
    `;

    // Add checkbox handler
    const checkbox = itemDiv.querySelector('.batch-item-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        addItemToBatch(item);
      } else {
        removeItemFromBatch(item.id);
      }
    });

    batchAvailableList.appendChild(itemDiv);
  });

  updateBulkActionButtons();
}

function addItemToBatch(item) {
  // Add to selected items
  batchSelectedItems.set(item.id, {
    item: item,
    quantity: 1
  });

  // Update UI
  updateSelectedItemsList();
  updateItemCheckboxState(item.id, true);
  updateBulkActionButtons();
}

function removeItemFromBatch(itemId) {
  batchSelectedItems.delete(itemId);
  updateSelectedItemsList();
  updateItemCheckboxState(itemId, false);
  updateBulkActionButtons();
}

function updateItemCheckboxState(itemId, isSelected) {
  const checkbox = document.querySelector(`.batch-item-checkbox[data-item-id="${itemId}"]`);
  const itemDiv = checkbox?.closest('.batch-item-available');

  if (checkbox) {
    checkbox.checked = isSelected;
  }

  if (itemDiv) {
    itemDiv.classList.toggle('selected', isSelected);
  }
}

function selectAllVisibleItems() {
  const visibleCheckboxes = document.querySelectorAll('.batch-item-checkbox');

  visibleCheckboxes.forEach(checkbox => {
    if (!checkbox.checked) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    }
  });
}

function clearAllSelections() {
  // Clear all selected items
  batchSelectedItems.clear();

  // Update checkboxes
  const checkboxes = document.querySelectorAll('.batch-item-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
    const itemDiv = checkbox.closest('.batch-item-available');
    itemDiv?.classList.remove('selected');
  });

  updateSelectedItemsList();
  updateBulkActionButtons();
}

function updateBulkActionButtons() {
  const hasSelections = batchSelectedItems.size > 0;
  btnClearSelection.style.display = hasSelections ? 'block' : 'none';
}

function updateSelectedItemsList() {
  const count = batchSelectedItems.size;
  batchSelectedCount.textContent = count;

  // Enable/disable confirm button
  btnConfirmBatchExit.disabled = count === 0;

  if (count === 0) {
    batchSelectedList.innerHTML = `
      <div class="empty-selection">
        <p>Nenhum item selecionado</p>
      </div>
    `;
    return;
  }

  batchSelectedList.innerHTML = '';

  batchSelectedItems.forEach(({ item, quantity }, itemId) => {
    const selectedDiv = document.createElement('div');
    selectedDiv.className = 'batch-item-selected';

    selectedDiv.innerHTML = `
      <div class="batch-item-info">
        <h4 class="batch-item-name">${escapeHtml(item.name)}</h4>
        <p class="batch-item-code">Código: ${escapeHtml(item.code)}</p>
        <p class="batch-item-stock">Estoque: ${item.quantity || 0}</p>
      </div>
      <div class="batch-quantity-controls">
        <input
          type="number"
          class="batch-quantity-input"
          data-item-id="${itemId}"
          min="1"
          max="${item.quantity || 0}"
          value="${quantity}"
          placeholder="Qtd"
        />
        <button type="button" class="batch-remove-btn" data-item-id="${itemId}">×</button>
      </div>
    `;

    // Add event listeners
    const removeBtn = selectedDiv.querySelector('.batch-remove-btn');
    removeBtn.addEventListener('click', () => removeItemFromBatch(itemId));

    const quantityInput = selectedDiv.querySelector('.batch-quantity-input');
    quantityInput.addEventListener('input', (e) => {
      validateAndUpdateQuantity(itemId, e.target);
    });

    batchSelectedList.appendChild(selectedDiv);
  });
}

function validateAndUpdateQuantity(itemId, input) {
  const max = parseInt(input.getAttribute('max'));
  const value = parseInt(input.value);

  if (value > max) {
    input.value = max;
    showToast(`Quantidade máxima disponível: ${max}`, 'warning');
  }

  if (value < 1) {
    input.value = 1;
  }

  // Update quantity in state
  const selectedItem = batchSelectedItems.get(itemId);
  if (selectedItem) {
    selectedItem.quantity = parseInt(input.value);
  }
}

async function handleBatchExit() {
  if (batchSelectedItems.size === 0) {
    showToast('Selecione pelo menos um item', 'error');
    return;
  }

  // Validate quantities
  for (const [itemId, { item, quantity }] of batchSelectedItems) {
    if (!quantity || quantity < 1) {
      showToast('Todas as quantidades devem ser maior que 0', 'error');
      return;
    }

    if (quantity > item.quantity) {
      showToast(`Quantidade excede estoque disponível para ${item.name}`, 'error');
      return;
    }
  }

  // Validate required address for exits
  const address = batchExitAddress.value.trim();
  if (!address) {
    showToast('⚠️ Endereço/Local de Saída é obrigatório para operações de saída', 'error');
    batchExitAddress.classList.add('required-error');
    batchExitAddress.focus();
    return;
  }

  // Remove error class if validation passes
  batchExitAddress.classList.remove('required-error');

  // Show loading state
  btnConfirmBatchExit.disabled = true;
  btnConfirmBatchExit.innerHTML = '<span class="icon">⏳</span><span>Processando...</span>';

  try {
    const today = new Date().toISOString().split('T')[0];

    // Process each exit
    for (const [itemId, { item, quantity }] of batchSelectedItems) {
      await apiCall(`/estoque/items/${itemId}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          movementType: 'saida',
          quantity,
          movementDate: today,
          address: address
        })
      });
    }

    // Success
    showToast(`✅ ${batchSelectedItems.size} saída(s) registrada(s) com sucesso!`, 'success');

    // Reload data and close modal
    await loadData();
    renderItemsView();
    closeBatchExitModal();

  } catch (error) {
    console.error('Erro no batch exit:', error);
    showToast('Erro ao processar saídas múltiplas', 'error');
  } finally {
    // Reset button state
    btnConfirmBatchExit.disabled = false;
    btnConfirmBatchExit.innerHTML = '<span class="icon">📦</span><span>Confirmar Saídas</span>';
  }
}

// Global functions for inline buttons
window.openInlineMovementModal = openInlineMovementModal;
window.viewItem = viewItem;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopRealTimeUpdates();
});

// Start
window.addEventListener('DOMContentLoaded', init);
// Also call init immediately in case DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
