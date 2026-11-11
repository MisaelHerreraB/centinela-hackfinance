/**
 * Motor Determinista de Detección de Estafas, Lista de Alertas CNMV y Verificación de IBAN
 *
 * IMPORTANTE (datos de demostración): las entidades de CNMV_WARNING_ENTITIES y los IBAN de
 * REPORTED_IBANS son FICTICIOS, creados para la demo. En producción se sustituyen por la lista
 * oficial de advertencias de la CNMV y por la verificación de beneficiario (VoP) del banco.
 */

const DEMO_DATA_NOTE = 'Datos de demostración (entidades/IBAN ficticios). En producción: lista oficial de advertencias de la CNMV y verificación VoP del banco.';

const CNMV_WARNING_ENTITIES = [
  {
    name: 'Quantum Ibérica Capital',
    aliases: ['quantum iberica', 'quantum capital', 'quantum iberica invest', 'quantumiberia.com'],
    cnmv_warning_date: '2025-11-14',
    reason: 'Entidad NO autorizada para prestar servicios de inversión (Art. 17 LMVSI - Chiringuito Financiero)'
  },
  {
    name: 'AlphaYield Crypto & Forex VIP',
    aliases: ['alphayield', 'alpha yield', 'alphayield-vip.io', 'alpha trading iberica'],
    cnmv_warning_date: '2026-01-22',
    reason: 'Entidad NO registrada en CNMV. Captación ilegal de ahorro minorista.'
  },
  {
    name: 'EuroPrime Garantizado 12',
    aliases: ['europrime', 'europrime gestion', 'europrime-markets.es'],
    cnmv_warning_date: '2026-02-10',
    reason: 'Alerta CNMV e IOSCO por suplantación de gestora regulada.'
  },
  {
    name: 'MyInvestor Soporte Seguridad (Clon Phishing)',
    aliases: ['myinvestor-seguridad.com', 'alertas-myinvestor.es', 'verificar-myinvestor.net', 'cuenta-segura-myinvestor'],
    cnmv_warning_date: '2026-03-05',
    reason: 'Suplantación de identidad bancaria (Smishing / Vishing Spoofing).'
  },
  {
    name: 'Horizon Gold & AI Trading',
    aliases: ['horizon gold', 'horizon ai trading', 'horizongold-invest.com'],
    cnmv_warning_date: '2025-10-19',
    reason: 'Advertencia CNMV: Chiringuito financiero sin licencia MiFID.'
  },
  {
    name: 'Iberia Wealth Management Ltd (Clon)',
    aliases: ['iberia wealth', 'iberiawealth-uk.com'],
    cnmv_warning_date: '2026-01-08',
    reason: 'Clon fraudulento no vinculado a ninguna EAF ni SGIIC registrada.'
  }
];

const REPORTED_IBANS = {
  'ES9121000418450200051332': {
    reports: 14,
    risk_level: 'CRITICO',
    registered_holder: 'Comercializadora Puente S.L. (Cuenta Mula)',
    sepa_vop_status: 'NO_MATCH',
    note: 'Cuenta puente reportada por fraude de falso bróker (14 denuncias registradas). SEPA VoP: Titular real NO coincide con la entidad anunciada.'
  },
  'LT603250081199221100': {
    reports: 29,
    risk_level: 'CRITICO',
    registered_holder: 'PayBridge Baltic UAB (No supervisada CNMV)',
    sepa_vop_status: 'NO_MATCH',
    note: 'IBAN extranjero (Lituania) vinculado a red de chiringuitos financieros. SEPA VoP: Discrepancia crítica de titularidad.'
  },
  'ES1800491500052110998877': {
    reports: 7,
    risk_level: 'ALTO',
    registered_holder: 'Particular / Cuenta Puente Vishing',
    sepa_vop_status: 'NO_MATCH',
    note: 'Cuenta reportada en ataques de vishing de "cuenta segura". SEPA VoP: No pertenece al Banco de España ni a MyInvestor.'
  },
  'GB29NWBK60161331926819': {
    reports: 19,
    risk_level: 'CRITICO',
    registered_holder: 'Offshore Clearing Ltd',
    sepa_vop_status: 'NO_MATCH',
    note: 'IBAN no supervisado por Banco de España con alertas de estafa de inversión.'
  }
};

const MANIPULATION_PATTERNS = [
  {
    id: 'PROMESA_GARANTIZADA',
    label: 'Promesa de rentabilidad alta garantizada',
    cognitive_bias: 'Ilusión de Certeza y Sesgo de Optimismo (Sistema 1 - Kahneman)',
    weight: 55,
    // % alto (8 % o más, sin confundir 2,9 % con 9 %) + garantía/seguridad, "sin ningún riesgo", etc.
    regex: /((?<![\d.,])(?:[89]|[1-9]\d{1,2})(?:[.,]\d+)?\s*%[^.\n]{0,40}(?:garantizad|asegurad|segur[oa]s?\b|sin\s+(?:ning[uú]n\s+)?riesgos?|fijo)|(?:garantizad[oa]s?|asegurad[oa]s?|segur[oa]s?)\s+(?:del?\s+|de\s+un\s+)?(?<![\d.,])(?:[89]|[1-9]\d{1,2})(?:[.,]\d+)?\s*%|sin\s+ning[uú]n\s+riesgo|beneficio\s+asegurado|gananci?as?\s+(?:seguras|aseguradas|garantizadas)|duplicar\s+tu\s+dinero)/i,
    explanation: 'En los mercados regulados no existe el 8%–12% garantizado sin riesgo. Es el gancho clásico de los falsos brókers.'
  },
  {
    id: 'GARANTIA_GENERICA',
    label: 'Se menciona una rentabilidad "garantizada"',
    cognitive_bias: 'Ilusión de Certeza (señal débil: existen depósitos y fondos garantizados legales)',
    weight: 20,
    regex: /(rentabilidad\s+garantizada|inter[eé]s\s+garantizado|capital\s+garantizado)/i,
    explanation: 'Hay productos garantizados legales (depósitos, fondos garantizados). Comprueba quién lo ofrece y si está registrado en la CNMV o el Banco de España.'
  },
  {
    id: 'URGENCIA_ARTIFICIAL',
    label: 'Presión y urgencia artificial para firmar hoy',
    cognitive_bias: 'Sesgo de Escasez y Descuento Hiperbólico (Secuestro Sistema 1 - FCA/PSR)',
    weight: 25,
    regex: /(solo\s+por\s+hoy|en\s+los\s+pr[oó]ximos\s+\d+\s+minutos|antes\s+de\s+las\s+\d+|cierra\s+el\s+cupo|últimas?\s+plazas?|transferir\s+ahora\s+mismo|no\s+cuelgues|hazlo\s+ya)/i,
    explanation: 'El estafador busca impedir que consultes con tu familia o con tu banco antes de enviar el dinero.'
  },
  {
    id: 'AISLAMIENTO_O_SECRETO',
    label: 'Intento de aislar a la víctima o evitar al banco',
    cognitive_bias: 'Aislamiento Social y Evitación de Verificación Analítica (Sistema 2)',
    weight: 20,
    regex: /(no\s+se\s+lo\s+digas|en\s+tu\s+banco\s+te\s+pondr[aá]n\s+pegas|pon\s+en\s+el\s+concepto\s+familia|no\s+hables\s+con|operaci[oó]n\s+confidencial)/i,
    explanation: 'Piden ocultar el motivo real de la transferencia para burlar los controles antiblanqueo del banco.'
  },
  {
    id: 'SOLICITUD_CLAVES_O_CUENTA_SEGURA',
    label: 'Solicitud de claves SMS/OTP, acceso remoto o "Cuenta Segura"',
    cognitive_bias: 'Sesgo de Obediencia a la Autoridad Suplantada (PSR Bank Impersonation)',
    cold_stage: 5,
    weight: 65,
    regex: /(c[oó]digo\s+sms|clave\s+de\s+firma|cuenta\s+segura\s+del\s+banco|anydesk|teamviewer|bloqueo\s+inminente|movimiento\s+sospechoso\s+transfiere|pincha\s+en\s+este\s+enlace)/i,
    explanation: 'MyInvestor NUNCA pide códigos SMS por teléfono, ni instalar AnyDesk, ni transferir fondos a una supuesta "cuenta segura".'
  },
  {
    id: 'FALSA_TASA_DESBLOQUEO_O_IMPUESTO_PREVIO',
    label: 'Extorsión de salida: exigen transferencia previa para "liberar fondos" o "pagar IRPF"',
    cognitive_bias: 'Falacia del Coste Hundido y Aversión a la Pérdida (USENIX SOUPS / FinCEN Escalation)',
    cold_stage: 4,
    weight: 75,
    regex: /(pagar\s+(?:antes|primero)\s+el\s+\d+\s*%|tasa\s+de\s+desbloqueo|liberar\s+(?:tus\s+)?(?:fondos|ganancias)|impuesto\s+previo\s+para\s+retirar|comisi[oó]n\s+de\s+liquidez\s+para\s+retirar|certificado\s+antiblanqueo|transferir\s+el\s+irpf\s+para\s+desbloquear)/i,
    explanation: 'En España (Ley 35/2006 IRPF), la retención del 19% se descuenta automáticamente del reembolso. JAMÁS se transfiere dinero aparte para desbloquear fondos.'
  },
  {
    id: 'ESCALADO_TRAS_MICRO_RETIRO_CEBO',
    label: 'Patrón "Bait-and-Escalate" (escalado tras micro-abono cebo inicial)',
    cognitive_bias: 'Condicionamiento Operante por Micro-Recompensa (TRM Labs / Elliptic Pig-Butchering)',
    cold_stage: 1,
    weight: 45,
    regex: /(ya\s+viste\s+que\s+cobraste|primeros?\s+\d+\s*€?\s+de\s+beneficio|ya\s+retiraste\s+tu\s+primera\s+ganancia|como\s+ya\s+probaste\s+con\s+poco|ahora\s+entra\s+en\s+el\s+tramo\s+vip)/i,
    explanation: 'Los falsos brókers abonan primero una pequeña ganancia real (cebo) para generar confianza ciega antes de robar el capital fuerte.'
  }
];

function normalizeText(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function checkCnmvWarning(textOrEntity = '') {
  const haystack = normalizeText(textOrEntity);
  for (const item of CNMV_WARNING_ENTITIES) {
    if (
      haystack.includes(normalizeText(item.name)) ||
      item.aliases.some((alias) => haystack.includes(normalizeText(alias)))
    ) {
      return {
        flagged: true,
        entity: item.name,
        warning_date: item.cnmv_warning_date,
        reason: item.reason,
        data_source: 'DEMO',
        data_note: DEMO_DATA_NOTE
      };
    }
  }
  return {
    flagged: false,
    entity: null,
    reason: 'Sin coincidencias en la lista de alertas de demostración.',
    data_source: 'DEMO',
    data_note: DEMO_DATA_NOTE
  };
}

function checkIbanStatus(rawIban = '', claimedEntity = '') {
  if (!rawIban) {
    return {
      provided: false,
      flagged: false,
      iban: null,
      reports: 0,
      sepa_vop_status: 'NOT_APPLICABLE',
      registered_holder: null,
      note: 'Sin IBAN especificado'
    };
  }
  const clean = String(rawIban).replace(/\s+/g, '').toUpperCase();
  const match = REPORTED_IBANS[clean];
  if (match) {
    return {
      provided: true,
      flagged: true,
      iban: clean,
      reports: match.reports,
      risk_level: match.risk_level,
      sepa_vop_status: match.sepa_vop_status || 'NO_MATCH',
      registered_holder: match.registered_holder,
      claimed_holder: claimedEntity || 'Entidad anunciada en llamada',
      regulation_ref: 'Reglamento (UE) 2024/886 (SEPA Verification of Payee) + PSR/PSD3',
      note: match.note,
      data_source: 'DEMO',
      data_note: DEMO_DATA_NOTE
    };
  }
  // IBAN extranjero sin denuncias: NO es estafa por sí solo (p. ej. Revolut usa IBAN lituanos).
  // Solo suma una señal débil que pide verificar al beneficiario.
  const country = clean.slice(0, 2);
  const isForeign = /^[A-Z]{2}$/.test(country) && country !== 'ES';
  return {
    provided: true,
    flagged: false,
    foreign_unverified: isForeign,
    iban: clean,
    reports: 0,
    risk_level: isForeign ? 'MEDIO' : 'BAJO',
    sepa_vop_status: 'NO_VERIFICADO',
    registered_holder: null,
    claimed_holder: claimedEntity || null,
    note: isForeign
      ? `IBAN extranjero (${country}) sin denuncias en la base de demostración. No es estafa por sí solo, pero conviene confirmar quién es el titular.`
      : 'IBAN sin denuncias en la base de demostración. El titular (VoP) lo verifica el banco al ordenar la transferencia.',
    data_source: 'DEMO',
    data_note: DEMO_DATA_NOTE
  };
}

function analyzeFraudRisk({
  text = '',
  entity_name = '',
  iban = '',
  claimed_product = '',
  product_exists_in_mcp = true,
  amount_eur = 0,
  speech_rate_wpm = null,
  speech_rate_source = null
}) {
  const combinedText = `${text} ${entity_name} ${claimed_product}`;
  const signals = [];
  let riskScore = 0;

  // 1. Patrones de manipulación psicológica + Taxonomía Conductual (Sistema 1 vs Sistema 2)
  for (const pattern of MANIPULATION_PATTERNS) {
    const match = combinedText.match(pattern.regex);
    if (match) {
      riskScore += pattern.weight;
      signals.push({
        type: pattern.id,
        severity: 'ALTA',
        label: pattern.label,
        cognitive_bias: pattern.cognitive_bias,
        evidence: match[0],
        explanation: pattern.explanation
      });
    }
  }

  // 2. Verificación CNMV
  const cnmvCheck = checkCnmvWarning(combinedText);
  if (cnmvCheck.flagged) {
    riskScore += 45;
    signals.push({
      type: 'ENTIDAD_ALERTA_CNMV',
      severity: 'CRITICA',
      label: `Entidad alertada por la CNMV: ${cnmvCheck.entity}`,
      cognitive_bias: 'Suplantación de Autoridad Financiera Regulada',
      evidence: cnmvCheck.warning_date,
      explanation: cnmvCheck.reason
    });
  }

  // 3. Verificación IBAN + SEPA Verification of Payee (VoP - Reglamento UE 2024/886)
  const ibanRegex = combinedText.match(/\b([A-Z]{2}\d{2}[\s]?[0-9A-Z]{4}[\s]?[0-9A-Z]{4}[\s]?[0-9A-Z]{4}[\s]?[0-9A-Z]{0,8})\b/i);
  const extractedIban = iban || (ibanRegex ? ibanRegex[1] : '');
  const ibanCheck = checkIbanStatus(extractedIban, entity_name || cnmvCheck.entity || '');
  if (ibanCheck.flagged) {
    riskScore += 35;
    signals.push({
      type: 'IBAN_REPORTADO_Y_SEPA_VOP_NO_MATCH',
      severity: 'CRITICA',
      label: `SEPA VoP ${ibanCheck.sepa_vop_status} · IBAN con ${ibanCheck.reports} denuncias (${ibanCheck.iban})`,
      cognitive_bias: 'Asimetría de Identidad de Beneficiario (SEPA Instant Payments Reg. UE 2024/886)',
      evidence: `Titular real: ${ibanCheck.registered_holder}`,
      explanation: ibanCheck.note
    });
  }

  // 3B. IBAN extranjero sin denuncias: señal débil (no convierte en estafa por sí sola)
  if (ibanCheck.foreign_unverified) {
    riskScore += 15;
    signals.push({
      type: 'IBAN_EXTRANJERO_NO_VERIFICADO',
      severity: 'MEDIA',
      label: `IBAN extranjero (${ibanCheck.iban.slice(0, 2)}) sin verificar`,
      cognitive_bias: 'Verificación de beneficiario pendiente',
      evidence: ibanCheck.iban,
      explanation: ibanCheck.note
    });
  }

  // 4. Producto inexistente en el catálogo oficial MCP
  // (solo si el MCP respondió de verdad: product_exists_in_mcp === false; null = no verificado, no suma)
  if (claimed_product && product_exists_in_mcp === false) {
    riskScore += 25;
    signals.push({
      type: 'PRODUCTO_INEXISTENTE_MCP',
      severity: 'ALTA',
      label: `Producto inexistente en catálogo oficial: "${claimed_product}"`,
      cognitive_bias: 'Efecto Halo de Marca Conocida (Product Spoofing)',
      evidence: '0 coincidencias en MCP MyInvestor',
      explanation: 'El producto mencionado no existe en la base de datos oficial regulada.'
    });
  }

  const finalScore = Math.min(100, riskScore);
  const isScam = finalScore >= 50 || cnmvCheck.flagged || ibanCheck.flagged;

  // 5. Análisis Paralingüístico / Prosódico (Vishing 2.0: Speech Rate WPM & Turn-Taking Pressure)
  // La velocidad del habla SOLO se informa si se ha medido (ElevenLabs Scribe) o si la demo la
  // declara como simulada. Nunca se deduce del veredicto. No modifica la puntuación de riesgo.
  const wpm = Number(speech_rate_wpm);
  const hasWpm = Number.isFinite(wpm) && wpm > 0;
  const prosodyAnalysis = {
    speech_rate_wpm: hasWpm ? Math.round(wpm) : null,
    speech_rate_source: hasWpm ? speech_rate_source || 'ELEVENLABS_SCRIBE' : 'NO_MEDIDO',
    acoustic_pressure_level: !hasWpm
      ? 'NO_MEDIDO (sin audio transcrito con marcas de tiempo)'
      : wpm >= 175
        ? 'ALTA (Compresión de turnos > 175 WPM)'
        : 'NORMAL (Cadencia conversacional)',
    detector_engine: 'ElevenLabs Scribe (scribe_v1 word-level timestamps) + Detector Semántico',
    scientific_basis: 'Multimodal Vishing Detection (Fusión Semántica + Prosodia de Urgencia, 2025–2026)'
  };

  // 6. Máquina de Estados de la Kill-Chain Conversacional (5 Fases — Modelo COLD & PreScam Benchmark, 2025)
  const activeStages = new Set();
  if (cnmvCheck.flagged || (claimed_product && product_exists_in_mcp === false) || signals.some((s) => s.type === 'ESCALADO_TRAS_MICRO_RETIRO_CEBO')) {
    activeStages.add(1);
  }
  if (signals.some((s) => s.type === 'URGENCIA_ARTIFICIAL')) {
    activeStages.add(2);
  }
  if (signals.some((s) => s.type === 'PROMESA_GARANTIZADA' || s.type === 'GARANTIA_GENERICA')) {
    activeStages.add(3);
  }
  if (signals.some((s) => s.type === 'AISLAMIENTO_O_SECRETO' || s.type === 'FALSA_TASA_DESBLOQUEO_O_IMPUESTO_PREVIO')) {
    activeStages.add(4);
  }
  if (ibanCheck.flagged || signals.some((s) => s.type === 'SOLICITUD_CLAVES_O_CUENTA_SEGURA')) {
    activeStages.add(5);
  }

  const coldStages = [
    { stage: 1, name: '1. Trust Cultivation (Falsa Autoridad / Cebo)', active: activeStages.has(1) },
    { stage: 2, name: '2. Risk & Scarcity Fabrication (Urgencia)', active: activeStages.has(2) },
    { stage: 3, name: '3. Persuasive Pitching (Ilusión Sin Riesgo)', active: activeStages.has(3) },
    { stage: 4, name: '4. Isolation & Coercion (Ocultación / Tasa Previa)', active: activeStages.has(4) },
    { stage: 5, name: '5. Payoff Exploitation (Extracción IBAN / OTP)', active: activeStages.has(5) }
  ];
  const highestStage = activeStages.size > 0 ? Math.max(...Array.from(activeStages)) : 0;

  const killChainProgression = {
    framework: 'COLD Framework & PreScam Benchmark (Multi-Turn Scam Kill-Chain, 2025)',
    highest_stage_reached: highestStage,
    phase_summary: highestStage > 0 ? `Fase ${highestStage}/5 alcanzada` : 'Sin progresión de ataque (0/5)',
    stages: coldStages
  };

  // 7. Telemetría Contextual In-Call + Portapapeles (BioCatch / Wultra MTD Studies)
  // No se mide en esta versión web: requiere la app nativa (estado de llamada del sistema operativo).
  const inCallTelemetry = {
    active_voice_call_during_banking: null,
    iban_clipboard_paste_detected: null,
    coercion_telemetry_flag: 'NO_MEDIDO (requiere integración con la app nativa de MyInvestor)',
    scientific_basis: 'Active Call & Behavioral Biometrics Coercion Telemetry (BioCatch / Wultra)'
  };

  // 8. Intervención Conductual (Ruptura Sistema 1 -> Sistema 2 + Pregunta Diagnóstica RCT BIT/FCA)
  let diagnosticQuestion = null;
  if (isScam) {
    if (signals.some((s) => s.type === 'FALSA_TASA_DESBLOQUEO_O_IMPUESTO_PREVIO')) {
      diagnosticQuestion = '¿Te están pidiendo transferir dinero previo para "pagar impuestos" o "desbloquear ganancias"? En España, Hacienda jamás cobra por adelantado: se descuenta del reembolso.';
    } else if (signals.some((s) => s.type === 'SOLICITUD_CLAVES_O_CUENTA_SEGURA')) {
      diagnosticQuestion = '¿Alguien al teléfono dice ser de seguridad bancaria y te pide mover dinero a una "cuenta segura" o leer un código SMS? MyInvestor jamás lo solicita.';
    } else {
      diagnosticQuestion = '¿El interlocutor al teléfono te promete una rentabilidad garantizada superior al 8% o te presiona para transferir hoy sin consultar a tu familia?';
    }
  }

  const behavioralIntervention = {
    cognitive_state_detected: isScam ? 'SECUESTRO_SISTEMA_1 (Urgencia / Autoridad / Escasez)' : 'SISTEMA_2_ANALITICO',
    intervention_applied: isScam
      ? 'Fricción Cognitiva Adaptativa (Cooling-off + Co-firma familiar de Daniel fuera del túnel emocional)'
      : 'Flujo sin fricción (Operación legítima verificada)',
    bit_fca_rct_diagnostic_question: diagnosticQuestion,
    psr_psd3_bank_shield: isScam
      ? `Escudo PSR/PSD3 activo: ${Number(amount_eur) > 0 ? `evita una posible pérdida de ${Number(amount_eur).toLocaleString('es-ES')} € y ` : ''}protege el balance de MyInvestor frente a responsabilidad por suplantación o discrepancia SEPA VoP.`
      : 'Sin señales de fraude en esta consulta.'
  };

  return {
    verdict: isScam ? 'ESTAFA' : 'ADELANTE',
    risk_score: finalScore,
    signals,
    cnmv_check: cnmvCheck,
    iban_check: ibanCheck,
    kill_chain_progression: killChainProgression,
    in_call_telemetry: inCallTelemetry,
    prosody_analysis: prosodyAnalysis,
    behavioral_intervention: behavioralIntervention,
    amount_detected_eur: Number(amount_eur) || 0,
    voice_directive: isScam
      ? 'Cuelga ahora mismo. Hemos detectado señales claras de estafa financiera.'
      : 'No se han detectado alertas de fraude ni avisos en la CNMV.'
  };
}

module.exports = {
  CNMV_WARNING_ENTITIES,
  REPORTED_IBANS,
  MANIPULATION_PATTERNS,
  checkCnmvWarning,
  checkIbanStatus,
  analyzeFraudRisk
};
