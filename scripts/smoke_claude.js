#!/usr/bin/env node
/**
 * Prueba rápida de Claude con la clave real (2 minutos).
 * Uso:  npm run smoke:claude
 *
 *  1. Comprueba que la clave funciona con una llamada mínima.
 *  2. Analiza 3 frases (estafa parafraseada, SMS de "cuenta segura", mensaje familiar) con
 *     claude-haiku-5-5 y con claude-sonnet-5-5: veredicto, señales, descartes del validador y latencia.
 *  3. Lee public/samples/folleto_dfi_banco_tradicional.pdf con Sonnet y comprueba que el TER es 1,80.
 *  4. Muestra cuántas llamadas ha hecho y una estimación del coste (tokens de `usage`).
 *
 * La clave se lee de .env y NUNCA se imprime.
 */

require('../src/config/loadEnv').loadEnv();

const fs = require('fs');
const path = require('path');
const ai = require('../src/services/aiService');
const { analyzeFraudRisk } = require('../src/engine/fraudEngine');

// USD por millón de tokens (entrada / salida). Verificado en platform.claude.com/docs el 11-nov-2026.
// Haiku 5.5: precio para prompts de hasta 100K tokens.
const PRICES_USD_PER_MTOK = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 }
};

function estimateCostUsd(usageByModel) {
  let total = 0;
  const rows = [];
  for (const [model, u] of Object.entries(usageByModel)) {
    const price = PRICES_USD_PER_MTOK[model];
    const cost = price ? (u.input_tokens * price.input + u.output_tokens * price.output) / 1e6 : null;
    if (cost !== null) total += cost;
    rows.push({ model, ...u, cost_usd: cost });
  }
  return { rows, total };
}

const PHRASES = [
  {
    id: 'estafa-parafraseada',
    expected: 'ESTAFA',
    text: 'Buenas tardes, doña Carmen. Con nuestro plan su dinero no puede bajar nunca: es imposible que pierda un céntimo y cada mes cobrará un buen pellizco. Eso sí, tiene que decidirse esta misma tarde, porque mañana ya no quedará hueco, y mejor que en su sucursal no se enteren de esto.'
  },
  {
    id: 'sms-cuenta-segura',
    expected: 'ESTAFA',
    text: 'Banco: hemos detectado un cargo no reconocido en su tarjeta. Para proteger sus ahorros, un gestor le llamará y deberá traspasar su saldo a una cuenta de custodia temporal. No comparta este aviso con nadie.'
  },
  {
    id: 'mensaje-familiar',
    expected: 'ADELANTE',
    text: 'Hola mamá, te recojo el sábado a las doce para ir a comer con la abuela. Lleva el paraguas, que dan lluvia. Un beso.'
  }
];

function line(label, value) {
  console.log(`${String(label).padEnd(30)} ${value}`);
}

(async () => {
  const status = ai.getAiStatus();
  console.log('\n=== Centinela · prueba rápida de Claude ===\n');
  if (!status.claude_configured) {
    console.log('No hay clave de Anthropic. Pon ANTHROPIC_API_KEY en el archivo .env (copia de .env.example) y vuelve a ejecutar:');
    console.log('  npm run smoke:claude\n');
    console.log('Sin clave la app funciona igual, solo con reglas. No se ha hecho ninguna llamada.\n');
    return;
  }

  let failures = 0;
  const HAIKU = 'claude-haiku-5-5';
  const SONNET = 'claude-sonnet-5-5';
  line('Modelo llamadas/SMS (.env):', status.claude_call_model);
  line('Modelo folletos (.env):', status.claude_model);
  line('Tope de llamadas:', status.claude_calls_max);

  // 1. La clave funciona
  console.log('\n1) Llamada mínima');
  for (const model of [HAIKU, SONNET]) {
    const ping = await ai.pingClaude(model);
    if (ping.ok) {
      line(`   ${model}`, `OK · responde "${ping.reply}" · modelo devuelto: ${ping.model} · ${ping.latency_ms} ms`);
    } else {
      failures += 1;
      line(`   ${model}`, `FALLO · ${ping.reason}`);
    }
  }

  // 2. Tres frases con Haiku y con Sonnet
  console.log('\n2) Análisis de 3 frases (reglas solas frente a reglas + Claude)');
  const latencies = { [HAIKU]: [], [SONNET]: [] };
  for (const phrase of PHRASES) {
    const rules = analyzeFraudRisk({ text: phrase.text });
    console.log(`\n   [${phrase.id}] esperado: ${phrase.expected} · solo reglas: ${rules.verdict} (riesgo ${rules.risk_score})`);
    for (const model of [HAIKU, SONNET]) {
      const res = await ai.analyzeCallWithClaude({ text: phrase.text, model });
      if (!res.ok) {
        failures += 1;
        console.log(`     ${model}: FALLO de Claude (${res.reason}) tras ${res.latency_ms} ms → se usarían solo las reglas`);
        continue;
      }
      latencies[model].push(res.latency_ms);
      const combined = analyzeFraudRisk({ text: phrase.text, entity_name: res.entity_name || '', iban: res.iban || '', ai_signals: res.signals });
      const okMark = combined.verdict === phrase.expected ? '✅' : '❌';
      if (combined.verdict !== phrase.expected) failures += 1;
      console.log(`     ${model}: ${okMark} ${combined.verdict} (riesgo ${combined.risk_score}) · ${res.latency_ms} ms · ${res.rounds} ronda(s) · herramientas: ${res.tool_calls.map((t) => t.name).join(', ') || 'ninguna'}`);
      for (const s of res.signals) console.log(`         señal ${s.type}: «${s.evidence_quote}»`);
      if (res.signals.length === 0) console.log('         sin señales');
      for (const d of res.discarded) console.log(`         DESCARTADO por el validador (${d.kind}, ${d.reason}): «${d.evidence_quote || d.value || ''}»`);
    }
  }
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  console.log('');
  line('   Latencia media Haiku 5.5:', avg(latencies[HAIKU]) === null ? 'sin datos' : `${avg(latencies[HAIKU])} ms`);
  line('   Latencia media Sonnet 5.5:', avg(latencies[SONNET]) === null ? 'sin datos' : `${avg(latencies[SONNET])} ms`);

  // 3. Folleto PDF con Sonnet
  console.log('\n3) Folleto PDF de ejemplo con el modelo de folletos');
  const pdfPath = path.join(__dirname, '..', 'public', 'samples', 'folleto_dfi_banco_tradicional.pdf');
  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
  const t0 = Date.now();
  const doc = await ai.extractFinancialOfferWithClaude({ imageBase64: `data:application/pdf;base64,${pdfBase64}`, imageMimeType: 'application/pdf' });
  const docMs = Date.now() - t0;
  const docOk = doc.extractor === 'CLAUDE_LIVE_API' && doc.offered_ter_pct === 1.8;
  if (!docOk) failures += 1;
  line('   Extractor:', `${doc.extractor}${doc.extractor === 'CLAUDE_LIVE_API' ? '' : ` (Claude falló: ${ai.getAiStatus().claude_last_error || 'sin detalle'})`}`);
  line('   TER leído:', `${doc.offered_ter_pct} ${docOk ? '✅ (esperado 1,80)' : '❌ (esperado 1,80 leído por Claude)'}`);
  line('   Producto / ISIN:', `${doc.name} / ${doc.isin}`);
  line('   Latencia:', `${docMs} ms`);

  // 4. Llamadas y coste
  console.log('\n4) Llamadas y coste estimado');
  const { rows, total } = estimateCostUsd(ai.getClaudeUsage());
  for (const r of rows) {
    line(`   ${r.model}`, `${r.requests} peticiones · ${r.input_tokens} tokens de entrada · ${r.output_tokens} de salida · ${r.cost_usd === null ? 'precio no tabulado' : `~${r.cost_usd.toFixed(4)} USD`}`);
  }
  const end = ai.getAiStatus();
  line('   Total:', `${end.claude_calls_used} peticiones de ${end.claude_calls_max} permitidas · ~${total.toFixed(4)} USD (estimación con precios de lista)`);

  console.log(failures === 0 ? '\n✅ smoke:claude en verde\n' : `\n❌ smoke:claude con ${failures} fallo(s)\n`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((err) => {
  console.error(`\n❌ Error inesperado: ${err.message}\n`);
  process.exitCode = 1;
});
