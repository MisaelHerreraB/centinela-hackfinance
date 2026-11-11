/**
 * Centinela · Frontend Reactivo (Diseño Oficial inspirado en MyInvestor × GPTadvisor)
 */

let currentAccessMode = 'STANDARD';
let lastSpokenMessage = '';
let currentContract = {};
let isRecordingMic = false;
let recognitionInstance = null;
let lastScamAmountEur = 0;

// Extrae un importe en euros de un texto libre ("9.000 euros", "5700 €"). null si no hay.
function extractAmountEur(text = '') {
  const m = String(text).match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,7})(?:[.,]\d{1,2})?\s*(?:€|euros?|eur)\b/i);
  return m ? parseInt(m[1].replace(/[.\s]/g, ''), 10) : null;
}

function formatEur(n) {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toLocaleString('es-ES')} €` : '—';
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Muestra un estado neutro cuando no hay datos suficientes: nunca se inventa un veredicto
function renderNeedsInput(title, message, extraJson = null) {
  const banner = document.getElementById('verdict-banner');
  banner.className = 'verdict-hero PENDIENTE';
  document.getElementById('verdict-title').textContent = title;
  document.getElementById('verdict-badge-right').textContent = 'Falta un dato';
  document.getElementById('verdict-sub-right').textContent = 'Sin veredicto';
  document.getElementById('verdict-details-container').innerHTML = `
    <div style="margin-top:8px; padding:9px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:9px; font-size:0.75rem; color:#334155; font-weight:600;">
      ℹ️ ${escapeHtml(message)}
    </div>`;
  document.getElementById('action-container').innerHTML =
    '<div style="color:var(--muted); font-weight:600;">Escribe el dato en la caja de texto o usa el micrófono para continuar.</div>';
  if (extraJson) document.getElementById('mcp-inspector-box').textContent = JSON.stringify(extraJson, null, 2);
  speakMessage(message);
}

const PRESET_DOCUMENTS = {
  FONDO_RV_180: {
    name: 'FonBanco Selección Global Gestión Activa FI',
    bank_name: 'Banco Tradicional Sucursal',
    isin: 'XX0000DEMO01',
    asset_type: 'Renta Variable',
    geography: 'Global',
    product_type: 'FONDO_INVERSION',
    offered_ter_pct: 1.80,
    management_fee_pct: 1.65,
    deposit_fee_pct: 0.15,
    exit_fee_pct: 0,
    amount_eur: 50000,
    accumulated_gain_eur: 9200,
    document_html: `
      <div style="font-size:0.71rem; font-weight:700; color:var(--accent); margin-bottom:4px;">📄 DFI / KID OFICIAL · CNMV</div>
      <div><strong>Fondo:</strong> FonBanco Selección Global Activa, FI (<code>XX0000DEMO01</code>)</div>
      <div><strong>Categoría:</strong> Renta Variable Global · <strong>Importe:</strong> 50.000 €</div>
      <div style="margin-top:5px;">
        <strong>Costes Anuales:</strong> Gastos corrientes (TER): <span class="hl-danger">1,80 % anual</span>
        (Gestión: 1,65 % + Depósito: 0,15 %).
      </div>
      <div style="margin-top:4px; font-size:0.73rem; color:var(--muted);">
        <em>IIC armonizada acogida al régimen de diferimiento por traspaso (Art. 94 LIRPF = 0 € IRPF).</em>
      </div>
    `
  },
  FONDO_GARANTIZADO_SALIDA: {
    name: 'Fondo Garantizado Rendimiento Estabilidad 2031 FI',
    bank_name: 'Banco Tradicional Sucursal',
    isin: 'XX0000DEMO02',
    asset_type: 'Mixto',
    geography: 'Europa',
    product_type: 'FONDO_GARANTIZADO',
    offered_ter_pct: 1.45,
    management_fee_pct: 1.30,
    deposit_fee_pct: 0.15,
    exit_fee_pct: 4.0,
    liquidity_window_note: 'solo sin comisión el día 15 de cada semestre',
    amount_eur: 50000,
    accumulated_gain_eur: 4500,
    document_html: `
      <div style="font-size:0.71rem; font-weight:700; color:var(--scam-red); margin-bottom:4px;">📄 DFI · FONDO GARANTIZADO CON COMISIÓN DE SALIDA</div>
      <div><strong>Fondo:</strong> Garantizado Estabilidad 2031 FI (<code>XX0000DEMO02</code>)</div>
      <div style="margin-top:5px;">
        <strong>TER:</strong> <span class="hl-warn">1,45 % anual</span> ·
        <strong>Comisión de reembolso:</strong> <span class="hl-danger">4,00 % por salir antes de vencimiento</span>.
      </div>
    `
  },
  UNIT_LINKED_NO_TRASPASABLE: {
    name: 'Seguro Vida-Inversión Futuro Plus (Unit-Linked)',
    bank_name: 'Aseguradora Bancaria Tradicional',
    isin: 'UL-ES-99201',
    asset_type: 'Mixto',
    geography: 'Global',
    product_type: 'UNIT_LINKED',
    offered_ter_pct: 2.10,
    management_fee_pct: 1.90,
    deposit_fee_pct: 0.20,
    exit_fee_pct: 2.0,
    amount_eur: 50000,
    accumulated_gain_eur: 12000,
    document_html: `
      <div style="font-size:0.71rem; font-weight:700; color:var(--scam-red); margin-bottom:4px;">📄 PÓLIZA UNIT-LINKED (NO ES FONDO IIC)</div>
      <div><strong>Producto:</strong> Seguro Unit-Linked Futuro Plus</div>
      <div style="margin-top:5px;">
        <strong>Coste total:</strong> <span class="hl-danger">2,10 % anual</span> ·
        <strong>Fiscalidad:</strong> <span class="hl-danger">NO traspasable sin tributar 19 %–30 % en IRPF</span>.
      </div>
    `
  },
  FONDO_LIMPIO_ADELANTE: {
    name: 'Fidelity MSCI World Index Fund EUR P Acc',
    bank_name: 'MyInvestor (Catálogo Indexado)',
    isin: 'IE00BYX5NX33',
    asset_type: 'Renta Variable',
    geography: 'Global',
    product_type: 'FONDO_INVERSION',
    offered_ter_pct: 0.12,
    management_fee_pct: 0.12,
    deposit_fee_pct: 0.0,
    exit_fee_pct: 0,
    amount_eur: 50000,
    accumulated_gain_eur: 8000,
    document_html: `
      <div style="font-size:0.71rem; font-weight:700; color:var(--mi-teal); margin-bottom:4px;">📄 DFI · FONDO INDEXADO UCITS EN MYINVESTOR</div>
      <div><strong>Producto:</strong> Fidelity MSCI World Index Fund EUR P Acc (<code>IE00BYX5NX33</code>)</div>
      <div style="margin-top:5px;">
        <strong>Gastos corrientes (TER):</strong> <strong style="color:var(--mi-teal);">0,12 % anual</strong> · Custodia: 0,00 % · Traspasable 0 € IRPF.
      </div>
    `
  }
};

window.addEventListener('DOMContentLoaded', () => {
  refreshState();
});

async function refreshState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.ok) renderGlobalState(data);
  } catch (e) {
    console.error('Error cargando estado:', e);
  }
}

function renderGlobalState(data) {
  currentContract = data.contract || {};
  document.getElementById('input-max-transfer').value = currentContract.max_transfer_amount_eur || 3000;
  document.getElementById('input-max-ter').value = currentContract.max_acceptable_ter_pct || 0.75;
  document.getElementById('input-trusted-name').value = currentContract.trusted_contact?.name || 'Daniel García (Hijo)';

  const killBtn = document.getElementById('btn-kill-switch');
  const statusPill = document.getElementById('contract-status-pill');
  if (currentContract.operations_disabled) {
    killBtn.textContent = '🔒 Operativa Deshabilitada (Clic para Reactivar)';
    statusPill.textContent = '🛑 Operativa Bloqueada';
    statusPill.style.background = '#fee2e2';
    statusPill.style.color = '#991b1b';
    statusPill.style.borderColor = '#fca5a5';
  } else {
    killBtn.textContent = '🛑 Deshabilitar Operativa Saliente (Kill-Switch)';
    statusPill.textContent = 'Escudo Activo';
    statusPill.style.background = 'var(--mi-teal-bg)';
    statusPill.style.color = '#0f6f4b';
    statusPill.style.borderColor = 'var(--mi-teal-border)';
  }

  // Notificaciones de Daniel
  const notifs = data.family_notifications || [];
  const danielBox = document.getElementById('daniel-notifications-box');
  const danielBadge = document.getElementById('daniel-badge');
  if (notifs.length === 0) {
    danielBadge.textContent = 'Sin incidencias activas';
    danielBadge.style.background = 'var(--mi-teal-bg)';
    danielBadge.style.color = '#0f6f4b';
    danielBadge.style.borderColor = 'var(--mi-teal-border)';
    danielBox.innerHTML = `
      <div style="padding:18px 12px; text-align:center; color:var(--muted); font-size:0.79rem; background:var(--surface); border-radius:10px; border:1px dashed var(--line-strong);">
        Centinela nunca invade la privacidad diaria de Carmen. Solo envía una alerta push a Daniel cuando <strong>Mi Contrato</strong> retiene una estafa o transferencia fuera de límite.
      </div>
    `;
  } else {
    const latest = notifs[0];
    danielBadge.textContent = `🚨 ${notifs.length} Alerta Crítica enviada a Daniel`;
    danielBadge.style.background = '#fee2e2';
    danielBadge.style.color = '#991b1b';
    danielBadge.style.borderColor = '#fca5a5';
    danielBox.innerHTML = `
      <div class="daniel-alert-active">
        <div style="display:flex; justify-content:space-between; font-size:0.71rem; color:#be123c; font-weight:700; margin-bottom:4px;">
          <span>📲 PUSH EN EL MÓVIL DE DANIEL</span>
          <span>Ahora mismo</span>
        </div>
        <div style="font-weight:800; font-size:0.88rem; color:#881337; margin-bottom:4px;">
          ${latest.title}
        </div>
        <div style="font-size:0.77rem; color:#4c0519; line-height:1.4; margin-bottom:7px;">
          ${latest.body}
        </div>
        <div style="font-size:0.72rem; color:#9f1239; background:#ffe4e6; padding:6px 8px; border-radius:7px; margin-bottom:8px;">
          <strong>Señales:</strong> ${latest.signals.join(' · ')}<br/>
          <strong>IBAN retenido:</strong> <code>${latest.iban_blocked}</code>
        </div>
        <button class="btn-cta-danger" style="padding:8px 12px; font-size:0.75rem;" onclick="activateKillSwitchFromDaniel()">
          🔒 Confirmar Bloqueo desde Móvil de Daniel
        </button>
      </div>
    `;
  }

  // Log de Auditoría SHA-256
  const logs = data.audit_log || [];
  document.getElementById('audit-log-box').textContent = logs
    .map(
      (l) =>
        `[${l.timestamp.slice(11, 19)}] [${l.verdict}] ${l.summary}\n  ↳ SHA-256: ${l.hash} (Prev: ${l.prev_hash})`
    )
    .join('\n\n');
}

function switchInspectorTab(tab) {
  const mcpBox = document.getElementById('mcp-inspector-box');
  const auditBox = document.getElementById('audit-log-box');
  document.getElementById('tab-btn-mcp').classList.toggle('active', tab === 'MCP');
  document.getElementById('tab-btn-audit').classList.toggle('active', tab === 'AUDIT');
  mcpBox.style.display = tab === 'MCP' ? 'block' : 'none';
  auditBox.style.display = tab === 'AUDIT' ? 'block' : 'none';
}

async function speakMessage(text, extraLowVisionDetails = '') {
  const fullText =
    currentAccessMode === 'LOW_VISION' && extraLowVisionDetails
      ? `${text} Lectura preventiva de Baja Visión antes de firmar: ${extraLowVisionDetails}`
      : text;

  lastSpokenMessage = fullText;
  document.getElementById('spoken-transcript').innerHTML = `🔊 <strong>Centinela:</strong> "${fullText}"`;

  if (currentAccessMode === 'DEAF') {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    document.getElementById('deaf-banner').innerHTML = `
      🦻 <strong>MODO PERSONA SORDA (SUBTÍTULO SINCRONIZADO · AUDIO DESACTIVADO):</strong><br/>
      "${fullText}"
    `;
    return;
  }

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fullText })
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('audio/mpeg')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      return;
    }
  } catch (e) {}

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.03;
    window.speechSynthesis.speak(utterance);
  }
}

function replayLastVoice() {
  if (lastSpokenMessage) speakMessage(lastSpokenMessage);
}

// ============================================================================
// ACTO 1: FALSO BRÓKER (ESTAFA · 9.000 €)
// ============================================================================
async function runScenario1Scam() {
  setActiveScenarioPill('btn-scenario-1', 'active-scam');
  document.getElementById('input-source-tag').textContent = '📞 Altavoz · ElevenLabs Scribe STT';
  document.getElementById('evidence-title').innerHTML =
    '🔴 <strong>Llamada en altavoz:</strong> "Quantum Ibérica Capital"';

  const phrases = [
    '“Hola Carmen, te llamo de <span class="hl-danger">Quantum Ibérica Capital</span>.',
    'Te activamos hoy el Bono VIP con un <span class="hl-danger">12 % anual garantizado sin ningún riesgo</span>.',
    'Quedan las <span class="hl-warn">últimas plazas solo por hoy en los próximos 15 minutos</span>.',
    'Transfiere ahora <strong>9.000 €</strong> al IBAN <span class="hl-danger">ES91 2100 0418 4502 0005 1332</span>.”'
  ];

  const evidenceContent = document.getElementById('evidence-content');
  evidenceContent.innerHTML = '';
  for (let i = 0; i < phrases.length; i++) {
    evidenceContent.innerHTML = phrases.slice(0, i + 1).join(' ');
    await new Promise((r) => setTimeout(r, 200));
  }

  showAnalyzing();
  const res = await fetch('/api/analyze-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hola Carmen, te llamo de Quantum Ibérica Capital. Te activamos hoy el Bono VIP con un 12% anual garantizado sin ningún riesgo. Quedan las últimas plazas solo por hoy en los próximos 15 minutos. Transfiere ahora mismo 9.000 euros al IBAN ES91 2100 0418 4502 0005 1332.',
      entity_name: 'Quantum Ibérica Capital',
      iban: 'ES9121000418450200051332',
      claimed_product: 'Bono VIP 12% Garantizado MyInvestor',
      amount_eur: 9000,
      // Guion de demo: no hay audio real, así que la velocidad del habla se declara SIMULADA.
      // Con un audio real, /api/stt la mide con ElevenLabs Scribe.
      speech_rate_wpm: 188,
      speech_rate_source: 'DEMO_SIMULADO'
    })
  });
  const data = await res.json();
  renderCallVerdict(data);
}

function triggerIosPush(verdict, title, body) {
  const pushEl = document.getElementById('ios-push-banner');
  if (!pushEl) return;
  const isPassive = currentContract?.protection_level !== 'LEVEL_1_ON_DEMAND';
  document.getElementById('push-level-tag').textContent = isPassive
    ? 'Escucha Pasiva · Nivel 2'
    : 'Consulta · Nivel 1';
  document.getElementById('push-title').textContent = title;
  document.getElementById('push-body').textContent = body;
  pushEl.className = `ios-push-banner show push-${verdict}`;
}

async function setProtectionLevel(level) {
  document.querySelectorAll('.passive-level-btn').forEach((b) => b.classList.remove('active'));
  const btn = document.getElementById(`lvl-${level}`);
  if (btn) btn.classList.add('active');
  const res = await fetch('/api/contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ protection_level: level })
  });
  const data = await res.json();
  if (data.ok) renderGlobalState(data.state);
}

function build30YearSvgChart(series30 = [], offeredTer = 1.8, indexTer = 0.06) {
  if (!Array.isArray(series30) || series30.length === 0) return '';
  const w = 310;
  const h = 118;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 20;
  const maxVal = Math.max(...series30.map((p) => p.myinvestor_direct_index_eur), 100000);
  const minVal = series30[0]?.offered_bank_eur || 50000;

  const toX = (yr) => padL + (yr / 30) * (w - padL - padR);
  const toY = (val) => padT + (1 - (val - minVal * 0.9) / (maxVal * 1.04 - minVal * 0.9)) * (h - padT - padB);

  const ptsIndex = series30.map((p) => `${toX(p.year).toFixed(1)},${toY(p.myinvestor_direct_index_eur).toFixed(1)}`).join(' ');
  const ptsPortfolio = series30.map((p) => `${toX(p.year).toFixed(1)},${toY(p.myinvestor_portfolio_eur).toFixed(1)}`).join(' ');
  const ptsOffered = series30.map((p) => `${toX(p.year).toFixed(1)},${toY(p.offered_bank_eur).toFixed(1)}`).join(' ');

  const areaIndex = `${toX(0)},${h - padB} ${ptsIndex} ${toX(30)},${h - padB}`;
  const y30 = series30[30] || series30[series30.length - 1];

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; display:block; overflow:visible;">
      <defs>
        <linearGradient id="gradIndex30" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#159E8A" stop-opacity="0.26"/>
          <stop offset="100%" stop-color="#159E8A" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points="${areaIndex}" fill="url(#gradIndex30)" />
      <polyline fill="none" stroke="#DC2626" stroke-width="2.4" stroke-dasharray="4 2" points="${ptsOffered}" />
      <polyline fill="none" stroke="#0046DE" stroke-width="2" opacity="0.7" points="${ptsPortfolio}" />
      <polyline fill="none" stroke="#159E8A" stroke-width="3" points="${ptsIndex}" />
      <circle cx="${toX(30)}" cy="${toY(y30.myinvestor_direct_index_eur)}" r="4" fill="#159E8A" />
      <circle cx="${toX(30)}" cy="${toY(y30.offered_bank_eur)}" r="4" fill="#DC2626" />
      <text x="${padL}" y="${h - 4}" font-size="8.5" fill="#64748B" font-weight="700">Hoy (50k €)</text>
      <text x="${toX(10) - 14}" y="${h - 4}" font-size="8.5" fill="#64748B" font-weight="600">Año 10</text>
      <text x="${toX(20) - 14}" y="${h - 4}" font-size="8.5" fill="#64748B" font-weight="600">Año 20</text>
      <text x="${toX(30) - 32}" y="${h - 4}" font-size="8.5" fill="#0F172A" font-weight="800">Año 30</text>
      <text x="${toX(30) - 96}" y="${toY(y30.myinvestor_direct_index_eur) + 3}" font-size="9.5" fill="#0f6f4b" font-weight="800">Índice ${indexTer}%: ${y30.myinvestor_direct_index_eur.toLocaleString('es-ES')} €</text>
      <text x="${toX(30) - 98}" y="${toY(y30.offered_bank_eur) - 5}" font-size="9" fill="#b91c1c" font-weight="800">TER ${offeredTer}%: ${y30.offered_bank_eur.toLocaleString('es-ES')} €</text>
    </svg>
  `;
}

function toggleChartDrillIn() {
  const panel = document.getElementById('chart-drill-in-panel');
  const hint = document.getElementById('chart-drill-in-hint');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (hint) {
    hint.textContent = isOpen ? '🔼 Ocultar números detallados' : '👆 Pulsa la gráfica para ver números (Drill-In)';
  }
}

function openOfficialChannelModal() {
  document.getElementById('modal-official-channel').classList.add('open');
  speakMessage(
    'Conectada con el Canal Oficial de MyInvestor en tiempo real. Hola Carmen, te confirmamos que Quantum Ibérica está en la lista de alertas de la CNMV. Te recomendamos no enviar la transferencia.'
  );
}

function closeOfficialChannelModal() {
  document.getElementById('modal-official-channel').classList.remove('open');
}

function confirmCancelFraudFromChannel() {
  closeOfficialChannelModal();
  const actionBox = document.getElementById('action-container');
  if (actionBox) {
    actionBox.innerHTML = `
      <div style="padding:10px 12px; background:var(--mi-teal-bg); border:1px solid var(--mi-teal-border); border-radius:10px; color:#065f46; font-weight:700; font-size:0.77rem;">
        ✅ <strong>Transferencia cancelada por Carmen tras verificar con el Canal Oficial de MyInvestor.</strong> ${lastScamAmountEur > 0 ? `Se han protegido ${formatEur(lastScamAmountEur)} sin quitarle el control al cliente.` : 'Sin quitarle el control al cliente.'}
      </div>
    `;
  }
}

function continueFraudWithOverride(amountEur) {
  const actionBox = document.getElementById('action-container');
  if (actionBox) {
    actionBox.innerHTML = `
      <div style="padding:10px 12px; background:#fff1f2; border:1px solid #fecdd3; border-radius:10px; color:#9f1239; font-size:0.75rem;">
        ⚠️ <strong>El cliente ha decidido continuar bajo su responsabilidad</strong> tras haber recibido la explicación de riesgo y la opción de Canal Oficial (Trazabilidad registrada en Audit Log SHA-256).
      </div>
    `;
  }
}

// Con Claude el análisis de una llamada tarda unos segundos: se avisa mientras tanto.
function showAnalyzing() {
  const badge = document.getElementById('latency-badge');
  if (badge) badge.textContent = '⏳ Analizando…';
}

function renderCallVerdict(data) {
  if (!data || !data.ok || !data.step_2_verdict) {
    renderNeedsInput('SIN CONTENIDO', (data && data.error) || 'No he recibido nada que analizar.');
    return;
  }
  const v = data.step_2_verdict.fraud_analysis;
  lastScamAmountEur = Number(v.amount_detected_eur) || 0;
  const demoTag = (s) =>
    s.type === 'ENTIDAD_ALERTA_CNMV' || s.type === 'IBAN_REPORTADO_Y_SEPA_VOP_NO_MATCH'
      ? '<span class="demo-data-tag" title="Lista ficticia de demostración">datos de demo</span>'
      : '';
  const mcpCheck = data.step_2_verdict.mcp_verification;
  const act = data.step_3_action;

  // [Tarea C] ¿Quién ha analizado el texto? Reglas solas o reglas + Claude (señales con cita literal validada).
  const claudeInfo = data.step_2_verdict.claude_analysis || { used: false };
  const usedClaude = v.analysis_engine === 'RULES+CLAUDE';
  const claudeModelShort = String(claudeInfo.model || '').replace(/^claude-/, '');
  const claudeFallbackNote = !v.claude_error
    ? ''
    : v.claude_error === 'CLAUDE_BUDGET_EXHAUSTED'
      ? 'límite de llamadas a Claude alcanzado'
      : /^TIMEOUT/.test(v.claude_error)
        ? 'Claude no respondió a tiempo'
        : 'Claude no disponible';
  const engineTag = usedClaude
    ? `<div class="engine-tag" style="display:inline-flex; align-items:center; gap:5px; margin:6px 0; padding:3px 9px; border-radius:999px; font-size:0.66rem; font-weight:700; background:#f5f0ff; color:#5b21b6; border:1px solid #ddd6fe;">
        ✳️ Analizado con Claude${claudeModelShort ? ` (${escapeHtml(claudeModelShort)})` : ''} + reglas${claudeInfo.latency_ms ? ` · ${claudeInfo.latency_ms} ms` : ''}
      </div>`
    : `<div class="engine-tag" style="display:inline-flex; align-items:center; gap:5px; margin:6px 0; padding:3px 9px; border-radius:999px; font-size:0.66rem; font-weight:700; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;"${v.claude_error ? ` title="${escapeHtml(v.claude_error)}"` : ''}>
        ⚙️ Solo reglas${claudeFallbackNote ? ` · ${claudeFallbackNote}` : ''}
      </div>`;
  const claudeBadge = (s) =>
    s.source === 'CLAUDE'
      ? ' <span style="display:inline-block; margin-left:4px; padding:1px 6px; border-radius:999px; font-size:0.60rem; font-weight:800; background:#f5f0ff; color:#5b21b6; border:1px solid #ddd6fe; vertical-align:middle;">Claude</span>'
      : '';
  const claudeQuote = (s) =>
    s.source === 'CLAUDE' && s.evidence
      ? `<div style="margin-top:3px; color:#5b21b6; font-style:italic;">Cita literal: «${escapeHtml(s.evidence)}»${s.claude_explanation ? ` — ${escapeHtml(s.claude_explanation)}` : ''}</div>`
      : '';

  document.getElementById('latency-badge').textContent = `⚡ ${data.total_latency_ms} ms${usedClaude ? ' · Claude + reglas' : ''}`;

  // 1. Disparar PUSH Notification nativa arriba del móvil (Output Base)
  if (v.verdict === 'ESTAFA') {
    const reasons = v.signals.slice(0, 2).map((s) => s.label).join(' · ');
    triggerIosPush(
      'ESTAFA',
      '🔴 Creemos que es una ESTAFA (Escucha Pasiva)',
      `${reasons || 'Señales de fraude detectadas'}. Pulsa para ver por qué.`
    );
  } else if (v.signals.length > 0) {
    triggerIosPush('ADELANTE', '🟢 Sin estafa clara · revisa el aviso', v.signals[0].label);
  } else {
    triggerIosPush('ADELANTE', '🟢 Operación Verificada (OK)', 'Sin alertas ni patrones de manipulación.');
  }

  // 2. Banner Rojo In-App ("Creemos que es una estafa")
  const banner = document.getElementById('verdict-banner');
  banner.className = `verdict-hero ${v.verdict}`;
  document.getElementById('verdict-title').textContent =
    v.verdict === 'ESTAFA' ? '🔴 CREEMOS QUE ES ESTAFA' : '🟢 ADELANTE · OK';
  document.getElementById('verdict-badge-right').textContent = `Riesgo ${v.risk_score}%`;
  document.getElementById('verdict-sub-right').textContent =
    v.cnmv_check?.flagged ? 'Explicabilidad Activa' : 'Verificado sin alertas';

  const detailsBox = document.getElementById('verdict-details-container');
  if (v.verdict === 'ESTAFA') {
    const vopBadge = v.iban_check?.sepa_vop_status === 'NO_MATCH'
      ? `<div style="margin-bottom:6px; padding:6px 9px; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; font-size:0.71rem; color:#9f1239; font-weight:700;">
          🏦 <strong>SEPA VoP: NO_MATCH</strong> · El IBAN pertenece a <em>"${v.iban_check.registered_holder}"</em>, NO a ${v.iban_check.claimed_holder}.
        </div>`
      : '';
    const killChainBadge = v.kill_chain_progression
      ? `<div style="margin-bottom:6px; padding:7px 9px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; font-size:0.69rem; color:#1e293b;">
          <div style="font-weight:800; color:#0f172a; margin-bottom:4px;">
            🔍 ¿Por qué creemos que es fraude? (${v.kill_chain_progression.phase_summary})
          </div>
          <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:3px;">
            ${v.kill_chain_progression.stages
              .map(
                (st) => `
              <div style="padding:3px 4px; border-radius:4px; text-align:center; font-size:0.60rem; font-weight:700; background:${st.active ? '#fee2e2' : '#e2e8f0'}; color:${st.active ? '#991b1b' : '#64748b'}; border:1px solid ${st.active ? '#fca5a5' : 'transparent'};">
                F${st.stage} ${st.active ? '●' : '○'}
              </div>`
              )
              .join('')}
          </div>
        </div>`
      : '';
    detailsBox.innerHTML = `
      ${engineTag}
      ${killChainBadge}
      ${vopBadge}
      <div class="phone-signals">
        ${v.signals
          .map(
            (s) => `
          <div class="phone-signal-row">
            <div style="font-weight:800; color:#991b1b;">⚠️ ${s.label}${demoTag(s)}${claudeBadge(s)}</div>
            <div style="color:#475569; margin-top:2px;">${s.explanation}</div>
            ${claudeQuote(s)}
          </div>
        `
          )
          .join('')}
      </div>
    `;
  } else {
    detailsBox.innerHTML = `
      ${engineTag}
      <div style="margin-top:8px; padding:9px; background:var(--ok-bg); border:1px solid var(--ok-border); border-radius:9px; font-size:0.75rem; color:var(--ok-ink); font-weight:600;">
        ✅ Sin alertas en la lista de demostración ni patrones claros de manipulación.
      </div>
      ${v.signals
        .map(
          (s) => `
        <div style="margin-top:6px; padding:7px 9px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; font-size:0.71rem; color:#92400e;">
          <strong>Ojo:</strong> ${s.label}${claudeBadge(s)}. ${s.explanation}
          ${claudeQuote(s)}
        </div>`
        )
        .join('')}
    `;
  }

  // 3. Pantalla Adicional al pulsar "Enviar" (Sin Hard Block: Canal Oficial en Vivo + Botón Rojo Clarito)
  const actionBox = document.getElementById('action-container');
  if (v.verdict === 'ESTAFA') {
    actionBox.innerHTML = `
      <div style="background:#ffffff; border:1.5px solid #fecaca; border-radius:12px; padding:11px 12px;">
        <div style="font-weight:800; color:#991b1b; font-size:0.80rem; margin-bottom:4px;">
          🛑 Pantalla de Seguridad antes de enviar ${lastScamAmountEur > 0 ? formatEur(lastScamAmountEur) : 'dinero'}
        </div>
        <div style="font-size:0.73rem; color:#334155; margin-bottom:9px; line-height:1.38;">
          Oye Carmen, <strong>esto tiene toda la pinta de ser un fraude</strong> por los motivos que te explicamos arriba. Puedes consultarnos ahora mismo en tiempo real antes de enviar tu dinero:
        </div>
        <button class="btn-official-channel" onclick="openOfficialChannelModal()">
          🎧 Consultar en Canal Oficial MyInvestor (Voz / Chat en vivo)
        </button>
        <button class="btn-soft-red-override" onclick="continueFraudWithOverride(${lastScamAmountEur})">
          Seguir y enviar transferencia bajo mi responsabilidad (No recomendado)
        </button>
      </div>
    `;
  } else {
    actionBox.innerHTML = `<div style="color:var(--ok-ink); font-weight:600;">✅ Operación verificada sin alertas. Puedes continuar.</div>`;
  }

  document.getElementById('mcp-inspector-box').textContent = JSON.stringify(
    {
      verdict: v.verdict,
      risk_score: v.risk_score,
      analysis_engine: v.analysis_engine,
      claude_error: v.claude_error || null,
      signals: v.signals.map((s) => ({ type: s.type, source: s.source, evidence: s.evidence })),
      claude_analysis: claudeInfo,
      kill_chain_cold_prescam: v.kill_chain_progression,
      in_call_coercion_telemetry: v.in_call_telemetry,
      cnmv_check: v.cnmv_check,
      iban_sepa_vop_check: v.iban_check,
      prosody_vishing_analysis: v.prosody_analysis,
      behavioral_intervention_fca_psr: v.behavioral_intervention,
      mcp_catalog_check: mcpCheck,
      contract_action: act.action_taken
    },
    null,
    2
  );

  renderGlobalState(data.state);
  speakMessage(
    data.spoken_text,
    v.verdict === 'ESTAFA'
      ? `${lastScamAmountEur > 0 ? `Importe: ${lastScamAmountEur} euros. ` : ''}${
          v.cnmv_check?.flagged ? `Entidad en la lista de alertas: ${v.cnmv_check.entity}. ` : ''
        }Puedes consultar nuestro canal oficial en tiempo real pulsando el botón azul.`
      : ''
  );
}

// ============================================================================
// ACTO 2: FONDO CARO EN LA OFICINA (TER 1,80% vs 0,30% MCP MYINVESTOR)
// ============================================================================
async function runScenario2Caro(presetKey = 'FONDO_RV_180') {
  setActiveScenarioPill('btn-scenario-2', 'active-caro');
  const preset = PRESET_DOCUMENTS[presetKey] || PRESET_DOCUMENTS.FONDO_RV_180;

  document.getElementById('input-source-tag').textContent = '📸 Folleto DFI · Claude Vision + MCP';
  document.getElementById('evidence-title').innerHTML = `🟠 <strong>${preset.name}</strong>`;
  document.getElementById('evidence-content').innerHTML = preset.document_html;

  const res = await fetch('/api/analyze-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      presetDocument: preset,
      amount_eur: preset.amount_eur || 50000,
      years: 10,
      gross_return_pct: 5.0
    })
  });
  const data = await res.json();
  renderDocumentVerdict(data);
}

function renderDocumentVerdict(data) {
  if (!data || !data.ok) {
    renderNeedsInput('NO SE PUDO ANALIZAR', (data && data.error) || 'Error al analizar el documento.');
    return;
  }
  if (data.needs_input) {
    renderNeedsInput('FALTA LA COMISIÓN', `${data.message} ${data.ask_user || ''}`.trim(), { extraction: data.step_1_input });
    return;
  }
  const doc = data.step_1_input;
  const cost = data.step_2_verdict.cost_analysis;
  const mcp = data.step_2_verdict.mcp_lookup;
  const act = data.step_3_action;
  const verdict = data.step_2_verdict.verdict;

  document.getElementById('latency-badge').textContent =
    `⚡ ${data.total_latency_ms} ms (MCP: ${mcp.mcp_latency_ms} ms)`;

  const topAlt = mcp.alternatives?.[0] || {
    isin: 'IE00BYX5NX33',
    name: 'Fidelity MSCI World Index Fund EUR P Acc',
    ter: 0.12
  };
  const loss30yIndex = cost.metrics.loss_30y_vs_direct_index_eur;
  const loss30yPortfolio = cost.metrics.loss_30y_vs_portfolio_eur;
  const isLiveMcp = /^LIVE/.test(mcp.mcp_status || '');

  // 1. Output Base: Notificación PUSH arriba del móvil (Caro vs Ok)
  if (verdict === 'CARO') {
    triggerIosPush(
      'CARO',
      `🟠 Producto CARO (${cost.inputs.offered_ter_pct.toFixed(2)}% TER vs ${topAlt.ter}% Índice MCP)`,
      `A 30 años dejas de ganar +${loss30yIndex.toLocaleString('es-ES')} €. Pulsa la gráfica para ver el desglose.`
    );
  } else {
    triggerIosPush(
      'ADELANTE',
      `🟢 Producto OK (${cost.inputs.offered_ter_pct.toFixed(2)}% TER)`,
      'Comisiones óptimas alineadas con el catálogo indexado de MyInvestor.'
    );
  }

  // 2. Banner In-App de "CARO"
  const banner = document.getElementById('verdict-banner');
  banner.className = `verdict-hero ${verdict}`;
  document.getElementById('verdict-title').textContent =
    verdict === 'CARO'
      ? `🟠 PRODUCTO CARO (${cost.inputs.offered_ter_pct.toFixed(2)}%)`
      : `🟢 PRODUCTO OK (${cost.inputs.offered_ter_pct.toFixed(2)}%)`;
  document.getElementById('verdict-badge-right').textContent =
    verdict === 'CARO'
      ? `-${loss30yIndex.toLocaleString('es-ES')} € (30a)`
      : 'Coste Óptimo';
  document.getElementById('verdict-sub-right').textContent =
    cost.transferability.is_tax_exempt_transfer ? 'Traspasable 0 € IRPF' : 'No traspasable';

  // 3. Gráfica In-App de Crecimiento a 30 Años (Sin texto denso) + Drill-In al pulsar la gráfica
  const svg30 = build30YearSvgChart(
    cost.yearly_series_30y || [],
    cost.inputs.offered_ter_pct,
    topAlt.ter
  );
  const m10 = cost.metrics.milestones_drill_in?.year_10 || {};
  const m20 = cost.metrics.milestones_drill_in?.year_20 || {};
  const m30 = cost.metrics.milestones_drill_in?.year_30 || {};

  const detailsBox = document.getElementById('verdict-details-container');
  detailsBox.innerHTML = `
    <div class="chart-30y-card" onclick="toggleChartDrillIn()" title="Pulsa la gráfica para desplegar los números detallados (Drill-In)">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:0.72rem; font-weight:800; color:var(--ink);">📈 Crecimiento a 30 años (TER ${cost.inputs.offered_ter_pct}% vs Índice MCP ${topAlt.ter}%)</span>
        <span id="chart-drill-in-hint" class="drill-in-hint">👆 Pulsa para números (Drill-In)</span>
      </div>
      ${svg30}
      <div id="chart-drill-in-panel" class="drill-in-panel">
        <div style="font-weight:800; color:var(--ink); margin-bottom:5px;">
          🔍 Desglose Numérico Drill-In (Sobre ${data.amount_is_example ? 'un ejemplo de ' : ''}${cost.inputs.amount_eur.toLocaleString('es-ES')} € al ${cost.inputs.gross_return_pct}% bruto anual):
        </div>
        <div class="phone-kpi-grid" style="margin-bottom:6px;">
          <div class="phone-kpi">
            <div class="phone-kpi-label">Año 10</div>
            <div class="phone-kpi-val" style="color:var(--caro-amber); font-size:0.84rem;">
              +${(m10.cumulative_loss_vs_direct_eur || cost.metrics.loss_10y_vs_direct_index_eur).toLocaleString('es-ES')} €
            </div>
            <div style="font-size:0.60rem; color:var(--muted);">${formatEur(m10.myinvestor_direct_index_eur)} vs ${formatEur(m10.offered_bank_eur)}</div>
          </div>
          <div class="phone-kpi">
            <div class="phone-kpi-label">Año 20</div>
            <div class="phone-kpi-val" style="color:var(--caro-amber); font-size:0.84rem;">
              +${formatEur(m20.cumulative_loss_vs_direct_eur)}
            </div>
            <div style="font-size:0.60rem; color:var(--muted);">${formatEur(m20.myinvestor_direct_index_eur)} vs ${formatEur(m20.offered_bank_eur)}</div>
          </div>
          <div class="phone-kpi">
            <div class="phone-kpi-label">Año 30</div>
            <div class="phone-kpi-val" style="color:var(--scam-red); font-size:0.84rem;">
              +${loss30yIndex.toLocaleString('es-ES')} €
            </div>
            <div style="font-size:0.60rem; color:var(--muted);">${formatEur(m30.myinvestor_direct_index_eur)} vs ${formatEur(m30.offered_bank_eur)}</div>
          </div>
        </div>
        <div style="font-size:0.68rem; color:var(--ink-soft); line-height:1.38;">
          • <strong>Drenaje mensual hoy:</strong> -${cost.metrics.monthly_fee_drain_eur} €/mes (-${cost.metrics.daily_fee_drain_eur} €/día)<br/>
          • <strong>Índice MCP comparado:</strong> ${topAlt.name} (<code>${topAlt.isin}</code> · TER ${topAlt.ter}%)<br/>
          • <strong>Peaje Fiscal IRPF hoy:</strong> <strong>${cost.transferability.irpf_to_pay_today_eur} €</strong> (${cost.transferability.is_tax_exempt_transfer ? 'Exento Art. 94 LIRPF' : 'No traspasable'})
        </div>
      </div>
    </div>
    ${
      cost.transferability.exit_warning
        ? `<div style="margin-top:8px; padding:8px 10px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; font-size:0.73rem; color:#991b1b; font-weight:600;">
            ⚠️ ${cost.transferability.exit_warning}
          </div>`
        : ''
    }
  `;

  // Actualizar panel comparativo grande de la derecha con la proyección a 30 años contra Índice MCP
  const maxVal30 = Math.max(
    cost.metrics.final_capital_30y_direct_eur,
    cost.metrics.final_capital_30y_portfolio_eur,
    cost.metrics.final_capital_30y_offered_eur,
    1
  );
  const pctOffered = Math.round((cost.metrics.final_capital_30y_offered_eur / maxVal30) * 100);
  const pctPortfolio = Math.round((cost.metrics.final_capital_30y_portfolio_eur / maxVal30) * 100);

  const mcpBadge = document.getElementById('mcp-status-badge');
  if (mcpBadge) {
    mcpBadge.textContent = isLiveMcp
      ? '● Conectado en vivo a https://mcp.myinvestor.es/mcp'
      : '● Sin conexión al MCP: copia guardada del catálogo';
  }
  const execSubtitle = document.getElementById('exec-chart-subtitle');
  if (execSubtitle) {
    execSubtitle.textContent = `Proyección Compuesta a 30 Años (${data.amount_is_example ? 'ejemplo de ' : ''}${cost.inputs.amount_eur.toLocaleString('es-ES')} € · ${cost.inputs.gross_return_pct}% bruto anual · TER Caro vs Índice MCP)`;
  }
  document.getElementById('exec-chart-headline').textContent =
    verdict === 'CARO'
      ? `A 30 años pierdes ${loss30yIndex.toLocaleString('es-ES')} € frente al Índice MCP al ${topAlt.ter} % (y ${loss30yPortfolio.toLocaleString('es-ES')} € frente a Cartera al 0,30 %)`
      : `Producto óptimo dentro de su categoría oficial en MyInvestor`;

  document.getElementById('bar-label-offered').textContent = `🏦 ${doc.name} a 30 años (TER ${cost.inputs.offered_ter_pct.toFixed(2)} %)`;
  document.getElementById('bar-val-offered').textContent = `${formatEur(cost.metrics.final_capital_30y_offered_eur)} (10a: ${cost.metrics.final_capital_offered_eur.toLocaleString('es-ES')} €)`;
  document.getElementById('bar-fill-offered').style.width = `${pctOffered}%`;

  document.getElementById('bar-label-portfolio').textContent = `🟢 ${mcp.recommended_portfolio.name} a 30 años (TER 0,30 % · Vía Fondo Puente FR0000447823)`;
  document.getElementById('bar-val-portfolio').textContent = `${formatEur(cost.metrics.final_capital_30y_portfolio_eur)} (+${loss30yPortfolio.toLocaleString('es-ES')} € a 30a)`;
  document.getElementById('bar-fill-portfolio').style.width = `${pctPortfolio}%`;

  document.getElementById('bar-label-direct').textContent = `⚡ Indexado Directo MCP a 30 años: ${topAlt.name} (${topAlt.isin} · TER ${topAlt.ter} %)`;
  document.getElementById('bar-val-direct').textContent = `${formatEur(cost.metrics.final_capital_30y_direct_eur)} (+${loss30yIndex.toLocaleString('es-ES')} € a 30a)`;

  // Renderizar tarjetas del MCP de MyInvestor
  const cardsContainer = document.getElementById('mcp-cards-container');
  cardsContainer.innerHTML = (mcp.alternatives || []).slice(0, 2).map((f) => `
    <div class="mcp-fund-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
        <span class="isin-tag">${f.isin}</span>
        <span style="font-size:0.74rem; font-weight:800; color:var(--mi-teal);">TER ${f.ter} %</span>
      </div>
      <div style="font-weight:800; font-size:0.83rem; color:var(--ink);">${f.name}</div>
      <div style="font-size:0.72rem; color:var(--muted); margin-top:3px;">
        ${f.asset_type} · ${f.geography || 'Global'} · ${isLiveMcp ? 'Datos en tiempo real vía <code>mcp.myinvestor.es</code>' : 'Copia guardada del catálogo MCP (sin conexión ahora)'}
      </div>
    </div>
  `).join('');

  // Paso 3: Orden de Traspaso preparada en el móvil de Carmen
  const actionBox = document.getElementById('action-container');
  if (verdict === 'CARO' && act.transfer_order_draft) {
    const draft = act.transfer_order_draft;
    actionBox.innerHTML = `
      <div style="background:var(--accent-soft); border:1px solid var(--accent-border); border-radius:12px; padding:11px 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <strong style="color:var(--accent); font-size:0.81rem;">✅ Traspaso Preparado (${draft.order_id})</strong>
          <span style="font-size:0.68rem; font-weight:700; background:var(--mi-teal-bg); color:#0f6f4b; padding:2px 7px; border-radius:999px;">0 € IRPF</span>
        </div>
        <div style="font-size:0.74rem; color:var(--ink-soft); margin-bottom:9px;">
          • <strong>De:</strong> ${draft.origin_product} (TER ${draft.origin_ter_pct}%)<br/>
          • <strong>A:</strong> ${draft.destination_option_1.name} (${draft.destination_option_1.ter_pct}%) o ${draft.destination_option_2.name} (0,30%)<br/>
          • <strong>Ahorro a 30 años vs Índice MCP:</strong> +${formatEur(draft.estimated_30y_savings_vs_index_eur)} (+${formatEur(draft.estimated_10y_savings_eur)} a 10a)
        </div>
        <div id="sign-box-area">
          <button class="btn-cta-primary" onclick="signTransferInApp('${draft.order_id}', '${draft.destination_option_2.name}', ${draft.amount_eur})">
            ✍️ Firmar Traspaso In-App (FaceID)
          </button>
        </div>
      </div>
    `;
  } else {
    actionBox.innerHTML = `<div style="color:var(--ok-ink); font-weight:600;">✅ Producto con comisiones óptimas. Puedes continuar en la app.</div>`;
  }

  document.getElementById('mcp-inspector-box').textContent = JSON.stringify(
    {
      mcp_server: mcp.mcp_status,
      mcp_latency_ms: mcp.mcp_latency_ms,
      mcp_alternatives: mcp.alternatives,
      formula_audit: cost.formula_audit,
      behavioral_fee_salience_esma: cost.behavioral_salience,
      transferability_art94_lirpf: cost.transferability
    },
    null,
    2
  );

  renderGlobalState(data.state);
  speakMessage(
    data.spoken_text,
    `Importe: ${cost.inputs.amount_eur} euros. Origen: ${doc.name} al ${cost.inputs.offered_ter_pct} por ciento anual. Destino en MyInvestor al 0,30 por ciento. Impuestos a pagar hoy: ${cost.transferability.irpf_to_pay_today_eur} euros.`
  );
}

// ============================================================================
// ACTO 3: ACCESIBILIDAD (10 SEGUNDOS · MODO PERSONA SORDA / BAJA VISIÓN)
// ============================================================================
function runScenario3Accessibility() {
  setActiveScenarioPill('btn-scenario-3', 'active-access');
  const nextMode =
    currentAccessMode === 'STANDARD'
      ? 'DEAF'
      : currentAccessMode === 'DEAF'
        ? 'LOW_VISION'
        : 'STANDARD';
  setAccessMode(nextMode);
}

async function setAccessMode(mode) {
  currentAccessMode = mode;
  document.body.classList.remove('mode-deaf', 'mode-low-vision');
  document.querySelectorAll('.access-btn').forEach((el) => el.classList.remove('active'));
  const activeBtn = document.getElementById(`mode-${mode}`);
  if (activeBtn) activeBtn.classList.add('active');

  if (mode === 'DEAF') {
    document.body.classList.add('mode-deaf');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } else if (mode === 'LOW_VISION') {
    document.body.classList.add('mode-low-vision');
    speakMessage(
      'Modo Baja Visión activado. Centinela lee en voz alta el importe, las comisiones, el beneficiario y el IBAN antes de firmar.',
      lastSpokenMessage || ''
    );
  } else {
    speakMessage('Modo estándar de voz y texto simultáneos activado.');
  }

  await fetch('/api/contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessibility_mode: mode })
  });
  refreshState();
}

async function signTransferInApp(orderId, destination, amountEur) {
  const res = await fetch('/api/sign-transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, destination, amount_eur: amountEur })
  });
  const data = await res.json();
  if (data.ok) {
    document.getElementById('sign-box-area').innerHTML = `
      <div style="padding:9px 11px; background:var(--mi-teal-bg); border:1px solid var(--mi-teal-border); border-radius:9px; color:#0f6f4b; font-weight:700; font-size:0.76rem; text-align:center;">
        🎉 Orden ${orderId} firmada con éxito In-App · 0 € de peaje fiscal en IRPF
      </div>
    `;
    renderGlobalState(data.state);
    speakMessage(`Solicitud de traspaso ${orderId} firmada en la app de MyInvestor sin coste fiscal.`);
  }
}

function handlePresetSelect(val) {
  if (!val) return;
  if (val === 'SMISHING_MYINVESTOR') {
    runSmishingQuickCase();
  } else if (val === 'EXTORSION_DESBLOQUEO_IRPF') {
    runUnlockTaxExtortionCase();
  } else {
    runScenario2Caro(val);
  }
}

async function runUnlockTaxExtortionCase() {
  document.getElementById('input-source-tag').textContent = '📞 Audio / Chat · Detector Extorsión Salida';
  document.getElementById('evidence-title').innerHTML =
    '🔴 <strong>Trampa Fase 4–5 (USENIX / FinCEN):</strong> Falsa Tasa Previa de Desbloqueo / IRPF';
  document.getElementById('evidence-content').innerHTML = `
    “Como ya viste que cobraste tus <span class="hl-warn">primeros 100 € de beneficio</span>, tu cuenta acumula 38.000 €.
    Para <span class="hl-danger">liberar tus ganancias tienes que pagar antes el 15% de tasa de desbloqueo e impuesto previo para retirar</span>
    transfiriendo <strong>5.700 €</strong> hoy al IBAN <span class="hl-danger">LT60 3250 0811 9922 1100</span>.”
  `;
  showAnalyzing();
  const res = await fetch('/api/analyze-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Como ya viste que cobraste tus primeros 100 € de beneficio, para liberar tus ganancias tienes que pagar antes el 15% de tasa de desbloqueo e impuesto previo para retirar transfiriendo 5.700 euros hoy al IBAN LT603250081199221100.',
      entity_name: 'Horizon Gold & AI Trading',
      iban: 'LT603250081199221100',
      amount_eur: 5700
    })
  });
  const data = await res.json();
  renderCallVerdict(data);
}

async function runSmishingQuickCase() {
  document.getElementById('input-source-tag').textContent = '💬 Captura SMS · Detector Smishing';
  document.getElementById('evidence-title').innerHTML = '🔴 <strong>SMS recibido:</strong> Suplantación de Hilo (Spoofing)';
  document.getElementById('evidence-content').innerHTML = `
    “AVISO URGENTE MYINVESTOR: Su cuenta sufre <span class="hl-danger">bloqueo inminente</span>.
    <span class="hl-danger">Pincha en este enlace myinvestor-seguridad.com</span> e introduce tu <span class="hl-danger">código SMS</span>.”
  `;
  showAnalyzing();
  const res = await fetch('/api/analyze-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'AVISO URGENTE MYINVESTOR: Su cuenta sufre bloqueo inminente. Pincha en este enlace myinvestor-seguridad.com e introduce tu código SMS de firma.',
      entity_name: 'myinvestor-seguridad.com',
      amount_eur: 4500
    })
  });
  const data = await res.json();
  renderCallVerdict(data);
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  document.getElementById('input-source-tag').textContent = `📄 ${file.name}`;
  document.getElementById('evidence-title').innerHTML = `📸 <strong>Analizando:</strong> ${file.name}`;

  if (file.type.startsWith('image/') || file.type === 'application/pdf') {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      document.getElementById('evidence-content').innerHTML =
        file.type === 'application/pdf'
          ? `<div>📑 <strong>Folleto PDF cargado (${file.name})</strong> · Extrayendo ISIN, TER y liquidez con Claude Document/Vision y consultando <code>mcp.myinvestor.es</code>...</div>`
          : `<div style="display:flex; gap:10px; align-items:center;">
              <img src="${base64}" style="max-height:70px; border-radius:6px; border:1px solid var(--line-strong);" />
              <div>Extrayendo comisiones con Claude Vision y consultando <code>mcp.myinvestor.es</code>...</div>
            </div>`;
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Se analiza el archivo REAL que ha subido el usuario (sin documento de ejemplo)
        body: JSON.stringify({
          imageBase64: base64,
          imageMimeType: file.type
        })
      });
      const data = await res.json().catch(() => ({ ok: false, error: `Error HTTP ${res.status}` }));
      if (!data.ok || data.needs_input) {
        document.getElementById('evidence-content').textContent = `${file.name}: ${data.message || data.error || 'no se ha podido leer'}`;
      }
      renderDocumentVerdict(data);
    };
    reader.readAsDataURL(file);
  } else if (file.type.startsWith('audio/') || /\.(webm|mp3|m4a|wav|ogg|oga|aac|flac|mp4)$/i.test(file.name)) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      document.getElementById('evidence-content').innerHTML =
        `🎙️ Transcribiendo audio <strong>${file.name}</strong> con ElevenLabs Scribe (<code>scribe_v1</code>)...`;
      const sttRes = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: file.type })
      });
      const sttData = await sttRes.json().catch(() => ({ ok: false, reason: `Error HTTP ${sttRes.status}` }));
      if (!sttData.ok || !String(sttData.text || '').trim()) {
        // Sin transcripción real no se analiza nada (antes se usaba un texto de estafa fijo)
        document.getElementById('evidence-content').textContent = sttData.reason || 'No se ha podido transcribir el audio.';
        renderNeedsInput('AUDIO SIN TRANSCRIBIR', `${sttData.reason || 'No se ha podido transcribir el audio.'} Puedes usar el micrófono en vivo o escribir el mensaje.`);
        return;
      }
      document.getElementById('evidence-content').textContent = `“${sttData.text}”`;
      processLiveSpokenInput(sttData.text, sttData.speech_rate_wpm ? { speech_rate_wpm: sttData.speech_rate_wpm, speech_rate_source: 'ELEVENLABS_SCRIBE' } : {});
    };
    reader.readAsDataURL(file);
  } else if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
    // Texto (p. ej. un SMS copiado): se analiza su contenido real
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '').slice(0, 5000);
      document.getElementById('evidence-content').textContent = `“${content}”`;
      processLiveSpokenInput(content);
    };
    reader.readAsText(file);
  } else {
    renderNeedsInput('FORMATO NO ADMITIDO', `No puedo analizar "${file.name}". Sube una foto, un PDF, un audio o un .txt.`);
  }
}

function toggleLiveMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('btn-mic');

  if (!SpeechRecognition) {
    const manualText = prompt(
      'Introduce lo que te ofrecen en la llamada o sucursal:',
      'Te garantizamos un 12% anual sin riesgo si transfieres hoy 9.000 euros a Quantum Ibérica'
    );
    if (manualText) processLiveSpokenInput(manualText);
    return;
  }

  if (isRecordingMic && recognitionInstance) {
    recognitionInstance.stop();
    isRecordingMic = false;
    micBtn.textContent = '🎙️ Altavoz en Vivo';
    return;
  }

  recognitionInstance = new SpeechRecognition();
  recognitionInstance.lang = 'es-ES';
  recognitionInstance.interimResults = true;
  isRecordingMic = true;
  micBtn.textContent = '🔴 Escuchando...';
  document.getElementById('evidence-title').innerHTML = '🎙️ <strong>Escuchando altavoz en directo...</strong>';

  recognitionInstance.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById('evidence-content').textContent = `“${transcript}”`;
    if (event.results[event.results.length - 1].isFinal) {
      processLiveSpokenInput(transcript);
    }
  };

  recognitionInstance.onend = () => {
    isRecordingMic = false;
    micBtn.textContent = '🎙️ Altavoz en Vivo';
  };

  recognitionInstance.start();
}

async function processLiveSpokenInput(transcript, extra = {}) {
  const text = String(transcript || '').trim();
  if (!text) {
    renderNeedsInput('SIN CONTENIDO', 'No he recibido nada que analizar.');
    return;
  }
  // El importe sale de lo que se ha dicho; si no se dice, no se inventa
  const amount = extractAmountEur(text);
  // Si hay cualquier rasgo de estafa (promesas, transferencias, códigos), va al detector de fraude aunque se hable de un "fondo"
  const looksLikeScamPitch = /garantizad|asegurad|segur[oa]s?\b|sin\s+(?:ning[uú]n\s+)?riesgos?|c[oó]digo\s+sms|\biban\b|transfi[eé]r|desbloque|duplicar|anydesk|cuenta\s+segura/i.test(text);
  const isCostQuery = /(comisi[oó]n|\bTER\b|fondo|folleto|1[.,]\d+\s*%)/i.test(text) && !looksLikeScamPitch;
  if (isCostQuery) {
    const res = await fetch('/api/analyze-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...(amount ? { amount_eur: amount } : {}) })
    });
    const data = await res.json().catch(() => ({ ok: false, error: `Error HTTP ${res.status}` }));
    renderDocumentVerdict(data);
  } else {
    showAnalyzing();
    const res = await fetch('/api/analyze-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, amount_eur: amount || 0, ...extra })
    });
    const data = await res.json().catch(() => ({ ok: false, error: `Error HTTP ${res.status}` }));
    renderCallVerdict(data);
  }
}

async function saveContractForm() {
  const maxTransfer = Number(document.getElementById('input-max-transfer').value) || 3000;
  const maxTer = Number(document.getElementById('input-max-ter').value) || 0.75;
  const trustedName = document.getElementById('input-trusted-name').value || 'Daniel García (Hijo)';

  const res = await fetch('/api/contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_transfer_amount_eur: maxTransfer,
      max_acceptable_ter_pct: maxTer,
      trusted_contact: { name: trustedName }
    })
  });
  const data = await res.json();
  if (data.ok) renderGlobalState(data.state);
}

async function toggleKillSwitch(forceState) {
  const newState = typeof forceState === 'boolean' ? forceState : !currentContract.operations_disabled;
  const res = await fetch('/api/contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations_disabled: newState })
  });
  const data = await res.json();
  if (data.ok) {
    renderGlobalState(data.state);
    if (newState) {
      speakMessage('Operativa saliente deshabilitada en Mi Contrato.');
    }
  }
}

function activateKillSwitchFromDaniel() {
  toggleKillSwitch(true);
}

async function resetDemo() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const res = await fetch('/api/reset', { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    renderGlobalState(data.state);
    document.querySelectorAll('.scenario-pill').forEach((b) => {
      b.className = 'scenario-pill';
    });
    document.getElementById('verdict-banner').className = 'verdict-hero ADELANTE';
    const pushEl = document.getElementById('ios-push-banner');
    if (pushEl) pushEl.className = 'ios-push-banner';
    document.getElementById('verdict-title').textContent = 'LISTO PARA VERIFICAR';
    document.getElementById('verdict-badge-right').textContent = 'MCP Online';
    document.getElementById('verdict-sub-right').textContent = 'CNMV + Catálogo MyInvestor';
    document.getElementById('verdict-details-container').innerHTML = '';
    document.getElementById('spoken-transcript').innerHTML =
      '🔊 <strong>Todo se oye y se lee a la vez:</strong> Selecciona un escenario para escuchar el veredicto de Centinela.';
    document.getElementById('action-container').innerHTML =
      '<strong>Mi Contrato protege a Carmen:</strong> Límite máximo de <strong>3.000 €</strong> por transferencia, bloqueo automático de entidades alertadas por la CNMV y notificación a su hijo <strong>Daniel</strong>.';
  }
}

function setActiveScenarioPill(id, activeClass) {
  ['btn-scenario-1', 'btn-scenario-2', 'btn-scenario-3'].forEach((btnId) => {
    const el = document.getElementById(btnId);
    if (el) {
      el.className = 'scenario-pill';
      if (btnId === id) el.classList.add(activeClass);
    }
  });
}

async function openEvalsModal() {
  document.getElementById('modal-evals').classList.add('open');
  document.getElementById('evals-summary-bar').innerHTML = 'Ejecutando los 30 casos de prueba...';
  const res = await fetch('/api/evals');
  const data = await res.json();
  if (data.ok) {
    const r = data.report;
    document.getElementById('evals-summary-bar').innerHTML = `
      <div style="display:flex; gap:14px; flex-wrap:wrap; background:var(--accent-soft); border:1px solid var(--accent-border); padding:11px 15px; border-radius:12px; font-size:0.83rem;">
        <div>✅ <strong>Precisión Global:</strong> <span style="color:var(--mi-teal); font-weight:800;">${r.passed_cases}/${r.total_cases} (${r.accuracy_pct}%)</span></div>
        <div>🔴 <strong>Estafas:</strong> ${r.breakdown_by_class.ESTAFA}</div>
        <div>🟠 <strong>Caros:</strong> ${r.breakdown_by_class.CARO}</div>
        <div>🟢 <strong>Adelante:</strong> ${r.breakdown_by_class.ADELANTE}</div>
        <div>⚡ <strong>Latencia media del motor:</strong> ${r.avg_time_to_verdict_ms} ms/caso</div>
      </div>
    `;
    document.getElementById('evals-table-container').innerHTML = `
      <table class="eval-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Caso de Prueba</th>
            <th>Esperado</th>
            <th>Obtenido</th>
            <th>Latencia</th>
            <th>Evidencia Determinista</th>
          </tr>
        </thead>
        <tbody>
          ${r.cases
            .map(
              (c) => `
            <tr>
              <td><code>${c.id}</code></td>
              <td><strong>${c.title}</strong></td>
              <td>${c.expected}</td>
              <td style="color:${c.passed ? 'var(--mi-teal)' : 'var(--scam-red)'}; font-weight:800;">
                ${c.passed ? '✅ ' : '❌ '}${c.actual}
              </td>
              <td>${c.latency_ms} ms</td>
              <td style="color:var(--ink-soft);">${c.detail}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }
}

function closeEvalsModal() {
  document.getElementById('modal-evals').classList.remove('open');
}

function openKeysModal() {
  document.getElementById('modal-keys').classList.add('open');
}

function closeKeysModal() {
  document.getElementById('modal-keys').classList.remove('open');
}

async function saveApiKeys() {
  const anthropicKey = document.getElementById('key-anthropic').value;
  const elevenLabsKey = document.getElementById('key-elevenlabs').value;
  await fetch('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anthropicKey, elevenLabsKey })
  });
  closeKeysModal();
  refreshState();
}
