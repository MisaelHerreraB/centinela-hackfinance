/**
 * Tests de regresión del parche "sin datos inventados".
 * Ejecutar:  npm test   (Node >= 18, sin dependencias)
 * No usan red: levantan un MCP simulado y un Claude simulado en localhost.
 */

process.env.CENTINELA_SKIP_DOTENV = '1'; // la clave real del equipo (.env) nunca entra en los tests

const test = require('node:test');
const { before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------- Servidores simulados (se arrancan antes de cargar la app) ----------
const mock = { mode: 'stateful', sessions: new Set(), calls: [], claudeMode: 'ok', claudeBodies: [] };

function sendRpc(res, payload, { sse = false, session = null } = {}) {
  const headers = { 'Content-Type': sse ? 'text/event-stream' : 'application/json' };
  if (session) headers['Mcp-Session-Id'] = session;
  res.writeHead(200, headers);
  res.end(sse ? `event: message\ndata: ${JSON.stringify(payload)}\n\n` : JSON.stringify(payload));
}

const FUNDS = [
  { isin: 'IE000ZYRH0Q7', name: 'iShares Developed World Index Fund (IE) S Acc EUR', ter: 0.06, asset_type: 'Renta Variable', return_3y: 18.123 },
  { isin: 'IE00BYX5NX33', name: 'Fidelity MSCI World Index Fund EUR P Acc', ter: 0.12, asset_type: 'Renta Variable' }
];

const mcpServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const rpc = body ? JSON.parse(body) : {};
    mock.calls.push({ method: rpc.method, session: req.headers['mcp-session-id'] || null, args: rpc.params?.arguments });
    if (mock.mode === 'slow') await new Promise((r) => setTimeout(r, 8000));
    if (mock.mode === 'http500') {
      res.writeHead(500);
      return res.end('boom');
    }
    if (rpc.method === 'initialize') {
      if (mock.mode === 'stateless') return sendRpc(res, { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Method not found' } });
      const sid = `sess-${mock.sessions.size + 1}`;
      mock.sessions.add(sid);
      return sendRpc(res, { jsonrpc: '2.0', id: rpc.id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} } } }, { session: sid });
    }
    if (rpc.method === 'notifications/initialized') {
      res.writeHead(202);
      return res.end();
    }
    if (mock.mode === 'stateful' || mock.mode === 'expire') {
      const sid = req.headers['mcp-session-id'];
      if (!sid || !mock.sessions.has(sid)) {
        res.writeHead(sid ? 404 : 400);
        return res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad session' } }));
      }
    }
    if (rpc.method === 'tools/list') {
      return sendRpc(res, { jsonrpc: '2.0', id: rpc.id, result: { tools: [{ name: 'search_funds', inputSchema: { type: 'object', properties: { query: {}, asset_type: {}, currency: {}, order_by: {}, limit: {}, management_type: {}, geography: {} } } }] } }, { sse: true });
    }
    if (rpc.method === 'tools/call') {
      if (mock.mode === 'rpcError') return sendRpc(res, { jsonrpc: '2.0', id: rpc.id, error: { code: -32602, message: 'Invalid params' } });
      if (mock.mode === 'toolError') return sendRpc(res, { jsonrpc: '2.0', id: rpc.id, result: { isError: true, content: [{ type: 'text', text: 'asset_type inválido' }] } });
      const q = rpc.params?.arguments?.query;
      const funds = q && /bono vip|inexistente/i.test(q) ? [] : FUNDS;
      if (mock.mode === 'textContent') {
        return sendRpc(res, { jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: JSON.stringify({ data: { funds } }) }] } }, { sse: true });
      }
      return sendRpc(res, { jsonrpc: '2.0', id: rpc.id, result: { structuredContent: { data: { funds } } } }, { sse: true });
    }
    sendRpc(res, { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'no' } });
  });
});

const claudeServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    mock.claudeBodies.push(JSON.parse(body || '{}'));
    if (mock.claudeMode === 'retired') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'model: claude-sonnet-4-20250514' } }));
    }
    const json = mock.claudeMode === 'stringNumbers'
      ? '{"name":"Fondo Foto","bank_name":"Banco X","asset_type":"Renta Variable","product_type":"FONDO_INVERSION","offered_ter_pct":"1,95","exit_fee_pct":"0","amount_eur":"25.000"}'
      : '{"name":"Fondo Foto","bank_name":"Banco X","asset_type":"Renta Variable","product_type":"FONDO_INVERSION","offered_ter_pct":1.95,"exit_fee_pct":0,"amount_eur":25000}';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text: `Aquí está:\n${json}` }] }));
  });
});

let BASE;
let app;
let ai;
let mcp;

before(async () => {
  await new Promise((r) => mcpServer.listen(0, '127.0.0.1', r));
  await new Promise((r) => claudeServer.listen(0, '127.0.0.1', r));
  process.env.MYINVESTOR_MCP_URL = `http://127.0.0.1:${mcpServer.address().port}/mcp`;
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${claudeServer.address().port}`;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
  app = require('../src/server').server;
  ai = require('../src/services/aiService');
  mcp = require('../src/services/mcpClient');
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  BASE = `http://localhost:${app.address().port}`;
});

after(() => {
  app.close();
  mcpServer.close();
  claudeServer.close();
});

beforeEach(() => {
  mock.mode = 'stateful';
  mock.calls = [];
  mock.sessions.clear();
  mock.claudeMode = 'ok';
  mock.claudeBodies = [];
  mcp && mcp.resetMcpSession();
  ai && ai.setRuntimeKeys({ anthropicKey: '', elevenLabsKey: '' });
});

async function post(p, body) {
  const res = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

const SAMPLE_PDF = fs.readFileSync(path.join(__dirname, '..', 'public', 'samples', 'folleto_dfi_banco_tradicional.pdf'));

// =============================================================================
// 1. Nada de datos inventados en la extracción de documentos y audio
// =============================================================================
test('Subir el PDF de ejemplo SIN clave lee el archivo real (TER 1,80 %, ISIN ficticio, 50.000 €)', async () => {
  const { json } = await post('/api/analyze-document', { imageBase64: `data:application/pdf;base64,${SAMPLE_PDF.toString('base64')}`, imageMimeType: 'application/pdf' });
  assert.equal(json.ok, true);
  assert.equal(json.needs_input, undefined);
  assert.equal(json.step_1_input.extractor, 'CENTINELA_PDF_TEXT_EXTRACTOR');
  assert.equal(json.step_1_input.offered_ter_pct, 1.8);
  assert.equal(json.step_1_input.isin, 'XX0000DEMO01');
  assert.equal(json.step_1_input.product_type, 'FONDO_INVERSION');
  assert.equal(json.step_2_verdict.verdict, 'CARO');
  assert.equal(json.amount_is_example, false);
  assert.match(json.spoken_text, /Con 50\.000 euros/);
});

test('Subir una FOTO sin clave de Claude NO devuelve un veredicto inventado', async () => {
  const { json } = await post('/api/analyze-document', { imageBase64: 'data:image/png;base64,iVBORw0KGgo=', imageMimeType: 'image/png' });
  assert.equal(json.needs_input, true);
  assert.match(json.message, /clave de Claude/);
  assert.equal(json.step_2_verdict, undefined);
});

test('Subir un PDF ilegible (escaneo) pide el dato en vez de suponer 1,80 %', async () => {
  const fake = Buffer.from('%PDF-1.4\n1 0 obj << /Length 5 /Filter /DCTDecode >> stream\nxxxxx\nendstream endobj\n%%EOF');
  const { json } = await post('/api/analyze-document', { imageBase64: fake.toString('base64'), imageMimeType: 'application/pdf' });
  assert.equal(json.needs_input, true);
  assert.equal(json.step_1_input.offered_ter_pct, null);
});

test('Un PDF corrupto no rompe el servidor', async () => {
  const { status, json } = await post('/api/analyze-document', { imageBase64: 'esto-no-es-base64-%%%', imageMimeType: 'application/pdf' });
  assert.equal(status, 200);
  assert.equal(json.needs_input, true);
});

test('Texto hablado sin comisión -> pide la comisión (antes asumía 1,80 % y decía CARO)', async () => {
  const { json } = await post('/api/analyze-document', { text: 'quiero meter 20.000 euros en un fondo del banco' });
  assert.equal(json.needs_input, true);
  assert.match(json.ask_user, /comisión anual/);
});

test('Texto con comisión y sin importe -> calcula con un EJEMPLO declarado de 50.000 €', async () => {
  const { json } = await post('/api/analyze-document', { text: 'me ofrecen un fondo con una comisión del 1,5 %' });
  assert.equal(json.step_1_input.offered_ter_pct, 1.5);
  assert.equal(json.amount_is_example, true);
  assert.match(json.spoken_text, /Para un ejemplo de 50\.000 euros/);
});

test('"Rentabilidad del 5 % anual" no se confunde con la comisión', async () => {
  const r = await ai.extractFinancialOfferWithClaude({ text: 'fondo con rentabilidad del 5% anual y comisión de gestión del 2%' });
  assert.equal(r.offered_ter_pct, 2);
  const r2 = await ai.extractFinancialOfferWithClaude({ text: 'fondo con rentabilidad del 5% anual' });
  assert.equal(r2.offered_ter_pct, null);
});

test('"Comisión de depósito" no convierte un fondo en depósito bancario', async () => {
  const r = await ai.extractFinancialOfferWithClaude({ text: 'Fondo de Inversión FI. TER 1,2 %. Comisión de depósito 0,1 %' });
  assert.equal(r.product_type, 'FONDO_INVERSION');
});

test('Los botones de demo (preset) siguen funcionando y se etiquetan como DEMO_PRESET', async () => {
  const preset = { name: 'FonBanco Selección Global Gestión Activa FI', bank_name: 'Banco Tradicional Sucursal', isin: 'XX0000DEMO01', asset_type: 'Renta Variable', geography: 'Global', product_type: 'FONDO_INVERSION', offered_ter_pct: 1.8, exit_fee_pct: 0, amount_eur: 50000 };
  const { json } = await post('/api/analyze-document', { presetDocument: preset, amount_eur: 50000, years: 10, gross_return_pct: 5 });
  assert.equal(json.step_1_input.extractor, 'DEMO_PRESET');
  assert.equal(json.step_2_verdict.verdict, 'CARO');
  const m = json.step_2_verdict.cost_analysis.metrics;
  // Cifras que DEBEN coincidir con el guion y el deck corregidos (con la caché: iShares 0,06 %)
  assert.equal(m.loss_10y_vs_portfolio_eur, 10635);
  assert.equal(m.final_capital_30y_offered_eur, 128636);
  assert.equal(m.final_capital_30y_direct_eur, 212423);
  assert.equal(m.loss_30y_vs_direct_index_eur, 83787);
  assert.equal(m.final_capital_30y_portfolio_eur, 198322);
  assert.equal(m.loss_30y_vs_portfolio_eur, 69686);
});

test('Audio sin clave de ElevenLabs -> ok:false y texto vacío (antes devolvía la estafa de Quantum)', async () => {
  const { json } = await post('/api/stt', { audioBase64: 'data:audio/webm;base64,AAAA', mimeType: 'audio/webm' });
  assert.equal(json.ok, false);
  assert.equal(json.text, '');
  assert.doesNotMatch(JSON.stringify(json), /Quantum/);
});

test('Claude: usa el modelo vigente (claude-sonnet-5-5), no el retirado', async () => {
  ai.setRuntimeKeys({ anthropicKey: 'sk-test' });
  const r = await ai.extractFinancialOfferWithClaude({ imageBase64: 'data:image/png;base64,iVBORw0KGgo=', imageMimeType: 'image/png' });
  assert.equal(mock.claudeBodies[0].model, 'claude-sonnet-5-5');
  assert.equal(r.extractor, 'CLAUDE_LIVE_API');
  assert.equal(r.offered_ter_pct, 1.95);
  assert.equal(r.amount_eur, 25000);
});

test('Claude devolviendo números como texto ("1,95", "25.000") se normaliza bien', async () => {
  ai.setRuntimeKeys({ anthropicKey: 'sk-test' });
  mock.claudeMode = 'stringNumbers';
  const r = await ai.extractFinancialOfferWithClaude({ text: 'x', imageBase64: 'data:image/jpeg;base64,/9j/', imageMimeType: 'image/jpeg' });
  assert.equal(r.offered_ter_pct, 1.95);
  assert.equal(r.amount_eur, 25000);
});

test('Si Claude falla (modelo retirado), se informa del error y NO se inventa nada', async () => {
  ai.setRuntimeKeys({ anthropicKey: 'sk-test' });
  mock.claudeMode = 'retired';
  const { json } = await post('/api/analyze-document', { imageBase64: 'data:image/png;base64,iVBORw0KGgo=', imageMimeType: 'image/png' });
  assert.equal(json.needs_input, true);
  assert.match(json.message, /HTTP_404/);
  assert.match(ai.getAiStatus().claude_last_error, /HTTP_404/);
});

test('Foto en HEIC (iPhone) con clave: no se envía a Claude (no lo admite) y se explica', async () => {
  ai.setRuntimeKeys({ anthropicKey: 'sk-test' });
  const r = await ai.extractFinancialOfferWithClaude({ imageBase64: 'data:image/heic;base64,AAAA', imageMimeType: 'image/heic' });
  assert.equal(mock.claudeBodies.length, 0);
  assert.equal(r.extraction_complete, false);
  assert.match(r.reason, /image\/heic/);
});

// =============================================================================
// 2. Detector de estafas: menos falsos positivos/negativos y nada medido "de mentira"
// =============================================================================
const { analyzeFraudRisk } = require('../src/engine/fraudEngine');

test('Estafa parafraseada ("ganancias seguras del 15 %, sin riesgos") se detecta', () => {
  assert.equal(analyzeFraudRisk({ text: 'Te llamo de Quantum: ganancias seguras del 15 % al año, sin riesgos, mándame 9000 euros ya' }).verdict, 'ESTAFA');
  assert.equal(analyzeFraudRisk({ text: 'Inversión con un 150% de beneficio asegurado en 3 meses' }).verdict, 'ESTAFA');
});

test('IBAN de Revolut (lituano) de un familiar ya NO es estafa ni tiene "3 denuncias" inventadas', () => {
  const r = analyzeFraudRisk({ text: 'Hola mamá, te paso mi IBAN de Revolut LT12 3250 0123 4567 8901 para lo de la cena' });
  assert.equal(r.verdict, 'ADELANTE');
  assert.equal(r.iban_check.flagged, false);
  assert.equal(r.iban_check.reports, 0);
  assert.ok(r.signals.some((s) => s.type === 'IBAN_EXTRANJERO_NO_VERIFICADO'));
});

test('Productos garantizados legales (3 %, depósito al 2,9 %) no son estafa', () => {
  assert.equal(analyzeFraudRisk({ text: 'Me han ofrecido un fondo con rentabilidad garantizada del 3% en el Santander' }).verdict, 'ADELANTE');
  assert.equal(analyzeFraudRisk({ text: 'Depósito a plazo al 2,9 % garantizado por el Fondo de Garantía de Depósitos' }).verdict, 'ADELANTE');
});

test('La velocidad del habla solo aparece si se mide o se declara simulada', () => {
  assert.equal(analyzeFraudRisk({ text: 'hola' }).prosody_analysis.speech_rate_wpm, null);
  assert.equal(analyzeFraudRisk({ text: 'Rentabilidad del 12% anual fijo sin ningún riesgo' }).prosody_analysis.speech_rate_wpm, null);
  const sim = analyzeFraudRisk({ text: 'x', speech_rate_wpm: 188, speech_rate_source: 'DEMO_SIMULADO' }).prosody_analysis;
  assert.equal(sim.speech_rate_wpm, 188);
  assert.equal(sim.speech_rate_source, 'DEMO_SIMULADO');
});

test('La telemetría de llamada no se deduce del veredicto', () => {
  const r = analyzeFraudRisk({ text: 'Rentabilidad del 12% anual fijo sin ningún riesgo, no cuelgues' });
  assert.equal(r.verdict, 'ESTAFA');
  assert.equal(r.in_call_telemetry.active_voice_call_during_banking, null);
});

test('Un IBAN español sin denuncias ya no dice "SEPA VoP MATCH" (no se ha verificado)', () => {
  const r = analyzeFraudRisk({ text: 'paga a ES7620770024003102575766' });
  assert.equal(r.iban_check.sepa_vop_status, 'NO_VERIFICADO');
});

test('Las listas CNMV/IBAN se marcan como datos de demostración', () => {
  const r = analyzeFraudRisk({ text: 'Invierte con AlphaYield Crypto & Forex VIP' });
  assert.equal(r.cnmv_check.flagged, true);
  assert.equal(r.cnmv_check.data_source, 'DEMO');
});

test('Producto no verificable (MCP caído) NO suma riesgo; inexistente verificado SÍ', () => {
  const noVer = analyzeFraudRisk({ text: 'quiero el fondo X', claimed_product: 'Fondo X', product_exists_in_mcp: null });
  assert.ok(!noVer.signals.some((s) => s.type === 'PRODUCTO_INEXISTENTE_MCP'));
  const inex = analyzeFraudRisk({ text: 'quiero el fondo X', claimed_product: 'Fondo X', product_exists_in_mcp: false });
  assert.ok(inex.signals.some((s) => s.type === 'PRODUCTO_INEXISTENTE_MCP'));
});

test('El texto de intervención no se inventa 9.000 € cuando no hay importe', () => {
  const r = analyzeFraudRisk({ text: 'Su cuenta sufre bloqueo inminente, pincha en este enlace e introduce tu código SMS' });
  assert.equal(r.verdict, 'ESTAFA');
  assert.doesNotMatch(r.behavioral_intervention.psr_psd3_bank_shield, /9\.?000/);
});

test('El benchmark oficial sigue en 30/30', () => {
  const { runBenchmark30 } = require('../src/evals/run_evals');
  const rep = runBenchmark30();
  assert.equal(rep.passed_cases, 30, JSON.stringify(rep.cases.filter((c) => !c.passed)));
});

// =============================================================================
// 3. Endpoints de llamada/SMS
// =============================================================================
test('analyze-call vacío -> 400 con mensaje (no un veredicto)', async () => {
  const { status, json } = await post('/api/analyze-call', { text: '   ' });
  assert.equal(status, 400);
  assert.equal(json.ok, false);
});

test('Escenario 1 de la demo sigue igual: ESTAFA, 9.000 €, aviso a Daniel, 188 WPM simulado', async () => {
  const { json } = await post('/api/analyze-call', {
    text: 'Hola Carmen, te llamo de Quantum Ibérica Capital. Te activamos hoy el Bono VIP con un 12% anual garantizado sin ningún riesgo. Quedan las últimas plazas solo por hoy en los próximos 15 minutos. Transfiere ahora mismo 9.000 euros al IBAN ES91 2100 0418 4502 0005 1332.',
    entity_name: 'Quantum Ibérica Capital',
    iban: 'ES9121000418450200051332',
    claimed_product: 'Bono VIP 12% Garantizado MyInvestor',
    amount_eur: 9000,
    speech_rate_wpm: 188,
    speech_rate_source: 'DEMO_SIMULADO'
  });
  const v = json.step_2_verdict;
  assert.equal(v.verdict, 'ESTAFA');
  assert.equal(v.mcp_verification.exists_in_catalog, false); // el MCP simulado no tiene el "Bono VIP"
  assert.ok(v.fraud_analysis.signals.some((s) => s.type === 'PRODUCTO_INEXISTENTE_MCP'));
  assert.equal(v.fraud_analysis.prosody_analysis.speech_rate_source, 'DEMO_SIMULADO');
  assert.match(json.spoken_text, /9\.?000 euros/);
  assert.match(json.step_3_action.family_notification.title, /9\.?000 €/);
  assert.equal(json.step_3_action.allow_client_override, true);
});

test('SMS sin importe: el aviso a Daniel no muestra 9.000 € ni un IBAN inventado', async () => {
  const { json } = await post('/api/analyze-call', { text: 'AVISO URGENTE MYINVESTOR: Su cuenta sufre bloqueo inminente. Pincha en este enlace myinvestor-seguridad.com e introduce tu código SMS de firma.', entity_name: 'myinvestor-seguridad.com' });
  assert.equal(json.step_2_verdict.verdict, 'ESTAFA');
  const n = json.step_3_action.family_notification;
  assert.doesNotMatch(n.title + n.body, /9\.?000/);
  assert.equal(n.iban_blocked, null);
  assert.doesNotMatch(json.spoken_text, /euros/);
  assert.doesNotMatch(json.spoken_text, /rentabilidad garantizada falsa/);
});

test('Con el MCP caído, un producto legítimo NO cuenta como "inexistente"', async () => {
  mock.mode = 'http500';
  const { json } = await post('/api/analyze-call', { text: 'Me recomiendan el Fidelity MSCI World', claimed_product: 'Fidelity MSCI World' });
  assert.equal(json.step_2_verdict.mcp_verification.exists_in_catalog, null);
  assert.equal(json.step_2_verdict.mcp_verification.verification, 'NO_VERIFICADO');
  assert.equal(json.step_2_verdict.verdict, 'ADELANTE');
});

// =============================================================================
// 4. Cliente MCP: sesión, formatos de respuesta, errores y tiempos
// =============================================================================
test('MCP con sesión (initialize + Mcp-Session-Id + SSE) -> datos en vivo', async () => {
  const r = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  assert.equal(r.mcp_live, true);
  assert.match(r.mcp_status, /^LIVE/);
  assert.equal(r.alternatives[0].isin, 'IE000ZYRH0Q7');
  assert.equal(r.alternatives[0].return_3y, 18.12);
  const call = mock.calls.find((c) => c.method === 'tools/call');
  assert.equal(call.session, 'sess-1');
});

test('La sesión se reutiliza entre llamadas (no se reinicializa cada vez)', async () => {
  await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  assert.equal(mock.calls.filter((c) => c.method === 'initialize').length, 1);
});

test('MCP sin sesiones (initialize no soportado) -> funciona igual', async () => {
  mock.mode = 'stateless';
  const r = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  assert.equal(r.mcp_live, true);
});

test('Sesión caducada (404) -> se reinicia una vez y funciona', async () => {
  await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  mock.sessions.clear(); // el servidor "olvida" la sesión
  const r = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  assert.equal(r.mcp_live, true);
});

test('Respuesta en content[].text (sin structuredContent) también se entiende', async () => {
  mock.mode = 'textContent';
  mcp.resetMcpSession();
  const r = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  assert.equal(r.mcp_live, true);
});

test('Error JSON-RPC o isError -> caché, y el estado lo dice (no "LIVE")', async () => {
  for (const mode of ['rpcError', 'toolError']) {
    mock.mode = mode;
    mcp.resetMcpSession();
    const r = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
    assert.equal(r.mcp_live, false, mode);
    assert.match(r.mcp_status, /^CACHED/, mode);
    assert.ok(r.alternatives.length > 0, mode);
  }
});

test('Verificar producto: inexistente verificado = false; MCP caído = null', async () => {
  const no = await mcp.verifyProductExistsInMyInvestor('Producto inexistente');
  assert.equal(no.exists_in_catalog, false);
  assert.equal(no.verification, 'VERIFICADO_EN_MCP');
  mock.mode = 'http500';
  mcp.resetMcpSession();
  const down = await mcp.verifyProductExistsInMyInvestor('Fidelity');
  assert.equal(down.exists_in_catalog, null);
});

test('MCP colgado: se corta en ~4,5 s en total (no se acumulan esperas)', async () => {
  mock.mode = 'slow';
  const t0 = Date.now();
  const r = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  const elapsed = Date.now() - t0;
  assert.equal(r.mcp_live, false);
  assert.ok(elapsed < 5500, `tardó ${elapsed} ms`);
});

test('MCP sin red (puerto cerrado) -> caché inmediata', async () => {
  const saved = process.env.MYINVESTOR_MCP_URL;
  // El cliente lee la URL al cargar: se prueba con una instancia nueva del módulo
  delete require.cache[require.resolve('../src/services/mcpClient')];
  process.env.MYINVESTOR_MCP_URL = 'http://127.0.0.1:1/mcp';
  const fresh = require('../src/services/mcpClient');
  const t0 = Date.now();
  const r = await fresh.findCategoryAlternatives({ asset_type: 'Monetario' });
  assert.equal(r.mcp_live, false);
  assert.equal(r.alternatives[0].isin, 'FR0000447823');
  assert.ok(Date.now() - t0 < 2000);
  process.env.MYINVESTOR_MCP_URL = saved;
  delete require.cache[require.resolve('../src/services/mcpClient')];
});

// =============================================================================
// 5. Servidor MCP propio y contrato
// =============================================================================
test('/mcp: herramienta desconocida devuelve error JSON-RPC', async () => {
  const { json } = await post('/mcp', { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'transfer_money', arguments: {} } });
  assert.equal(json.error.code, -32602);
});

test('/mcp: enforce_client_contract CARO sin análisis no inventa ahorros', async () => {
  const { json } = await post('/mcp', { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'enforce_client_contract', arguments: { verdict: 'CARO' } } });
  const draft = json.result.structuredContent.transfer_order_draft;
  assert.equal(draft.estimated_10y_savings_eur, null);
  assert.equal(draft.origin_isin, null);
});

test('No queda ningún ISIN real del Santander (ES0113900J37) en el código ni en el PDF de ejemplo', () => {
  const files = ['src/services/aiService.js', 'src/engine/contractEngine.js', 'public/app.js'];
  for (const f of files) assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), /ES0113900J37/, f);
  const { extractPdfText } = require('../src/services/pdfText');
  assert.doesNotMatch(extractPdfText(SAMPLE_PDF), /ES0113900J37/);
});

test('Si el MCP falla al arrancar y luego se recupera, la app vuelve a usar datos en vivo', async () => {
  mock.mode = 'http500';
  mcp.resetMcpSession();
  const down = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  assert.equal(down.mcp_live, false);
  mock.mode = 'stateful';
  const up = await mcp.findCategoryAlternatives({ asset_type: 'Renta Variable' });
  assert.equal(up.mcp_live, true);
});

test('Extracción: una comisión de reembolso sola no se toma como comisión anual', async () => {
  const r = await ai.extractFinancialOfferWithClaude({ text: 'fondo con comisión de reembolso del 4%' });
  assert.equal(r.offered_ter_pct, null);
  assert.equal(r.exit_fee_pct, 4);
  const d = await ai.extractFinancialOfferWithClaude({ text: 'Depósito a plazo fijo al 2,5% cubierto por el Fondo de Garantía de Depósitos, comisión 0,2%' });
  assert.equal(d.product_type, 'DEPOSITO');
});
