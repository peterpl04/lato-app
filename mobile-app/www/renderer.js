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
    classe: null,
    diameter: null,
    length: null,
    head: null,
    thread: null
  },
  activeFilters: {
    classes: [],
    diameters: [],
    heads: [],
    threads: [],
    medida: null
  },
  showOnlyWithStock: false,
  currentItemsTab: 'all' // 'all' | 'alert'
};

// API Configuration
const API_BASE_URL = "https://lato-app-production.up.railway.app";
const REQUEST_TIMEOUT = 10000;
let appEnv = "prod";

function resolveEnvironmentLabel(value) {
  if (!value) return "prod";
  const lower = String(value).toLowerCase().trim();
  return lower === "development" || lower === "dev" ? "dev" : "prod";
}

// Helper para fazer requisições
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-App-Env': appEnv
  };

  // Mark mutation in flight for write methods to suspend polling
  const method = (options.method || 'GET').toUpperCase();
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  if (isWrite) { mutationCount++; isMutating = true; }

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
  } finally {
    if (isWrite) {
      mutationCount = Math.max(0, mutationCount - 1);
      isMutating = mutationCount > 0;
    }
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
const movementEquipmentType = document.getElementById('movementEquipmentType');
const movementEquipmentCode = document.getElementById('movementEquipmentCode');
const movementProjectId = document.getElementById('movementProjectId');
const movementEquipmentText = document.getElementById('movementEquipmentText');
const btnPickEquipment = document.getElementById('btnPickEquipment');
const exitAddressGroup = document.getElementById('exitAddressGroup');
const btnSubmitMovement = document.getElementById('btnSubmitMovement');

const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');
const btnCancelDelete = document.getElementById('btnCancelDelete');

// Fixador Modals
const fixadorTypeModal = document.getElementById('fixadorTypeModal');
const fixadorSizeModal = document.getElementById('fixadorSizeModal');
const fixadorLengthModal = document.getElementById('fixadorLengthModal');
const fixadorHeadModal = document.getElementById('fixadorHeadModal');
const fixadorThreadModal = document.getElementById('fixadorThreadModal');
const fixadorPorcaTypeModal = document.getElementById('fixadorPorcaTypeModal');
const btnCloseFixadorTypeModal = document.getElementById('btnCloseFixadorTypeModal');
const btnCloseFixadorSizeModal = document.getElementById('btnCloseFixadorSizeModal');
const btnCloseFixadorLengthModal = document.getElementById('btnCloseFixadorLengthModal');
const btnCloseFixadorHeadModal = document.getElementById('btnCloseFixadorHeadModal');
const btnCloseFixadorThreadModal = document.getElementById('btnCloseFixadorThreadModal');
const btnCloseFixadorPorcaTypeModal = document.getElementById('btnCloseFixadorPorcaTypeModal');
const fixadorSizeTitle = document.getElementById('fixadorSizeTitle');
const fixadorLengthInput = document.getElementById('fixadorLengthInput');
const btnConfirmFixadorLength = document.getElementById('btnConfirmFixadorLength');

// Filter elements
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
  try {
    appEnv = resolveEnvironmentLabel(await window.api.getAppEnvironment());
  } catch {
    appEnv = "prod";
  }

  setDefaultDate();
  await loadData();
  attachEventListeners();
  initBatchExitSystem();
  renderCategoryView();
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
let isLoadingData = false;        // global in-flight lock
let loadRequestSeq = 0;            // monotonic sequence to discard stale responses
let isMutating = false;            // true while a write (POST/PUT/DELETE) is happening
let mutationCount = 0;             // counter to handle overlapping writes

// Polling: more frequent on desktop, conservative on mobile (battery + data)
const IS_MOBILE = !!window.Capacitor || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
const POLLING_INTERVAL = IS_MOBILE ? 15000 : 5000;

// Hash baseado apenas em (id, quantidade, nome) — suficiente para detectar mudanças
// sem precisar carregar movimentos.
function generateDataHash(data) {
  const parts = [];
  for (const category of Object.keys(data)) {
    const items = data[category] || [];
    parts.push(category + ':' + items.length);
    for (const item of items) {
      parts.push(item.id + '#' + (item.quantity || 0));
    }
  }
  return parts.join('|');
}

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

// Cache de movimentos por item (lazy-load on details view)
const movementsCache = new Map(); // itemId -> [{id,type,date,quantity,address}]

function normalizeMovements(rawList) {
  return (rawList || []).map(m => ({
    id: m.id,
    type: m.movement_type,
    date: m.movement_date,
    quantity: m.quantity,
    address: m.address,
    projectId: m.project_id || null,
    equipmentType: m.equipment_type || null,
    equipmentCode: m.equipment_code || null
  }));
}

// Busca apenas itens (sem movimentos). Usado em init, polling e refresh pós-mutação.
async function fetchAllItems() {
  const newData = {};
  for (const category of Object.keys(categories)) {
    const items = await apiCall(`/estoque/items/${category}`);
    newData[category] = items.map(item => {
      const id = item.item_id;
      return {
        id,
        name: item.name,
        code: item.code,
        location: item.location || null,
        quantity: item.quantity,
        // Mantém movimentos do cache se já foram carregados
        movements: movementsCache.get(id) || null
      };
    });
  }
  return newData;
}

async function loadData() {
  if (isLoadingData) return;
  isLoadingData = true;
  const mySeq = ++loadRequestSeq;
  try {
    const newData = await fetchAllItems();
    if (mySeq !== loadRequestSeq) return; // descartado
    currentState.items = newData;
    lastDataHash = generateDataHash(newData);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showToast('⚠️ Erro ao carregar dados do estoque', 'error');
  } finally {
    isLoadingData = false;
  }
}

// Carrega movimentos de um item sob demanda; usa cache.
async function loadItemMovements(item, { force = false } = {}) {
  if (!item) return;
  if (!force && Array.isArray(item.movements)) return;
  if (!force && movementsCache.has(item.id)) {
    item.movements = movementsCache.get(item.id);
    return;
  }
  try {
    const data = await apiCall(`/estoque/items/${item.id}/movements`);
    const movements = normalizeMovements(data.movements);
    item.movements = movements;
    movementsCache.set(item.id, movements);
  } catch (err) {
    console.error('Erro ao carregar movimentos:', err);
    item.movements = item.movements || [];
  }
}

function invalidateMovements(itemId) {
  movementsCache.delete(itemId);
}

// Polling silencioso: só re-renderiza se houver mudança e nenhum modal estiver aberto.
async function loadDataSilently() {
  if (isLoadingData || isMutating) return;
  if (isAnyModalOpen()) return; // não interromper interação do usuário

  isLoadingData = true;
  const mySeq = ++loadRequestSeq;
  try {
    const newData = await fetchAllItems();
    if (mySeq !== loadRequestSeq || isMutating) return;

    if (!hasDataChanged(newData)) return;

    currentState.items = newData;

    if (currentState.currentView === 'items') {
      renderItemsView();
    } else if (currentState.currentView === 'category') {
      renderCategoryView();
    } else if (currentState.currentView === 'details' && currentState.currentItem) {
      const category = currentState.currentCategory;
      const updatedItem = (currentState.items[category] || []).find(i => i.id === currentState.currentItem.id);
      if (updatedItem) {
        // Preserva movimentos já carregados
        if (!updatedItem.movements && currentState.currentItem.movements) {
          updatedItem.movements = currentState.currentItem.movements;
        }
        currentState.currentItem = updatedItem;
        renderItemDetailsView();
      }
    }
  } catch (error) {
    console.error('Erro no polling:', error);
  } finally {
    isLoadingData = false;
  }
}

function isAnyModalOpen() {
  return !!document.querySelector('.modal:not(.is-hidden)');
}

function startRealTimeUpdates() {
  if (isPolling) return;
  isPolling = true;

  pollingInterval = setInterval(() => {
    if (!document.hidden) loadDataSilently();
  }, POLLING_INTERVAL);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadDataSilently();
  });
}

function stopRealTimeUpdates() {
  if (!isPolling) return;
  isPolling = false;
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Event Listeners
function attachEventListeners() {
  // Category buttons
  const categoryBtns = document.querySelectorAll('.category-btn');
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      selectCategory(this.dataset.category);
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

  // Equipment picker (single saída + batch saída)
  initEquipmentPickerSystem();

  // Delete confirmation
  btnConfirmDelete.addEventListener('click', handleDeleteItem);
  btnCancelDelete.addEventListener('click', closeDeleteModal);

  // Fixador modals
  btnCloseFixadorTypeModal.addEventListener('click', closeFixadorTypeModal);
  btnCloseFixadorSizeModal.addEventListener('click', closeFixadorSizeModal);
  btnCloseFixadorLengthModal.addEventListener('click', closeFixadorLengthModal);
  btnCloseFixadorHeadModal.addEventListener('click', closeFixadorHeadModal);
  btnCloseFixadorThreadModal.addEventListener('click', closeFixadorThreadModal);
  btnCloseFixadorPorcaTypeModal.addEventListener('click', closeFixadorPorcaTypeModal);
  btnConfirmFixadorLength.addEventListener('click', confirmFixadorLength);
  fixadorLengthInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmFixadorLength();
    }
  });

  // Filter actions
  btnClearAllFilters.addEventListener('click', clearAllFilters);

  // Password modal
  document.getElementById('btnClosePasswordModal').addEventListener('click', closePasswordModal);
  document.getElementById('btnCancelPassword').addEventListener('click', closePasswordModal);
  document.getElementById('btnConfirmPassword').addEventListener('click', confirmPassword);
  document.getElementById('passwordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmPassword(); }
  });

  // Providenciar modal
  document.getElementById('btnCloseProvidenciarModal').addEventListener('click', closeProvidenciarModal);

  // Click outside modals to close
  document.addEventListener('click', (e) => {
    if (e.target === itemModal) closeItemModal();
    if (e.target === movementModal) closeMovementModal();
    if (e.target === confirmDeleteModal) closeDeleteModal();
    if (e.target === fixadorTypeModal) closeFixadorTypeModal();
    if (e.target === fixadorSizeModal) closeFixadorSizeModal();
    if (e.target === fixadorLengthModal) closeFixadorLengthModal();
    if (e.target === fixadorHeadModal) closeFixadorHeadModal();
    if (e.target === fixadorThreadModal) closeFixadorThreadModal();
    if (e.target === fixadorPorcaTypeModal) closeFixadorPorcaTypeModal();
    const pwModal = document.getElementById('passwordModal');
    const pvModal = document.getElementById('providenciarModal');
    if (e.target === pwModal) closePasswordModal();
    if (e.target === pvModal) closeProvidenciarModal();
  });

  // Advanced filter modal
  attachAdvancedFilterListeners();
}

// Navigation
function switchView(viewName) {
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
  currentState.currentCategory = categoryKey;
  showItemsLoading();
  renderItemsView();
  switchView('items');
  setTimeout(() => hideItemsLoading(), 300);
}

function goToCategories() {
  currentState.currentItem = null;
  currentState.showOnlyWithStock = false;
  currentState.currentItemsTab = 'all';
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
  document.querySelectorAll('.category-badge').forEach(el => {
    const cat = el.dataset.count;
    const count = (currentState.items[cat] || []).length;
    el.textContent = count;
  });
}

function renderItemsView() {
  const category = currentState.currentCategory;
  const categoryData = categories[category];

  if (!categoryData) {
    showToast('Categoria inválida', 'error');
    return;
  }

  categoryTitle.textContent = categoryData.name;

  // Show/hide fixadores-specific buttons
  const itemsToolbar = document.getElementById('itemsToolbar');
  if (category === 'fixadores') {
    btnFilterItems.style.display = 'flex';
    btnBatchExit.style.display = 'flex';
    if (itemsToolbar) itemsToolbar.style.display = 'flex';

    // Sync stock toggle button state
    const btnStockFilter = document.getElementById('btnStockFilter');
    if (btnStockFilter) btnStockFilter.classList.toggle('active', currentState.showOnlyWithStock);

    // Show clear filters button only when there are active filters
    if (hasActiveFilters()) {
      btnClearActiveFilters.style.display = 'flex';
    } else {
      btnClearActiveFilters.style.display = 'none';
    }

    updateItemsTabsBar();
  } else {
    btnFilterItems.style.display = 'none';
    btnClearActiveFilters.style.display = 'none';
    btnBatchExit.style.display = 'none';
    if (itemsToolbar) itemsToolbar.style.display = 'none';
    const tabsBar = document.getElementById('itemsTabsBar');
    if (tabsBar) tabsBar.style.display = 'none';
  }

  const isAlertTab = category === 'fixadores' && currentState.currentItemsTab === 'alert';
  let items;

  if (isAlertTab) {
    items = getBelowMinItems();
  } else {
    items = currentState.items[category] || [];

    // Apply filters if active
    items = applyActiveFilters(items);

    // Apply stock-only filter if enabled
    if (currentState.showOnlyWithStock) {
      items = items.filter(item => (item.quantity || 0) > 0);
    }
  }

  categorySubtitle.textContent = `${items.length} itens`;

  // Capture expanded sections BEFORE clearing the list
  const expandedSections = new Set();
  document.querySelectorAll('.items-section-group').forEach(group => {
    const header = group.querySelector('.items-section-header');
    const label = group.querySelector('.items-section-label')?.textContent;
    if (header && label && !header.classList.contains('collapsed')) {
      expandedSections.add(label);
    }
  });
  currentState._expandedSections = expandedSections;

  itemsList.innerHTML = '';

  if (isAlertTab) {
    if (items.length === 0) {
      itemsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <p>Todos os itens estão acima da quantidade mínima!</p>
        </div>
      `;
      return;
    }

    const alertHeader = document.createElement('div');
    alertHeader.className = 'alert-tab-header';
    const capturedItems = items;
    alertHeader.innerHTML = `
      <span class="alert-tab-desc">⚠️ ${items.length} ${items.length === 1 ? 'item abaixo' : 'itens abaixo'} da quantidade mínima</span>
      <button class="btn-providenciar-all btn-action btn-providenciar" onclick="promptProvidenciar(window.__alertItems)">🛒 Providenciar</button>
    `;
    window.__alertItems = capturedItems;
    itemsList.appendChild(alertHeader);

    renderFixadoresGrouped(items);
    return;
  }

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

  if (category === 'fixadores') {
    renderFixadoresGrouped(items);
  } else {
    const frag = document.createDocumentFragment();
    items.forEach(item => frag.appendChild(createItemCard(item)));
    itemsList.appendChild(frag);
  }

  // Update active filters display
  updateActiveFiltersDisplay();
}

// ── Fixadores: grouped + sorted render ────────────────────────────────────────

const FIXADOR_CLASS_ORDER = ['Parafuso', 'Porca', 'Arruela', 'Rebite Roscado'];
const FIXADOR_CLASS_PLURAL = {
  'Parafuso': 'Parafusos',
  'Porca': 'Porcas',
  'Arruela': 'Arruelas',
  'Rebite Roscado': 'Rebites Roscados',
  'Outros': 'Outros'
};

function getFixadorClass(name) {
  const n = name.toLowerCase();
  if (n.startsWith('parafuso')) return 'Parafuso';
  if (n.startsWith('porca')) return 'Porca';
  if (n.startsWith('arruela')) return 'Arruela';
  if (n.startsWith('rebite')) return 'Rebite Roscado';
  return 'Outros';
}

function extractDiameter(name) {
  // Matches patterns like M3, M3,5, M10, M16 etc. (case-insensitive)
  const m = name.match(/m([\d]+(?:[,.][\d]+)?)/i);
  if (!m) return Infinity;
  return parseFloat(m[1].replace(',', '.'));
}

function sortFixadores(items) {
  return [...items].sort((a, b) => {
    const clsA = getFixadorClass(a.name);
    const clsB = getFixadorClass(b.name);

    const orderA = FIXADOR_CLASS_ORDER.indexOf(clsA);
    const orderB = FIXADOR_CLASS_ORDER.indexOf(clsB);
    const clsOrder = (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
    if (clsOrder !== 0) return clsOrder;

    // Within same class: sort by diameter number
    const dA = extractDiameter(a.name);
    const dB = extractDiameter(b.name);
    if (dA !== dB) return dA - dB;

    // Then alphabetically by full name
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

function renderFixadoresGrouped(items) {
  const expandedClasses = currentState._expandedSections || new Set();
  const isFiltered = hasActiveFilters();

  const sorted = sortFixadores(items);

  const groups = new Map();
  for (const item of sorted) {
    const cls = getFixadorClass(item.name);
    if (!groups.has(cls)) groups.set(cls, []);
    groups.get(cls).push(item);
  }

  const frag = document.createDocumentFragment();
  for (const [cls, groupItems] of groups) {
    const label = FIXADOR_CLASS_PLURAL[cls] || cls;
    const shouldExpand = isFiltered || expandedClasses.has(label);

    const group = document.createElement('div');
    group.className = 'items-section-group';

    const header = document.createElement('div');
    header.className = 'items-section-header collapsible' + (shouldExpand ? '' : ' collapsed');
    header.innerHTML = `
      <span class="section-chevron">▼</span>
      <span class="items-section-label">${label}</span>
      <span class="items-section-count">${groupItems.length}</span>
    `;

    const body = document.createElement('div');
    body.className = 'items-section-body' + (shouldExpand ? '' : ' collapsed');
    const bodyFrag = document.createDocumentFragment();
    groupItems.forEach(item => bodyFrag.appendChild(createItemCard(item)));
    body.appendChild(bodyFrag);

    header.addEventListener('click', () => {
      const isCollapsed = header.classList.toggle('collapsed');
      body.classList.toggle('collapsed', isCollapsed);
    });

    group.appendChild(header);
    group.appendChild(body);
    frag.appendChild(group);
  }
  itemsList.appendChild(frag);
}

function createItemCard(item) {
  const quantity = item.quantity || 0;
  const isLow = quantity > 0 && quantity < 5;
  const isZero = quantity === 0;
  const dotClass = isZero ? 'zero' : (isLow ? 'low' : 'ok');
  const qtyClass = isZero ? 'zero' : (isLow ? 'low' : '');
  const dotTitle = isZero ? 'Sem estoque' : (isLow ? 'Estoque baixo' : 'Em estoque');

  const card = document.createElement('div');
  card.className = 'item-card';

  const displayName = formatFixadorDisplayName(item.name);
  const codeLine = item.location
    ? `${escapeHtml(item.code)} <span class="item-card-sep">|</span> ${escapeHtml(item.location)}`
    : escapeHtml(item.code);

  card.innerHTML = `
    <div class="item-stock-dot ${dotClass}" title="${dotTitle}"></div>
    <div class="item-card-info" onclick="viewItem('${item.id}')">
      <h3>${escapeHtml(displayName)}</h3>
      <p>${codeLine}</p>
    </div>
    <div class="item-card-actions">
      <button class="btn-inline-entry" onclick="openInlineMovementModal('entrada', '${item.id}')" title="Registrar Entrada">
        <span class="icon">↓</span>
      </button>
      <button class="btn-inline-exit" onclick="openInlineMovementModal('saida', '${item.id}')" title="Registrar Saída">
        <span class="icon">↑</span>
      </button>
    </div>
    <div class="item-card-qty-section">
      <div class="item-card-qty ${qtyClass}">${quantity}</div>
    </div>
    <div class="item-card-arrow" onclick="viewItem('${item.id}')">→</div>
  `;

  return card;
}

function renderItemDetailsView() {
  const item = currentState.currentItem;
  if (!item) return;

  itemTitle.textContent = formatFixadorDisplayName(item.name);
  document.getElementById('detailItemName').textContent = formatFixadorDisplayName(item.name);
  document.getElementById('detailItemCode').textContent = item.code;
  const locEl = document.getElementById('detailItemLocation');
  if (locEl) locEl.textContent = item.location || '—';
  // Ensure edit UI is hidden on render
  const locEditRow = document.getElementById('locationEditRow');
  const btnEditLoc = document.getElementById('btnEditLocation');
  if (locEditRow) locEditRow.style.display = 'none';
  if (btnEditLoc) btnEditLoc.style.display = 'flex';

  const quantity = item.quantity || 0;
  const quantityBadge = document.getElementById('detailItemQuantity');
  quantityBadge.textContent = quantity;
  quantityBadge.classList.toggle('low', quantity < 5);

  // Min quantity system — only for fixadores
  const isFixadores = currentState.currentCategory === 'fixadores';
  const minQtyRow = document.getElementById('minQtyRow');
  const btnProvidenciar = document.getElementById('btnProvidenciar');
  if (isFixadores) {
    const minQty = getMinQty(item.id);
    const minBadge = document.getElementById('detailMinQty');
    if (minBadge) {
      minBadge.textContent = minQty;
      minBadge.classList.toggle('below-min', quantity < minQty);
    }
    // Reset edit UI
    if (document.getElementById('minQtyEditRow')) document.getElementById('minQtyEditRow').style.display = 'none';
    if (document.getElementById('btnEditMinQty')) document.getElementById('btnEditMinQty').style.display = 'flex';
    if (minQtyRow) minQtyRow.style.display = 'block';
    if (btnProvidenciar) btnProvidenciar.style.display = 'flex';
  } else {
    if (minQtyRow) minQtyRow.style.display = 'none';
    if (btnProvidenciar) btnProvidenciar.style.display = 'none';
  }

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

  const frag = document.createDocumentFragment();
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
    if (movement.equipmentType && movement.equipmentCode) {
      const label = movement.equipmentType === 'alimentador' ? 'Alimentador' : 'Girafa';
      addressInfo = `<small>${label}: ${escapeHtml(movement.equipmentCode)}</small>`;
    } else if (movement.address) {
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

    frag.appendChild(li);
  });
  movementsList.appendChild(frag);
}

async function viewItem(itemId) {
  const category = currentState.currentCategory;
  const item = (currentState.items[category] || []).find(i => i.id === itemId);
  if (!item) return;

  currentState.currentItem = item;
  switchView('details');

  // Lazy-load de movimentos só ao entrar nos detalhes
  if (!Array.isArray(item.movements)) {
    showDetailsLoading();
    try {
      await loadItemMovements(item);
    } finally {
      hideDetailsLoading();
    }
  }
  renderItemDetailsView();
}

// Item Management
function openItemModal() {
  // Se a categoria atual for fixadores, abrir o fluxo especializado
  if (currentState.currentCategory === 'fixadores') {
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
    openAdvancedFilterModal();
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
  const locationInput = document.getElementById('itemLocation');
  const location = locationInput ? locationInput.value.trim() : '';
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
        location: location || null,
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
  clearEquipmentSelection('single');

  if (type === 'entrada') {
    movementModalTitle.textContent = '↓ Registrar Entrada';
    exitAddressGroup.classList.add('is-hidden');
    btnPickEquipment.classList.remove('required-error');
  } else {
    movementModalTitle.textContent = '↑ Registrar Saída';
    exitAddressGroup.classList.remove('is-hidden');
  }

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
  const equipmentType = movementEquipmentType.value || null;
  const equipmentCode = movementEquipmentCode.value || null;
  const projectId = movementProjectId.value ? Number(movementProjectId.value) : null;

  if (!date || quantity <= 0) {
    showToast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  const type = currentState.movementType;

  // Validação obrigatória para saídas
  if (type === 'saida' && (!equipmentType || !equipmentCode || !projectId)) {
    showToast('⚠️ Selecione o alimentador ou girafa de destino', 'error');
    btnPickEquipment.classList.add('required-error');
    btnPickEquipment.focus();
    return;
  }

  btnPickEquipment.classList.remove('required-error');

  const item = currentState.currentItem;

  try {
    showGlobalLoading(type === 'entrada' ? 'Registrando entrada...' : 'Registrando saída...');

    // Registrar movimento na API
    await apiCall(`/estoque/items/${item.id}/movements`, {
      method: 'POST',
      body: JSON.stringify({
        movementType: type,
        quantity,
        movementDate: date,
        address: type === 'saida' ? address : null,
        projectId: type === 'saida' ? projectId : null,
        equipmentType: type === 'saida' ? equipmentType : null,
        equipmentCode: type === 'saida' ? equipmentCode : null
      })
    });

    // Invalidar cache do item afetado e recarregar lista (sem N+1)
    invalidateMovements(item.id);
    await loadData();
    await loadItemMovements(item, { force: true });

    const category = currentState.currentCategory;
    const updatedItem = (currentState.items[category] || []).find(i => i.id === item.id);
    if (updatedItem) {
      updatedItem.movements = item.movements;
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
    hideGlobalLoading();
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

    invalidateMovements(item.id);
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

// ============================================================================
// FIXADOR FLOW
// ----------------------------------------------------------------------------
// Sequence per class:
//   Parafuso       : classe -> diâmetro -> comprimento -> cabeça -> rosca
//   Porca          : classe -> diâmetro -> tipo de porca (Lisa/Parlock)
//   Rebite Roscado : classe -> diâmetro -> comprimento
//   Arruela        : classe -> diâmetro
// Final name format examples:
//   "Parafuso M10x35 Francês Soberbo"
//   "Porca Lisa M10" | "Porca Parlock M10"
//   "Rebite Roscado M8x30"
//   "Arruela M10"
// ============================================================================

function resetFixadorSelection() {
  currentState.fixadorSelection = {
    classe: null,
    diameter: null,
    length: null,
    head: null,
    thread: null,
    porcaType: null
  };
}

function classNeedsLength(classe) {
  return classe === 'Parafuso' || classe === 'Rebite Roscado';
}

function classNeedsPorcaType(classe) {
  return classe === 'Porca';
}

function classNeedsHead(classe) {
  return classe === 'Parafuso';
}

function classNeedsThread(classe) {
  return classe === 'Parafuso';
}

function composeFixadorName(sel) {
  if (sel.classe === 'Porca') {
    const tipo = sel.porcaType ? ` ${sel.porcaType}` : '';
    return `Porca Inox${tipo} ${sel.diameter}`;
  }

  if (sel.classe === 'Parafuso') {
    let name = `Parafuso Inox`;
    if (sel.head) name += ` ${sel.head}`;
    if (sel.thread && sel.thread !== 'Normal') name += ` ${sel.thread}`;
    name += ` ${sel.diameter}`;
    if (sel.length) name += `x${sel.length}`;
    return name;
  }

  if (sel.classe === 'Arruela') {
    return `Arruela Inox ${sel.diameter}`;
  }

  // Rebite Roscado, outros — diâmetro/medida ao final
  let name = `${sel.classe}`;
  if (sel.head) name += ` ${sel.head}`;
  if (sel.thread && sel.thread !== 'Normal') name += ` ${sel.thread}`;
  name += ` ${sel.diameter}`;
  if (sel.length) name += `x${sel.length}`;
  return name;
}

// Reordena o nome para exibição: diâmetro/medida (Mx, MxN, M5x35 etc.) vai para o final.
// Idempotente — se o token já estiver no fim, retorna o mesmo nome.
function formatFixadorDisplayName(name) {
  if (!name) return name;
  const m = name.match(/\bM\d+(?:[,.]\d+)?(?:x\d+)?\b/i);
  if (!m) return name;
  const token = m[0];
  const without = name.replace(token, '').replace(/\s+/g, ' ').trim();
  if (!without) return token;
  return `${without} ${token}`;
}

// --- Class modal --------------------------------------------------------------
function openFixadorTypeModal() {
  resetFixadorSelection();
  fixadorTypeModal.classList.remove('is-hidden');

  // Re-bind listeners by cloning (clears stale handlers)
  document.querySelectorAll('#fixadorTypeModal .fixador-type-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll('#fixadorTypeModal .fixador-type-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      selectFixadorClass(this.dataset.class);
    });
  });
}

function closeFixadorTypeModal() {
  fixadorTypeModal.classList.add('is-hidden');
}

function selectFixadorClass(classe) {
  currentState.fixadorSelection.classe = classe;
  closeFixadorTypeModal();
  openFixadorSizeModal();
}

// --- Diameter modal -----------------------------------------------------------
function openFixadorSizeModal() {
  const classe = currentState.fixadorSelection.classe;
  fixadorSizeTitle.textContent = classe
    ? `Selecionar Diâmetro — ${classe}`
    : 'Selecionar Diâmetro';
  fixadorSizeModal.classList.remove('is-hidden');

  // Re-bind listeners
  document.querySelectorAll('#fixadorSizeModal .fixador-size-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll('#fixadorSizeModal .fixador-size-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      selectFixadorDiameter(this.dataset.size);
    });
  });
}

function closeFixadorSizeModal() {
  fixadorSizeModal.classList.add('is-hidden');
  document.querySelectorAll('#fixadorSizeModal .fixador-size-btn')
    .forEach(b => b.classList.remove('selected'));
}

function selectFixadorDiameter(diameter) {
  currentState.fixadorSelection.diameter = diameter;
  closeFixadorSizeModal();

  const classe = currentState.fixadorSelection.classe;
  if (classNeedsLength(classe)) {
    openFixadorLengthModal();
  } else if (classNeedsPorcaType(classe)) {
    openFixadorPorcaTypeModal();
  } else {
    finalizeFixadorFlow();
  }
}

// --- Length modal -------------------------------------------------------------
function openFixadorLengthModal() {
  fixadorLengthInput.value = '';
  fixadorLengthInput.classList.remove('required-error');
  fixadorLengthModal.classList.remove('is-hidden');
  setTimeout(() => fixadorLengthInput.focus(), 50);
}

function closeFixadorLengthModal() {
  fixadorLengthModal.classList.add('is-hidden');
}

function confirmFixadorLength() {
  const raw = fixadorLengthInput.value.trim();
  const value = parseInt(raw, 10);

  if (!raw || isNaN(value) || value <= 0) {
    fixadorLengthInput.classList.add('required-error');
    fixadorLengthInput.focus();
    showToast('Informe um comprimento válido (mm)', 'error');
    return;
  }

  currentState.fixadorSelection.length = String(value);
  closeFixadorLengthModal();

  const classe = currentState.fixadorSelection.classe;
  if (classNeedsHead(classe)) {
    openFixadorHeadModal();
  } else {
    finalizeFixadorFlow();
  }
}

// --- Head modal ---------------------------------------------------------------
function openFixadorHeadModal() {
  fixadorHeadModal.classList.remove('is-hidden');

  document.querySelectorAll('.fixador-head-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll('.fixador-head-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      selectFixadorHead(this.dataset.head);
    });
  });
}

function closeFixadorHeadModal() {
  fixadorHeadModal.classList.add('is-hidden');
}

function selectFixadorHead(head) {
  currentState.fixadorSelection.head = head;
  closeFixadorHeadModal();

  if (classNeedsThread(currentState.fixadorSelection.classe)) {
    openFixadorThreadModal();
  } else {
    finalizeFixadorFlow();
  }
}

// --- Thread modal -------------------------------------------------------------
function openFixadorThreadModal() {
  fixadorThreadModal.classList.remove('is-hidden');

  document.querySelectorAll('.fixador-thread-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll('.fixador-thread-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      selectFixadorThread(this.dataset.thread);
    });
  });
}

function closeFixadorThreadModal() {
  fixadorThreadModal.classList.add('is-hidden');
}

function selectFixadorThread(thread) {
  currentState.fixadorSelection.thread = thread;
  closeFixadorThreadModal();
  finalizeFixadorFlow();
}

// --- Porca type modal ---------------------------------------------------------
function openFixadorPorcaTypeModal() {
  fixadorPorcaTypeModal.classList.remove('is-hidden');

  document.querySelectorAll('.fixador-porca-type-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll('.fixador-porca-type-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      selectFixadorPorcaType(this.dataset.porcaType);
    });
  });
}

function closeFixadorPorcaTypeModal() {
  fixadorPorcaTypeModal.classList.add('is-hidden');
}

function selectFixadorPorcaType(porcaType) {
  currentState.fixadorSelection.porcaType = porcaType;
  closeFixadorPorcaTypeModal();
  finalizeFixadorFlow();
}

// --- Finalization -------------------------------------------------------------
function finalizeFixadorFlow() {
  const name = composeFixadorName(currentState.fixadorSelection);
  openMainItemModalWithName(name);
}

function openMainItemModalWithName(name) {
  itemForm.reset();
  document.getElementById('itemName').value = name;
  document.getElementById('itemCode').focus();
  itemModal.classList.remove('is-hidden');
}

// ============================================================================
// FILTER SYSTEM
// ============================================================================

function clearAllFilters() {
  resetActiveFilters();
  renderItemsView();
  showToast('✓ Todos os filtros removidos', 'success');
}

function resetActiveFilters() {
  currentState.activeFilters = { classes: [], diameters: [], heads: [], threads: [], medida: null };
}

// ======================== ADVANCED FILTER MODAL ========================

const ADV_FILTER_GROUPS = {
  classes: [],
  diameters: [],
  heads: [],
  threads: [],
  medida: null
};

let pendingFilterState = null;
let advFilterMode = 'main'; // 'main' | 'batch'

function openAdvancedFilterModal(mode = 'main') {
  const modal = document.getElementById('advancedFilterModal');
  if (!modal) return;

  advFilterMode = mode === 'batch' ? 'batch' : 'main';

  // Source filters depend on context
  const f = advFilterMode === 'batch'
    ? (batchActiveFilters || { classes: [], diameters: [], heads: [], threads: [], medida: null })
    : currentState.activeFilters;

  pendingFilterState = {
    classes:   [...f.classes],
    diameters: [...f.diameters],
    heads:     [...f.heads],
    threads:   [...f.threads],
    medida:    f.medida || ''
  };

  // Sync chips UI
  modal.querySelectorAll('.filter-chip').forEach(chip => {
    const group = chip.dataset.group;
    const val   = chip.dataset.value;
    chip.classList.toggle('selected', pendingFilterState[group] && pendingFilterState[group].includes(val));
  });

  // Sync medida input
  const medidaInput = document.getElementById('advFilterMedida');
  if (medidaInput) medidaInput.value = pendingFilterState.medida || '';

  updateAdvFilterPreview();
  modal.classList.remove('is-hidden');
}

function closeAdvancedFilterModal() {
  const modal = document.getElementById('advancedFilterModal');
  if (modal) modal.classList.add('is-hidden');
  pendingFilterState = null;
}

function toggleAdvFilterChip(chip) {
  if (!pendingFilterState) return;
  const group = chip.dataset.group;
  const val   = chip.dataset.value;
  const arr   = pendingFilterState[group];
  const idx   = arr.indexOf(val);
  if (idx >= 0) {
    arr.splice(idx, 1);
    chip.classList.remove('selected');
  } else {
    arr.push(val);
    chip.classList.add('selected');
  }
  updateAdvFilterPreview();
}

function updateAdvFilterPreview() {
  if (!pendingFilterState) return;
  const preview = document.getElementById('advFilterPreview');
  const previewText = document.getElementById('advFilterPreviewText');
  const applyCount = document.getElementById('advFilterApplyCount');

  const parts = [];
  if (pendingFilterState.classes.length)   parts.push(pendingFilterState.classes.join(', '));
  if (pendingFilterState.diameters.length) parts.push(pendingFilterState.diameters.join(', '));
  if (pendingFilterState.heads.length)     parts.push(pendingFilterState.heads.join(', '));
  if (pendingFilterState.threads.length)   parts.push(pendingFilterState.threads.join(', '));
  const medida = document.getElementById('advFilterMedida');
  if (medida && medida.value.trim()) parts.push(medida.value.trim());

  if (parts.length > 0) {
    if (preview) preview.style.display = 'block';
    if (previewText) previewText.textContent = parts.join(' · ');
    if (applyCount) { applyCount.textContent = `(${parts.length})`; applyCount.style.display = 'inline'; }
  } else {
    if (preview) preview.style.display = 'none';
    if (applyCount) applyCount.style.display = 'none';
  }
}

function applyAdvancedFilter() {
  if (!pendingFilterState) return;
  const medidaInput = document.getElementById('advFilterMedida');
  const medidaVal = medidaInput ? medidaInput.value.trim() : '';

  const newFilter = {
    classes:   [...pendingFilterState.classes],
    diameters: [...pendingFilterState.diameters],
    heads:     [...pendingFilterState.heads],
    threads:   [...pendingFilterState.threads],
    medida:    medidaVal || null
  };

  if (advFilterMode === 'batch') {
    batchActiveFilters = newFilter;
    closeAdvancedFilterModal();
    updateBatchFilterUI();
    filterAvailableItems();
    if (hasBatchActiveFilters()) showToast('✓ Filtro aplicado', 'success');
  } else {
    currentState.activeFilters = newFilter;
    closeAdvancedFilterModal();
    renderItemsView();
    if (hasActiveFilters()) showToast('✓ Filtro aplicado', 'success');
  }
}

function hasBatchActiveFilters() {
  const f = batchActiveFilters;
  return f.classes.length > 0 || f.diameters.length > 0 || f.heads.length > 0 || f.threads.length > 0 || !!f.medida;
}

function attachAdvancedFilterListeners() {
  const modal = document.getElementById('advancedFilterModal');
  if (!modal) return;

  modal.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleAdvFilterChip(chip));
  });

  const medidaInput = document.getElementById('advFilterMedida');
  if (medidaInput) medidaInput.addEventListener('input', updateAdvFilterPreview);

  document.getElementById('btnApplyAdvancedFilter')?.addEventListener('click', applyAdvancedFilter);
  document.getElementById('btnClearAdvancedFilter')?.addEventListener('click', () => {
    if (advFilterMode === 'batch') {
      batchActiveFilters = { classes: [], diameters: [], heads: [], threads: [], medida: null };
      closeAdvancedFilterModal();
      updateBatchFilterUI();
      filterAvailableItems();
    } else {
      resetActiveFilters();
      closeAdvancedFilterModal();
      renderItemsView();
    }
    showToast('✓ Filtros removidos', 'success');
  });
  document.getElementById('btnCancelAdvancedFilter')?.addEventListener('click', closeAdvancedFilterModal);
  document.getElementById('btnCloseAdvancedFilter')?.addEventListener('click', closeAdvancedFilterModal);

  modal.querySelector('.modal-overlay')?.addEventListener('click', closeAdvancedFilterModal);
}

// ======================== END ADVANCED FILTER MODAL ========================

function toggleStockFilter() {
  currentState.showOnlyWithStock = !currentState.showOnlyWithStock;
  renderItemsView();
}

function hasActiveFilters() {
  const f = currentState.activeFilters;
  return f.classes.length > 0 || f.diameters.length > 0 || f.heads.length > 0 || f.threads.length > 0 || !!f.medida;
}

function applyActiveFilters(items, filtersOverride) {
  const f = filtersOverride || currentState.activeFilters;
  const has = filtersOverride
    ? (f.classes.length > 0 || f.diameters.length > 0 || f.heads.length > 0 || f.threads.length > 0 || !!f.medida)
    : hasActiveFilters();
  if (!has) return items;

  return items.filter(item => {
    const name = item.name.toLowerCase();

    if (f.classes.length > 0) {
      const matchesAnyClass = f.classes.some(cls => name.startsWith(cls.toLowerCase()));
      if (!matchesAnyClass) return false;
    }

    if (f.diameters.length > 0) {
      const matchesAnyDiam = f.diameters.some(d => name.includes(d.toLowerCase()));
      if (!matchesAnyDiam) return false;
    }

    if (f.heads.length > 0) {
      const matchesAnyHead = f.heads.some(h => name.includes(h.toLowerCase()));
      if (!matchesAnyHead) return false;
    }

    if (f.threads.length > 0) {
      const matchesAnyThread = f.threads.some(t => {
        if (t === 'Normal') return !name.includes('soberbo');
        return name.includes(t.toLowerCase());
      });
      if (!matchesAnyThread) return false;
    }

    if (f.medida) {
      const words = f.medida.toLowerCase().split(/\s+/);
      if (!words.some(w => w && name.includes(w))) return false;
    }

    return true;
  });
}

function updateActiveFiltersDisplay() {
  if (!hasActiveFilters()) {
    if (activeFilters) activeFilters.style.display = 'none';
    return;
  }

  if (activeFilters) activeFilters.style.display = 'block';
  if (!filterTags) return;
  filterTags.innerHTML = '';

  const f = currentState.activeFilters;

  const addTag = (label, value, removeFn) => {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `<span>${label}: ${escapeHtml(value)}</span><span class="remove">×</span>`;
    tag.querySelector('.remove').addEventListener('click', () => { removeFn(); renderItemsView(); });
    filterTags.appendChild(tag);
  };

  f.classes.forEach((c, i) => addTag('Classe', c, () => { currentState.activeFilters.classes.splice(i, 1); }));
  f.diameters.forEach((d, i) => addTag('Diâmetro', d, () => { currentState.activeFilters.diameters.splice(i, 1); }));
  f.heads.forEach((h, i) => addTag('Cabeça', h, () => { currentState.activeFilters.heads.splice(i, 1); }));
  f.threads.forEach((t, i) => addTag('Rosca', t, () => { currentState.activeFilters.threads.splice(i, 1); }));
  if (f.medida) addTag('Medida', f.medida, () => { currentState.activeFilters.medida = null; });
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

// =====================================
// MIN QUANTITY SYSTEM
// =====================================

const MIN_QTY_STORAGE_KEY = 'fixadores_min_qty';
const DEFAULT_MIN_QTY = 100;

function getMinQty(itemId) {
  try {
    const stored = JSON.parse(localStorage.getItem(MIN_QTY_STORAGE_KEY) || '{}');
    return stored[itemId] !== undefined ? stored[itemId] : DEFAULT_MIN_QTY;
  } catch {
    return DEFAULT_MIN_QTY;
  }
}

function setMinQty(itemId, value) {
  try {
    const stored = JSON.parse(localStorage.getItem(MIN_QTY_STORAGE_KEY) || '{}');
    stored[itemId] = value;
    localStorage.setItem(MIN_QTY_STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error('Erro ao salvar min qty:', e);
  }
}

function getBelowMinItems() {
  const items = currentState.items['fixadores'] || [];
  return items.filter(item => (item.quantity || 0) < getMinQty(item.id));
}

// ── Items tabs bar ────────────────────────────────────────────────────────────

function updateItemsTabsBar() {
  const tabsBar = document.getElementById('itemsTabsBar');
  const alertBadge = document.getElementById('alertBadge');

  if (currentState.currentCategory !== 'fixadores') {
    if (tabsBar) tabsBar.style.display = 'none';
    return;
  }

  const belowMin = getBelowMinItems();
  if (belowMin.length > 0) {
    if (tabsBar) tabsBar.style.display = 'flex';
    if (alertBadge) alertBadge.textContent = belowMin.length;
  } else {
    if (tabsBar) tabsBar.style.display = 'none';
    if (currentState.currentItemsTab === 'alert') {
      currentState.currentItemsTab = 'all';
    }
  }

  document.getElementById('tabAll')?.classList.toggle('active', currentState.currentItemsTab === 'all');
  document.getElementById('tabAlert')?.classList.toggle('active', currentState.currentItemsTab === 'alert');
}

function switchItemsTab(tab) {
  currentState.currentItemsTab = tab;
  renderItemsView();
}

// ── Password modal ────────────────────────────────────────────────────────────

let pendingPasswordAction = null;

function openPasswordModal(title, action) {
  pendingPasswordAction = action;
  document.getElementById('passwordModalTitle').textContent = title;
  document.getElementById('passwordInput').value = '';
  document.getElementById('passwordError').style.display = 'none';
  document.getElementById('passwordModal').classList.remove('is-hidden');
  setTimeout(() => document.getElementById('passwordInput')?.focus(), 100);
}

function closePasswordModal() {
  pendingPasswordAction = null;
  document.getElementById('passwordModal').classList.add('is-hidden');
}

function confirmPassword() {
  const pwd = document.getElementById('passwordInput').value;
  const expected = pendingPasswordAction?.password;
  if (pwd !== expected) {
    document.getElementById('passwordError').style.display = 'block';
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordInput').focus();
    return;
  }
  const cb = pendingPasswordAction?.callback;
  closePasswordModal();
  if (cb) cb();
}

// ── Min qty editing ───────────────────────────────────────────────────────────

function promptEditMinQty() {
  openPasswordModal('Editar Quantidade Mínima', {
    password: 'edit',
    callback: enableMinQtyEdit
  });
}

function enableMinQtyEdit() {
  const item = currentState.currentItem;
  if (!item) return;
  const current = getMinQty(item.id);
  const editRow = document.getElementById('minQtyEditRow');
  const editInput = document.getElementById('minQtyEditInput');
  const editBtn = document.getElementById('btnEditMinQty');
  editInput.value = current;
  if (editRow) editRow.style.display = 'flex';
  if (editBtn) editBtn.style.display = 'none';
  editInput?.focus();
  editInput?.select();
}

function saveMinQty() {
  const item = currentState.currentItem;
  if (!item) return;
  const val = parseInt(document.getElementById('minQtyEditInput').value, 10);
  if (isNaN(val) || val < 0) { showToast('Valor inválido', 'error'); return; }
  setMinQty(item.id, val);
  const badge = document.getElementById('detailMinQty');
  if (badge) {
    badge.textContent = val;
    badge.classList.toggle('below-min', (item.quantity || 0) < val);
  }
  cancelMinQtyEdit();
  showToast('Quantidade mínima atualizada ✓');
  updateItemsTabsBar();
}

function cancelMinQtyEdit() {
  document.getElementById('minQtyEditRow').style.display = 'none';
  document.getElementById('btnEditMinQty').style.display = 'flex';
}

// ── Location (endereçamento) editing ─────────────────────────────────────────

function enableLocationEdit() {
  const item = currentState.currentItem;
  if (!item) return;
  const editRow = document.getElementById('locationEditRow');
  const editInput = document.getElementById('locationEditInput');
  const editBtn = document.getElementById('btnEditLocation');
  if (editInput) editInput.value = item.location || '';
  if (editRow) editRow.style.display = 'flex';
  if (editBtn) editBtn.style.display = 'none';
  editInput?.focus();
  editInput?.select();
}

function cancelLocationEdit() {
  const editRow = document.getElementById('locationEditRow');
  const editBtn = document.getElementById('btnEditLocation');
  if (editRow) editRow.style.display = 'none';
  if (editBtn) editBtn.style.display = 'flex';
}

async function saveLocation() {
  const item = currentState.currentItem;
  if (!item) return;
  const editInput = document.getElementById('locationEditInput');
  const newLocation = (editInput?.value || '').trim();

  try {
    await apiCall(`/estoque/items/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ location: newLocation || null })
    });
    item.location = newLocation || null;
    const locEl = document.getElementById('detailItemLocation');
    if (locEl) locEl.textContent = item.location || '—';
    // Atualiza listagem em memória
    const category = currentState.currentCategory;
    const inList = (currentState.items[category] || []).find(i => i.id === item.id);
    if (inList) inList.location = item.location;
    cancelLocationEdit();
    showToast('✓ Endereçamento atualizado', 'success');
  } catch (err) {
    console.error('Erro ao salvar endereçamento:', err);
    showToast('Erro ao salvar endereçamento', 'error');
  }
}

// ── Providenciar modal ────────────────────────────────────────────────────────

function promptProvidenciarSingle() {
  const item = currentState.currentItem;
  if (!item) return;
  openPasswordModal('Providenciar', {
    password: 'buy',
    callback: () => openProvidenciarModal([item])
  });
}

function promptProvidenciar(items) {
  openPasswordModal('Providenciar', {
    password: 'buy',
    callback: () => openProvidenciarModal(items)
  });
}

function openProvidenciarModal(items) {
  const list = document.getElementById('providenciarItemsList');
  const result = document.getElementById('providenciarResult');
  const footer = document.getElementById('providenciarFooter');
  const btnGerar = document.getElementById('btnGerarProvidenciar');

  result.style.display = 'none';
  if (footer) footer.style.display = 'flex';
  if (btnGerar) btnGerar.style.display = 'flex';

  list.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'providenciar-item-row';
    const displayName = formatFixadorDisplayName(item.name);
    row.innerHTML = `
      <span class="providenciar-item-name" data-code="${escapeHtml(item.code || '')}">${escapeHtml(displayName)}</span>
      <div class="providenciar-qty-wrap">
        <label>Quantidade:</label>
        <input type="number" min="1" class="providenciar-qty-input" data-id="${item.id}" placeholder="0" />
      </div>
    `;
    list.appendChild(row);
  });

  document.getElementById('providenciarModal').classList.remove('is-hidden');
}

function closeProvidenciarModal() {
  document.getElementById('providenciarModal').classList.add('is-hidden');
}

function generateProvidenciarText() {
  const inputs = document.querySelectorAll('.providenciar-qty-input');
  const lines = [];
  inputs.forEach(input => {
    const qty = parseInt(input.value, 10);
    if (qty > 0) {
      const nameEl = input.closest('.providenciar-item-row').querySelector('.providenciar-item-name');
      const name = nameEl.textContent;
      const code = nameEl.dataset.code || '';
      const prefix = code ? `[${code}] ` : '';
      lines.push(`${prefix}${name} Quantidade: ${qty}`);
    }
  });

  if (lines.length === 0) {
    showToast('Informe pelo menos uma quantidade', 'error');
    return;
  }

  const text = 'PROVIDENCIAR:\n\n' + lines.join('\n');
  document.getElementById('providenciarText').value = text;
  document.getElementById('providenciarResult').style.display = 'block';
  document.getElementById('btnGerarProvidenciar').style.display = 'none';
}

function copyProvidenciarText() {
  const text = document.getElementById('providenciarText').value;
  navigator.clipboard.writeText(text)
    .then(() => showToast('Texto copiado! 📋'))
    .catch(() => showToast('Erro ao copiar', 'error'));
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

// Global loading overlay (works regardless of active view/modal)
function showGlobalLoading(text) {
  const el = document.getElementById('globalLoading');
  if (!el) return;
  const label = document.getElementById('globalLoadingText');
  if (label && text) label.textContent = text;
  el.classList.add('active');
  el.setAttribute('aria-hidden', 'false');
}

function hideGlobalLoading() {
  const el = document.getElementById('globalLoading');
  if (!el) return;
  el.classList.remove('active');
  el.setAttribute('aria-hidden', 'true');
}

// =====================================
// BATCH EXIT SYSTEM
// =====================================

// State for selected items
let batchSelectedItems = new Map(); // Map<itemId, {item, quantity}>
let currentCategoryFilter = 'all';
let batchActiveFilters = { classes: [], diameters: [], heads: [], threads: [], medida: null };

// Elements
const btnBatchExit = document.getElementById('btnBatchExit');
const batchExitModal = document.getElementById('batchExitModal');
const batchAvailableList = document.getElementById('batchAvailableList');
const batchSelectedList = document.getElementById('batchSelectedList');
const batchSelectedCount = document.getElementById('batchSelectedCount');
const btnConfirmBatchExit = document.getElementById('btnConfirmBatchExit');
const btnCancelBatchExit = document.getElementById('btnCancelBatchExit');
const batchExitAddress = document.getElementById('batchExitAddress');
const batchEquipmentType = document.getElementById('batchEquipmentType');
const batchEquipmentCode = document.getElementById('batchEquipmentCode');
const batchProjectId = document.getElementById('batchProjectId');
const batchEquipmentText = document.getElementById('batchEquipmentText');
const btnPickEquipmentBatch = document.getElementById('btnPickEquipmentBatch');
const availableItemsTitle = document.getElementById('availableItemsTitle');
const btnSelectAllVisible = document.getElementById('btnSelectAllVisible');
const btnClearSelection = document.getElementById('btnClearSelection');

// Initialize batch exit system
function initBatchExitSystem() {
  btnBatchExit?.addEventListener('click', openBatchExitModal);
  btnConfirmBatchExit?.addEventListener('click', handleBatchExit);
  btnCancelBatchExit?.addEventListener('click', closeBatchExitModal);

  // Filter button (replaces specific search) — opens advanced filter modal in batch context
  document.getElementById('btnBatchFilter')?.addEventListener('click', () => openAdvancedFilterModal('batch'));
  document.getElementById('btnBatchClearFilter')?.addEventListener('click', () => {
    batchActiveFilters = { classes: [], diameters: [], heads: [], threads: [], medida: null };
    updateBatchFilterUI();
    filterAvailableItems();
  });

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
  clearEquipmentSelection('batch');
  currentCategoryFilter = 'all';
  batchActiveFilters = { classes: [], diameters: [], heads: [], threads: [], medida: null };
  updateBatchFilterUI();

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
    'arruelas': 'Arruelas',
    'rebites': 'Rebites Roscados'
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

  if (name.includes('rebite')) return 'rebites';
  if (name.includes('parafuso')) return 'parafusos';
  if (name.includes('porca')) return 'porcas';
  if (name.includes('arruela')) return 'arruelas';

  return 'outros';
}

function filterAvailableItems() {
  const category = currentState.currentCategory;
  const categoryItems = currentState.items[category] || [];

  // Quick category filter (Parafusos / Porcas / Arruelas / Rebites / Todos)
  let filteredItems = categoryItems.filter(item => {
    if (currentCategoryFilter !== 'all') {
      const itemCategory = getItemCategory(item);
      if (itemCategory !== currentCategoryFilter) return false;
    }
    return true;
  });

  // Advanced filter (Classe / Diâmetro / Cabeça / Rosca / Medida)
  filteredItems = applyActiveFilters(filteredItems, batchActiveFilters);

  renderAvailableItems(filteredItems);
}

function updateBatchFilterUI() {
  const preview = document.getElementById('batchFilterPreview');
  const previewText = document.getElementById('batchFilterPreviewText');
  const badge = document.getElementById('batchFilterBadge');
  const btnClear = document.getElementById('btnBatchClearFilter');
  const f = batchActiveFilters;

  const parts = [];
  if (f.classes.length)   parts.push(f.classes.join(', '));
  if (f.diameters.length) parts.push(f.diameters.join(', '));
  if (f.heads.length)     parts.push(f.heads.join(', '));
  if (f.threads.length)   parts.push(f.threads.join(', '));
  if (f.medida)           parts.push(f.medida);

  if (parts.length > 0) {
    if (preview) preview.style.display = 'block';
    if (previewText) previewText.textContent = parts.join(' · ');
    if (badge) { badge.textContent = `(${parts.length})`; badge.style.display = 'inline'; }
    if (btnClear) btnClear.style.display = 'inline-flex';
  } else {
    if (preview) preview.style.display = 'none';
    if (badge) badge.style.display = 'none';
    if (btnClear) btnClear.style.display = 'none';
  }
}

function renderAvailableItems(items) {
  batchAvailableList.innerHTML = '';

  if (items.length === 0) {
    batchAvailableList.innerHTML = `
      <div class="empty-selection">
        <p>Nenhum item encontrado com os filtros aplicados</p>
      </div>
    `;
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(item => {
    const qty = item.quantity || 0;
    const hasStock = qty > 0;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'batch-item-available' + (hasStock ? '' : ' no-stock');

    const isSelected = batchSelectedItems.has(item.id);
    if (isSelected && hasStock) {
      itemDiv.classList.add('selected');
    }

    itemDiv.innerHTML = `
      <input
        type="checkbox"
        class="batch-item-checkbox"
        data-item-id="${item.id}"
        ${isSelected && hasStock ? 'checked' : ''}
        ${!hasStock ? 'disabled' : ''}
      />
      <div class="batch-item-info">
        <h4 class="batch-item-name">${escapeHtml(item.name)}</h4>
        <p class="batch-item-code">Código: ${escapeHtml(item.code)}</p>
        <p class="batch-item-stock ${hasStock ? '' : 'out-of-stock'}">
          Estoque: ${qty}${!hasStock ? ' — Sem estoque' : ''}
        </p>
      </div>
    `;

    if (hasStock) {
      const checkbox = itemDiv.querySelector('.batch-item-checkbox');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          addItemToBatch(item);
        } else {
          removeItemFromBatch(item.id);
        }
      });
    }

    frag.appendChild(itemDiv);
  });
  batchAvailableList.appendChild(frag);

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
  const visibleCheckboxes = document.querySelectorAll('.batch-item-checkbox:not([disabled])');

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

  // Validate required equipment destination for exits
  const address = batchExitAddress.value.trim();
  const equipmentType = batchEquipmentType.value || null;
  const equipmentCode = batchEquipmentCode.value || null;
  const projectId = batchProjectId.value ? Number(batchProjectId.value) : null;

  if (!equipmentType || !equipmentCode || !projectId) {
    showToast('⚠️ Selecione o alimentador ou girafa de destino', 'error');
    btnPickEquipmentBatch.classList.add('required-error');
    btnPickEquipmentBatch.focus();
    return;
  }

  btnPickEquipmentBatch.classList.remove('required-error');

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
          address: address,
          projectId,
          equipmentType,
          equipmentCode
        })
      });
      invalidateMovements(itemId);
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

// =====================================
// EQUIPMENT PICKER SYSTEM
// (alimentador / girafa selection for saídas)
// =====================================

const equipmentPickerModal = document.getElementById('equipmentPickerModal');
const equipmentPickerList = document.getElementById('equipmentPickerList');
const equipmentSearchInput = document.getElementById('equipmentSearchInput');

// Which form opened the picker: 'single' or 'batch'
let equipmentPickerContext = null;

// Cached equipment list and current view filters
let equipmentCache = null;
let equipmentCacheAt = 0;
const EQUIPMENT_CACHE_TTL_MS = 30_000;
let equipmentTypeFilter = 'all';
let equipmentSearchTerm = '';

function initEquipmentPickerSystem() {
  btnPickEquipment?.addEventListener('click', () => openEquipmentPicker('single'));
  btnPickEquipmentBatch?.addEventListener('click', () => openEquipmentPicker('batch'));

  document.getElementById('btnCloseEquipmentPicker')?.addEventListener('click', closeEquipmentPicker);
  document.getElementById('btnCancelEquipmentPicker')?.addEventListener('click', closeEquipmentPicker);
  document.getElementById('btnClearEquipmentSelection')?.addEventListener('click', () => {
    clearEquipmentSelection(equipmentPickerContext || 'single');
    closeEquipmentPicker();
  });

  equipmentPickerModal?.querySelector('.modal-overlay')?.addEventListener('click', closeEquipmentPicker);

  equipmentSearchInput?.addEventListener('input', e => {
    equipmentSearchTerm = (e.target.value || '').trim().toLowerCase();
    renderEquipmentList();
  });

  document.querySelectorAll('.equipment-type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      equipmentTypeFilter = tab.dataset.typeFilter;
      document.querySelectorAll('.equipment-type-tab').forEach(t =>
        t.classList.toggle('active', t === tab)
      );
      renderEquipmentList();
    });
  });
}

async function openEquipmentPicker(context) {
  equipmentPickerContext = context;
  equipmentSearchTerm = '';
  equipmentTypeFilter = 'all';
  if (equipmentSearchInput) equipmentSearchInput.value = '';
  document.querySelectorAll('.equipment-type-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.typeFilter === 'all')
  );

  equipmentPickerModal.classList.remove('is-hidden');

  const stale = !equipmentCache || (Date.now() - equipmentCacheAt) > EQUIPMENT_CACHE_TTL_MS;
  if (stale) {
    equipmentPickerList.innerHTML = `
      <div class="equipment-picker-loading">
        <i class="fa-solid fa-spinner"></i>
        <span>Carregando equipamentos...</span>
      </div>
    `;
    try {
      equipmentCache = await apiCall('/projects/equipment');
      equipmentCacheAt = Date.now();
    } catch (err) {
      console.error('Erro ao carregar equipamentos:', err);
      equipmentPickerList.innerHTML = `
        <div class="equipment-picker-empty">
          <span>⚠️ Falha ao carregar equipamentos. Tente novamente.</span>
        </div>
      `;
      return;
    }
  }

  renderEquipmentList();
  setTimeout(() => equipmentSearchInput?.focus(), 50);
}

function closeEquipmentPicker() {
  equipmentPickerModal.classList.add('is-hidden');
  equipmentPickerContext = null;
}

// Force refresh next time the picker is opened
function invalidateEquipmentCache() {
  equipmentCache = null;
  equipmentCacheAt = 0;
}

function renderEquipmentList() {
  if (!equipmentCache) return;

  const filtered = equipmentCache.filter(eq => {
    if (equipmentTypeFilter !== 'all' && eq.equipmentType !== equipmentTypeFilter) return false;
    if (!equipmentSearchTerm) return true;
    const haystack = [
      eq.obra,
      eq.cliente,
      eq.unidade,
      eq.equipmentCode,
      eq.equipmentType
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(equipmentSearchTerm);
  });

  if (filtered.length === 0) {
    equipmentPickerList.innerHTML = `
      <div class="equipment-picker-empty">
        <span>Nenhum equipamento encontrado.</span>
      </div>
    `;
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(eq => {
    const card = document.createElement('div');
    card.className = 'equipment-card';
    const icon = eq.equipmentType === 'alimentador' ? '⚙️' : '🦒';
    const typeLabel = eq.equipmentType === 'alimentador' ? 'Alimentador' : 'Girafa';

    const metaParts = [];
    if (eq.obra) metaParts.push(`<span>${escapeHtml(eq.obra)}</span>`);
    if (eq.cliente) metaParts.push(`<span>${escapeHtml(eq.cliente)}</span>`);
    if (eq.unidade) metaParts.push(`<span>${escapeHtml(eq.unidade)}</span>`);

    card.innerHTML = `
      <div class="equipment-card-badge ${eq.equipmentType}">${icon}</div>
      <div class="equipment-card-info">
        <p class="equipment-card-title">
          ${escapeHtml(eq.label || eq.equipmentCode)}
          <span class="equipment-card-type ${eq.equipmentType}">${typeLabel}</span>
        </p>
        <div class="equipment-card-meta">${metaParts.join('')}</div>
      </div>
    `;

    card.addEventListener('click', () => selectEquipment(eq));
    frag.appendChild(card);
  });

  equipmentPickerList.innerHTML = '';
  equipmentPickerList.appendChild(frag);
}

function buildEquipmentDisplay(eq) {
  // Used both as the picker-button label and the persisted "address" text
  // so that legacy consumers (any place that reads only `address`) still see
  // a meaningful destination string.
  const type = eq.equipmentType === 'alimentador' ? 'Alimentador' : 'Girafa';
  const ctx = [eq.obra, eq.cliente].filter(Boolean).join(' / ');
  return `${type} ${eq.label || eq.equipmentCode}${ctx ? ' — ' + ctx : ''}`;
}

function selectEquipment(eq) {
  const display = buildEquipmentDisplay(eq);

  if (equipmentPickerContext === 'batch') {
    batchProjectId.value = eq.projectId;
    batchEquipmentType.value = eq.equipmentType;
    batchEquipmentCode.value = eq.equipmentCode;
    batchExitAddress.value = display;
    batchEquipmentText.innerHTML = `${escapeHtml(eq.label || eq.equipmentCode)}<span class="picker-sub">${escapeHtml((eq.equipmentType === 'alimentador' ? 'Alimentador' : 'Girafa') + (eq.obra ? ' · ' + eq.obra : ''))}</span>`;
    btnPickEquipmentBatch.classList.add('is-filled');
    btnPickEquipmentBatch.classList.remove('required-error');
  } else {
    movementProjectId.value = eq.projectId;
    movementEquipmentType.value = eq.equipmentType;
    movementEquipmentCode.value = eq.equipmentCode;
    movementAddress.value = display;
    movementEquipmentText.innerHTML = `${escapeHtml(eq.label || eq.equipmentCode)}<span class="picker-sub">${escapeHtml((eq.equipmentType === 'alimentador' ? 'Alimentador' : 'Girafa') + (eq.obra ? ' · ' + eq.obra : ''))}</span>`;
    btnPickEquipment.classList.add('is-filled');
    btnPickEquipment.classList.remove('required-error');
  }

  closeEquipmentPicker();
}

function clearEquipmentSelection(context) {
  if (context === 'batch') {
    if (batchProjectId) batchProjectId.value = '';
    if (batchEquipmentType) batchEquipmentType.value = '';
    if (batchEquipmentCode) batchEquipmentCode.value = '';
    if (batchExitAddress) batchExitAddress.value = '';
    if (batchEquipmentText) batchEquipmentText.textContent = 'Selecionar alimentador ou girafa';
    btnPickEquipmentBatch?.classList.remove('is-filled', 'required-error');
  } else {
    if (movementProjectId) movementProjectId.value = '';
    if (movementEquipmentType) movementEquipmentType.value = '';
    if (movementEquipmentCode) movementEquipmentCode.value = '';
    if (movementAddress) movementAddress.value = '';
    if (movementEquipmentText) movementEquipmentText.textContent = 'Selecionar alimentador ou girafa';
    btnPickEquipment?.classList.remove('is-filled', 'required-error');
  }
}

// Refresh equipment cache when sockets indicate project changes
window.addEventListener('projects:changed', invalidateEquipmentCache);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopRealTimeUpdates();
});

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
