/**
 * Recoge los textos EXACTOS que la interfaz envía a /api/tts al pulsar los botones de la demo.
 *
 * Para no duplicar los guiones (y que no se desincronicen), se carga el propio public/app.js con un DOM
 * mínimo, se pulsan los botones contra el servidor arrancado en este mismo proceso y se interceptan las
 * peticiones a /api/tts. No se llama a ElevenLabs ni a Claude: aquí solo se averigua qué frases hay.
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Objeto "comodín": cualquier propiedad o llamada devuelve otro comodín; como texto es '' y como lista está vacío.
function makeUniversal() {
  const target = function () {};
  const proxy = new Proxy(target, {
    get(_t, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () {};
      if (key === 'length') return 0;
      if (key === 'then') return undefined; // que no parezca una promesa
      if (key === 'toString' || key === 'valueOf') return () => '';
      return proxy;
    },
    set: () => true,
    apply: () => proxy,
    construct: () => proxy
  });
  return proxy;
}

function makeDom() {
  const universal = makeUniversal();
  const elements = {};
  const makeElement = (id) => {
    const store = { id, style: {}, innerHTML: '', textContent: '', innerText: '', value: '', className: '', dataset: {} };
    return new Proxy(store, {
      get(t, key) {
        if (key in t) return t[key];
        if (key === 'querySelectorAll' || key === 'children' || key === 'childNodes') return key === 'querySelectorAll' ? () => [] : [];
        return universal;
      },
      set(t, key, value) {
        t[key] = value;
        return true;
      }
    });
  };
  const document = {
    getElementById: (id) => (elements[id] = elements[id] || makeElement(id)),
    querySelectorAll: () => [],
    querySelector: () => makeElement('query'),
    addEventListener() {},
    createElement: () => makeElement('new'),
    body: makeElement('body')
  };
  return { document, elements };
}

/**
 * @returns {Promise<Array<{label:string, text:string, group:'principal'|'ejemplos'|'otros'}>>}
 */
async function collectDemoPhrases({ all = false } = {}) {
  const { server } = require(path.join(ROOT, 'src', 'server'));
  const ai = require(path.join(ROOT, 'src', 'services', 'aiService'));
  // Las frases de los botones no dependen de Claude (la entidad está en la lista de alertas): se desactiva
  // en este proceso para no gastar llamadas mientras se recogen los textos.
  ai.setRuntimeKeys({ anthropicKey: '' });

  const listening = server.listening;
  if (!listening) await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const captured = [];
  const { document } = makeDom();
  const windowStub = {
    addEventListener() {},
    speechSynthesis: { cancel() {}, speak() {}, getVoices: () => [] },
    document
  };
  const fetchStub = async (url, options = {}) => {
    if (String(url) === '/api/tts') {
      try {
        captured.push(JSON.parse(options.body || '{}').text || '');
      } catch (e) {
        /* cuerpo ilegible: no es una frase */
      }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ ok: false, reason: 'CAPTURA_DE_FRASES' }), blob: async () => null };
    }
    return fetch(base + url, options);
  };
  const context = vm.createContext({
    document,
    window: windowStub,
    navigator: {},
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    fetch: fetchStub,
    URL,
    Blob,
    performance,
    SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {},
    Audio: function Audio() {
      return { play: async () => {}, pause() {} };
    },
    prompt: () => null,
    alert() {},
    localStorage: { getItem: () => null, setItem() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8'), context, { filename: 'public/app.js' });

  const phrases = [];
  const reset = () => fetch(`${base}/api/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  // Ejecuta una acción de la interfaz y espera a que envíe (o no) su frase a /api/tts
  const run = async (label, group, action, { expectSpeech = true } = {}) => {
    const before = captured.length;
    await action();
    const t0 = Date.now();
    while (expectSpeech && captured.length === before && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 25));
    await new Promise((r) => setTimeout(r, 50));
    for (const text of captured.slice(before)) {
      const clean = String(text).replace(/\s+/g, ' ').trim();
      if (clean && !phrases.some((p) => p.text === clean)) phrases.push({ label, group, text: clean });
    }
  };

  try {
    await reset();
    await run('Acto 1 · Falso bróker (Quantum Ibérica)', 'principal', () => context.runScenario1Scam());
    await run('Acto 2 · Fondo caro de sucursal (TER 1,80 %)', 'principal', () => context.runScenario2Caro('FONDO_RV_180'));
    // Acto 3: el botón recorre Persona sorda (sin audio) -> Baja visión -> Estándar
    await run('Acto 3 · Persona sorda (solo subtítulos)', 'principal', () => context.runScenario3Accessibility(), { expectSpeech: false });
    await run('Acto 3 · Baja visión (tras el Acto 2)', 'principal', () => context.runScenario3Accessibility());
    await run('Acto 3 · Vuelta al modo estándar', 'principal', () => context.runScenario3Accessibility());
    await reset();
    await run('Ejemplo · SMS de bloqueo inminente', 'ejemplos', () => context.runSmishingQuickCase());
    await run('Ejemplo · Falsa tasa de desbloqueo / IRPF', 'ejemplos', () => context.runUnlockTaxExtortionCase());
    if (all) {
      for (const [key, label] of [
        ['FONDO_GARANTIZADO_SALIDA', 'Ejemplo · Fondo garantizado con comisión de salida'],
        ['UNIT_LINKED_NO_TRASPASABLE', 'Ejemplo · Unit-linked no traspasable'],
        ['FONDO_LIMPIO_ADELANTE', 'Ejemplo · Fondo indexado limpio (ADELANTE)']
      ]) {
        await run(label, 'otros', () => context.runScenario2Caro(key));
      }
    }
    await reset();
  } finally {
    if (!listening) {
      server.close();
      if (server.closeAllConnections) server.closeAllConnections();
    }
  }
  return phrases;
}

module.exports = { collectDemoPhrases };
