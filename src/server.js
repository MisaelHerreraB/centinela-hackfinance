// Primera línea: cargar .env ANTES de que ningún módulo lea process.env (las claves nunca se imprimen).
require('./config/loadEnv').loadEnv();

/**
 * Servidor Principal de Centinela (HTTP + API REST + Cliente MCP MyInvestor + Servidor MCP Propio)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  findCategoryAlternatives,
  verifyProductExistsInMyInvestor,
  DEFAULT_MCP_URL
} = require('./services/mcpClient');
const { calculateCostComparison } = require('./engine/financialEngine');
const { analyzeFraudRisk } = require('./engine/fraudEngine');
const {
  getContractState,
  updateContractSettings,
  evaluateContractAction,
  recordAuditEvent,
  resetDemoState
} = require('./engine/contractEngine');
const {
  setRuntimeKeys,
  getAiStatus,
  CLAUDE_CENTINELA_TOOLS,
  extractFinancialOfferWithClaude,
  analyzeCallWithClaude,
  transcribeAudioWithElevenLabsScribe,
  synthesizeSpeechElevenLabs
} = require('./services/aiService');
const { runBenchmark30 } = require('./evals/run_evals');

const PORT = Number(process.env.PORT) || 3000;
// Por defecto solo se escucha en esta máquina. Docker fija HOST=0.0.0.0 dentro del contenedor.
const HOST = process.env.HOST || '127.0.0.1';
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const ALLOWED_HOSTNAMES = new Set([
  ...LOOPBACK_HOSTNAMES,
  ...(process.env.ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
]);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon'
};

function hostnameOf(hostHeader) {
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

// Evita que una web externa alcance el servidor local apuntando su dominio a esta máquina.
function isAllowedHost(req) {
  return ALLOWED_HOSTNAMES.has(hostnameOf(req.headers.host || ''));
}

// Los navegadores envían Origin en los POST entre sitios; los clientes MCP y curl no lo envían.
function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase();
  } catch (e) {
    return false;
  }
}

function canSetApiKeys(req) {
  const fromThisMachine = LOOPBACK_ADDRESSES.has(req.socket.remoteAddress)
    || process.env.CENTINELA_KEYS_FROM_DOCKER_HOST === '1';
  const isJson = String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json');
  return fromThisMachine && isJson && LOOPBACK_HOSTNAMES.has(hostnameOf(req.headers.host || ''));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 12 * 1024 * 1024) {
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (!isAllowedHost(req)) {
    return sendJson(res, 403, { ok: false, error: 'Host no permitido' });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== 'GET' && !isSameOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: 'Origen no permitido' });
  }

  try {
    // 1. Estado general de Centinela + Mi Contrato + Notificaciones de Daniel + Audit Log
    if (pathname === '/api/state' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        mcp_endpoint: DEFAULT_MCP_URL,
        ai_status: getAiStatus(),
        ...getContractState()
      });
    }

    // 2. Ejecutar los 30 casos del Benchmark en vivo
    if (pathname === '/api/evals' && req.method === 'GET') {
      const report = runBenchmark30();
      return sendJson(res, 200, { ok: true, report });
    }

    // 3. Analizar llamada en altavoz o SMS (Veredicto ESTAFA vs ADELANTE)
    if (pathname === '/api/analyze-call' && req.method === 'POST') {
      const t0 = Date.now();
      const body = await readJsonBody(req);
      const {
        text = '',
        entity_name = '',
        iban = '',
        claimed_product = '',
        amount_eur = 0,
        speech_rate_wpm = null,
        speech_rate_source = null,
        // Por defecto Claude analiza el texto si hay clave (también en los botones de la demo).
        // `useClaude: false` fuerza el análisis solo con reglas.
        useClaude = true
      } = body;

      if (!String(text).trim() && !String(entity_name).trim() && !String(iban).trim() && !String(claimed_product).trim()) {
        return sendJson(res, 400, { ok: false, error: 'No hay contenido que analizar (texto, entidad, IBAN o producto).' });
      }
      let amountEur = Math.max(0, Number(amount_eur) || 0);

      let mcpCheck = {
        mcp_status: 'SKIPPED',
        mcp_latency_ms: 0,
        exists_in_catalog: true,
        matches: []
      };

      // Claude (si hay clave) y la comprobación MCP del producto van en paralelo para no sumar latencias.
      // Sin clave, sin texto o con useClaude:false no se llama a Claude: el flujo es el de solo reglas.
      const claudeWanted = useClaude !== false && Boolean(String(text).trim()) && getAiStatus().claude_configured;
      const [claudeRes, mcpRes] = await Promise.all([
        claudeWanted ? analyzeCallWithClaude({ text: String(text) }) : Promise.resolve(null),
        claimed_product ? verifyProductExistsInMyInvestor(claimed_product) : Promise.resolve(null)
      ]);
      if (mcpRes) mcpCheck = mcpRes;
      const claudeOk = Boolean(claudeRes && claudeRes.ok);

      // Datos que Claude ha leído en el texto y el validador ha comprobado: solo rellenan huecos,
      // nunca pisan lo que ya venía en la petición. El importe lo calcula el código a partir de la cita.
      const effectiveEntity = entity_name || (claudeOk && claudeRes.entity_name) || '';
      const effectiveIban = iban || (claudeOk && claudeRes.iban) || '';
      let amountSource = amountEur > 0 ? 'REQUEST' : null;
      if (amountEur === 0 && claudeOk && claudeRes.amount_eur > 0) {
        amountEur = claudeRes.amount_eur;
        amountSource = 'CITA_VALIDADA_DE_CLAUDE';
      }

      const fraudAnalysis = analyzeFraudRisk({
        text,
        entity_name: effectiveEntity,
        iban: effectiveIban,
        claimed_product,
        product_exists_in_mcp: mcpCheck.exists_in_catalog,
        amount_eur: amountEur,
        speech_rate_wpm,
        speech_rate_source,
        ai_signals: claudeOk ? claudeRes.signals : null
      });
      // Si se intentó usar Claude y falló (timeout, HTTP, tope...), se dice: el veredicto es solo de reglas.
      fraudAnalysis.claude_error = claudeRes && !claudeRes.ok ? claudeRes.reason : null;

      const claudeAnalysis = claudeRes
        ? {
            used: claudeOk,
            model: claudeRes.model,
            latency_ms: claudeRes.latency_ms,
            rounds: claudeRes.rounds || claudeRes.usage?.requests || 0,
            error: claudeOk ? null : claudeRes.reason,
            signals_accepted: claudeOk ? claudeRes.signals : [],
            discarded_by_validator: claudeOk ? claudeRes.discarded : [],
            extracted: claudeOk
              ? {
                  entity_name: claudeRes.entity_name,
                  iban: claudeRes.iban,
                  amount_eur_quote: claudeRes.amount_eur_quote,
                  amount_eur_parsed_by_code: claudeRes.amount_eur,
                  claimed_product: claudeRes.claimed_product
                }
              : null,
            read_only_tool_calls: claudeRes.tool_calls || [],
            usage: claudeRes.usage
          }
        : {
            used: false,
            error: null,
            reason: useClaude === false ? 'DESACTIVADO_EN_LA_PETICION' : !String(text).trim() ? 'SIN_TEXTO' : 'SIN_CLAVE_DE_CLAUDE'
          };
      const aiNow = getAiStatus();
      claudeAnalysis.budget = { calls_used: aiNow.claude_calls_used, calls_max: aiNow.claude_calls_max, exhausted: aiNow.claude_budget_exhausted };

      const contractExecution = evaluateContractAction({
        verdict: fraudAnalysis.verdict,
        amount_eur: amountEur,
        beneficiary_name: effectiveEntity || fraudAnalysis.cnmv_check?.entity || 'Interlocutor telefónico',
        iban: effectiveIban || fraudAnalysis.iban_check?.iban || '',
        fraud_analysis: fraudAnalysis
      });

      // El motivo hablado sale de la señal más grave detectada, no de una frase fija
      const topSignal = [...fraudAnalysis.signals].sort((a, b) => {
        const rank = { CRITICA: 0, ALTA: 1, MEDIA: 2 };
        return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
      })[0];
      const spokenText =
        fraudAnalysis.verdict === 'ESTAFA'
          ? `Cuelga ahora mismo, Carmen. Creemos que es una estafa. ${
              fraudAnalysis.cnmv_check?.flagged
                ? `La entidad ${fraudAnalysis.cnmv_check.entity} está en la lista de alertas.`
                : topSignal
                  ? `${topSignal.label}.`
                  : ''
            } ${
              amountEur > 0
                ? `Mi Contrato ha retenido la transferencia de ${amountEur.toLocaleString('es-ES')} euros`
                : 'Mi Contrato ha activado la pantalla de seguridad'
            } y acabo de enviar una alerta al móvil de tu hijo Daniel.`
          : fraudAnalysis.signals.length > 0
            ? `No veo señales claras de estafa, pero ojo: ${fraudAnalysis.signals[0].label.charAt(0).toLowerCase()}${fraudAnalysis.signals[0].label.slice(1)}. ${fraudAnalysis.signals[0].explanation}`
            : `Verificación completada. No hay alertas ni señales de manipulación para esta consulta. Puedes continuar con tranquilidad.`;

      return sendJson(res, 200, {
        ok: true,
        total_latency_ms: Date.now() - t0,
        step_1_input: {
          mode: 'VOICE_OR_SMS',
          text,
          entity_name,
          iban,
          claimed_product,
          amount_eur: amountEur,
          amount_source: amountSource
        },
        step_2_verdict: {
          verdict: fraudAnalysis.verdict,
          analysis_engine: fraudAnalysis.analysis_engine,
          fraud_analysis: fraudAnalysis,
          claude_analysis: claudeAnalysis,
          mcp_verification: mcpCheck
        },
        step_3_action: contractExecution,
        spoken_text: spokenText,
        state: getContractState()
      });
    }

    // 4. Analizar Folleto DFI / PDF / Captura de Fondo Bancario (Veredicto CARO vs ADELANTE)
    if (pathname === '/api/analyze-document' && req.method === 'POST') {
      const t0 = Date.now();
      const body = await readJsonBody(req);
      const {
        text = '',
        imageBase64 = null,
        imageMimeType = 'image/png',
        presetDocument = null,
        amount_eur = null,
        years = 10,
        gross_return_pct = 5.0
      } = body;

      // Paso 1: Extraer datos del DFI con Claude Vision / Extractor estructurado
      const extractedDoc = await extractFinancialOfferWithClaude({
        text,
        imageBase64,
        imageMimeType,
        presetDocument
      });

      // Sin comisión legible no se calcula nada: se pide el dato en vez de inventarlo
      if (!extractedDoc.extraction_complete) {
        return sendJson(res, 200, {
          ok: true,
          needs_input: true,
          total_latency_ms: Date.now() - t0,
          step_1_input: extractedDoc,
          message: extractedDoc.reason || 'No he podido leer la comisión anual del producto.',
          ask_user: extractedDoc.ask_user || '¿Qué comisión anual (TER) aparece en el folleto?',
          spoken_text: `${extractedDoc.reason || 'No he podido leer la comisión anual del producto.'} ${extractedDoc.ask_user || ''}`.trim(),
          state: getContractState()
        });
      }

      const explicitAmount = Number(amount_eur) > 0 ? Number(amount_eur) : null;
      const amountIsExample = !explicitAmount && !extractedDoc.amount_eur;
      const finalAmount = explicitAmount || extractedDoc.amount_eur || 50000;

      // Paso 2A: Consultar en tiempo real el servidor MCP oficial de MyInvestor
      const mcpResult = await findCategoryAlternatives({
        asset_type: extractedDoc.asset_type || 'Renta Variable',
        geography: extractedDoc.geography || 'Global'
      });

      const cheapestDirectFund = mcpResult.alternatives?.[0] || {
        isin: 'IE00BYX5NX33',
        name: 'Fidelity MSCI World Index Fund EUR P Acc',
        ter: 0.12
      };
      const portfolioTer = mcpResult.recommended_portfolio?.ter_total || 0.30;

      // Paso 2B: Motor Cuantitativo y Fiscal Determinista (Ninguna cifra sale del LLM)
      const costAnalysis = calculateCostComparison({
        amount_eur: finalAmount,
        years: Number(years) || 10,
        gross_return_pct: Number(gross_return_pct) || 5.0,
        offered_ter_pct: extractedDoc.offered_ter_pct,
        benchmark_ter_pct: portfolioTer,
        direct_index_ter_pct: cheapestDirectFund.ter,
        product_type: extractedDoc.product_type || 'FONDO_INVERSION',
        exit_fee_pct: extractedDoc.exit_fee_pct || 0,
        liquidity_window_note: extractedDoc.liquidity_window_note || null,
        accumulated_gain_eur: extractedDoc.accumulated_gain_eur || 8500
      });

      // Paso 3: Mi Contrato decide y prepara el Traspaso In-App
      const contractExecution = evaluateContractAction({
        verdict: costAnalysis.verdict,
        amount_eur: finalAmount,
        beneficiary_name: extractedDoc.bank_name,
        cost_analysis: costAnalysis,
        mcp_recommendation: mcpResult,
        offered_fund: extractedDoc
      });

      const lossRounded = Math.round(costAnalysis.metrics.loss_10y_vs_portfolio_eur / 100) * 100;
      const taxPhrase = costAnalysis.transferability.is_tax_exempt_transfer
        ? 'y puedes cambiar por traspaso sin pagar ni un euro a Hacienda'
        : `pero atención: al ser un ${extractedDoc.product_type}, no admite traspaso directo exento de IRPF`;
      const exitPhrase =
        costAnalysis.transferability.has_exit_penalty
          ? ` Cuidado: el folleto incluye una comisión de salida del ${extractedDoc.exit_fee_pct}% fuera de ventana de liquidez.`
          : '';

      const amountPhrase = amountIsExample
        ? `Para un ejemplo de ${finalAmount.toLocaleString('es-ES')} euros`
        : `Con ${finalAmount.toLocaleString('es-ES')} euros`;
      const spokenText =
        costAnalysis.verdict === 'CARO'
          ? `Atención, Carmen: en este producto pagas un ${extractedDoc.offered_ter_pct
              .toString()
              .replace('.', ',')}% al año. ${amountPhrase}, en 10 años son unos ${lossRounded.toLocaleString(
              'es-ES'
            )} euros menos que con un producto de la misma categoría al 0,30% en MyInvestor, ${taxPhrase}.${exitPhrase} Ya tienes el traspaso preparado para firmar en la app.`
          : `Adelante, Carmen. Este producto tiene una comisión muy competitiva del ${extractedDoc.offered_ter_pct
              .toString()
              .replace('.', ',')}% anual y está alineado con el catálogo de MyInvestor.`;

      return sendJson(res, 200, {
        ok: true,
        amount_is_example: amountIsExample,
        total_latency_ms: Date.now() - t0,
        step_1_input: extractedDoc,
        step_2_verdict: {
          verdict: costAnalysis.verdict,
          cost_analysis: costAnalysis,
          mcp_lookup: mcpResult
        },
        step_3_action: contractExecution,
        spoken_text: spokenText,
        state: getContractState()
      });
    }

    // 5. Actualizar reglas de "Mi Contrato" / Modo Accesibilidad / Kill-Switch
    if (pathname === '/api/contract' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const updated = updateContractSettings(body);
      return sendJson(res, 200, {
        ok: true,
        contract: updated,
        state: getContractState()
      });
    }

    // 6. Firmar orden de traspaso In-App (Simulación de cierre seguro en App MyInvestor)
    if (pathname === '/api/sign-transfer' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const entry = recordAuditEvent({
        event_type: 'IN_APP_TRANSFER_SIGNED',
        verdict: 'FIRMADO',
        summary: `Orden de traspaso exento de IRPF (${body.order_id || 'TRASP-01'}) firmada biométricamente In-App por Carmen García hacia ${body.destination || 'MyInvestor'}.`,
        details: body
      });
      return sendJson(res, 200, {
        ok: true,
        audit_entry: entry,
        state: getContractState()
      });
    }

    // 7. Configurar API Keys en caliente (Claude / ElevenLabs)
    if (pathname === '/api/keys' && req.method === 'POST') {
      if (!canSetApiKeys(req)) {
        return sendJson(res, 403, { ok: false, error: 'Las claves solo se pueden configurar desde esta máquina' });
      }
      const body = await readJsonBody(req);
      setRuntimeKeys({
        anthropicKey: body.anthropicKey,
        elevenLabsKey: body.elevenLabsKey
      });
      return sendJson(res, 200, {
        ok: true,
        ai_status: getAiStatus()
      });
    }

    // 8. Transcripción de Audio con ElevenLabs Scribe (con caché y tope de créditos) + fallback Web Speech API
    if (pathname === '/api/stt' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const sttRes = await transcribeAudioWithElevenLabsScribe({
        audioBase64: body.audioBase64,
        mimeType: body.mimeType || 'audio/webm',
        durationSec: body.durationSec
      });
      const el = getAiStatus().elevenlabs;
      return sendJson(res, 200, { ...sttRes, budget: { credits_used_estimated: el.credits_used_estimated, credits_max: el.credits_max, exhausted: el.budget_exhausted } });
    }

    // 8B. Síntesis de Voz con ElevenLabs (con fallback automático en cliente si no hay key)
    if (pathname === '/api/tts' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const ttsRes = await synthesizeSpeechElevenLabs(body.text || '');
      if (ttsRes.ok) {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'X-Centinela-TTS-Source': ttsRes.source, // CACHE (no gasta) | LIVE
          'X-Centinela-TTS-Model': ttsRes.model,
          'X-Centinela-TTS-Credits': String(ttsRes.credits_estimated || 0)
        });
        return res.end(ttsRes.audioBuffer);
      }
      const el = getAiStatus().elevenlabs;
      return sendJson(res, 200, {
        ok: false,
        fallback: 'WEB_SPEECH_API',
        reason: ttsRes.reason,
        budget: { credits_used_estimated: el.credits_used_estimated, credits_max: el.credits_max, exhausted: el.budget_exhausted }
      });
    }

    // 9. Reiniciar estado de demo
    if (pathname === '/api/reset' && req.method === 'POST') {
      resetDemoState();
      return sendJson(res, 200, { ok: true, state: getContractState() });
    }

    // 10. Servidor MCP Propio de Centinela (/mcp) — Las 3 herramientas nuevas para GPTadvisor
    if (pathname === '/mcp' && req.method === 'POST') {
      const rpc = await readJsonBody(req);
      if (rpc.method === 'initialize') {
        return sendJson(res, 200, {
          jsonrpc: '2.0',
          id: rpc.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'centinela-mcp-extension',
              version: '1.0.0',
              description: 'Extensión MCP de Centinela para MyInvestor & GPTadvisor: Verificación CNMV, Motor de Costes/IRPF y Gobernanza Mi Contrato'
            },
            capabilities: { tools: {} }
          }
        });
      }
      if (rpc.method === 'tools/list') {
        return sendJson(res, 200, {
          jsonrpc: '2.0',
          id: rpc.id,
          result: {
            tools: [
              {
                name: 'verify_cnmv_and_iban',
                description: 'Verifica señales de manipulación, lista de alertas CNMV e IBAN reportados antes de firmar o transferir.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    entity_name: { type: 'string' },
                    iban: { type: 'string' },
                    amount_eur: { type: 'number' }
                  }
                }
              },
              {
                name: 'calculate_10y_fee_and_tax',
                description: 'Calcula de forma determinista la pérdida por comisiones a 10 años y si aplica traspaso exento de IRPF (Art. 94 LIRPF).',
                inputSchema: {
                  type: 'object',
                  properties: {
                    amount_eur: { type: 'number' },
                    offered_ter_pct: { type: 'number' },
                    benchmark_ter_pct: { type: 'number' },
                    product_type: { type: 'string' },
                    exit_fee_pct: { type: 'number' }
                  },
                  required: ['offered_ter_pct']
                }
              },
              {
                name: 'enforce_client_contract',
                description: 'Ejecuta las reglas programables de Mi Contrato (retención de transferencia y alerta familiar o preparación de traspaso In-App).',
                inputSchema: {
                  type: 'object',
                  properties: {
                    verdict: { type: 'string', enum: ['ESTAFA', 'CARO', 'ADELANTE'] },
                    amount_eur: { type: 'number' },
                    beneficiary_name: { type: 'string' }
                  },
                  required: ['verdict']
                }
              }
            ]
          }
        });
      }
      if (rpc.method === 'tools/call') {
        const toolName = rpc.params?.name;
        const args = rpc.params?.arguments || {};
        let toolOutput = {};
        if (toolName === 'verify_cnmv_and_iban') {
          toolOutput = analyzeFraudRisk(args);
        } else if (toolName === 'calculate_10y_fee_and_tax') {
          toolOutput = calculateCostComparison(args);
        } else if (toolName === 'enforce_client_contract') {
          toolOutput = evaluateContractAction(args);
        } else {
          return sendJson(res, 200, {
            jsonrpc: '2.0',
            id: rpc.id,
            error: { code: -32602, message: `Herramienta desconocida: ${toolName}` }
          });
        }
        return sendJson(res, 200, {
          jsonrpc: '2.0',
          id: rpc.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(toolOutput, null, 2) }],
            structuredContent: toolOutput
          }
        });
      }
      return sendJson(res, 400, { error: 'Método MCP no soportado' });
    }

    // 11. Servir archivos estáticos del Frontend
    let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ruta no encontrada');
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\n🛡️  Centinela (MyInvestor In-App Module) ejecutándose en: http://localhost:${PORT}`);
    console.log(`🔌 Conectado al MCP oficial de MyInvestor: ${DEFAULT_MCP_URL}`);
    console.log(`🛠️  Servidor MCP propio de Centinela activo en: http://localhost:${PORT}/mcp\n`);
  });
}

module.exports = { server };
