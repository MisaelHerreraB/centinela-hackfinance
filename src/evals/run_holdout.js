#!/usr/bin/env node
/**
 * Medición "fuera de muestra": reglas solas frente a reglas + Claude.
 * Uso:
 *   npm run eval:holdout                                  (modelo de ANTHROPIC_CALL_MODEL, por defecto claude-haiku-5-5)
 *   npm run eval:holdout -- --model=claude-sonnet-5-5     (mismo conjunto con otro modelo)
 *   npm run eval:holdout -- --rules-only                  (no llama a Claude)
 *
 * Los casos están en src/evals/cases_holdout.js y los escribió el equipo SIN mirar las reglas.
 * Ni las reglas ni el prompt se han ajustado mirando estos casos: por eso el número vale.
 * Con Claude se hace exactamente lo mismo que en /api/analyze-call: señales validadas + motor determinista.
 * Si Claude falla o tarda más de 8 s en un caso, ese caso se decide solo con reglas (como en la app) y se cuenta.
 */

require('../config/loadEnv').loadEnv();

const fs = require('fs');
const path = require('path');
const ai = require('../services/aiService');
const { analyzeFraudRisk } = require('../engine/fraudEngine');

const PRICES_USD_PER_MTOK = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 }
};

function arg(name, fallback = null) {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
}

function stats(values) {
  if (!values.length) return { mean: null, p50: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return {
    mean: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
    p50: pick(0.5),
    p95: pick(0.95),
    max: sorted[sorted.length - 1]
  };
}

function score(rows, key) {
  const scams = rows.filter((r) => r.expected === 'ESTAFA');
  const legit = rows.filter((r) => r.expected === 'ADELANTE');
  const hit = (r) => r[key] === r.expected;
  return {
    correct: rows.filter(hit).length,
    total: rows.length,
    accuracy_pct: rows.length ? Math.round((rows.filter(hit).length / rows.length) * 1000) / 10 : null,
    scams_detected: scams.filter(hit).length,
    scams_total: scams.length,
    legit_correct: legit.filter(hit).length,
    legit_total: legit.length,
    false_positives: legit.filter((r) => !hit(r)).map((r) => r.id),
    false_negatives: scams.filter((r) => !hit(r)).map((r) => r.id)
  };
}

async function runPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i], i);
      }
    })
  );
  return out;
}

async function runHoldout({ model, rulesOnly = false, concurrency = 2 } = {}) {
  let cases;
  try {
    cases = require('./cases_holdout').HOLDOUT_CASES;
  } catch (e) {
    return { ok: false, error: 'No existe src/evals/cases_holdout.js. Hay que crearlo a partir de entregables/casos_fuera_de_muestra.txt.' };
  }
  const useClaude = !rulesOnly && ai.getAiStatus().claude_configured;
  const usedModel = model || ai.CLAUDE_CALL_MODEL;

  const rows = await runPool(cases, useClaude ? concurrency : 1, async (c) => {
    const t0 = performance.now();
    const rules = analyzeFraudRisk({ text: c.text });
    const rulesMs = performance.now() - t0;
    const row = {
      id: c.id,
      expected: c.expected_verdict,
      rules: rules.verdict,
      rules_score: rules.risk_score,
      rules_ms: Math.round(rulesMs * 1000) / 1000
    };
    if (useClaude) {
      const t1 = Date.now();
      const res = await ai.analyzeCallWithClaude({ text: c.text, model: usedModel });
      const combined = analyzeFraudRisk({
        text: c.text,
        entity_name: res.ok ? res.entity_name || '' : '',
        iban: res.ok ? res.iban || '' : '',
        ai_signals: res.ok ? res.signals : null
      });
      row.claude = combined.verdict;
      row.claude_score = combined.risk_score;
      row.claude_ms = Date.now() - t1;
      row.claude_ok = res.ok;
      row.claude_error = res.ok ? null : res.reason;
      row.claude_rounds = res.rounds || res.usage?.requests || 0;
      row.claude_signals = res.ok ? res.signals.map((s) => s.type) : [];
      row.claude_discarded = res.ok ? res.discarded.length : 0;
      row.claude_tools = (res.tool_calls || []).map((t) => t.name);
    }
    return row;
  });

  const report = {
    ok: true,
    date: new Date().toISOString(),
    cases: rows.length,
    rules: { ...score(rows, 'rules'), latency_ms: stats(rows.map((r) => r.rules_ms)) },
    claude: null,
    rows
  };
  if (useClaude) {
    const usage = ai.getClaudeUsage()[usedModel] || { requests: 0, input_tokens: 0, output_tokens: 0 };
    const price = PRICES_USD_PER_MTOK[usedModel];
    report.claude = {
      model: usedModel,
      ...score(rows, 'claude'),
      latency_ms: stats(rows.map((r) => r.claude_ms)),
      fallbacks_to_rules: rows.filter((r) => !r.claude_ok).map((r) => ({ id: r.id, error: r.claude_error })),
      discarded_by_validator: rows.reduce((a, r) => a + (r.claude_discarded || 0), 0),
      api_requests: usage.requests,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost_usd: price ? Math.round(((usage.input_tokens * price.input + usage.output_tokens * price.output) / 1e6) * 10000) / 10000 : null
    };
  }
  return report;
}

function printReport(report) {
  console.log('\n=== Centinela · casos fuera de muestra (reglas solas frente a reglas + Claude) ===\n');
  const mark = (ok) => (ok ? '✅' : '❌');
  for (const r of report.rows) {
    const base = `[${r.id}] esperado ${r.expected.padEnd(8)} | reglas ${mark(r.rules === r.expected)} ${r.rules.padEnd(8)}`;
    if (report.claude) {
      console.log(`${base} | +Claude ${mark(r.claude === r.expected)} ${r.claude.padEnd(8)} ${String(r.claude_ms).padStart(5)} ms${r.claude_ok ? '' : ` (Claude falló: ${String(r.claude_error).slice(0, 40)} → solo reglas)`}`);
    } else {
      console.log(base);
    }
  }
  const fmt = (s) => `${s.correct}/${s.total} (${s.accuracy_pct} %) · estafas detectadas ${s.scams_detected}/${s.scams_total} · legítimos correctos ${s.legit_correct}/${s.legit_total}`;
  console.log('\n--------------------------------------------------------------------------------');
  console.log(`SOLO REGLAS       : ${fmt(report.rules)} · latencia media ${report.rules.latency_ms.mean} ms`);
  if (report.claude) {
    const c = report.claude;
    console.log(`REGLAS + CLAUDE   : ${fmt(c)} · latencia media ${c.latency_ms.mean} ms (p50 ${c.latency_ms.p50}, p95 ${c.latency_ms.p95}, máx ${c.latency_ms.max})`);
    console.log(`Modelo            : ${c.model}`);
    console.log(`Falsos positivos  : ${c.false_positives.join(', ') || 'ninguno'}`);
    console.log(`Falsos negativos  : ${c.false_negatives.join(', ') || 'ninguno'}`);
    console.log(`Casos resueltos solo con reglas por fallo o timeout de Claude: ${c.fallbacks_to_rules.length}`);
    console.log(`Datos descartados por el validador: ${c.discarded_by_validator}`);
    console.log(`Peticiones a la API: ${c.api_requests} · tokens ${c.input_tokens} entrada / ${c.output_tokens} salida · coste estimado ~${c.estimated_cost_usd === null ? '?' : c.estimated_cost_usd} USD`);
  } else {
    console.log('REGLAS + CLAUDE   : no medido (falta ANTHROPIC_API_KEY en .env o se pidió --rules-only).');
    console.log('                    Pon la clave en .env y ejecuta de nuevo:  npm run eval:holdout');
  }
  console.log('================================================================================\n');
}

if (require.main === module) {
  (async () => {
    const model = typeof arg('model') === 'string' ? arg('model') : null;
    const report = await runHoldout({ model, rulesOnly: arg('rules-only') === true, concurrency: Number(arg('concurrency', 2)) || 2 });
    if (!report.ok) {
      console.log(`\n${report.error}\n`);
      return;
    }
    printReport(report);
    if (report.claude || arg('save') === true) {
      const dir = path.join(__dirname, 'results');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `holdout_${report.claude ? report.claude.model : 'rules'}.json`);
      fs.writeFileSync(file, JSON.stringify(report, null, 2));
      console.log(`Resultado guardado en ${path.relative(process.cwd(), file)}\n`);
    }
  })().catch((err) => {
    console.error(`\n❌ Error inesperado: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runHoldout };
