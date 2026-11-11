/**
 * Lectura semántica de estafas: Claude entiende, el código decide.
 *
 * El motor de reglas (fraudEngine.js) reconoce los guiones que ya conoce. Para una estafa nueva
 * (Bizum inverso, «hijo en apuros», falso técnico, «cuenta segura»...) Claude solo señala QUÉ
 * tácticas ve y cita la frase literal. Este módulo comprueba que la cita existe en el texto y
 * decide el veredicto con reglas fijas: el modelo no pone ni la puntuación ni el veredicto.
 */

const TACTICS = {
  SUPLANTACION: { label: 'Se hace pasar por alguien de confianza', hint: 'banco, policía, técnico, empresa conocida o familiar', weight: 30, asksForMoneyOrAccess: false, critical: false },
  URGENCIA: { label: 'Mete prisa para que no lo pienses', hint: 'hoy, ya, última oportunidad, antes de que sea tarde', weight: 20, asksForMoneyOrAccess: false, critical: false },
  SECRETO: { label: 'Pide que no lo consultes con nadie', hint: 'no lo comentes, no llames, es confidencial', weight: 30, asksForMoneyOrAccess: false, critical: false },
  PIDE_DINERO: { label: 'Pide que envíes o pagues dinero', hint: 'transferencia, Bizum, tasa, adelanto, ingreso', weight: 35, asksForMoneyOrAccess: true, critical: false },
  CUENTA_SEGURA: { label: 'Pide mover tus ahorros a otra cuenta', hint: 'cuenta segura, cuenta puente, cuenta de custodia', weight: 60, asksForMoneyOrAccess: true, critical: true },
  ACCESO_O_CLAVES: { label: 'Pide tus claves, códigos o control del dispositivo', hint: 'código SMS, contraseña, instalar una app de acceso remoto', weight: 60, asksForMoneyOrAccess: true, critical: true },
  ENLACE: { label: 'Te manda a un enlace para pagar o identificarte', hint: 'dominio que no es el oficial', weight: 35, asksForMoneyOrAccess: true, critical: false },
  GANANCIA_IRREAL: { label: 'Promete ganancias altas, rápidas o seguras', hint: 'duplicar, triplicar, sin riesgo, plaza reservada', weight: 30, asksForMoneyOrAccess: false, critical: false }
};

const normalize = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Se queda solo con las tácticas del catálogo cuya cita aparece literalmente en el texto.
 * Una táctica sin cita comprobable se descarta: el modelo no puede inventar evidencias.
 */
function validateTactics(text, rawTactics) {
  const haystack = normalize(text);
  const seen = new Set();
  const valid = [];
  for (const t of Array.isArray(rawTactics) ? rawTactics : []) {
    const code = String((t && t.code) || '').toUpperCase();
    const quote = String((t && t.quote) || '').trim();
    const needle = normalize(quote);
    if (!TACTICS[code] || seen.has(code) || needle.length < 4 || !haystack.includes(needle)) continue;
    seen.add(code);
    valid.push({ code, quote });
  }
  return valid;
}

/**
 * Reglas fijas: es ESTAFA si hay una táctica crítica, o si se pide dinero/acceso y además
 * hay al menos otra táctica de manipulación. Una sola señal suelta no basta.
 */
function decideFromTactics(tactics) {
  const defs = tactics.map((t) => TACTICS[t.code]);
  const hasCritical = defs.some((d) => d.critical);
  const asks = defs.some((d) => d.asksForMoneyOrAccess);
  const isScam = hasCritical || (asks && tactics.length >= 2);
  const score = Math.min(100, defs.reduce((sum, d) => sum + d.weight, 0));
  return { isScam, score };
}

/** Añade al análisis del motor las tácticas validadas y recalcula veredicto y riesgo. */
function applySemanticTactics(fraudAnalysis, text, rawTactics, meta = {}) {
  const tactics = validateTactics(text, rawTactics);
  const semantic = { used: true, model: meta.model || null, latency_ms: meta.latency_ms ?? null, tactics, discarded: (Array.isArray(rawTactics) ? rawTactics.length : 0) - tactics.length };
  if (tactics.length === 0) return { ...fraudAnalysis, semantic_reading: semantic };

  const { isScam, score } = decideFromTactics(tactics);
  const signals = [
    ...fraudAnalysis.signals,
    ...tactics.map((t) => ({
      type: `LECTURA_${t.code}`,
      severity: TACTICS[t.code].critical ? 'CRITICA' : 'ALTA',
      label: TACTICS[t.code].label,
      cognitive_bias: 'Detectado por lectura semántica (Claude) y validado por cita literal',
      evidence: t.quote,
      explanation: `Frase literal: «${t.quote}».`
    }))
  ];
  const scam = isScam || fraudAnalysis.verdict === 'ESTAFA';
  return {
    ...fraudAnalysis,
    verdict: scam ? 'ESTAFA' : fraudAnalysis.verdict,
    risk_score: Math.min(100, Math.max(fraudAnalysis.risk_score, score)),
    signals,
    voice_directive: scam ? 'Cuelga ahora mismo. Hemos detectado señales claras de estafa financiera.' : fraudAnalysis.voice_directive,
    semantic_reading: semantic
  };
}

module.exports = { TACTICS, validateTactics, decideFromTactics, applySemanticTactics };
