/**
 * Motor Cuantitativo y Fiscal Determinista de Centinela
 * Principio "Jagged Frontier": NINGUNA cifra matemática ni fiscal sale del LLM.
 * Incluye:
 *  - Interés compuesto a 10 años con desglose año a año
 *  - Escala oficial Base Imponible del Ahorro IRPF 2025-2026 (AEAT: 19% a 30%)
 *  - Matriz de traspasabilidad (Art. 94 LIRPF: Fondo -> Fondo/Cartera sí; ETF/Depósito/Unit-Linked no)
 *  - Detección de comisiones de reembolso (salida) en fondos garantizados
 */

const IRPF_SAVINGS_BRACKETS_2025_2026 = [
  { upTo: 6000, rate: 0.19, label: '0 € – 6.000 € (19%)' },
  { upTo: 50000, rate: 0.21, label: '6.000,01 € – 50.000 € (21%)' },
  { upTo: 200000, rate: 0.23, label: '50.000,01 € – 200.000 € (23%)' },
  { upTo: 300000, rate: 0.27, label: '200.000,01 € – 300.000 € (27%)' },
  { upTo: Infinity, rate: 0.30, label: 'Más de 300.000 € (30%)' }
];

/**
 * Calcula el impuesto exacto sobre la ganancia patrimonial en la base del ahorro (AEAT 2025-2026)
 */
function calculateIrpfSavingsTax(capitalGainEur) {
  const gain = Math.max(0, Number(capitalGainEur) || 0);
  if (gain === 0) {
    return {
      capital_gain_eur: 0,
      total_tax_eur: 0,
      effective_rate_pct: 0,
      brackets_applied: []
    };
  }

  let remaining = gain;
  let previousLimit = 0;
  let totalTax = 0;
  const breakdown = [];

  for (const bracket of IRPF_SAVINGS_BRACKETS_2025_2026) {
    if (remaining <= 0) break;
    const bandWidth = bracket.upTo - previousLimit;
    const taxableInBand = Math.min(remaining, bandWidth);
    const taxInBand = taxableInBand * bracket.rate;

    totalTax += taxInBand;
    breakdown.push({
      bracket: bracket.label,
      taxable_eur: Number(taxableInBand.toFixed(2)),
      rate_pct: Number((bracket.rate * 100).toFixed(1)),
      tax_eur: Number(taxInBand.toFixed(2))
    });

    remaining -= taxableInBand;
    previousLimit = bracket.upTo;
  }

  return {
    capital_gain_eur: Number(gain.toFixed(2)),
    total_tax_eur: Number(totalTax.toFixed(2)),
    effective_rate_pct: Number(((totalTax / gain) * 100).toFixed(2)),
    brackets_applied: breakdown
  };
}

/**
 * Clasifica si un instrumento permite traspaso con diferimiento fiscal (Art. 94 Ley 35/2006 IRPF)
 */
function evaluateTransferability({
  product_type = 'FONDO_INVERSION',
  exit_fee_pct = 0,
  liquidity_window_note = null,
  accumulated_gain_eur = 8500
}) {
  const normalizedType = String(product_type).toUpperCase();
  const exitFee = Number(exit_fee_pct) || 0;
  const potentialIrpf = calculateIrpfSavingsTax(accumulated_gain_eur);

  if (normalizedType === 'FONDO_INVERSION' || normalizedType === 'FONDO_GARANTIZADO') {
    const hasExitPenalty = exitFee > 0;
    return {
      product_type: normalizedType,
      is_tax_exempt_transfer: true,
      legal_basis: 'Art. 94 Ley 35/2006 del IRPF (Régimen de diferimiento fiscal en traspasos entre IIC)',
      irpf_to_pay_today_eur: 0,
      irpf_saved_by_transfer_eur: potentialIrpf.total_tax_eur,
      bridge_fund_mechanism:
        'Para Carteras Indexadas MyInvestor, el traspaso aterriza automáticamente en el fondo monetario puente AXA Trésor Court Terme (FR0000447823) sin tocar cuenta corriente, conservando antigüedad y coste fiscal.',
      has_exit_penalty: hasExitPenalty,
      exit_fee_pct: exitFee,
      exit_warning: hasExitPenalty
        ? `ATENCIÓN: Aunque el traspaso está exento de IRPF (0 € a Hacienda), este fondo aplica una comisión de reembolso/salida del ${exitFee.toFixed(2)}% fuera de sus ventanas de liquidez${liquidity_window_note ? ` (${liquidity_window_note})` : ''}.`
        : null,
      summary_label: hasExitPenalty
        ? `Traspasable sin pagar IRPF (0 €), pero vigila la comisión de salida del ${exitFee}%`
        : 'Traspasable 100% exento de IRPF (0 € a Hacienda hoy)'
    };
  }

  const instrumentLabels = {
    ETF: 'ETF (Fondo Cotizado)',
    DEPOSITO: 'Depósito a Plazo / Estructurado',
    UNIT_LINKED: 'Seguro de Vida-Ahorro (Unit-Linked)',
    ACCIONES: 'Acciones individuales'
  };

  return {
    product_type: normalizedType,
    is_tax_exempt_transfer: false,
    legal_basis: 'Excluido del régimen de traspasos del Art. 94 LIRPF (tributa en la Base del Ahorro 19%–30% al reembolsar)',
    irpf_to_pay_today_eur: potentialIrpf.total_tax_eur,
    irpf_breakdown: potentialIrpf,
    has_exit_penalty: exitFee > 0,
    exit_fee_pct: exitFee,
    exit_warning: `IMPORTANTE: Un ${instrumentLabels[normalizedType] || normalizedType} NO admite traspaso con diferimiento fiscal en España. Si ya lo tienes contratado con ${accumulated_gain_eur.toLocaleString('es-ES')} € de plusvalía, venderlo implica tributar ${potentialIrpf.total_tax_eur.toLocaleString('es-ES')} € en IRPF (${potentialIrpf.effective_rate_pct}%).`,
    summary_label: `No traspasable sin tributar (${instrumentLabels[normalizedType] || normalizedType})`
  };
}

/**
 * Calcula el impacto compuesto exacto de las comisiones a N años (por defecto 10 años, 50.000 € y 5% bruto anual)
 */
function calculateCostComparison({
  amount_eur = 50000,
  years = 10,
  gross_return_pct = 5.0,
  offered_ter_pct = 1.80,
  benchmark_ter_pct = 0.30,
  direct_index_ter_pct = 0.12,
  product_type = 'FONDO_INVERSION',
  exit_fee_pct = 0,
  liquidity_window_note = null,
  accumulated_gain_eur = 8500
}) {
  const C0 = Number(amount_eur) || 50000;
  const T = Number(years) || 10;
  const rGross = (Number(gross_return_pct) || 5.0) / 100;
  const terOffered = (Number(offered_ter_pct) || 0) / 100;
  const terBenchmark = (Number(benchmark_ter_pct) || 0.30) / 100;
  const terDirect = (Number(direct_index_ter_pct) || 0.12) / 100;

  const yearlySeries = [];
  const yearlySeries30 = [];
  for (let y = 0; y <= 30; y++) {
    const valGross = C0 * Math.pow(1 + rGross, y);
    const valOffered = C0 * Math.pow(1 + rGross - terOffered, y);
    const valBenchmark = C0 * Math.pow(1 + rGross - terBenchmark, y);
    const valDirect = C0 * Math.pow(1 + rGross - terDirect, y);
    const point = {
      year: y,
      gross_eur: Math.round(valGross),
      offered_bank_eur: Math.round(valOffered),
      myinvestor_portfolio_eur: Math.round(valBenchmark),
      myinvestor_direct_index_eur: Math.round(valDirect),
      cumulative_loss_vs_portfolio_eur: Math.round(valBenchmark - valOffered),
      cumulative_loss_vs_direct_eur: Math.round(valDirect - valOffered)
    };
    yearlySeries30.push(point);
    if (y <= T) {
      yearlySeries.push(point);
    }
  }

  const finalYear = yearlySeries[yearlySeries.length - 1];
  const year10 = yearlySeries30[10];
  const year20 = yearlySeries30[20];
  const year30 = yearlySeries30[30];
  const lossVsPortfolio10y = finalYear.myinvestor_portfolio_eur - finalYear.offered_bank_eur;
  const lossVsDirect10y = finalYear.myinvestor_direct_index_eur - finalYear.offered_bank_eur;
  const lossVsPortfolio30y = year30.myinvestor_portfolio_eur - year30.offered_bank_eur;
  const lossVsDirect30y = year30.myinvestor_direct_index_eur - year30.offered_bank_eur;
  const annualFeeGapEur = Math.round(C0 * (terOffered - terBenchmark));

  const transferability = evaluateTransferability({
    product_type,
    exit_fee_pct,
    liquidity_window_note,
    accumulated_gain_eur
  });

  // Regla determinista de veredicto "CARO" vs "ADELANTE"
  // Si el TER supera en más de 0.45 puntos porcentuales la alternativa de su misma categoría o tiene comisión de reembolso > 0
  const terSpreadPct = Number((offered_ter_pct - benchmark_ter_pct).toFixed(2));
  const isExpensive = terSpreadPct >= 0.45 || Number(exit_fee_pct) > 0;

  return {
    verdict: isExpensive ? 'CARO' : 'ADELANTE',
    inputs: {
      amount_eur: C0,
      years: T,
      gross_return_pct: Number(gross_return_pct),
      offered_ter_pct: Number(offered_ter_pct),
      benchmark_ter_pct: Number(benchmark_ter_pct),
      direct_index_ter_pct: Number(direct_index_ter_pct)
    },
    metrics: {
      ter_spread_pct: terSpreadPct,
      fee_multiplier: Number((offered_ter_pct / Math.max(0.05, benchmark_ter_pct)).toFixed(1)),
      first_year_overcost_eur: annualFeeGapEur,
      monthly_fee_drain_eur: Math.round(annualFeeGapEur / 12),
      daily_fee_drain_eur: Number((annualFeeGapEur / 365).toFixed(2)),
      final_capital_offered_eur: finalYear.offered_bank_eur,
      final_capital_myinvestor_portfolio_eur: finalYear.myinvestor_portfolio_eur,
      final_capital_myinvestor_direct_eur: finalYear.myinvestor_direct_index_eur,
      loss_10y_vs_portfolio_eur: lossVsPortfolio10y,
      loss_10y_vs_direct_index_eur: lossVsDirect10y,
      final_capital_30y_offered_eur: year30.offered_bank_eur,
      final_capital_30y_portfolio_eur: year30.myinvestor_portfolio_eur,
      final_capital_30y_direct_eur: year30.myinvestor_direct_index_eur,
      loss_30y_vs_portfolio_eur: lossVsPortfolio30y,
      loss_30y_vs_direct_index_eur: lossVsDirect30y,
      milestones_drill_in: {
        year_10: year10,
        year_20: year20,
        year_30: year30
      }
    },
    behavioral_salience: {
      daily_pain_of_paying_eur: Number((annualFeeGapEur / 365).toFixed(2)),
      monthly_pain_of_paying_eur: Math.round(annualFeeGapEur / 12),
      compound_10y_loss_eur: lossVsPortfolio10y,
      compound_30y_loss_vs_index_eur: lossVsDirect30y,
      academic_basis:
        'Fee Salience & Percentage Veil (Barber, Odean & Zheng, 2005; ESMA Cost Disclosures) + Exponential Growth Bias a 30 años (Stango & Zinman)'
    },
    transferability,
    yearly_series: yearlySeries,
    yearly_series_30y: yearlySeries30,
    formula_audit: `Vf(30a) = ${C0} * (1 + ${rGross} - TER)^30 | Sin alucinación (Motor Determinista Centinela)`
  };
}

module.exports = {
  IRPF_SAVINGS_BRACKETS_2025_2026,
  calculateIrpfSavingsTax,
  evaluateTransferability,
  calculateCostComparison
};
