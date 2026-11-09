/**
 * Batería Oficial de 30 Casos de Prueba de Centinela
 *  - 10 Casos ESTAFA (Vishing, Chiringuitos CNMV, Smishing Spoofing, IBAN reportado, Producto inexistente)
 *  - 10 Casos CARO (Fondos de sucursal TER 1,25%–2,20%, Fondos Garantizados con comisión de salida, Unit-Linked)
 *  - 10 Casos ADELANTE (Fondos indexados limpios, Carteras MyInvestor, Transferencias legítimas)
 */

const TEST_CASES_30 = [
  // ==================== 10 CASOS ESTAFA ====================
  {
    id: 'CASE-01',
    category: 'ESTAFA_VISHING_BROKER',
    title: 'Falso bróker Quantum Ibérica (12% garantizado + IBAN reportado)',
    input_mode: 'VOICE_CALL',
    text: 'Hola Carmen, te llamo de Quantum Ibérica Capital. Tienes una rentabilidad garantizada del 12% anual sin ningún riesgo si transfieres hoy 9.000 euros al IBAN ES91 2100 0418 4502 0005 1332 antes de que cierre el cupo en 15 minutos.',
    entity_name: 'Quantum Ibérica Capital',
    iban: 'ES9121000418450200051332',
    claimed_product: 'Bono VIP Garantizado 12% MyInvestor',
    product_exists_in_mcp: false,
    amount_eur: 9000,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-02',
    category: 'ESTAFA_SMISHING_SPOOFING',
    title: 'SMS Spoofing suplantando soporte de seguridad MyInvestor',
    input_mode: 'SMS_CAPTURE',
    text: 'AVISO URGENTE MYINVESTOR: Detectado acceso no autorizado. Su cuenta sufre bloqueo inminente. Pincha en este enlace myinvestor-seguridad.com e introduce tu código SMS de firma ahora mismo.',
    entity_name: 'myinvestor-seguridad.com',
    iban: '',
    amount_eur: 4500,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-03',
    category: 'ESTAFA_CUENTA_SEGURA',
    title: 'Llamada de falsa "Cuenta Segura" del Banco de España',
    input_mode: 'VOICE_CALL',
    text: 'Le llamamos del departamento antifraude. Hay un movimiento sospechoso, transfiere ahora mismo tus ahorros a esta cuenta segura del banco ES18 0049 1500 0521 1099 8877 y no cuelgues.',
    entity_name: 'Soporte Cuenta Segura',
    iban: 'ES1800491500052110998877',
    amount_eur: 12000,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-04',
    category: 'ESTAFA_CHIRINGUITO_CNMV',
    title: 'Chiringuito cripto AlphaYield alertado por la CNMV',
    input_mode: 'VOICE_CALL',
    text: 'Invierte con AlphaYield Crypto & Forex VIP. Nuestro algoritmo te da beneficio asegurado para duplicar tu dinero solo por hoy.',
    entity_name: 'AlphaYield Crypto & Forex VIP',
    iban: 'LT603250081199221100',
    amount_eur: 6000,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-05',
    category: 'ESTAFA_CLON_GESTORA',
    title: 'Clon EuroPrime Garantizado 12 en lista de alertas CNMV',
    input_mode: 'PDF_OFFER',
    text: 'Contrato privado EuroPrime Garantizado 12. Rentabilidad garantizada del 11% anual fijo. Últimas plazas disponibles hoy.',
    entity_name: 'EuroPrime Garantizado 12',
    iban: 'GB29NWBK60161331926819',
    amount_eur: 15000,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-06',
    category: 'ESTAFA_REMOTO_ANYDESK',
    title: 'Falso gestor que pide instalar AnyDesk y código SMS',
    input_mode: 'VOICE_CALL',
    text: 'Para desbloquear tu dividendo instala AnyDesk en el móvil y dime la clave de firma y el código SMS que te acaba de llegar.',
    entity_name: 'Soporte Técnico',
    iban: '',
    amount_eur: 3500,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-07',
    category: 'ESTAFA_HORIZON_GOLD',
    title: 'Chiringuito Horizon Gold & AI Trading con IBAN lituano',
    input_mode: 'VOICE_CALL',
    text: 'Horizon Gold & AI Trading: rentabilidad garantizada sin ningún riesgo. Transfiere hoy a LT603250081199221100.',
    entity_name: 'Horizon Gold & AI Trading',
    iban: 'LT603250081199221100',
    amount_eur: 8000,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-08',
    category: 'ESTAFA_AISLAMIENTO_FAMILIAR',
    title: 'Presión psicológica para ocultar transferencia al banco',
    input_mode: 'VOICE_CALL',
    text: 'Es una operación confidencial con rentabilidad garantizada: en tu banco te pondrán pegas porque no quieren que ganes un 12% anual fijo, pon en el concepto familia y hazlo ya.',
    entity_name: 'Asesor Privado VIP',
    iban: 'ES9121000418450200051332',
    amount_eur: 9500,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-09',
    category: 'ESTAFA_CLON_IBERIA_WEALTH',
    title: 'Suplantación Iberia Wealth Management Ltd (Alerta CNMV)',
    input_mode: 'SMS_CAPTURE',
    text: 'Oferta exclusiva Iberia Wealth Management (iberiawealth-uk.com): 10% garantizado solo por hoy.',
    entity_name: 'iberiawealth-uk.com',
    iban: 'GB29NWBK60161331926819',
    amount_eur: 10000,
    expected_verdict: 'ESTAFA'
  },
  {
    id: 'CASE-10',
    category: 'ESTAFA_PRODUCTO_FANTASMA',
    title: 'Falso Depósito Cripto-Garantizado suplantando a MyInvestor',
    input_mode: 'VOICE_CALL',
    text: 'Te llamamos para activar el Depósito Cripto-Garantizado 14% de MyInvestor. Solo por hoy en los próximos 10 minutos, pásame tu código SMS.',
    entity_name: 'verificar-myinvestor.net',
    claimed_product: 'Depósito Cripto-Garantizado 14%',
    product_exists_in_mcp: false,
    amount_eur: 7000,
    expected_verdict: 'ESTAFA'
  },

  // ==================== 10 CASOS CARO ====================
  {
    id: 'CASE-11',
    category: 'CARO_FONDO_SUCURSAL_RV',
    title: 'Fondo Renta Variable Global Banca Tradicional (TER 1,80%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Variable',
    offered_ter_pct: 1.80,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-12',
    category: 'CARO_FONDO_GARANTIZADO_SALIDA',
    title: 'Fondo Garantizado con TER 1,45% y Comisión de Reembolso 4%',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_GARANTIZADO',
    asset_type: 'Mixto',
    offered_ter_pct: 1.45,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 4.0,
    amount_eur: 40000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-13',
    category: 'CARO_FONDO_MIXTO_TRADICIONAL',
    title: 'Fondo Mixto Defensivo Sucursal (TER 1,65%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Mixto',
    offered_ter_pct: 1.65,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 60000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-14',
    category: 'CARO_TECHO_MAXIMO_CNMV',
    title: 'Fondo Gestión Activa al tope legal CNMV (2,25% gestión + 0,20% depósito)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Variable',
    offered_ter_pct: 2.45,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-15',
    category: 'CARO_UNIT_LINKED_NO_TRASPASABLE',
    title: 'Seguro Unit-Linked Bancario (TER 2,10% y no traspasable en IRPF)',
    input_mode: 'DFI_PDF',
    product_type: 'UNIT_LINKED',
    asset_type: 'Mixto',
    offered_ter_pct: 2.10,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 2.5,
    amount_eur: 50000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-16',
    category: 'CARO_RENTA_FIJA_COMISION_ALTA',
    title: 'Fondo Renta Fija Corto Plazo con comisión del 1,15% (vs 0,15% Monetario)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Fija',
    offered_ter_pct: 1.15,
    benchmark_ter_pct: 0.22,
    exit_fee_pct: 0,
    amount_eur: 35000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-17',
    category: 'CARO_MONETARIO_BANCA_CLASICA',
    title: 'Fondo Monetario sucursal con TER 0,95% (vs 0,05% AXA Trésor)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Monetario',
    offered_ter_pct: 0.95,
    benchmark_ter_pct: 0.15,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-18',
    category: 'CARO_ETF_TEMATICO_COSTOSO',
    title: 'ETF Temático con TER 1,35% (No traspasable sin tributar)',
    input_mode: 'DFI_PDF',
    product_type: 'ETF',
    asset_type: 'Renta Variable',
    offered_ter_pct: 1.35,
    benchmark_ter_pct: 0.20,
    exit_fee_pct: 0,
    amount_eur: 25000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-19',
    category: 'CARO_FONDO_BOLSA_USA_ACTIVO',
    title: 'Fondo Bolsa USA Activo (TER 1,92% vs 0,06% Indexado)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Variable',
    offered_ter_pct: 1.92,
    benchmark_ter_pct: 0.12,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'CARO'
  },
  {
    id: 'CASE-20',
    category: 'CARO_FONDO_CON_PENALIZACION_SALIDA',
    title: 'Fondo Rendimiento Objetivo con 3,00% de penalización por reembolso',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_GARANTIZADO',
    asset_type: 'Renta Fija',
    offered_ter_pct: 0.90,
    benchmark_ter_pct: 0.22,
    exit_fee_pct: 3.0,
    amount_eur: 45000,
    expected_verdict: 'CARO'
  },

  // ==================== 10 CASOS ADELANTE ====================
  {
    id: 'CASE-21',
    category: 'ADELANTE_FIDELITY_MSCI_WORLD',
    title: 'Fidelity MSCI World Index Fund EUR P Acc (IE00BYX5NX33 - TER 0,12%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Variable',
    offered_ter_pct: 0.12,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-22',
    category: 'ADELANTE_ISHARES_DEVELOPED_WORLD',
    title: 'iShares Developed World Index Fund S Acc EUR (IE000ZYRH0Q7 - TER 0,06%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Variable',
    offered_ter_pct: 0.06,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-23',
    category: 'ADELANTE_AXA_TRESOR_PUENTE',
    title: 'AXA Trésor Court Terme C (FR0000447823 - Monetario TER 0,05%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Monetario',
    offered_ter_pct: 0.05,
    benchmark_ter_pct: 0.22,
    exit_fee_pct: 0,
    amount_eur: 30000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-24',
    category: 'ADELANTE_CARTERA_AHORRO_MYINVESTOR',
    title: 'Cartera Ahorro MyInvestor (TER total 0,22%–0,30%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Monetario',
    offered_ter_pct: 0.22,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 40000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-25',
    category: 'ADELANTE_CARTERA_INDIE_MYINVESTOR',
    title: 'Cartera Indexada Indie MyInvestor (TER total 0,30%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Mixto',
    offered_ter_pct: 0.30,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-26',
    category: 'ADELANTE_AMUNDI_GOV_BOND',
    title: 'Amundi Prime Euro Government Bond IE (LU2339731064 - TER 0,05%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Fija',
    offered_ter_pct: 0.05,
    benchmark_ter_pct: 0.25,
    exit_fee_pct: 0,
    amount_eur: 25000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-27',
    category: 'ADELANTE_LAZARD_EURO_SHORT',
    title: 'Lazard Euro Short Duration SRI (FR0013506995 - TER 0,04%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Fija',
    offered_ter_pct: 0.04,
    benchmark_ter_pct: 0.25,
    exit_fee_pct: 0,
    amount_eur: 20000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-28',
    category: 'ADELANTE_OFI_MONETAIRE',
    title: 'Ofi Invest ISR Monétaire CT E (FR0010738229 - TER 0,06%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Monetario',
    offered_ter_pct: 0.06,
    benchmark_ter_pct: 0.22,
    exit_fee_pct: 0,
    amount_eur: 15000,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-29',
    category: 'ADELANTE_LLAMADA_LEGITIMA_INFORMATIVA',
    title: 'Conversación familiar legítima sobre aportación mensual indexada',
    input_mode: 'VOICE_CALL',
    text: 'Mamá, recuerda que en la app de MyInvestor puedes ver tu Cartera Ahorro cuando quieras, sin prisa y sin que nadie te pida claves.',
    entity_name: 'MyInvestor',
    iban: 'ES7701865001680510084921',
    amount_eur: 300,
    expected_verdict: 'ADELANTE'
  },
  {
    id: 'CASE-30',
    category: 'ADELANTE_VANGUARD_GLOBAL_STOCK',
    title: 'Vanguard Global Stock Index Fund EUR Acc (IE00B03HCZ61 - TER 0,18%)',
    input_mode: 'DFI_PDF',
    product_type: 'FONDO_INVERSION',
    asset_type: 'Renta Variable',
    offered_ter_pct: 0.18,
    benchmark_ter_pct: 0.30,
    exit_fee_pct: 0,
    amount_eur: 50000,
    expected_verdict: 'ADELANTE'
  }
];

module.exports = { TEST_CASES_30 };
