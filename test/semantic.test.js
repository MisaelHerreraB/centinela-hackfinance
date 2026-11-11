const test = require('node:test');
const assert = require('node:assert');
const { analyzeFraudRisk } = require('../src/engine/fraudEngine');
const { validateTactics, decideFromTactics, applySemanticTactics } = require('../src/engine/semanticSignals');

const TEXT = 'Le habla el inspector Ramírez. Debe mover sus ahorros a una cuenta segura hoy mismo y no lo comente con nadie.';

test('Lectura semántica: se descarta la táctica cuya cita no está en el texto', () => {
  const valid = validateTactics(TEXT, [
    { code: 'CUENTA_SEGURA', quote: 'mover sus ahorros a una cuenta segura' },
    { code: 'ENLACE', quote: 'pinche en este enlace para pagar' },
    { code: 'TACTICA_INVENTADA', quote: 'inspector Ramírez' }
  ]);
  assert.deepStrictEqual(valid.map((t) => t.code), ['CUENTA_SEGURA']);
});

test('Lectura semántica: una sola señal no crítica no basta para ESTAFA', () => {
  assert.strictEqual(decideFromTactics([{ code: 'URGENCIA', quote: 'hoy mismo' }]).isScam, false);
  assert.strictEqual(decideFromTactics([{ code: 'PIDE_DINERO', quote: 'x' }]).isScam, false);
  assert.strictEqual(decideFromTactics([{ code: 'PIDE_DINERO', quote: 'x' }, { code: 'URGENCIA', quote: 'y' }]).isScam, true);
  assert.strictEqual(decideFromTactics([{ code: 'CUENTA_SEGURA', quote: 'x' }]).isScam, true);
});

test('Lectura semántica: el veredicto lo recalcula el código y conserva las señales del motor', () => {
  const rules = analyzeFraudRisk({ text: TEXT });
  const merged = applySemanticTactics(rules, TEXT, [
    { code: 'CUENTA_SEGURA', quote: 'cuenta segura' },
    { code: 'SECRETO', quote: 'no lo comente con nadie' }
  ], { model: 'test', latency_ms: 1 });
  assert.strictEqual(merged.verdict, 'ESTAFA');
  assert.ok(merged.risk_score >= 60);
  assert.strictEqual(merged.signals.length, rules.signals.length + 2);
  assert.strictEqual(merged.semantic_reading.tactics.length, 2);
});

test('Lectura semántica: sin tácticas válidas el análisis del motor no cambia', () => {
  const rules = analyzeFraudRisk({ text: 'Mamá, el sábado comemos en casa.' });
  const merged = applySemanticTactics(rules, 'Mamá, el sábado comemos en casa.', [{ code: 'URGENCIA', quote: 'transfiere ya' }]);
  assert.strictEqual(merged.verdict, rules.verdict);
  assert.strictEqual(merged.risk_score, rules.risk_score);
  assert.strictEqual(merged.semantic_reading.discarded, 1);
});
