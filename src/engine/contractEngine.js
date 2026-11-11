/**
 * Motor de Gobernanza Programable "Mi Contrato" y Log de Auditoría Inmutable
 */

const crypto = require('crypto');

// Estado en memoria del contrato del cliente (Carmen, 68 años)
let clientContract = {
  client_id: 'MYINV-ES-884920',
  client_name: 'Carmen García',
  max_transfer_amount_eur: 3000,
  max_acceptable_ter_pct: 0.75,
  allowed_products: [
    'FONDOS_REGULADOS_CNMV',
    'CARTERAS_INDEXADAS_MYINVESTOR',
    'DEPOSITOS_FGD_ESPANA'
  ],
  block_unregistered_cnmv: true,
  require_family_alert_on_scam: true,
  operations_disabled: false,
  trusted_contact: {
    name: 'Daniel García (Hijo)',
    role: 'Familiar de confianza autorizado',
    device: 'iPhone 16 Pro · App MyInvestor',
    channel: 'Notificación Push In-App'
  },
  protection_level: 'LEVEL_2_PASSIVE_LISTENING', // 'LEVEL_1_ON_DEMAND' | 'LEVEL_2_PASSIVE_LISTENING'
  accessibility_mode: 'STANDARD' // 'STANDARD' | 'DEAF' | 'LOW_VISION'
};

const familyNotifications = [];
const auditLog = [];

function recordAuditEvent({ event_type, verdict, summary, details }) {
  const prevHash = auditLog.length > 0 ? auditLog[0].hash : '00000000000000000000000000000000';
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ timestamp, event_type, verdict, summary, prevHash });
  const hash = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);

  const entry = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    timestamp,
    event_type,
    verdict,
    summary,
    details,
    prev_hash: prevHash,
    hash
  };
  auditLog.unshift(entry);
  if (auditLog.length > 50) auditLog.pop();
  return entry;
}

function evaluateContractAction({
  verdict,
  amount_eur = 0,
  beneficiary_name = '',
  iban = '',
  fraud_analysis = null,
  cost_analysis = null,
  mcp_recommendation = null,
  offered_fund = null
}) {
  const amount = Number(amount_eur) || 0;

  if (clientContract.operations_disabled) {
    const entry = recordAuditEvent({
      event_type: 'KILL_SWITCH_ACTIVE',
      verdict: 'BLOQUEADO',
      summary: 'Operativa saliente deshabilitada por seguridad en Mi Contrato.',
      details: { amount_eur: amount, beneficiary_name }
    });
    return {
      contract_status: 'OPERATIVA_DESHABILITADA',
      action_taken: 'RETENCION_TOTAL',
      allow_signature: false,
      offer_kill_switch: true,
      audit_entry: entry
    };
  }

  // CASO 1: VEREDICTO ESTAFA
  if (verdict === 'ESTAFA') {
    const exceedsMax = amount > clientContract.max_transfer_amount_eur;
    const rulesTriggered = [
      'Regla #1: Bloqueo automático ante entidad en lista de alertas CNMV o IBAN reportado',
      'Regla #2: Detección de manipulación psicológica / promesa garantizada fuera de mercado'
    ];
    if (exceedsMax) {
      rulesTriggered.push(
        `Regla #3: Importe (${amount.toLocaleString('es-ES')} €) supera el límite de seguridad de Mi Contrato (${clientContract.max_transfer_amount_eur.toLocaleString('es-ES')} €)`
      );
    }

    // Solo se muestran importe, riesgo e IBAN si existen de verdad: nada de valores por defecto inventados
    const hasAmount = amount > 0;
    const riskScore = fraud_analysis?.risk_score;
    const notification = {
      id: `NOTIF-${Date.now()}`,
      timestamp: new Date().toISOString(),
      recipient: clientContract.trusted_contact.name,
      title: hasAmount
        ? `🚨 Alerta Centinela: Transferencia de ${amount.toLocaleString('es-ES')} € retenida`
        : '🚨 Alerta Centinela: posible estafa detectada',
      body: `Carmen ha recibido una oferta sospechosa (${beneficiary_name || 'remitente desconocido'})${
        typeof riskScore === 'number' ? ` con riesgo del ${riskScore}%` : ''
      }. ${hasAmount ? `Mi Contrato ha retenido los ${amount.toLocaleString('es-ES')} € preventivamente.` : 'Mi Contrato ha activado la pantalla de seguridad.'}`,
      signals: (fraud_analysis?.signals || []).map((s) => s.label),
      iban_blocked: iban || fraud_analysis?.iban_check?.iban || null,
      amount_eur: amount,
      status: 'PENDIENTE_REVISION_FAMILIAR'
    };
    familyNotifications.unshift(notification);

    const auditEntry = recordAuditEvent({
      event_type: 'SCAM_INTERCEPTED_AND_HELD',
      verdict: 'ESTAFA',
      summary: `${hasAmount ? `Transferencia de ${amount.toLocaleString('es-ES')} € a "${beneficiary_name || 'Entidad no autorizada'}" retenida por Mi Contrato.` : `Posible estafa de "${beneficiary_name || 'remitente desconocido'}" interceptada por Mi Contrato.`} Alerta enviada a ${clientContract.trusted_contact.name}.`,
      details: {
        rules_triggered: rulesTriggered,
        risk_score: fraud_analysis?.risk_score,
        iban: notification.iban_blocked
      }
    });

    return {
      contract_status: 'PANTALLA_INTERCEPCION_FRAUDE_ACTIVA',
      action_taken: 'INTERCEPCION_EXPLICABLE_SIN_HARD_BLOCK',
      allow_signature: true,
      allow_client_override: true,
      official_channel_cta: 'Consultar en el Canal Oficial de MyInvestor en Tiempo Real (Voz / Chat)',
      override_warning_cta: 'Continuar y enviar bajo mi responsabilidad (No recomendado)',
      offer_kill_switch: true,
      rules_triggered: rulesTriggered,
      family_notification: notification,
      audit_entry: auditEntry
    };
  }

  // CASO 2: VEREDICTO CARO
  if (verdict === 'CARO') {
    const targetFund =
      mcp_recommendation?.alternatives?.[0] || {
        isin: 'IE00BYX5NX33',
        name: 'Fidelity MSCI World Index Fund EUR P Acc',
        ter: 0.12
      };
    const targetPortfolio = mcp_recommendation?.recommended_portfolio || {
      name: 'Cartera Indexada MyInvestor',
      ter_total: 0.30,
      bridge_fund_isin: 'FR0000447823',
      bridge_fund_name: 'AXA Trésor Court Terme C'
    };

    const isTaxExempt = cost_analysis?.transferability?.is_tax_exempt_transfer !== false;
    const transferOrderDraft = {
      order_id: `TRASP-${Date.now().toString().slice(-6)}`,
      order_type: isTaxExempt
        ? 'TRASPASO_EXTERNO_EXENTO_IRPF (Art. 94 LIRPF)'
        : 'REEMBOLSO_Y_SUSCRIPCION (Producto origen no traspasable)',
      origin_entity: offered_fund?.bank_name || 'Banco Tradicional S.A.',
      origin_product: offered_fund?.name || 'Producto de origen no indicado',
      origin_isin: offered_fund?.isin || null,
      origin_ter_pct: cost_analysis?.inputs?.offered_ter_pct ?? null,
      destination_option_1: {
        type: 'FONDO_INDEXADO_DIRECTO',
        name: targetFund.name,
        isin: targetFund.isin,
        ter_pct: targetFund.ter
      },
      destination_option_2: {
        type: 'CARTERA_INDEXADA_ROBOADVISOR',
        name: targetPortfolio.name,
        ter_pct: targetPortfolio.ter_total,
        bridge_fund: `${targetPortfolio.bridge_fund_name} (${targetPortfolio.bridge_fund_isin})`
      },
      amount_eur: cost_analysis?.inputs?.amount_eur ?? (Number(amount_eur) || null),
      estimated_10y_savings_eur: cost_analysis?.metrics?.loss_10y_vs_portfolio_eur ?? null,
      estimated_30y_savings_vs_index_eur: cost_analysis?.metrics?.loss_30y_vs_direct_index_eur ?? null,
      estimated_30y_savings_vs_portfolio_eur: cost_analysis?.metrics?.loss_30y_vs_portfolio_eur ?? null,
      tax_impact_today_eur: cost_analysis?.transferability?.irpf_to_pay_today_eur || 0,
      exit_warning: cost_analysis?.transferability?.exit_warning || null,
      status: 'LISTO_PARA_FIRMA_IN_APP'
    };

    const auditEntry = recordAuditEvent({
      event_type: 'COST_COMPARISON_AND_TRANSFER_PREPARED',
      verdict: 'CARO',
      summary: `Detectado sobrecoste (${transferOrderDraft.origin_ter_pct ?? '¿?'}% vs 0,30%).${
        typeof transferOrderDraft.estimated_10y_savings_eur === 'number'
          ? ` Ahorro a 10 años: ${transferOrderDraft.estimated_10y_savings_eur.toLocaleString('es-ES')} €.`
          : ''
      } Orden ${transferOrderDraft.order_id} preparada.`,
      details: transferOrderDraft
    });

    return {
      contract_status: 'SOBRECOSTE_DETECTADO',
      action_taken: 'ORDEN_TRASPASO_PREPARADA_IN_APP',
      allow_signature: true,
      offer_kill_switch: false,
      rules_triggered: [
        `Regla Mi Contrato: Advertir cuando el TER (${transferOrderDraft.origin_ter_pct}%) supere el umbral eficiente (${clientContract.max_acceptable_ter_pct}%)`,
        'Cumplimiento MiFID II Art. 24: Comparativa objetiva ex-ante de costes dentro de la misma categoría oficial'
      ],
      transfer_order_draft: transferOrderDraft,
      audit_entry: auditEntry
    };
  }

  // CASO 3: VEREDICTO ADELANTE
  const auditEntry = recordAuditEvent({
    event_type: 'VERIFIED_SAFE_AND_COMPETITIVE',
    verdict: 'ADELANTE',
    summary: 'Producto regulado en CNMV con costes dentro de rango competitivo. Operación permitida.',
    details: { amount_eur: amount, beneficiary_name }
  });

  return {
    contract_status: 'AUTORIZADO',
    action_taken: 'PERMITIR_CONTINUAR',
    allow_signature: true,
    offer_kill_switch: false,
    rules_triggered: ['Verificación CNMV, IBAN y umbral de comisiones superada con éxito'],
    audit_entry: auditEntry
  };
}

function getContractState() {
  return {
    contract: clientContract,
    family_notifications: familyNotifications,
    audit_log: auditLog
  };
}

function updateContractSettings(partial = {}) {
  clientContract = {
    ...clientContract,
    ...partial,
    trusted_contact: {
      ...clientContract.trusted_contact,
      ...(partial.trusted_contact || {})
    }
  };
  recordAuditEvent({
    event_type: 'CONTRACT_UPDATED',
    verdict: 'CONFIG',
    summary: `Configuración de Mi Contrato actualizada (Límite: ${clientContract.max_transfer_amount_eur} €, Modo: ${clientContract.accessibility_mode}, Kill-Switch: ${clientContract.operations_disabled}).`,
    details: clientContract
  });
  return clientContract;
}

function resetDemoState() {
  clientContract.operations_disabled = false;
  familyNotifications.length = 0;
  auditLog.length = 0;
  recordAuditEvent({
    event_type: 'SYSTEM_INIT',
    verdict: 'READY',
    summary: 'Centinela inicializado y conectado a MCP MyInvestor + Caché CNMV.',
    details: { mcp_endpoint: 'https://mcp.myinvestor.es/mcp' }
  });
}

// Inicializar con evento de arranque
resetDemoState();

module.exports = {
  getContractState,
  updateContractSettings,
  evaluateContractAction,
  recordAuditEvent,
  resetDemoState
};
