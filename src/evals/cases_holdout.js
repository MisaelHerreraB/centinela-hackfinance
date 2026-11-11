/**
 * Casos "fuera de muestra" para medir reglas solas frente a reglas + Claude (npm run eval:holdout).
 *
 * Los casos están en casos_fuera_de_muestra.txt (copia de entregables/casos_fuera_de_muestra.txt), con el formato
 *   ESTAFA | texto      o      ADELANTE | texto      (uno por línea; las líneas con # se ignoran)
 * Para añadir casos del equipo basta con escribirlos al final de ese archivo: no hay que tocar código.
 *
 * Ni las reglas ni el prompt de Claude se han ajustado mirando estos casos (se convirtieron después de
 * dejar ambos cerrados en la rama). La cabecera del .txt explica cómo se redactaron y sus limitaciones.
 */

const fs = require('fs');
const path = require('path');

const HOLDOUT_FILE = path.join(__dirname, 'casos_fuera_de_muestra.txt');

function parseHoldout(content = '') {
  const counters = { ESTAFA: 0, ADELANTE: 0 };
  const cases = [];
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(ESTAFA|ADELANTE)\s*\|\s*(.+)$/);
    if (!m) continue;
    const verdict = m[1];
    counters[verdict] += 1;
    cases.push({
      id: `${verdict === 'ESTAFA' ? 'E' : 'L'}${String(counters[verdict]).padStart(2, '0')}`,
      expected_verdict: verdict,
      text: m[2].trim()
    });
  }
  return cases;
}

const HOLDOUT_CASES = parseHoldout(fs.readFileSync(HOLDOUT_FILE, 'utf8'));

module.exports = { HOLDOUT_CASES, parseHoldout, HOLDOUT_FILE };
