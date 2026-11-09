/**
 * Centinela · Frontend Reactivo (Diseño Oficial inspirado en MyInvestor × GPTadvisor)
 */

let currentAccessMode = 'STANDARD';
let lastSpokenMessage = '';
let currentContract = {};
let isRecordingMic = false;
let recognitionInstance = null;

const PRESET_DOCUMENTS = {
  FONDO_RV_180: {
    name: 'FonBanco Selección Global Gestión Activa FI',
    bank_name: 'Banco Tradicional Sucursal',
    isin: 'ES0113900J37',
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
      <div><strong>Fondo:</strong> FonBanco Selección Global Activa, FI (<code>ES0113900J37</code>)</div>
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
    isin: 'ES0138922004',
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
      <div><strong>Fondo:</strong> Garantizado Estabilidad 2031 FI (<code>ES0138922004</code>)</div>
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

  const res = await fetch('/api/analyze-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hola Carmen, te llamo de Quantum Ibérica Capital. Te activamos hoy el Bono VIP con un 12% anual garantizado sin ningún riesgo. Quedan las últimas plazas solo por hoy en los próximos 15 minutos. Transfiere ahora mismo 9.000 euros al IBAN ES91 2100 0418 4502 0005 1332.',
      entity_name: 'Quantum Ibérica Capital',
      iban: 'ES9121000418450200051332',
      claimed_product: 'Bono VIP 12% Garantizado MyInvestor',
      amount_eur: 9000
    })
  });
  const data = await res.json();
  renderCallVerdict(data);
}

function renderCallVerdict(data) {
  const v = data.step_2_verdict.fraud_analysis;
  const mcpCheck = data.step_2_verdict.mcp_verification;
  const act = data.step_3_action;

  document.getElementById('latency-badge').textContent = `⚡ ${data.total_latency_ms} ms`;

  const banner = document.getElementById('verdict-banner');
  banner.className = `verdict-hero ${v.verdict}`;
  document.getElementById('verdict-title').textContent =
    v.verdict === 'ESTAFA' ? '🔴 ESTAFA · CUELGA' : '🟢 ADELANTE · SEGURO';
  document.getElementById('verdict-badge-right').textContent = `Riesgo ${v.risk_score}%`;
  document.getElementById('verdict-sub-right').textContent =
    v.cnmv_check?.flagged ? 'Alerta CNMV + IBAN reportado' : 'Verificado sin alertas';

  const detailsBox = document.getElementById('verdict-details-container');
  if (v.verdict === 'ESTAFA') {
    detailsBox.innerHTML = `
      <div class="phone-signals">
        ${v.signals
          .map(
            (s) => `
          <div class="phone-signal-row">
            <div style="font-weight:800; color:#991b1b;">⚠️ ${s.label}</div>
            <div style="color:#475569; margin-top:2px;">${s.explanation}</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  } else {
    detailsBox.innerHTML = `
      <div style="margin-top:8px; padding:9px; background:var(--ok-bg); border:1px solid var(--ok-border); border-radius:9px; font-size:0.75rem; color:var(--ok-ink); font-weight:600;">
        ✅ Sin alertas en la CNMV ni patrones de manipulación psicológica.
      </div>
    `;
  }

  const actionBox = document.getElementById('action-container');
  if (v.verdict === 'ESTAFA') {
    actionBox.innerHTML = `
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:11px; padding:11px 12px;">
        <div style="font-weight:800; color:#991b1b; font-size:0.82rem; margin-bottom:4px;">
          🛡️ Transferencia de ${(v.amount_detected_eur || 9000).toLocaleString('es-ES')} € RETENIDA por Mi Contrato
        </div>
        <div style="font-size:0.74rem; color:#7f1d1d; margin-bottom:9px;">
          • Supera el límite de seguridad (${(currentContract.max_transfer_amount_eur || 3000).toLocaleString('es-ES')} €) y la entidad está alertada por la CNMV.<br/>
          • Notificación enviada al móvil de <strong>${currentContract.trusted_contact?.name || 'Daniel (Hijo)'}</strong>.
        </div>
        <button class="btn-cta-danger" onclick="toggleKillSwitch(true)">
          🛑 Deshabilitar Operativa Ahora
        </button>
      </div>
    `;
  } else {
    actionBox.innerHTML = `<div style="color:var(--ok-ink); font-weight:600;">✅ Operación permitida por Mi Contrato.</div>`;
  }

  document.getElementById('mcp-inspector-box').textContent = JSON.stringify(
    {
      verdict: v.verdict,
      risk_score: v.risk_score,
      cnmv_check: v.cnmv_check,
      iban_check: v.iban_check,
      mcp_catalog_check: mcpCheck,
      contract_action: act.action_taken
    },
    null,
    2
  );

  renderGlobalState(data.state);
  speakMessage(
    data.spoken_text,
    `Importe retenido: ${v.amount_detected_eur} euros. Entidad en lista negra de la CNMV: ${v.cnmv_check?.entity || 'Desconocida'}. IBAN bloqueado con ${v.iban_check?.reports || 14} denuncias.`
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
  const doc = data.step_1_input;
  const cost = data.step_2_verdict.cost_analysis;
  const mcp = data.step_2_verdict.mcp_lookup;
  const act = data.step_3_action;
  const verdict = data.step_2_verdict.verdict;

  document.getElementById('latency-badge').textContent =
    `⚡ ${data.total_latency_ms} ms (MCP: ${mcp.mcp_latency_ms} ms)`;

  const banner = document.getElementById('verdict-banner');
  banner.className = `verdict-hero ${verdict}`;
  document.getElementById('verdict-title').textContent =
    verdict === 'CARO'
      ? `🟠 PRODUCTO CARO (${cost.inputs.offered_ter_pct.toFixed(2)}%)`
      : `🟢 ADELANTE (${cost.inputs.offered_ter_pct.toFixed(2)}%)`;
  document.getElementById('verdict-badge-right').textContent =
    verdict === 'CARO'
      ? `-${cost.metrics.loss_10y_vs_portfolio_eur.toLocaleString('es-ES')} € (10a)`
      : 'Coste Óptimo';
  document.getElementById('verdict-sub-right').textContent =
    cost.transferability.is_tax_exempt_transfer ? 'Traspasable 0 € IRPF' : 'No traspasable';

  const detailsBox = document.getElementById('verdict-details-container');
  detailsBox.innerHTML = `
    <div class="phone-kpi-grid">
      <div class="phone-kpi">
        <div class="phone-kpi-label">Comisión Anual</div>
        <div class="phone-kpi-val" style="color:${verdict === 'CARO' ? 'var(--caro-amber)' : 'var(--mi-teal)'};">
          ${cost.inputs.offered_ter_pct.toFixed(2)}%
        </div>
        <div style="font-size:0.64rem; color:var(--muted);">vs 0,30% MyInvestor</div>
      </div>
      <div class="phone-kpi">
        <div class="phone-kpi-label">Pierdes en 10 años</div>
        <div class="phone-kpi-val" style="color:var(--scam-red);">
          -${cost.metrics.loss_10y_vs_portfolio_eur.toLocaleString('es-ES')} €
        </div>
        <div style="font-size:0.64rem; color:var(--muted);">Sobre 50.000 € (5% bruto)</div>
      </div>
      <div class="phone-kpi">
        <div class="phone-kpi-label">Peaje Fiscal IRPF</div>
        <div class="phone-kpi-val" style="color:${cost.transferability.is_tax_exempt_transfer ? 'var(--mi-teal)' : 'var(--scam-red)'};">
          ${cost.transferability.irpf_to_pay_today_eur.toLocaleString('es-ES')} €
        </div>
        <div style="font-size:0.64rem; color:var(--muted);">
          ${cost.transferability.is_tax_exempt_transfer ? 'Exento Art. 94' : 'Tributa 19%-30%'}
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

  // Actualizar panel comparativo grande de la derecha con los datos reales del MCP de MyInvestor
  const topAlt = mcp.alternatives?.[0] || {
    isin: 'IE00BYX5NX33',
    name: 'Fidelity MSCI World Index Fund EUR P Acc',
    ter: 0.12
  };
  const maxVal = cost.metrics.final_capital_myinvestor_direct_eur;
  const pctOffered = Math.round((cost.metrics.final_capital_offered_eur / maxVal) * 100);
  const pctPortfolio = Math.round((cost.metrics.final_capital_myinvestor_portfolio_eur / maxVal) * 100);

  document.getElementById('exec-chart-headline').textContent =
    verdict === 'CARO'
      ? `En 10 años pierdes ${cost.metrics.loss_10y_vs_portfolio_eur.toLocaleString('es-ES')} € frente a una Cartera al 0,30 % (y ${cost.metrics.loss_10y_vs_direct_index_eur.toLocaleString('es-ES')} € frente al indexado al ${topAlt.ter} %)`
      : `Producto óptimo dentro de su categoría oficial en MyInvestor`;

  document.getElementById('bar-label-offered').textContent = `🏦 ${doc.name} (TER ${cost.inputs.offered_ter_pct.toFixed(2)} %)`;
  document.getElementById('bar-val-offered').textContent = `${cost.metrics.final_capital_offered_eur.toLocaleString('es-ES')} €`;
  document.getElementById('bar-fill-offered').style.width = `${pctOffered}%`;

  document.getElementById('bar-label-portfolio').textContent = `🟢 ${mcp.recommended_portfolio.name} (TER 0,30 % · Vía Fondo Puente FR0000447823)`;
  document.getElementById('bar-val-portfolio').textContent = `${cost.metrics.final_capital_myinvestor_portfolio_eur.toLocaleString('es-ES')} € (+${cost.metrics.loss_10y_vs_portfolio_eur.toLocaleString('es-ES')} €)`;
  document.getElementById('bar-fill-portfolio').style.width = `${pctPortfolio}%`;

  document.getElementById('bar-label-direct').textContent = `⚡ Indexado Directo MCP: ${topAlt.name} (${topAlt.isin} · TER ${topAlt.ter} %)`;
  document.getElementById('bar-val-direct').textContent = `${cost.metrics.final_capital_myinvestor_direct_eur.toLocaleString('es-ES')} € (+${cost.metrics.loss_10y_vs_direct_index_eur.toLocaleString('es-ES')} €)`;

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
        ${f.asset_type} · ${f.geography || 'Global'} · Datos en tiempo real vía <code>mcp.myinvestor.es</code>
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
          • <strong>A:</strong> ${draft.destination_option_2.name} (0,30%) o ${draft.destination_option_1.name} (${draft.destination_option_1.ter_pct}%)<br/>
          • <strong>Ahorro a 10 años:</strong> +${draft.estimated_10y_savings_eur.toLocaleString('es-ES')} €
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
  } else {
    runScenario2Caro(val);
  }
}

async function runSmishingQuickCase() {
  document.getElementById('input-source-tag').textContent = '💬 Captura SMS · Detector Smishing';
  document.getElementById('evidence-title').innerHTML = '🔴 <strong>SMS recibido:</strong> Suplantación de Hilo (Spoofing)';
  document.getElementById('evidence-content').innerHTML = `
    “AVISO URGENTE MYINVESTOR: Su cuenta sufre <span class="hl-danger">bloqueo inminente</span>.
    <span class="hl-danger">Pincha en este enlace myinvestor-seguridad.com</span> e introduce tu <span class="hl-danger">código SMS</span>.”
  `;
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

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      document.getElementById('evidence-content').innerHTML = `
        <div style="display:flex; gap:10px; align-items:center;">
          <img src="${base64}" style="max-height:70px; border-radius:6px; border:1px solid var(--line-strong);" />
          <div>Extrayendo comisiones con Claude Vision y consultando <code>mcp.myinvestor.es</code>...</div>
        </div>
      `;
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          imageMimeType: file.type,
          text: file.name,
          amount_eur: 50000
        })
      });
      const data = await res.json();
      renderDocumentVerdict(data);
    };
    reader.readAsDataURL(file);
  } else {
    runScenario2Caro('FONDO_RV_180');
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

async function processLiveSpokenInput(transcript) {
  const isCostQuery = /(comisi[oó]n|ter\b|fondo|folleto|1[.,]\d+\s*%)/i.test(transcript) && !/garantizad|c[oó]digo\s+sms/i.test(transcript);
  if (isCostQuery) {
    const res = await fetch('/api/analyze-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: transcript, amount_eur: 50000 })
    });
    const data = await res.json();
    renderDocumentVerdict(data);
  } else {
    const res = await fetch('/api/analyze-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: transcript, amount_eur: 9000 })
    });
    const data = await res.json();
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
