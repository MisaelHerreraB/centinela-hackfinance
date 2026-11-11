/**
 * Cliente MCP Real conectado al servidor oficial de MyInvestor + GPTadvisor
 * Endpoint: https://mcp.myinvestor.es/mcp
 * Incluye fallback determinista en caché con datos reales verificados del propio MCP
 * por si falla la conexión Wi-Fi en el auditorio durante la demo.
 */

const DEFAULT_MCP_URL = process.env.MYINVESTOR_MCP_URL || 'https://mcp.myinvestor.es/mcp';

// Caché de respaldo con datos reales extraídos de https://mcp.myinvestor.es/mcp
const FALLBACK_CATALOG = {
  'Renta Variable': [
    {
      isin: 'IE000ZYRH0Q7',
      name: 'iShares Developed World Index Fund (IE) S Acc EUR',
      management_company: 'BlackRock Asset Management Ireland',
      asset_type: 'Renta Variable',
      geography: 'Global',
      management_type: 'Índice/pasivo',
      currency: 'EUR',
      ter: 0.06,
      management_fee: 0.06,
      risk_indicator: 4,
      return_3y: 18.12,
      min_initial: '1.00 EUR'
    },
    {
      isin: 'IE00BYX5NX33',
      name: 'Fidelity MSCI World Index Fund EUR P Acc',
      management_company: 'FIL Distributors',
      asset_type: 'Renta Variable',
      geography: 'Global',
      management_type: 'Índice/pasivo',
      currency: 'EUR',
      ter: 0.12,
      management_fee: 0.12,
      risk_indicator: 4,
      return_3y: 17.99,
      min_initial: '1.00 EUR'
    },
    {
      isin: 'IE00BD0NCM55',
      name: 'iShares Developed World Index Fund (IE) D Acc EUR',
      management_company: 'BlackRock Asset Management Ireland',
      asset_type: 'Renta Variable',
      geography: 'Global',
      management_type: 'Índice/pasivo',
      currency: 'EUR',
      ter: 0.12,
      management_fee: 0.12,
      risk_indicator: 4,
      return_3y: 17.97,
      min_initial: '1.00 EUR'
    }
  ],
  'Renta Fija': [
    {
      isin: 'FR0013506995',
      name: 'Lazard Euro Short Duration Income Opportunities SRI RVC EUR',
      management_company: 'Lazard Frères Gestion',
      asset_type: 'Renta Fija',
      geography: 'Europa',
      management_type: 'Activa',
      currency: 'EUR',
      ter: 0.04,
      management_fee: 0.04,
      risk_indicator: 2,
      return_3y: 3.45,
      min_initial: '1.00 EUR'
    },
    {
      isin: 'LU2339731064',
      name: 'Amundi Prime Euro Government Bond IE (C)',
      management_company: 'Amundi Luxembourg',
      asset_type: 'Renta Fija',
      geography: 'Europa',
      management_type: 'Índice/pasivo',
      currency: 'EUR',
      ter: 0.05,
      management_fee: 0.05,
      risk_indicator: 3,
      return_3y: 2.85,
      min_initial: '1.00 EUR'
    }
  ],
  'Monetario': [
    {
      isin: 'FR0000447823',
      name: 'AXA Trésor Court Terme C (Fondo Puente Carteras MyInvestor)',
      management_company: 'AXA Investment Managers Paris',
      asset_type: 'Monetario',
      geography: 'Europa',
      management_type: 'Activa',
      currency: 'EUR',
      ter: 0.05,
      management_fee: 0.05,
      risk_indicator: 1,
      return_3y: 3.32,
      min_initial: '1.00 EUR'
    },
    {
      isin: 'FR0010738229',
      name: 'Ofi Invest ISR Monétaire CT E',
      management_company: 'Ofi Invest Asset Management',
      asset_type: 'Monetario',
      geography: 'Europa',
      management_type: 'Activa',
      currency: 'EUR',
      ter: 0.06,
      management_fee: 0.06,
      risk_indicator: 1,
      return_3y: 3.28,
      min_initial: '1.00 EUR'
    }
  ],
  'Mixto': [
    {
      isin: 'CARTERA_CLASICA_MYINVESTOR',
      name: 'Cartera Indexada Clásica / Indie MyInvestor (Roboadvisor)',
      management_company: 'MyInvestor',
      asset_type: 'Mixto',
      geography: 'Global',
      management_type: 'Índice/pasivo',
      currency: 'EUR',
      ter: 0.30,
      management_fee: 0.15,
      risk_indicator: 3,
      return_3y: 9.80,
      min_initial: '150.00 EUR'
    },
    {
      isin: 'ES0119207001',
      name: 'Cobas Renta FI',
      management_company: 'Cobas Asset Management',
      asset_type: 'Mixto',
      geography: 'Global',
      management_type: 'Activa',
      currency: 'EUR',
      ter: 0.33,
      management_fee: 0.30,
      risk_indicator: 3,
      return_3y: 8.40,
      min_initial: '1.00 EUR'
    }
  ]
};

const FALLBACK_PORTFOLIOS = [
  {
    name_id: 'MY_SAVINGS',
    name: 'Cartera Ahorro MyInvestor',
    profile: 'CONSERVADOR',
    risk: 0,
    ter_total: 0.30,
    bridge_fund_isin: 'FR0000447823',
    bridge_fund_name: 'AXA Trésor Court Terme C',
    description: 'Cartera automatizada de renta fija a corto plazo y monetarios con diferimiento fiscal.'
  },
  {
    name_id: 'CLASSICAL',
    name: 'Cartera Clásica MyInvestor',
    profile: 'MODERADO',
    risk: 2,
    ter_total: 0.30,
    bridge_fund_isin: 'FR0000447823',
    bridge_fund_name: 'AXA Trésor Court Terme C',
    description: 'Cartera indexada global diversificada (Renta Fija + Renta Variable) al 0,30 % total.'
  },
  {
    name_id: 'INDIE',
    name: 'Cartera Indie MyInvestor',
    profile: 'DINAMICO',
    risk: 3,
    ter_total: 0.30,
    bridge_fund_isin: 'FR0000447823',
    bridge_fund_name: 'AXA Trésor Court Terme C',
    description: 'Cartera indexada global con predominio de renta variable internacional al 0,30 % total.'
  },
  {
    name_id: 'METAL',
    name: 'Cartera Metal MyInvestor',
    profile: 'MUY_AGRESIVO',
    risk: 5,
    ter_total: 0.30,
    bridge_fund_isin: 'FR0000447823',
    bridge_fund_name: 'AXA Trésor Court Terme C',
    description: '100% Renta Variable Indexada Global (Fidelity, Vanguard, iShares) al 0,30 % total.'
  }
];

// Sesión MCP (transporte Streamable HTTP): initialize -> notifications/initialized -> tools/call.
// Si el servidor no usa sesiones, la cabecera simplemente no llega y se sigue sin ella.
let mcpSession = { id: null, initialized: false };

function parseRpcResponse(rawText, requestId) {
  const candidates = [];
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    candidates.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  } else {
    // SSE: puede haber varios eventos "data:"; un mismo evento puede ocupar varias líneas data:
    for (const block of rawText.split(/\r?\n\r?\n/)) {
      const dataLines = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart());
      if (!dataLines.length) continue;
      try {
        candidates.push(JSON.parse(dataLines.join('\n')));
      } catch (e) {
        /* evento no JSON: se ignora */
      }
    }
  }
  return (
    candidates.find((c) => c && c.id === requestId && ('result' in c || 'error' in c)) ||
    candidates.find((c) => c && ('result' in c || 'error' in c)) ||
    null
  );
}

async function postRpc(body, { deadline, expectResponse = true }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(300, deadline - Date.now()));
  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'User-Agent': 'Centinela-MyInvestor-HackFinance/1.0'
    };
    if (mcpSession.id) headers['Mcp-Session-Id'] = mcpSession.id;
    const response = await fetch(DEFAULT_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const sessionHeader = response.headers.get('mcp-session-id');
    if (sessionHeader) mcpSession.id = sessionHeader;
    const rawText = expectResponse ? await response.text() : '';
    return { status: response.status, ok: response.ok, rawText };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureMcpSession(deadline) {
  if (mcpSession.initialized) return;
  const initId = Date.now();
  let init;
  init = await postRpc(
    {
      jsonrpc: '2.0',
      id: initId,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'centinela-hackfinance', version: '1.0.0' }
      }
    },
    { deadline }
  );
  let parsed = null;
  try {
    parsed = init.ok ? parseRpcResponse(init.rawText, initId) : null;
  } catch (e) {
    parsed = null;
  }
  if (!init.ok || !parsed || parsed.error) {
    // El servidor no acepta initialize: se intenta en modo sin sesión (tools/call directo)
    mcpSession = { id: null, initialized: true };
    return;
  }
  await postRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, { deadline, expectResponse: false }).catch(() => {});
  mcpSession.initialized = true;
}

function extractToolData(result) {
  if (!result) return {};
  if (result.structuredContent) return result.structuredContent.data || result.structuredContent;
  const textBlock = (result.content || []).find((b) => b.type === 'text');
  if (textBlock) {
    try {
      const parsed = JSON.parse(textBlock.text);
      return parsed.data || parsed;
    } catch (e) {
      return { text: textBlock.text };
    }
  }
  return result;
}

async function rpcWithSession(method, params, timeoutMs) {
  // Presupuesto total de tiempo para toda la secuencia (initialize + llamada + posible reintento)
  const deadline = Date.now() + timeoutMs;
  await ensureMcpSession(deadline);
  const id = Date.now() + 1;
  let res = await postRpc({ jsonrpc: '2.0', id, method, params }, { deadline });
  if ((res.status === 404 || res.status === 400) && mcpSession.id && Date.now() < deadline - 300) {
    // Sesión caducada: se reinicia una vez
    mcpSession = { id: null, initialized: false };
    await ensureMcpSession(deadline);
    res = await postRpc({ jsonrpc: '2.0', id, method, params }, { deadline });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = parseRpcResponse(res.rawText, id);
  if (!parsed) throw new Error('Respuesta MCP vacía o ilegible');
  if (parsed.error) throw new Error(`MCP error ${parsed.error.code}: ${parsed.error.message}`);
  return parsed.result;
}

async function callMyInvestorMCPTool(toolName, args = {}, timeoutMs = 4500) {
  const start = Date.now();
  try {
    const result = await rpcWithSession('tools/call', { name: toolName, arguments: args }, timeoutMs);
    if (result?.isError) {
      const msg = (result.content || []).map((b) => b.text).join(' ').slice(0, 200);
      throw new Error(`La herramienta devolvió error: ${msg}`);
    }
    return {
      ok: true,
      source: 'LIVE_MCP (https://mcp.myinvestor.es/mcp)',
      latency_ms: Date.now() - start,
      tool: toolName,
      arguments: args,
      data: extractToolData(result)
    };
  } catch (err) {
    // Error de red, o estábamos en modo sin sesión: la próxima llamada vuelve a intentar initialize
    if (!/HTTP|MCP error|herramienta/.test(err.message) || !mcpSession.id) mcpSession = { id: null, initialized: false };
    return {
      ok: false,
      source: 'CACHED_MCP_SNAPSHOT (Fallback sin red)',
      latency_ms: Date.now() - start,
      tool: toolName,
      arguments: args,
      error: err.name === 'AbortError' ? 'Timeout' : err.message
    };
  }
}

async function listMyInvestorTools(timeoutMs = 6000) {
  const result = await rpcWithSession('tools/list', {}, timeoutMs);
  return result?.tools || [];
}

function resetMcpSession() {
  mcpSession = { id: null, initialized: false };
}

/**
 * Busca alternativas reales en la misma categoría dentro del catálogo de MyInvestor vía MCP
 */
async function findCategoryAlternatives({ asset_type = 'Renta Variable', geography = 'Global', query = '' }) {
  const normalizedCategory = ['Renta Variable', 'Renta Fija', 'Monetario', 'Mixto'].includes(asset_type)
    ? asset_type
    : 'Renta Variable';

  const mcpArgs = {
    asset_type: normalizedCategory,
    currency: 'EUR',
    order_by: 'ter_asc',
    limit: 3
  };
  if (normalizedCategory === 'Renta Variable') {
    mcpArgs.management_type = 'Index/Passive';
    if (geography) mcpArgs.geography = geography;
  }

  const liveRes = await callMyInvestorMCPTool('search_funds', mcpArgs);
  const liveFundsAvailable = liveRes.ok && Array.isArray(liveRes.data?.funds) && liveRes.data.funds.length > 0;
  let funds = liveFundsAvailable
    ? liveRes.data.funds.map((f) => ({
        isin: f.isin,
        name: f.name,
        management_company: f.management_company,
        asset_type: f.asset_type || normalizedCategory,
        geography: f.geography || geography,
        management_type: f.management_type,
        currency: f.currency || 'EUR',
        ter: typeof f.ter === 'number' ? f.ter : 0.12,
        risk_indicator: f.risk_indicator || 4,
        return_3y: f.return_3y ? Number(f.return_3y.toFixed(2)) : null,
        warning_text: f.warning_text || null
      }))
    : FALLBACK_CATALOG[normalizedCategory] || FALLBACK_CATALOG['Renta Variable'];

  return {
    // Solo se dice "LIVE" si los fondos mostrados vienen de verdad del MCP en esta llamada
    mcp_status: liveFundsAvailable
      ? liveRes.source
      : liveRes.ok
        ? 'CACHED_MCP_SNAPSHOT (el MCP respondió sin fondos para estos filtros)'
        : liveRes.source,
    mcp_live: liveFundsAvailable,
    mcp_error: liveRes.ok ? null : liveRes.error,
    mcp_latency_ms: liveRes.latency_ms,
    mcp_tool_called: 'search_funds',
    mcp_arguments: mcpArgs,
    category: normalizedCategory,
    alternatives: funds,
    recommended_portfolio:
      normalizedCategory === 'Monetario' || normalizedCategory === 'Renta Fija'
        ? FALLBACK_PORTFOLIOS[0]
        : normalizedCategory === 'Mixto'
          ? FALLBACK_PORTFOLIOS[1]
          : FALLBACK_PORTFOLIOS[3]
  };
}

/**
 * Verifica en el MCP de MyInvestor si un supuesto producto prometido por teléfono existe realmente
 */
async function verifyProductExistsInMyInvestor(productNameOrIsin) {
  const liveRes = await callMyInvestorMCPTool('search_funds', {
    query: productNameOrIsin,
    limit: 3
  });
  const verified = liveRes.ok && Array.isArray(liveRes.data?.funds);
  const foundFunds = verified ? liveRes.data.funds : [];
  return {
    mcp_status: liveRes.source,
    mcp_latency_ms: liveRes.latency_ms,
    query: productNameOrIsin,
    // true / false solo si el MCP respondió de verdad; null = no se pudo comprobar (sin red, error...).
    // Un "no verificado" NUNCA cuenta como señal de estafa.
    exists_in_catalog: verified ? foundFunds.length > 0 : null,
    verification: verified ? 'VERIFICADO_EN_MCP' : 'NO_VERIFICADO',
    mcp_error: liveRes.ok ? null : liveRes.error,
    matches: foundFunds.slice(0, 2).map((f) => ({ isin: f.isin, name: f.name, ter: f.ter }))
  };
}

module.exports = {
  DEFAULT_MCP_URL,
  FALLBACK_CATALOG,
  FALLBACK_PORTFOLIOS,
  callMyInvestorMCPTool,
  listMyInvestorTools,
  resetMcpSession,
  parseRpcResponse,
  findCategoryAlternatives,
  verifyProductExistsInMyInvestor
};
