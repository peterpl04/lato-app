/**
 * Script de importação de fixadores — relação completa (143 itens)
 * Nomenclatura segue o padrão do app:
 *   Parafuso  → "Parafuso M10x35 Francês [Soberbo]"
 *   Porca Lisa / Porca Parlock → "Porca Lisa M10"
 *   Arruela   → "Arruela M10"
 *
 * "Francesa" do arquivo original → "Francês" (padrão do modal do app)
 */

const API_BASE = 'https://lato-app-production.up.railway.app';
const CATEGORY = 'fixadores';

const items = [
  // ── M3 ──────────────────────────────────────────────────────────────
  { code: '3858', name: 'Parafuso M3x30 Redonda' },
  { code: '3859', name: 'Parafuso M3x16 Redonda' },
  { code: '4121', name: 'Parafuso M3x30 Sextavado' },
  { code: '4122', name: 'Porca Parlock M3' },

  // ── M3,5 ─────────────────────────────────────────────────────────────
  { code: '4056', name: 'Parafuso M3,5x25 Panela Soberbo' },

  // ── M4 ──────────────────────────────────────────────────────────────
  { code: '2211', name: 'Parafuso M4x10 Panela' },
  { code: '2218', name: 'Parafuso M4x12 Redonda' },
  { code: '2859', name: 'Parafuso M4x30 Redonda' },
  { code: '2861', name: 'Parafuso M4x32 Panela Soberbo' },
  { code: '3682', name: 'Parafuso M4x30 Sextavado' },
  { code: '3855', name: 'Parafuso M4x35 Redonda' },
  { code: '3856', name: 'Parafuso M4x25 Redonda' },
  { code: '3857', name: 'Parafuso M4x6 Redonda' },
  { code: '3882', name: 'Parafuso M4x16 Redonda' },
  { code: '3885', name: 'Porca Parlock M4' },

  // ── M5 ──────────────────────────────────────────────────────────────
  { code: '1489', name: 'Parafuso M5x12 Redonda' },
  { code: '2337', name: 'Parafuso M5x35 Redonda' },
  { code: '2455', name: 'Parafuso M5x30 Redonda' },
  { code: '2620', name: 'Parafuso M5x16 Sextavado Soberbo' },
  { code: '2621', name: 'Parafuso M5x25 Sextavado Soberbo' },
  { code: '2622', name: 'Parafuso M5x30 Sextavado Soberbo' },
  { code: '2623', name: 'Parafuso M5x35 Sextavado Soberbo' },
  { code: '2624', name: 'Parafuso M5x40 Sextavado Soberbo' },
  { code: '2625', name: 'Parafuso M5x50 Sextavado Soberbo' },
  { code: '2626', name: 'Parafuso M5x35 Cônico Soberbo' },
  { code: '2775', name: 'Arruela M5' },
  { code: '2793', name: 'Parafuso M5x16 Redonda' },
  { code: '3660', name: 'Porca Parlock M5' },
  { code: '3850', name: 'Parafuso M5x50 Redonda' },
  { code: '3851', name: 'Parafuso M5x25 Redonda' },
  { code: '3852', name: 'Parafuso M5x20 Redonda' },
  { code: '3853', name: 'Parafuso M5x8 Redonda' },
  { code: '3854', name: 'Parafuso M5x40 Redonda' },
  { code: '3869', name: 'Parafuso M5x35 Cônico' },
  { code: '3879', name: 'Parafuso M5x16 Cônico' },
  { code: '3880', name: 'Parafuso M5x12 Cônico' },

  // ── M6 ──────────────────────────────────────────────────────────────
  { code: '304',  name: 'Parafuso M6x75 Sextavado' },
  { code: '552',  name: 'Parafuso M6x25 Redonda' },
  { code: '553',  name: 'Porca Parlock M6' },
  { code: '1296', name: 'Parafuso M6x70 Sextavado' },
  { code: '1501', name: 'Parafuso M6x35 Sextavado' },
  { code: '1507', name: 'Parafuso M6x50 Redonda' },
  { code: '2201', name: 'Parafuso M6x40 Redonda' },
  { code: '2219', name: 'Parafuso M6x45 Redonda' },
  { code: '2331', name: 'Parafuso M6x20 Cônico' },
  { code: '2439', name: 'Parafuso M6x40 Sextavado' },
  { code: '2454', name: 'Parafuso M6x45 Cônico' },
  { code: '2456', name: 'Parafuso M6x10 Redonda' },
  { code: '2770', name: 'Parafuso M6x16 Sextavado' },
  { code: '2771', name: 'Arruela M6' },
  { code: '2772', name: 'Parafuso M6x20 Sextavado' },
  { code: '2776', name: 'Parafuso M6x25 Sextavado' },
  { code: '2808', name: 'Parafuso M6x16 Redonda' },
  { code: '2877', name: 'Parafuso M6x16 Cônico' },
  { code: '2895', name: 'Parafuso M6x60 Sextavado' },
  { code: '2942', name: 'Parafuso M6x30 Redonda' },
  { code: '3337', name: 'Parafuso M6x20 Redonda' },
  { code: '3530', name: 'Parafuso M6x12 Redonda' },
  { code: '3569', name: 'Parafuso M6x35 Redonda' },
  { code: '3570', name: 'Parafuso M6x55 Redonda' },
  { code: '3623', name: 'Parafuso M6x12 Sextavado' },
  { code: '3665', name: 'Parafuso M6x30 Cônico' },
  { code: '3830', name: 'Parafuso M6x30 Sextavado' },
  { code: '3839', name: 'Parafuso M6x110 Sextavado' },
  { code: '3840', name: 'Parafuso M6x80 Sextavado' },
  { code: '3841', name: 'Parafuso M6x45 Sextavado' },
  { code: '3848', name: 'Parafuso M6x100 Redonda' },
  { code: '3849', name: 'Parafuso M6x60 Redonda' },
  { code: '3863', name: 'Parafuso M6x60 Cônico' },
  { code: '3864', name: 'Parafuso M6x50 Cônico' },
  { code: '3868', name: 'Parafuso M6x12 Cônico' },
  { code: '3928', name: 'Parafuso M6x40 Cônico' },
  { code: '4318', name: 'Parafuso M6x20 Francês' },
  { code: '5596', name: 'Parafuso M6x25 Francês' },

  // ── M8 ──────────────────────────────────────────────────────────────
  { code: '551',  name: 'Porca Parlock M8' },
  { code: '1267', name: 'Parafuso M8x35 Francês' },
  { code: '1295', name: 'Parafuso M8x20 Sextavado' },
  { code: '1484', name: 'Parafuso M8x25 Abaulado' },
  { code: '1488', name: 'Porca Lisa M8' },
  { code: '1497', name: 'Parafuso M8x40 Redonda' },
  { code: '1505', name: 'Parafuso M8x60 Redonda' },
  { code: '2226', name: 'Parafuso M8x30 Redonda' },
  { code: '2227', name: 'Parafuso M8x75 Sextavado' },
  { code: '2228', name: 'Parafuso M8x30 Francês' },
  { code: '2323', name: 'Parafuso M8x50 Sextavado' },
  { code: '2325', name: 'Arruela M8' },
  { code: '2332', name: 'Parafuso M8x25 Redonda' },
  { code: '2336', name: 'Parafuso M8x60 Sextavado' },
  { code: '2338', name: 'Parafuso M8x55 Sextavado' },
  { code: '2389', name: 'Parafuso M8x45 Redonda' },
  { code: '2444', name: 'Parafuso M8x75 Redonda' },
  { code: '2445', name: 'Parafuso M8x100 Sextavado' },
  { code: '2446', name: 'Parafuso M8x50 Redonda' },
  { code: '2448', name: 'Parafuso M8x55 Redonda' },
  { code: '2461', name: 'Parafuso M8x155 Sextavado' },
  { code: '2627', name: 'Parafuso M8x35 Redonda' },
  { code: '2687', name: 'Parafuso M8x110 Redonda' },
  { code: '2794', name: 'Parafuso M8x50 Francês' },
  { code: '3338', name: 'Parafuso M8x65 Sextavado' },
  { code: '3340', name: 'Parafuso M8x16 Redonda' },
  { code: '3594', name: 'Parafuso M8x25 Francês' },
  { code: '3618', name: 'Parafuso M8x16 Sextavado' },
  { code: '3622', name: 'Parafuso M8x110 Sextavado' },
  { code: '3699', name: 'Parafuso M8x100 Redonda' },
  { code: '3700', name: 'Parafuso M8x20 Redonda' },
  { code: '3829', name: 'Parafuso M8x80 Redonda' },
  { code: '3834', name: 'Parafuso M8x90 Sextavado' },
  { code: '3835', name: 'Parafuso M8x35 Sextavado' },
  { code: '3836', name: 'Parafuso M8x30 Sextavado' },
  { code: '3837', name: 'Parafuso M8x25 Sextavado' },
  { code: '3838', name: 'Parafuso M8x12 Sextavado' },
  { code: '3845', name: 'Parafuso M8x40 Redonda' },
  { code: '3846', name: 'Parafuso M8x90 Redonda' },
  { code: '3847', name: 'Parafuso M8x50 Redonda' },
  { code: '3860', name: 'Parafuso M8x45 Cônico' },
  { code: '3861', name: 'Parafuso M8x30 Cônico' },
  { code: '3862', name: 'Parafuso M8x20 Cônico' },
  { code: '3884', name: 'Parafuso M8x80 Sextavado' },
  { code: '4117', name: 'Parafuso M8x12 Redonda' },
  { code: '4694', name: 'Parafuso M8x20 Francês' },

  // ── M10 ─────────────────────────────────────────────────────────────
  { code: '1080', name: 'Porca Parlock M10' },
  { code: '2450', name: 'Arruela M10' },
  { code: '2581', name: 'Parafuso M10x35 Francês' },
  { code: '2592', name: 'Parafuso M10x30 Francês' },
  { code: '2595', name: 'Parafuso M10x20 Sextavado' },
  { code: '2596', name: 'Parafuso M10x50 Sextavado' },
  { code: '2597', name: 'Parafuso M10x60 Sextavado' },
  { code: '2598', name: 'Parafuso M10x35 Sextavado' },
  { code: '2773', name: 'Parafuso M10x40 Francês' },
  { code: '2774', name: 'Parafuso M10x50 Francês' },
  { code: '2777', name: 'Parafuso M10x55 Sextavado' },
  { code: '2792', name: 'Parafuso M10x25 Sextavado' },
  { code: '3588', name: 'Parafuso M10x40 Sextavado' },
  { code: '3842', name: 'Parafuso M10x60 Redonda' },
  { code: '3843', name: 'Parafuso M10x100 Redonda' },
  { code: '3844', name: 'Parafuso M10x50 Redonda' },
  { code: '3926', name: 'Parafuso M10x25 Redonda' },

  // ── M12 ─────────────────────────────────────────────────────────────
  { code: '2185', name: 'Porca Lisa M12' },
  { code: '2186', name: 'Porca Lisa M12' },
  { code: '2390', name: 'Parafuso M12x100 Sextavado' },

  // ── M16 ─────────────────────────────────────────────────────────────
  { code: '187',  name: 'Porca Lisa M16' },
  { code: '3621', name: 'Parafuso M16x25 Sextavado' },

  // ── M20 ─────────────────────────────────────────────────────────────
  { code: '2215', name: 'Porca Lisa M20' },
];

async function importItem(item) {
  const itemId = `${CATEGORY}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const res = await fetch(`${API_BASE}/estoque/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId,
      category: CATEGORY,
      name: item.name,
      code: item.code,
      quantity: 0
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

async function run() {
  console.log(`Iniciando importação de ${items.length} itens...\n`);

  let success = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const idx = String(i + 1).padStart(3);
    try {
      await importItem(item);
      console.log(`✓ [${idx}/${items.length}] ${item.code.padStart(4)} | ${item.name}`);
      success++;
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`✗ [${idx}/${items.length}] ${item.code.padStart(4)} | ${item.name} → ${err.message}`);
      errors++;
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`✓ Sucesso: ${success}   ✗ Erros: ${errors}   Total: ${items.length}`);
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});