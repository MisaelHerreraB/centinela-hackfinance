/**
 * Tests del Paso 0: la app lee el archivo .env (sin dependencias) y nunca enseña las claves.
 * Ejecutar:  npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { loadEnv, parseEnv } = require('../src/config/loadEnv');

const FAKE_KEY = 'sk-ant-test-CLAVE-FALSA-0123456789';

function tmpEnv(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'centinela-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, content);
  return file;
}

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

test('parseEnv: ignora comentarios y líneas vacías, quita comillas y acepta "export"', () => {
  const parsed = parseEnv(
    ['# comentario', '', 'A=1', 'B="con espacios"', "C='simple'", 'export D=cuatro', 'E=valor # comentario final', 'F=', 'no es una variable', 'G=a#b'].join('\n')
  );
  assert.deepEqual(parsed, { A: '1', B: 'con espacios', C: 'simple', D: 'cuatro', E: 'valor', F: '', G: 'a#b' });
});

test('loadEnv: carga lo que falta, NO sobrescribe lo ya definido y no devuelve valores', () => {
  const file = tmpEnv('CENTINELA_TEST_NUEVA=desde_env\nCENTINELA_TEST_YA_DEFINIDA=desde_env\nCENTINELA_TEST_VACIA=\n');
  process.env.CENTINELA_TEST_YA_DEFINIDA = 'desde_el_entorno';
  delete process.env.CENTINELA_TEST_NUEVA;
  delete process.env.CENTINELA_TEST_VACIA;
  const res = loadEnv({ path: file });
  assert.equal(process.env.CENTINELA_TEST_NUEVA, 'desde_env');
  assert.equal(process.env.CENTINELA_TEST_YA_DEFINIDA, 'desde_el_entorno');
  assert.equal(process.env.CENTINELA_TEST_VACIA, undefined);
  assert.deepEqual(res.loaded, ['CENTINELA_TEST_NUEVA']);
  assert.ok(!JSON.stringify(res).includes('desde_env'), 'solo se devuelven los nombres');
});

test('loadEnv: si el archivo no existe no falla; en los tests no se lee el .env real del proyecto', () => {
  assert.equal(loadEnv({ path: path.join(os.tmpdir(), 'no-existe', '.env') }).found, false);
  const saved = process.env.CENTINELA_ENV_FILE;
  delete process.env.CENTINELA_ENV_FILE;
  assert.equal(loadEnv().skipped, true);
  if (saved !== undefined) process.env.CENTINELA_ENV_FILE = saved;
});

test('Con un .env temporal, `node src/server.js` arranca con Claude configurado y la clave no sale en logs ni en /api/state', async () => {
  const file = tmpEnv(`# claves de prueba\nANTHROPIC_API_KEY="${FAKE_KEY}"\nANTHROPIC_CALL_MODEL=claude-haiku-5-5\nCLAUDE_MAX_CALLS=7\n`);
  const port = await freePort();
  const env = { ...process.env, CENTINELA_ENV_FILE: file, PORT: String(port), HOST: '127.0.0.1' };
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_CALL_MODEL', 'CLAUDE_MAX_CALLS', 'ELEVENLABS_API_KEY', 'NODE_TEST_CONTEXT', 'CENTINELA_SKIP_DOTENV']) delete env[k];
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));
  try {
    let state = null;
    for (let i = 0; i < 50 && !state; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/state`);
        if (res.ok) state = await res.json();
      } catch (e) {
        /* aún arrancando */
      }
    }
    assert.ok(state, `el servidor no arrancó. Logs: ${logs.replace(FAKE_KEY, '***')}`);
    assert.equal(state.ai_status.claude_configured, true);
    assert.equal(state.ai_status.claude_call_model, 'claude-haiku-5-5');
    assert.equal(state.ai_status.claude_calls_max, 7);
    assert.ok(!JSON.stringify(state).includes(FAKE_KEY), 'la clave no aparece en /api/state');
    assert.ok(!logs.includes(FAKE_KEY), 'la clave no aparece en los logs');
  } finally {
    child.kill();
  }
});
