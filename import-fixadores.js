/**
 * Script de importaÃ§Ã£o de fixadores â€” relaÃ§Ã£o completa (143 itens)
 * Nomenclatura segue o padrÃ£o do app:
 *   Parafuso  â†’ "Parafuso Inox [CabeÃ§a] M10x35 [Soberbo]"
 *   Porca Lisa / Porca Parlock â†’ "Porca Lisa M10"
 *   Arruela   â†’ "Arruela M10"
 */

const API_BASE = 'https://lato-app-production.up.railway.app';
const CATEGORY = 'fixadores';

const items = [
  // â”€â”€ M3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '3858', name: 'Parafuso Inox Allen M3x30' },
  { code: '3859', name: 'Parafuso Inox Allen M3x16' },
  { code: '4121', name: 'Parafuso Inox Sextavado M3x30' },
  { code: '4122', name: 'Porca Inox Parlock M3' },

  // â”€â”€ M3,5 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '4056', name: 'Parafuso Inox Panela M3,5x25 Soberbo' },

  // â”€â”€ M4 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '2211', name: 'Parafuso Inox Panela M4x10' },
  { code: '2218', name: 'Parafuso Inox Allen M4x12' },
  { code: '2859', name: 'Parafuso Inox Allen M4x30' },
  { code: '2861', name: 'Parafuso Inox Panela M4x32 Soberbo' },
  { code: '3682', name: 'Parafuso Inox Sextavado M4x30' },
  { code: '3855', name: 'Parafuso Inox Allen M4x35' },
  { code: '3856', name: 'Parafuso Inox Allen M4x25' },
  { code: '3857', name: 'Parafuso Inox Allen M4x6' },
  { code: '3882', name: 'Parafuso Inox Allen M4x16' },
  { code: '3885', name: 'Porca Parlock M4' },

  // â”€â”€ M5 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '1489', name: 'Parafuso Inox Allen M5x12' },
  { code: '2337', name: 'Parafuso Inox Allen M5x35' },
  { code: '2455', name: 'Parafuso Inox Allen M5x30' },
  { code: '2620', name: 'Parafuso Inox Sextavado M5x16 Soberbo' },
  { code: '2621', name: 'Parafuso Inox Sextavado M5x25 Soberbo' },
  { code: '2622', name: 'Parafuso Inox Sextavado M5x30 Soberbo' },
  { code: '2623', name: 'Parafuso Inox Sextavado M5x35 Soberbo' },
  { code: '2624', name: 'Parafuso Inox Sextavado M5x40 Soberbo' },
  { code: '2625', name: 'Parafuso Inox Sextavado M5x50 Soberbo' },
  { code: '2626', name: 'Parafuso Inox CÃ´nico M5x35 Soberbo' },
  { code: '2775', name: 'Arruela Inox M5' },
  { code: '2793', name: 'Parafuso Inox Allen M5x16' },
  { code: '3660', name: 'Porca Inox Parlock M5' },
  { code: '3850', name: 'Parafuso Inox Allen M5x50' },
  { code: '3851', name: 'Parafuso Inox Allen M5x25' },
  { code: '3852', name: 'Parafuso Inox Allen M5x20' },
  { code: '3853', name: 'Parafuso Inox Allen M5x8' },
  { code: '3854', name: 'Parafuso Inox Allen M5x40' },
  { code: '3869', name: 'Parafuso Inox CÃ´nico M5x35' },
  { code: '3879', name: 'Parafuso Inox CÃ´nico M5x16' },
  { code: '3880', name: 'Parafuso Inox CÃ´nico M5x12' },

  // â”€â”€ M6 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '304',  name: 'Parafuso Inox Sextavado M6x75' },
  { code: '552',  name: 'Parafuso Inox Allen M6x25' },
  { code: '553',  name: 'Porca Inox Parlock M6' },
  { code: '1296', name: 'Parafuso Inox Sextavado M6x70' },
  { code: '1501', name: 'Parafuso Inox Sextavado M6x35' },
  { code: '1507', name: 'Parafuso Inox Allen M6x50' },
  { code: '2201', name: 'Parafuso Inox Allen M6x40' },
  { code: '2219', name: 'Parafuso Inox Allen M6x45' },
  { code: '2331', name: 'Parafuso Inox CÃ´nico M6x20' },
  { code: '2439', name: 'Parafuso Inox Sextavado M6x40' },
  { code: '2454', name: 'Parafuso Inox CÃ´nico M6x45' },
  { code: '2456', name: 'Parafuso Inox Allen M6x10' },
  { code: '2770', name: 'Parafuso Inox Sextavado M6x16' },
  { code: '2771', name: 'Arruela Inox M6' },
  { code: '2772', name: 'Parafuso Inox Sextavado M6x20' },
  { code: '2776', name: 'Parafuso Inox Sextavado M6x25' },
  { code: '2808', name: 'Parafuso Inox Allen M6x16' },
  { code: '2877', name: 'Parafuso Inox CÃ´nico M6x16' },
  { code: '2895', name: 'Parafuso Inox Sextavado M6x60' },
  { code: '2942', name: 'Parafuso Inox Allen M6x30' },
  { code: '3337', name: 'Parafuso Inox Allen M6x20' },
  { code: '3530', name: 'Parafuso Inox Allen M6x12' },
  { code: '3569', name: 'Parafuso Inox Allen M6x35' },
  { code: '3570', name: 'Parafuso Inox Allen M6x55' },
  { code: '3623', name: 'Parafuso Inox Sextavado M6x12' },
  { code: '3665', name: 'Parafuso Inox CÃ´nico M6x30' },
  { code: '3830', name: 'Parafuso Inox Sextavado M6x30' },
  { code: '3839', name: 'Parafuso Inox Sextavado M6x110' },
  { code: '3840', name: 'Parafuso Inox Sextavado M6x80' },
  { code: '3841', name: 'Parafuso Inox Sextavado M6x45' },
  { code: '3848', name: 'Parafuso Inox Allen M6x100' },
  { code: '3849', name: 'Parafuso Inox Allen M6x60' },
  { code: '3863', name: 'Parafuso Inox CÃ´nico M6x60' },
  { code: '3864', name: 'Parafuso Inox CÃ´nico M6x50' },
  { code: '3868', name: 'Parafuso Inox CÃ´nico M6x12' },
  { code: '3928', name: 'Parafuso Inox CÃ´nico M6x40' },
  { code: '4318', name: 'Parafuso Inox FrancÃªs M6x20' },
  { code: '5596', name: 'Parafuso Inox FrancÃªs M6x25' },

  // â”€â”€ M8 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '551',  name: 'Porca Inox Parlock M8' },
  { code: '1267', name: 'Parafuso Inox FrancÃªs M8x35' },
  { code: '1295', name: 'Parafuso Inox Sextavado M8x20' },
  { code: '1484', name: 'Parafuso Inox Abaulado M8x25' },
  { code: '1488', name: 'Porca Inox Lisa M8' },
  { code: '1497', name: 'Parafuso Inox Allen M8x40' },
  { code: '1505', name: 'Parafuso Inox Allen M8x60' },
  { code: '2226', name: 'Parafuso Inox Allen M8x30' },
  { code: '2227', name: 'Parafuso Inox Sextavado M8x75' },
  { code: '2228', name: 'Parafuso Inox FrancÃªs M8x30' },
  { code: '2323', name: 'Parafuso Inox Sextavado M8x50' },
  { code: '2325', name: 'Arruela Inox M8' },
  { code: '2332', name: 'Parafuso Inox Allen M8x25' },
  { code: '2336', name: 'Parafuso Inox Sextavado M8x60' },
  { code: '2338', name: 'Parafuso Inox Sextavado M8x55' },
  { code: '2389', name: 'Parafuso Inox Allen M8x45' },
  { code: '2444', name: 'Parafuso Inox Allen M8x75' },
  { code: '2445', name: 'Parafuso Inox Sextavado M8x100' },
  { code: '2446', name: 'Parafuso Inox Allen M8x50' },
  { code: '2448', name: 'Parafuso Inox Allen M8x55' },
  { code: '2461', name: 'Parafuso Inox Sextavado M8x155' },
  { code: '2627', name: 'Parafuso Inox Allen M8x35' },
  { code: '2687', name: 'Parafuso Inox Allen M8x110' },
  { code: '2794', name: 'Parafuso Inox FrancÃªs M8x50' },
  { code: '3338', name: 'Parafuso Inox Sextavado M8x65' },
  { code: '3340', name: 'Parafuso Inox Allen M8x16' },
  { code: '3594', name: 'Parafuso Inox FrancÃªs M8x25' },
  { code: '3618', name: 'Parafuso Inox Sextavado M8x16' },
  { code: '3622', name: 'Parafuso Inox Sextavado M8x110' },
  { code: '3699', name: 'Parafuso Inox Allen M8x100' },
  { code: '3700', name: 'Parafuso Inox Allen M8x20' },
  { code: '3829', name: 'Parafuso Inox Allen M8x80' },
  { code: '3834', name: 'Parafuso Inox Sextavado M8x90' },
  { code: '3835', name: 'Parafuso Inox Sextavado M8x35' },
  { code: '3836', name: 'Parafuso Inox Sextavado M8x30' },
  { code: '3837', name: 'Parafuso Inox Sextavado M8x25' },
  { code: '3838', name: 'Parafuso Inox Sextavado M8x12' },
  { code: '3845', name: 'Parafuso Inox Allen M8x40' },
  { code: '3846', name: 'Parafuso Inox Allen M8x90' },
  { code: '3847', name: 'Parafuso Inox Allen M8x50' },
  { code: '3860', name: 'Parafuso Inox CÃ´nico M8x45' },
  { code: '3861', name: 'Parafuso Inox CÃ´nico M8x30' },
  { code: '3862', name: 'Parafuso Inox CÃ´nico M8x20' },
  { code: '3884', name: 'Parafuso Inox Sextavado M8x80' },
  { code: '4117', name: 'Parafuso Inox Allen M8x12' },
  { code: '4694', name: 'Parafuso Inox FrancÃªs M8x20' },

  // â”€â”€ M10 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '1080', name: 'Porca Inox Parlock M10' },
  { code: '2450', name: 'Arruela Inox M10' },
  { code: '2581', name: 'Parafuso Inox FrancÃªs M10x35' },
  { code: '2592', name: 'Parafuso Inox FrancÃªs M10x30' },
  { code: '2595', name: 'Parafuso Inox Sextavado M10x20' },
  { code: '2596', name: 'Parafuso Inox Sextavado M10x50' },
  { code: '2597', name: 'Parafuso Inox Sextavado M10x60' },
  { code: '2598', name: 'Parafuso Inox Sextavado M10x35' },
  { code: '2773', name: 'Parafuso Inox FrancÃªs M10x40' },
  { code: '2774', name: 'Parafuso Inox FrancÃªs M10x50' },
  { code: '2777', name: 'Parafuso Inox Sextavado M10x55' },
  { code: '2792', name: 'Parafuso Inox Sextavado M10x25' },
  { code: '3588', name: 'Parafuso Inox Sextavado M10x40' },
  { code: '3842', name: 'Parafuso Inox Allen M10x60' },
  { code: '3843', name: 'Parafuso Inox Allen M10x100' },
  { code: '3844', name: 'Parafuso Inox Allen M10x50' },
  { code: '3926', name: 'Parafuso Inox Allen M10x25' },

  // â”€â”€ M12 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '2185', name: 'Porca Inox Lisa M12' },
  { code: '2186', name: 'Porca Inox Lisa M12' },
  { code: '2390', name: 'Parafuso Inox Sextavado M12x100' },

  // â”€â”€ M16 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '187',  name: 'Porca Inox Lisa M16' },
  { code: '3621', name: 'Parafuso Inox Sextavado M16x25' },

  // â”€â”€ M20 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { code: '2215', name: 'Porca Inox Lisa M20' },
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
  console.log(`Iniciando importaÃ§Ã£o de ${items.length} itens...\n`);

  let success = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const idx = String(i + 1).padStart(3);
    try {
      await importItem(item);
      console.log(`âœ“ [${idx}/${items.length}] ${item.code.padStart(4)} | ${item.name}`);
      success++;
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`âœ— [${idx}/${items.length}] ${item.code.padStart(4)} | ${item.name} â†’ ${err.message}`);
      errors++;
    }
  }

  console.log(`\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€`);
  console.log(`âœ“ Sucesso: ${success}   âœ— Erros: ${errors}   Total: ${items.length}`);
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
