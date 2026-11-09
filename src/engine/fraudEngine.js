/**
 * Motor Determinista de Detección de Estafas, Lista de Alertas CNMV y Verificación de IBAN
 */

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
    note: 'Cuenta puente reportada por fraude de falso bróker (14 denuncias registradas).'
  },
  'LT603250081199221100': {
    reports: 29,
    risk_level: 'CRITICO',
    note: 'IBAN extranjero (Lituania) vinculado a red de chiringuitos financieros.'
  },
  'ES1800491500052110998877': {
    reports: 7,
    risk_level: 'ALTO',
    note: 'Cuenta reportada en ataques de vishing de "cuenta segura".'
  },
  'GB29NWBK60161331926819': {
    reports: 19,
    risk_level: 'CRITICO',
    note: 'IBAN no supervisado por Banco de España con alertas de estafa de inversión.'
  }
};

const MANIPULATION_PATTERNS = [
  {
    id: 'PROMESA_GARANTIZADA',
    label: 'Promesa de rentabilidad alta garantizada',
    weight: 55,
    regex: /(\b1[0-9]\s*%\s*garantizad|\b[89]\s*%\s*garantizad|rentabilidad\s+garantizada|sin\s+ning[uú]n\s+riesgo|beneficio\s+asegurado|duplicar\s+tu\s+dinero|12\s*%\s*anual\s+fijo)/i,
    explanation: 'En los mercados regulados no existe el 8%–12% garantizado sin riesgo. Es el gancho clásico de los falsos brókers.'
  },
  {
    id: 'URGENCIA_ARTIFICIAL',
    label: 'Presión y urgencia artificial para firmar hoy',
    weight: 25,
    regex: /(solo\s+por\s+hoy|en\s+los\s+pr[oó]ximos\s+\d+\s+minutos|antes\s+de\s+las\s+\d+|cierra\s+el\s+cupo|últimas?\s+plazas?|transferir\s+ahora\s+mismo|no\s+cuelgues|hazlo\s+ya)/i,
    explanation: 'El estafador busca impedir que consultes con tu familia o con tu banco antes de enviar el dinero.'
  },
  {
    id: 'AISLAMIENTO_O_SECRETO',
    label: 'Intento de aislar a la víctima o evitar al banco',
    weight: 20,
    regex: /(no\s+se\s+lo\s+digas|en\s+tu\s+banco\s+te\s+pondr[aá]n\s+pegas|pon\s+en\s+el\s+concepto\s+familia|no\s+hables\s+con|operaci[oó]n\s+confidencial)/i,
    explanation: 'Piden ocultar el motivo real de la transferencia para burlar los controles antiblanqueo del banco.'
  },
  {
    id: 'SOLICITUD_CLAVES_O_CUENTA_SEGURA',
    label: 'Solicitud de claves SMS/OTP, acceso remoto o "Cuenta Segura"',
    weight: 65,
    regex: /(c[oó]digo\s+sms|clave\s+de\s+firma|cuenta\s+segura\s+del\s+banco|anydesk|teamviewer|bloqueo\s+inminente|movimiento\s+sospechoso\s+transfiere|pincha\s+en\s+este\s+enlace)/i,
    explanation: 'MyInvestor NUNCA pide códigos SMS por teléfono, ni instalar AnyDesk, ni transferir fondos a una supuesta "cuenta segura".'
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
        reason: item.reason
      };
    }
  }
  return {
    flagged: false,
    entity: null,
    reason: 'Sin alertas activas en el registro de advertencias de la CNMV.'
  };
}

function checkIbanStatus(rawIban = '') {
  if (!rawIban) {
    return { provided: false, flagged: false, iban: null, reports: 0, note: 'Sin IBAN especificado' };
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
      note: match.note
    };
  }
  // Si empieza por LT, GB, CY, MT y se combina con promesa de inversión minorista en España
  const country = clean.slice(0, 2);
  if (['LT', 'CY', 'MT', 'BG'].includes(country)) {
    return {
      provided: true,
      flagged: true,
      iban: clean,
      reports: 3,
      risk_level: 'ALTO',
      note: `IBAN jurisdicción extranjera (${country}) frecuente en plataformas no supervisadas por CNMV.`
    };
  }
  return {
    provided: true,
    flagged: false,
    iban: clean,
    reports: 0,
    risk_level: 'BAJO',
    note: 'IBAN español sin reportes de fraude registrados.'
  };
}

function analyzeFraudRisk({
  text = '',
  entity_name = '',
  iban = '',
  claimed_product = '',
  product_exists_in_mcp = true,
  amount_eur = 0
}) {
  const combinedText = `${text} ${entity_name} ${claimed_product}`;
  const signals = [];
  let riskScore = 0;

  // 1. Patrones de manipulación psicológica
  for (const pattern of MANIPULATION_PATTERNS) {
    const match = combinedText.match(pattern.regex);
    if (match) {
      riskScore += pattern.weight;
      signals.push({
        type: pattern.id,
        severity: 'ALTA',
        label: pattern.label,
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
      evidence: cnmvCheck.warning_date,
      explanation: cnmvCheck.reason
    });
  }

  // 3. Verificación IBAN
  const ibanRegex = combinedText.match(/\b([A-Z]{2}\d{2}[\s]?[0-9A-Z]{4}[\s]?[0-9A-Z]{4}[\s]?[0-9A-Z]{4}[\s]?[0-9A-Z]{0,8})\b/i);
  const extractedIban = iban || (ibanRegex ? ibanRegex[1] : '');
  const ibanCheck = checkIbanStatus(extractedIban);
  if (ibanCheck.flagged) {
    riskScore += 35;
    signals.push({
      type: 'IBAN_REPORTADO',
      severity: 'CRITICA',
      label: `IBAN con ${ibanCheck.reports} reportes de fraude (${ibanCheck.iban})`,
      evidence: ibanCheck.iban,
      explanation: ibanCheck.note
    });
  }

  // 4. Producto inexistente en el catálogo oficial MCP
  if (claimed_product && product_exists_in_mcp === false) {
    riskScore += 25;
    signals.push({
      type: 'PRODUCTO_INEXISTENTE_MCP',
      severity: 'ALTA',
      label: `Producto inexistente en catálogo oficial: "${claimed_product}"`,
      evidence: '0 coincidencias en MCP MyInvestor',
      explanation: 'El producto mencionado no existe en la base de datos oficial regulada.'
    });
  }

  const finalScore = Math.min(100, riskScore);
  const isScam = finalScore >= 50 || cnmvCheck.flagged || ibanCheck.flagged;

  return {
    verdict: isScam ? 'ESTAFA' : 'ADELANTE',
    risk_score: finalScore,
    signals,
    cnmv_check: cnmvCheck,
    iban_check: ibanCheck,
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
