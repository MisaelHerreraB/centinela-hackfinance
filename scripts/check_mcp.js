#!/usr/bin/env node
/**
 * Diagnóstico de la conexión con el MCP de MyInvestor.
 * Uso:  npm run check:mcp
 * Comprueba: (1) que el servidor responde, (2) qué argumentos acepta search_funds,
 * (3) que una búsqueda real devuelve fondos y (4) si la app los usaría en vivo o tiraría de caché.
 */

const {
  DEFAULT_MCP_URL,
  listMyInvestorTools,
  callMyInvestorMCPTool,
  findCategoryAlternatives,
  verifyProductExistsInMyInvestor
} = require('../src/services/mcpClient');

function line(label, value) {
  console.log(`${label.padEnd(34)} ${value}`);
}

(async () => {
  console.log(`\nMCP: ${DEFAULT_MCP_URL}\n`);
  let warnings = 0;

  try {
    const tools = await listMyInvestorTools(8000);
    line('1. tools/list', `OK · ${tools.length} herramientas: ${tools.map((t) => t.name).join(', ')}`);
    const sf = tools.find((t) => t.name === 'search_funds');
    if (sf) {
      const props = Object.keys(sf.inputSchema?.properties || {});
      line('2. search_funds acepta', props.join(', ') || '(sin esquema)');
      const used = ['asset_type', 'currency', 'order_by', 'limit', 'management_type', 'geography', 'query'];
      const unknown = used.filter((p) => props.length && !props.includes(p));
      if (unknown.length) {
        warnings++;
        line('   ⚠️  la app envía y el MCP no declara', unknown.join(', '));
      }
    } else {
      warnings++;
      line('2. search_funds', '⚠️ NO existe en este servidor');
    }
  } catch (e) {
    warnings++;
    line('1. tools/list', `❌ ${e.message}`);
  }

  const raw = await callMyInvestorMCPTool('search_funds', { asset_type: 'Renta Variable', currency: 'EUR', order_by: 'ter_asc', limit: 3 }, 8000);
  line('3. search_funds (llamada real)', raw.ok ? `OK en ${raw.latency_ms} ms` : `❌ ${raw.error}`);
  if (raw.ok) {
    const funds = raw.data?.funds;
    line('   forma de la respuesta', Array.isArray(funds) ? `data.funds[] con ${funds.length} fondos` : `⚠️ sin data.funds (claves: ${Object.keys(raw.data || {}).join(', ')})`);
    if (!Array.isArray(funds)) warnings++;
  }

  const alt = await findCategoryAlternatives({ asset_type: 'Renta Variable', geography: 'Global' });
  line('4. La app usaría', `${alt.mcp_live ? '✅ DATOS EN VIVO' : '⚠️ CACHÉ'} · ${alt.alternatives.map((f) => `${f.isin} (${f.ter} %)`).join(' | ')}`);
  const live = alt.mcp_live;

  const v = await verifyProductExistsInMyInvestor('Fidelity MSCI World');
  line('5. Verificar "Fidelity MSCI World"', `${v.verification} · existe: ${v.exists_in_catalog}`);

  if (!live) {
    console.log('\n❌ La app NO está usando el MCP en vivo: la demo funcionará con la caché guardada. Revisa los puntos marcados.\n');
  } else if (warnings) {
    console.log('\n✅ La app usa el MCP en vivo. ⚠️ Aun así revisa los avisos (p. ej. filtros que el MCP podría ignorar).\n');
  } else {
    console.log('\n✅ El MCP funciona en vivo con la app.\n');
  }
  process.exit(live ? 0 : 1);
})();
