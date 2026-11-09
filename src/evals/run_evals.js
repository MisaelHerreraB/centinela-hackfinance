/**
 * Ejecutor de Benchmark de los 30 Casos Oficiales de Centinela
 * Mide precisión de clasificación (ESTAFA | CARO | ADELANTE) y tiempo hasta el veredicto.
 */

const { TEST_CASES_30 } = require('./cases_30');
const { analyzeFraudRisk } = require('../engine/fraudEngine');
const { calculateCostComparison } = require('../engine/financialEngine');

function runBenchmark30() {
  const startTotal = performance.now();
  const results = [];
  let passed = 0;

  for (const tc of TEST_CASES_30) {
    const t0 = performance.now();
    let actualVerdict = 'ADELANTE';
    let detailSummary = '';

    if (tc.input_mode === 'VOICE_CALL' || tc.input_mode === 'SMS_CAPTURE' || tc.text) {
      const fraudRes = analyzeFraudRisk({
        text: tc.text || '',
        entity_name: tc.entity_name || '',
        iban: tc.iban || '',
        claimed_product: tc.claimed_product || '',
        product_exists_in_mcp: tc.product_exists_in_mcp !== false,
        amount_eur: tc.amount_eur || 0
      });
      actualVerdict = fraudRes.verdict;
      detailSummary =
        actualVerdict === 'ESTAFA'
          ? `Riesgo ${fraudRes.risk_score}% · ${fraudRes.signals.length} señales (${fraudRes.signals.map((s) => s.type).join(', ')})`
          : 'Sin alertas CNMV ni manipulación';
    } else {
      const costRes = calculateCostComparison({
        amount_eur: tc.amount_eur || 50000,
        years: 10,
        gross_return_pct: 5.0,
        offered_ter_pct: tc.offered_ter_pct,
        benchmark_ter_pct: tc.benchmark_ter_pct || 0.30,
        product_type: tc.product_type || 'FONDO_INVERSION',
        exit_fee_pct: tc.exit_fee_pct || 0
      });
      actualVerdict = costRes.verdict;
      detailSummary =
        actualVerdict === 'CARO'
          ? `TER ${tc.offered_ter_pct}% vs ${tc.benchmark_ter_pct}% · Pierde ${costRes.metrics.loss_10y_vs_portfolio_eur.toLocaleString('es-ES')} € en 10a · ${costRes.transferability.is_tax_exempt_transfer ? 'Traspasable 0€ IRPF' : 'No traspasable'}`
          : `TER competitivo (${tc.offered_ter_pct}%)`;
    }

    const elapsedMs = Number((performance.now() - t0).toFixed(3));
    const isCorrect = actualVerdict === tc.expected_verdict;
    if (isCorrect) passed++;

    results.push({
      id: tc.id,
      title: tc.title,
      category: tc.category,
      expected: tc.expected_verdict,
      actual: actualVerdict,
      passed: isCorrect,
      latency_ms: elapsedMs,
      detail: detailSummary
    });
  }

  const totalMs = Number((performance.now() - startTotal).toFixed(2));
  const avgMs = Number((totalMs / TEST_CASES_30.length).toFixed(3));

  return {
    total_cases: TEST_CASES_30.length,
    passed_cases: passed,
    accuracy_pct: Number(((passed / TEST_CASES_30.length) * 100).toFixed(1)),
    total_time_ms: totalMs,
    avg_time_to_verdict_ms: avgMs,
    breakdown_by_class: {
      ESTAFA: results.filter((r) => r.expected === 'ESTAFA' && r.passed).length + '/10',
      CARO: results.filter((r) => r.expected === 'CARO' && r.passed).length + '/10',
      ADELANTE: results.filter((r) => r.expected === 'ADELANTE' && r.passed).length + '/10'
    },
    cases: results
  };
}

if (require.main === module) {
  const report = runBenchmark30();
  console.log('\n================================================================================');
  console.log('🛡️  CENTINELA — BENCHMARK OFICIAL DE 30 CASOS (ESTAFA | CARO | ADELANTE)');
  console.log('================================================================================');
  for (const r of report.cases) {
    const icon = r.passed ? '✅' : '❌';
    console.log(
      `${icon} [${r.id}] Esperado: ${r.expected.padEnd(8)} | Obtenido: ${r.actual.padEnd(8)} | ${String(r.latency_ms).padStart(5)} ms | ${r.title}`
    );
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(
    `RESULTADO GLOBAL: ${report.passed_cases}/${report.total_cases} (${report.accuracy_pct}%) | ESTAFA: ${report.breakdown_by_class.ESTAFA} | CARO: ${report.breakdown_by_class.CARO} | ADELANTE: ${report.breakdown_by_class.ADELANTE}`
  );
  console.log(`TIEMPO TOTAL MOTOR DETERMINISTA: ${report.total_time_ms} ms (Media: ${report.avg_time_to_verdict_ms} ms/caso)`);
  console.log('================================================================================\n');
  process.exit(report.passed_cases === report.total_cases ? 0 : 1);
}

module.exports = { runBenchmark30 };
