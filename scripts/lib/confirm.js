/**
 * Confirmación antes de gastar créditos. Sin respuesta afirmativa no se hace ninguna llamada de pago.
 * `--yes` salta la pregunta (para quien ya ha visto el coste y quiere automatizarlo).
 */
const readline = require('readline');

function hasFlag(name) {
  return process.argv.slice(2).some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
}
function flagValue(name, fallback = null) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

async function confirmSpend(question) {
  if (hasFlag('yes')) {
    console.log(`${question} -> sí (--yes)`);
    return true;
  }
  if (!process.stdin.isTTY) {
    console.log(`${question}\nNo hay terminal interactiva para confirmar. Vuelve a ejecutarlo en una terminal o añade --yes.`);
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(`${question} (s/N) `, resolve));
  rl.close();
  return /^s(i|í)?$/i.test(String(answer).trim());
}

module.exports = { confirmSpend, hasFlag, flagValue };
