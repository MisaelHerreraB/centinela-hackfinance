/**
 * Mide Centinela con casos que no ha visto: solo reglas frente a reglas + lectura de Claude.
 *   npm run eval:nuevos
 * Sin ANTHROPIC_API_KEY solo se informa la columna de reglas (no se inventa el resultado de Claude).
 */
const { analyzeFraudRisk } = require('../engine/fraudEngine');
const { TACTICS, applySemanticTactics } = require('../engine/semanticSignals');
const { readScamTacticsWithClaude, getAiStatus } = require('../services/aiService');
const CASES = require('./cases_nuevos');

async function runUnseen() {
  const withClaude = getAiStatus().claude_configured;
  const rows = [];
  for (const c of CASES) {
    const rules = analyzeFraudRisk({ text: c.text });
    let full = null;
    if (withClaude) {
      const reading = rules.verdict === 'ESTAFA' ? null : await readScamTacticsWithClaude(c.text, TACTICS);
      full = reading && reading.ok ? applySemanticTactics(rules, c.text, reading.tactics, reading) : reading ? { ...rules, error: reading.reason } : rules;
    }
    rows.push({
      id: c.id,
      title: c.title,
      expected: c.expected,
      rules: rules.verdict,
      with_claude: full ? full.verdict : null,
      tactics: full && full.semantic_reading ? full.semantic_reading.tactics.map((t) => t.code) : [],
      latency_ms: full && full.semantic_reading ? full.semantic_reading.latency_ms : null,
      error: full && full.error ? full.error : null
    });
  }
  const hit = (key) => rows.filter((r) => r[key] === r.expected).length;
  return { total: rows.length, rules_correct: hit('rules'), with_claude_correct: withClaude ? hit('with_claude') : null, claude_model: withClaude ? getAiStatus().claude_model : null, rows };
}

if (require.main === module) {
  runUnseen().then((r) => {
    for (const x of r.rows) {
      const mark = (v) => (v === null ? '   —   ' : v === x.expected ? 'OK     ' : 'FALLO  ');
      console.log(`${x.id}  reglas: ${mark(x.rules)} con Claude: ${mark(x.with_claude)} ${x.title}${x.tactics.length ? `  [${x.tactics.join(', ')}]` : ''}${x.error ? `  (error: ${x.error})` : ''}`);
    }
    console.log(`\nSolo reglas: ${r.rules_correct}/${r.total}`);
    console.log(r.with_claude_correct === null ? 'Con Claude: sin ANTHROPIC_API_KEY, no medido' : `Reglas + lectura de Claude (${r.claude_model}): ${r.with_claude_correct}/${r.total}`);
  });
}

module.exports = { runUnseen };
