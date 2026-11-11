/**
 * CENTINELA · MODO ESCENARIO
 * La demo contada en el iPhone de Carmen, paso a paso (→ avanza, ← retrocede).
 * La puesta en escena (llamada, cámara, FaceID) es un guion; los veredictos, las señales,
 * las cifras y la gráfica vienen de la API real en cada paso. Nada está escrito a mano aquí.
 */

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const num = (n, d = 0) => Number(n).toLocaleString('es-ES', { useGrouping: 'always', minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n) => `${num(Math.round(n))} €`;
const pct = (n) => `${num(n, 2)} %`;
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let muted = params.get('mudo') === '1';
let FAST = false; // repetición instantánea (al retroceder o al abrir un paso por enlace)
let epoch = 0; // cada navegación invalida las animaciones del paso anterior
let act = 0;
let step = 0;
let busy = false;
let timers = [];
const S = {}; // respuestas reales de la API en esta sesión

class Cancelled extends Error {}
const sleep = (ms, e) =>
  new Promise((res, rej) => {
    if (FAST) return res();
    setTimeout(() => (e === epoch ? res() : rej(new Cancelled())), ms);
  });
const every = (ms, fn) => timers.push(setInterval(fn, ms));

async function api(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return res.json();
}

/* ---------- Iconos ---------- */
const ICON = {
  shield: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z',
  warn: 'M12 2 1 21h22L12 2Zm1 15h-2v2h2v-2Zm0-7h-2v5h2v-5Z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5h-2v6l5 3 1-1.7-4-2.3V7Z',
  bank: 'M12 2 2 7v2h20V7L12 2ZM4 11v7h3v-7H4Zm6 0v7h4v-7h-4Zm7 0v7h3v-7h-3ZM2 20v2h20v-2H2Z',
  percent: 'M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18.3 4.3 4.3 18.3l1.4 1.4 14-14-1.4-1.4Z',
  doc: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 12v2h8v-2H8Zm0 4v2h8v-2H8Z',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  code: 'M9 7 4 12l5 5 1.4-1.4L6.8 12l3.6-3.6L9 7Zm6 0-1.4 1.4 3.6 3.6-3.6 3.6L15 17l5-5-5-5Z',
  coin: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 4v1.1c1.7.3 3 1.5 3 3.2h-2c0-.8-.8-1.4-2-1.4s-2 .5-2 1.3c0 .7.6 1.1 2.4 1.5 2.4.6 3.9 1.4 3.9 3.5 0 1.600-1.300 2.800-3.300 3.100V19h-2v-1.100c-1.900-.300-3.300-1.500-3.300-3.400h2c0 .900.900 1.600 2.300 1.600 1.300 0 2.200-.500 2.200-1.400 0-.800-.600-1.200-2.500-1.700-2.300-.600-3.700-1.400-3.700-3.300 0-1.500 1.200-2.700 3-3.100V6h2Z',
  phone: 'M6.600 2h3.200l1.600 4.800-2.200 1.600a13 13 0 0 0 6.400 6.400l1.600-2.200L22 14.200v3.200A2.600 2.600 0 0 1 19.400 20 17.400 17.400 0 0 1 2 4.600 2.600 2.600 0 0 1 4.600 2h2Z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.300 3.600-6 8-6s8 2.700 8 6v1H1v-1Zm18 1v-1c0-1.600-.600-3-1.700-4.200 3.100.400 5.700 2 5.700 4.200v1h-4Z',
  check: 'M4 12.500 9.500 18 20 6.500'
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${ICON[name]}"/></svg>`;

/* ---------- Sonido: efectos (WebAudio) y voz (ElevenLabs si hay clave; si no, la del navegador) ---------- */
let audioCtx = null;
function beep(freq, dur = 0.15, type = 'sine', vol = 0.07, at = 0) {
  if (muted || FAST) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const t = audioCtx.currentTime + at;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch (err) { /* sin audio: la demo sigue */ }
}
const sfx = {
  ring: () => [0, 0.45].forEach((t) => { beep(880, 0.36, 'sine', 0.06, t); beep(1108, 0.36, 'sine', 0.05, t); }),
  alert: () => { beep(233, 0.26, 'sawtooth', 0.07); beep(185, 0.4, 'sawtooth', 0.07, 0.27); },
  ding: () => { beep(1320, 0.12, 'sine', 0.07); beep(1760, 0.22, 'sine', 0.06, 0.12); },
  ok: () => [523, 659, 784].forEach((f, i) => beep(f, 0.24, 'sine', 0.07, i * 0.12)),
  shutter: () => beep(1900, 0.05, 'square', 0.04)
};

/*
 * Dos papeles, dos voces: el estafador (hombre, rápido) y Centinela (mujer, tranquila).
 * Con clave de ElevenLabs cada papel usa su voz de ElevenLabs; sin clave, dos voces distintas del navegador.
 * Si en el equipo solo hubiera una voz en español, se distinguen por el tono y la barra inferior lo avisa.
 */
const ROLES = {
  centinela: { prefer: ['Mónica', 'Monica', 'Marisol', 'Paulina', 'Google español', 'Flo', 'Sandy', 'Shelley'], rate: 1.0, pitch: 1.05, label: 'Centinela' },
  estafador: { prefer: ['Jorge', 'Juan', 'Diego', 'Carlos', 'Reed', 'Eddy', 'Rocko', 'Grandpa'], rate: 1.2, pitch: 0.8, label: 'estafador' }
};
let voiceCache = null;
function spanishVoices() {
  return 'speechSynthesis' in window ? window.speechSynthesis.getVoices().filter((v) => v.lang && /^es/i.test(v.lang)) : [];
}
function pickVoices() {
  const es = spanishVoices();
  if (!es.length) return { centinela: null, estafador: null, distinct: false };
  const find = (names, not) => {
    for (const name of names) {
      const v = es.find((x) => x !== not && x.name.includes(name) && /es[-_]ES/i.test(x.lang)) || es.find((x) => x !== not && x.name.includes(name));
      if (v) return v;
    }
    return null;
  };
  const centinela = find(ROLES.centinela.prefer) || es[0];
  const estafador = find(ROLES.estafador.prefer, centinela) || es.find((v) => v !== centinela) || centinela;
  return { centinela, estafador, distinct: centinela !== estafador };
}
function voiceFor(role) {
  if (!voiceCache || !voiceCache.centinela) {
    voiceCache = pickVoices();
    if (voiceCache.centinela) {
      const short = (v) => v.name.replace(/\s*\(.*$/, '');
      $('hud-note').textContent = voiceCache.distinct
        ? `Voces: estafador ${short(voiceCache.estafador)} · Centinela ${short(voiceCache.centinela)}`
        : 'Solo hay una voz en español en este equipo: se distinguen por el tono';
    }
  }
  return voiceCache[role];
}
// Chrome carga la lista de voces de forma asíncrona: se relee cuando llega
if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => { voiceCache = null; };

const ttsServer = { centinela: true, estafador: true }; // por papel: se desactiva si ElevenLabs no da audio para esa voz
let currentAudio = null;
function hush() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}
async function say(text, e, role = 'centinela') {
  if (muted || FAST || !text) return;
  if (ttsServer[role]) {
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: role }) });
      if ((res.headers.get('Content-Type') || '').includes('audio')) {
        const blob = await res.blob();
        if (e !== epoch) return;
        currentAudio = new Audio(URL.createObjectURL(blob));
        await new Promise((done) => { currentAudio.onended = currentAudio.onerror = done; currentAudio.play().catch(done); });
        return;
      }
      ttsServer[role] = false;
    } catch (err) { ttsServer[role] = false; }
  }
  if (!('speechSynthesis' in window) || e !== epoch) return;
  await new Promise((done) => {
    const u = new SpeechSynthesisUtterance(text);
    const voice = voiceFor(role);
    u.lang = voice ? voice.lang : 'es-ES';
    if (voice) u.voice = voice;
    u.rate = ROLES[role].rate;
    u.pitch = ROLES[role].pitch;
    u.onend = u.onerror = done;
    window.speechSynthesis.speak(u);
    setTimeout(done, 14000);
  });
}

/* ---------- Piezas de la pantalla ---------- */
function setTone(tone) { document.body.dataset.tone = tone; }
function setCaption(tag, title, sub) {
  $('act-tag').textContent = tag;
  for (const [id, text] of [['headline', title], ['subline', sub]]) {
    const el = $(id);
    el.textContent = text;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }
}
function setVerdict(word, note) {
  const el = $('verdict');
  el.hidden = !word;
  el.innerHTML = word ? `${esc(word)}${note ? `<small>${esc(note)}</small>` : ''}` : '';
}
function setView(html, dark = false) {
  const view = $('view');
  view.innerHTML = html;
  view.style.animation = 'none';
  void view.offsetWidth;
  view.style.animation = '';
  document.querySelector('.display').classList.toggle('dark', dark);
}
function setIsland(text, alert = false) {
  const el = $('island');
  el.classList.toggle('on', Boolean(text));
  el.classList.toggle('alert', alert);
  if (text) $('island-text').textContent = text;
}
function showPush(kind, title, body) {
  const el = $('push');
  el.className = `push ${kind}`;
  el.innerHTML = `${svg('shield')}<div><small>Centinela · ahora</small><b>${esc(title)}</b><span>${esc(body)}</span></div>`;
  void el.offsetWidth; // fuerza el estado inicial para que la entrada se anime
  el.classList.add('show');
}
function hidePush() { $('push').classList.remove('show'); }
function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}
function addSignal(key, icon, title, sub, badge, calm = false) {
  const list = $('signals');
  let li = list.querySelector(`[data-key="${key}"]`);
  if (!li) {
    li = document.createElement('li');
    li.dataset.key = key;
    list.appendChild(li);
  }
  li.className = calm ? 'calm' : '';
  li.innerHTML = `${svg(icon)}<div><b>${esc(title)}</b><span>${esc(sub || '')}</span></div>${badge ? `<em>${esc(badge)}</em>` : ''}`;
}
function setRisk(score) {
  $('gauge').hidden = false;
  $('g-fill').style.strokeDashoffset = String(314.16 * (1 - Math.min(100, score) / 100));
  $('g-num').textContent = String(Math.round(score));
}
function setChain(kc) {
  if (!kc || !Array.isArray(kc.stages)) return;
  const top = kc.highest_stage_reached || 0;
  const current = kc.stages.find((s) => s.stage === top);
  const label = current ? (current.name.match(/\(([^)]+)\)/) || [])[1] || current.name : '';
  $('chain').innerHTML = `
    <div class="chain-title">Fase ${top} de 5 de la estafa</div>
    <div class="chain-dots">${kc.stages.map((s) => `<i class="${s.active ? 'on' : ''}"></i>`).join('')}</div>
    <small>${esc(label)}</small>`;
}
function resetStage() {
  hush();
  timers.forEach(clearInterval);
  timers = [];
  hidePush();
  $('sheet').classList.remove('show');
  $('sheet').innerHTML = '';
  $('signals').innerHTML = '';
  $('chain').innerHTML = '';
  $('gauge').hidden = true;
  $('g-fill').style.strokeDashoffset = '314.16';
  $('g-num').textContent = '0';
  $('daniel').hidden = true;
  $('mini-notif').innerHTML = '';
  $('engine-title').textContent = '';
  $('trio').hidden = true;
  $('trio').innerHTML = '';
  $('challenge').hidden = true;
  $('phone-wrap').hidden = false;
  document.body.classList.remove('no-engine');
  setIsland('');
  setVerdict('');
  setTone('neutral');
}

/* ---------- Vistas del iPhone ---------- */
const appHead = `<div class="app-head"><div class="app-logo">my<b>investor</b></div><div class="avatar">CG</div></div>`;
function viewHome(cta) {
  return `${appHead}
    <div class="hello">Hola, Carmen<span>Tus ahorros, protegidos</span></div>
    <div class="tile"><small>Mi patrimonio en MyInvestor</small><b>62.430 €</b></div>
    <div class="row2">
      <div class="tile"><small>Cuenta</small><b>12.430 €</b></div>
      <div class="tile"><small>Fondos</small><b>50.000 €</b></div>
    </div>
    <div class="tile shield">${svg('shield')}<div><small>Centinela</small><b>Activo · escucha tus llamadas</b></div></div>
    ${cta ? `<button class="cta pulse" data-next>${esc(cta)}</button>` : ''}`;
}
const viewRing = `
  <div class="call">
    <div class="who">Número desconocido</div>
    <div class="sub">Llamada entrante…</div>
    <div class="call-btns">
      <button class="call-btn no" aria-label="Rechazar">${svg('phone')}</button>
      <button class="call-btn yes" data-next aria-label="Contestar">${svg('phone')}</button>
    </div>
  </div>`;
const viewCall = `
  <div class="call">
    <div class="who">Quantum Ibérica Capital</div>
    <div class="sub" id="call-time">00:00</div>
    <div class="bubbles" id="bubbles"></div>
    <div class="wpm" id="wpm"></div>
  </div>`;
const viewTransfer = `${appHead}
  <div class="hello" style="font-size:22px">Enviar dinero</div>
  <div class="amount">9.000 €</div>
  <div class="form">
    <div><small>Para</small>Quantum Ibérica Capital</div>
    <div><small>IBAN</small>ES91 2100 0418 4502 0005 1332</div>
    <div><small>Concepto</small>Bono VIP</div>
  </div>
  <button class="cta pulse" data-next>Enviar 9.000 €</button>`;
const viewDone = (title, sub) => `
  <div class="done">
    <div class="ring"><svg viewBox="0 0 24 24"><path d="${ICON.check}"/></svg></div>
    <b>${esc(title)}</b><span>${esc(sub)}</span>
  </div>`;
const viewCam = `
  <div class="cam">
    <div class="paper" id="paper">
      <h4>Documento de datos fundamentales</h4>
      <h3>FonBanco Selección Global Gestión Activa, FI</h3>
      <div>Renta variable global · Gestión activa</div>
      <div class="tiny">ISIN XX0000DEMO01 · Folleto de ejemplo</div>
      <hr />
      <div class="tiny">COSTES A LO LARGO DEL TIEMPO</div>
      <div>Comisión de gestión <span style="float:right">1,65 %</span></div>
      <div>Comisión de depósito <span style="float:right">0,15 %</span></div>
      <div class="ter"><span>Gastos corrientes (anual)</span><b>1,80 %</b></div>
      <hr />
      <div class="tiny">Inversión propuesta: 50.000 €. Rentabilidades pasadas no garantizan rentabilidades futuras.</div>
      <div class="scanline"></div>
    </div>
    <div class="hint">Encuadra el folleto</div>
    <button class="shutter" data-next aria-label="Hacer foto"></button>
  </div>`;
const viewClosing = `
  <div class="closing">${svg('shield')}<b>Antes de firmar, pregúntale.</b><span>Centinela · en tu app de MyInvestor</span></div>`;

/* ---------- ACTO 1 · La llamada (veredicto real: /api/analyze-call) ---------- */
const PHRASES = [
  { parts: ['Hola Carmen, te llamo de ', ['Quantum Ibérica Capital'], '.'] },
  { parts: ['Te activamos hoy el Bono VIP con un ', ['12 % anual garantizado, sin ningún riesgo'], '.'] },
  { parts: ['Quedan las ', ['últimas plazas, solo hoy, en los próximos 15 minutos'], '.'] },
  { parts: ['Transfiere ahora mismo ', ['9.000 euros'], ' al IBAN ', ['ES91 2100 0418 4502 0005 1332'], '.'], say: 'Transfiere ahora mismo nueve mil euros a la cuenta que te envío.' }
];
const plain = (p) => p.parts.map((x) => (Array.isArray(x) ? x[0] : x)).join('');
const SCAM_IBAN = 'ES9121000418450200051332';
const WPM = 188; // velocidad del guion; con audio real la mide ElevenLabs Scribe en /api/stt

const SIGNAL_UI = {
  ENTIDAD_ALERTA_CNMV: (s, fa) => ['bank', 'En la lista de alertas de la CNMV', fa.cnmv_check && fa.cnmv_check.entity],
  PROMESA_GARANTIZADA: (s) => ['percent', 'Rentabilidad «garantizada»', `«${s.evidence}»`],
  URGENCIA_ARTIFICIAL: (s) => ['clock', 'Prisa artificial', `«${s.evidence}»`],
  IBAN_REPORTADO_Y_SEPA_VOP_NO_MATCH: (s, fa) => ['users', 'La cuenta no es de quien dice', fa.iban_check && fa.iban_check.registered_holder]
};
function renderFraud(fa) {
  setRisk(fa.risk_score);
  setChain(fa.kill_chain_progression);
  for (const s of fa.signals) {
    const ui = SIGNAL_UI[s.type];
    const [icon, title, sub] = ui ? ui(s, fa) : ['warn', s.label, s.evidence];
    addSignal(s.type, icon, title, sub, s.severity === 'CRITICA' ? 'crítica' : 'alta');
  }
}
async function typeBubble(phrase, e) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  $('bubbles').appendChild(bubble);
  const words = [];
  for (const part of phrase.parts) {
    const marked = Array.isArray(part);
    for (const w of (marked ? part[0] : part).split(/(?<=\s)/)) if (w) words.push(marked ? `<mark>${esc(w)}</mark>` : esc(w));
  }
  const voice = say(phrase.say || plain(phrase), e, 'estafador');
  for (let i = 1; i <= words.length; i++) {
    bubble.innerHTML = words.slice(0, i).join('');
    await sleep(60000 / WPM, e);
  }
  await voice;
}
function firePush(fa, latency) {
  setTone('red');
  setIsland('Posible estafa', true);
  showPush('red', 'Creemos que es una estafa', 'No envíes dinero. Te explicamos por qué.');
  shake($('phone'));
  sfx.alert();
  setVerdict('ESTAFA', `riesgo ${Math.round(fa.risk_score)} de 100 · ${latency < 1 ? 'menos de 1' : latency} ms`);
}

const ACT1 = {
  tag: 'Acto 1 · La llamada',
  label: 'Estafa',
  steps: [
    async () => {
      setCaption(ACT1.tag, 'Carmen, 68 años.', 'Sus ahorros de toda la vida caben en su móvil.');
      setView(viewHome());
    },
    async () => {
      setCaption(ACT1.tag, 'Suena el teléfono.', 'Un «asesor» con una oportunidad que no puede esperar.');
      setView(viewRing, true);
      sfx.ring();
      every(2200, sfx.ring);
    },
    async (e) => {
      timers.forEach(clearInterval);
      timers = [];
      setCaption(ACT1.tag, 'Centinela escucha.', 'Cada frase pasa por el motor antifraude, en vivo.');
      setView(viewCall, true);
      setIsland('Centinela escuchando');
      $('engine-title').textContent = 'Lo que detecta Centinela';
      setRisk(0);
      $('wpm').innerHTML = `Ritmo del guion: <b>${WPM} palabras/min</b> (simulado)`;
      const t0 = Date.now();
      every(1000, () => {
        const s = Math.floor((Date.now() - t0) / 1000);
        const el = $('call-time');
        if (el) el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      });
      let heard = '';
      let pushed = false;
      for (const phrase of PHRASES) {
        await typeBubble(phrase, e);
        heard += (heard ? ' ' : '') + plain(phrase);
        const data = await api('/api/analyze-call', {
          preview: true,
          useClaude: false, // frase a frase solo con reglas: responde al instante
          text: heard,
          iban: heard.includes('IBAN') ? SCAM_IBAN : '',
          speech_rate_wpm: WPM,
          speech_rate_source: 'DEMO_SIMULADO'
        });
        if (e !== epoch) throw new Cancelled();
        const fa = data.step_2_verdict.fraud_analysis;
        renderFraud(fa);
        if (!pushed && fa.risk_score >= 80) {
          pushed = true;
          firePush(fa, data.total_latency_ms);
          await say('Carmen, creemos que es una estafa. No envíes dinero.', e, 'centinela');
        }
        await sleep(350, e);
      }
    },
    async () => {
      setCaption(ACT1.tag, 'Aun así, va a enviar el dinero.', 'Con el estafador al teléfono, Carmen abre la transferencia.');
      hidePush();
      setView(viewTransfer);
    },
    async (e) => {
      const data = await api('/api/analyze-call', {
        useClaude: false, // las reglas ya reconocen este guion; Claude se enseña en el reto (tecla 4)
        text: PHRASES.map(plain).join(' '),
        entity_name: 'Quantum Ibérica Capital',
        iban: SCAM_IBAN,
        amount_eur: 9000,
        speech_rate_wpm: WPM,
        speech_rate_source: 'DEMO_SIMULADO'
      });
      if (e !== epoch) throw new Cancelled();
      S.call = data;
      const fa = data.step_2_verdict.fraud_analysis;
      const action = data.step_3_action;
      renderFraud(fa);
      setCaption(ACT1.tag, 'Sin bloquearle su dinero.', 'Centinela explica el porqué, avisa a su hijo y le pone al banco al teléfono.');
      const holder = String((fa.iban_check && fa.iban_check.registered_holder) || '').replace(/\s*\(.*\)$/, '');
      const reasons = fa.signals
        .map((s) => (SIGNAL_UI[s.type] ? SIGNAL_UI[s.type](s, fa) : ['warn', s.label]))
        .slice(0, 3)
        .map(([icon, title]) => `<li>${svg(icon)}<span>${esc(title)}</span></li>`)
        .join('');
      $('sheet').innerHTML = `
        <h2>Espera, Carmen.<br /><em>Creemos que es una estafa.</em></h2>
        <div class="vop">
          <div><small>Dice ser</small>${esc(fa.iban_check.claimed_holder || 'Quantum Ibérica Capital')}</div>
          <i>≠</i>
          <div class="bad"><small>La cuenta es de</small>${esc(holder)}</div>
        </div>
        <ul class="why">${reasons}</ul>
        <button class="cta" data-next>Hablar con MyInvestor ahora</button>
        <button class="cta ghost">${action.allow_client_override ? 'Seguir bajo mi responsabilidad' : 'Operación retenida'}</button>
        <div class="note">Tu decisión queda registrada. Daniel ya lo sabe.</div>`;
      $('sheet').classList.add('show');
      const notif = action.family_notification;
      if (notif) {
        $('daniel').hidden = false;
        $('mini-notif').innerHTML = `<b>${esc(notif.title.replace(/^[^\p{L}]+/u, ''))}</b>${esc(notif.body)}`;
        shake($('mini-phone'));
        sfx.ding();
      }
      await say(data.spoken_text, e, 'centinela');
    },
    async () => {
      $('sheet').classList.remove('show');
      setIsland('');
      setTone('green');
      setVerdict('');
      const amount = (S.call && S.call.step_1_input.amount_eur) || 9000;
      setCaption(ACT1.tag, `${eur(amount)} a salvo.`, 'Carmen decide. Centinela le da los motivos a tiempo.');
      setView(viewDone(`${eur(amount)} a salvo`, 'Transferencia cancelada con MyInvestor'));
      sfx.ok();
    }
  ]
};

/* ---------- ACTO 2 · La sucursal (veredicto real: /api/analyze-document + MCP de MyInvestor) ---------- */
const DFI_PRESET = {
  name: 'FonBanco Selección Global Gestión Activa FI',
  bank_name: 'Banco Tradicional Sucursal',
  isin: 'XX0000DEMO01',
  asset_type: 'Renta Variable',
  geography: 'Global',
  product_type: 'FONDO_INVERSION',
  offered_ter_pct: 1.8,
  management_fee_pct: 1.65,
  deposit_fee_pct: 0.15,
  exit_fee_pct: 0,
  amount_eur: 50000,
  accumulated_gain_eur: 9200
};
function chartSvg(series) {
  const W = 374, H = 250, L = 10, R = 84, T = 18, B = 26;
  const max = Math.max(...series.map((p) => p.myinvestor_direct_index_eur));
  const x = (year) => L + (year / 30) * (W - L - R);
  const y = (v) => H - B - (v / max) * (H - T - B);
  const line = (key) => series.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  const idx = line('myinvestor_direct_index_eur');
  const bank = line('offered_bank_eur');
  const back = [...series].reverse().map((p) => `L${x(p.year).toFixed(1)} ${y(p.offered_bank_eur).toFixed(1)}`).join(' ');
  const last = series[series.length - 1];
  const ticks = [0, 10, 20, 30].map((t) => `<text x="${x(t)}" y="${H - 6}" fill="#6a7080" text-anchor="${t === 0 ? 'start' : 'middle'}">${t === 0 ? 'Hoy' : t === 30 ? '30 años' : t}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Crecimiento a 30 años: fondo del banco frente a fondo indexado">
    <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#d9dbe1" />
    <path class="area" d="${idx} ${back} Z" />
    <path class="l-bank draw" pathLength="1000" d="${bank}" />
    <path class="l-idx draw" pathLength="1000" d="${idx}" />
    <g class="end">
      <text x="${W - R + 7}" y="${y(last.myinvestor_direct_index_eur) + 5}" fill="#0d8a3f">${eur(last.myinvestor_direct_index_eur)}</text>
      <text x="${W - R + 7}" y="${y(last.offered_bank_eur) + 5}" fill="#c4281c">${eur(last.offered_bank_eur)}</text>
    </g>
    ${ticks}
  </svg>`;
}
function countUp(el, target, ms, e) {
  if (FAST) { el.textContent = `+${eur(target)}`; return; }
  const t0 = performance.now();
  const tick = (now) => {
    if (e !== epoch) return;
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = `+${eur(target * p * p * p)}`; // se acelera, como el interés compuesto
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const ACT2 = {
  tag: 'Acto 2 · La sucursal',
  label: 'Caro',
  steps: [
    async () => {
      setCaption(ACT2.tag, '«Es un fondo muy bueno».', 'En su banco de siempre le proponen dónde meter 50.000 €.');
      setView(viewHome('Enseñar a Centinela'));
    },
    async () => {
      setCaption(ACT2.tag, 'Carmen le hace una foto.', 'Al folleto que le han dado para firmar.');
      setView(viewCam, true);
    },
    async (e) => {
      sfx.shutter();
      $('flash').classList.remove('go');
      void $('flash').offsetWidth;
      $('flash').classList.add('go');
      $('engine-title').textContent = 'Lo que hace Centinela';
      addSignal('read', 'doc', 'Leyendo el folleto…', 'Busca la comisión anual', '', true);
      const data = await api('/api/analyze-document', { presetDocument: DFI_PRESET, amount_eur: DFI_PRESET.amount_eur, years: 10, gross_return_pct: 5 });
      if (e !== epoch) throw new Cancelled();
      S.doc = data;
      const doc = data.step_1_input;
      const cost = data.step_2_verdict.cost_analysis;
      const mcp = data.step_2_verdict.mcp_lookup;
      const alt = (mcp.alternatives || [])[0];
      const m = cost.metrics;
      const paper = $('paper');
      if (paper) paper.classList.add('found');
      addSignal('read', 'doc', `Comisión: ${pct(doc.offered_ter_pct)} al año`, doc.name, doc.extractor === 'DEMO_PRESET' ? 'folleto de ejemplo' : 'Claude');
      await sleep(900, e);
      addSignal('mcp', 'bolt', 'Pregunta al MCP de MyInvestor', `${mcp.mcp_tool_called} · ${mcp.mcp_latency_ms} ms`, mcp.mcp_live ? 'en vivo' : 'caché');
      await sleep(900, e);
      if (alt) addSignal('alt', 'coin', `El mismo tipo de fondo: ${pct(alt.ter)}`, alt.name, 'MyInvestor');
      await sleep(900, e);
      addSignal('calc', 'code', 'Las cuentas las hace el código', 'La IA lee. No calcula ni un euro.', 'determinista');
      await sleep(700, e);

      const times = Math.round(doc.offered_ter_pct / cost.inputs.direct_index_ter_pct);
      setTone('orange');
      showPush('orange', 'Producto caro', `Pagarías ${times} veces más comisión.`);
      shake($('phone'));
      sfx.ding();
      setVerdict('CARO', `${pct(doc.offered_ter_pct)} frente a ${pct(cost.inputs.direct_index_ter_pct)}`);
      await sleep(1500, e);

      setCaption(ACT2.tag, `${eur(m.loss_30y_vs_direct_index_eur)} de diferencia.`, 'El mismo mercado. Solo cambia la comisión.');
      setView(`${appHead}
        <div class="chart-top">
          <small>En 30 años, con tus ${eur(cost.inputs.amount_eur)}</small>
          <div class="gap" id="gap">+0 €</div>
          <p>más para ti con el fondo indexado</p>
        </div>
        <div class="chart" id="chart" data-next>${chartSvg(cost.yearly_series_30y)}</div>
        <div class="legend">
          <span><i style="background:#0d8a3f"></i>Índice en MyInvestor · ${pct(cost.inputs.direct_index_ter_pct)}</span>
          <span><i style="background:#e0372b"></i>Tu banco · ${pct(doc.offered_ter_pct)}</span>
        </div>
        <div id="drill"><div class="wait" style="text-align:center;margin-top:26px;font-size:14px;font-weight:600;color:#6a7080">Toca la gráfica para ver los números</div></div>`);
      void $('chart').offsetWidth;
      $('chart').classList.add('drawn');
      countUp($('gap'), m.loss_30y_vs_direct_index_eur, 2800, e);
      await sleep(3200, e);
      hidePush();
    },
    async () => {
      const cost = S.doc.step_2_verdict.cost_analysis;
      const ms = cost.metrics.milestones_drill_in;
      setCaption(ACT2.tag, 'Toca la gráfica: los números.', 'Año a año, sin letra pequeña.');
      hidePush();
      $('drill').innerHTML = `
        <div class="drill">
          <div class="head"><span>Año</span><span>Tu banco</span><span>Índice</span></div>
          ${['year_10', 'year_20', 'year_30'].map((k) => `<div><span>${ms[k].year}</span><span>${eur(ms[k].offered_bank_eur)}</span><span>${eur(ms[k].myinvestor_direct_index_eur)}</span></div>`).join('')}
        </div>
        <button class="cta green pulse" data-next style="display:block;width:calc(100% - 32px);margin:12px 16px 0">Traspasar · ${eur(cost.transferability.irpf_to_pay_today_eur)} de IRPF hoy</button>`;
      addSignal('drain', 'coin', `${eur(cost.metrics.monthly_fee_drain_eur)} al mes en comisiones`, `${num(cost.metrics.daily_fee_drain_eur, 2)} € cada día`, 'hoy');
      addSignal('tax', 'check2', 'Traspaso sin tributar ahora', 'Art. 94 de la Ley del IRPF: se tributa al reembolsar', eur(cost.transferability.irpf_to_pay_today_eur));
    },
    async (e) => {
      const draft = S.doc.step_3_action.transfer_order_draft || {};
      setCaption(ACT2.tag, 'Firmado con la cara.', 'El fondo se muda a MyInvestor sin pagar impuestos por el cambio.');
      setView(`<div class="faceid">
        <svg viewBox="0 0 48 48"><path d="M6 16V10a4 4 0 0 1 4-4h6M32 6h6a4 4 0 0 1 4 4v6M42 32v6a4 4 0 0 1-4 4h-6M16 42h-6a4 4 0 0 1-4-4v-6M17 19v3M31 19v3M24 19v7h-2M17 31c2 2 4.500 3 7 3s5-1 7-3"/></svg>
        <b>Face ID</b></div>`);
      await sleep(1300, e);
      const signed = await api('/api/sign-transfer', { order_id: draft.order_id, destination: draft.destination || 'MyInvestor', amount_eur: draft.amount_eur || DFI_PRESET.amount_eur });
      if (e !== epoch) throw new Cancelled();
      S.signed = signed;
      setTone('green');
      setVerdict('');
      setView(viewDone('Traspaso firmado', `${eur(S.doc.step_2_verdict.cost_analysis.transferability.irpf_to_pay_today_eur)} de IRPF ahora · queda en el registro`));
      sfx.ok();
    }
  ]
};
ICON.check2 = 'M9.500 16.200 5.300 12l-1.400 1.400 5.600 5.600 11-11L19.100 6.600l-9.600 9.600Z';

/* ---------- ACTO 3 · Para todos ---------- */
function alertScreen(mode) {
  const body = {
    std: `<span class="tag">Voz y texto</span><h3>Creemos que es una estafa.</h3><p>No envíes dinero. Centinela te lo dice en voz alta y por escrito.</p>`,
    deaf: `<span class="tag">Sin sonido</span><h3>Creemos que es una estafa.</h3><div class="subs">«Transfiere ahora mismo 9.000 euros…»</div><p>La pantalla parpadea y el móvil vibra. Todo lo que se dice, subtitulado.</p>`,
    lowvision: `<span class="tag">Alto contraste</span><h3>ESTAFA</h3><p>No envíes 9.000 €.</p>`
  }[mode];
  return `<div class="alert-screen ${mode === 'std' ? '' : mode}"><div class="ico">${svg('warn')}</div>${body}<button class="cta">Hablar con MyInvestor</button></div>`;
}
const miniPhone = (mode, title, sub) => `
  <figure>
    <div class="phone-wrap"><div class="phone"><div class="display${mode === 'lowvision' ? ' dark' : ''}">
      <div class="statusbar"><span class="clock">10:42</span><span class="sys">5G <i class="bat"></i></span></div>
      <div class="island"></div>${alertScreen(mode)}<div class="homebar"></div>
    </div></div></div>
    <figcaption>${title}<span>${sub}</span></figcaption>
  </figure>`;

const ACT3 = {
  tag: 'Acto 3 · Para todos',
  label: 'Para todos',
  steps: [
    async () => {
      document.body.classList.add('no-engine');
      setCaption(ACT3.tag, 'Para todos.', 'El mismo aviso, adaptado a cada persona con un toque.');
      $('phone-wrap').hidden = true;
      $('trio').hidden = false;
      $('trio').innerHTML =
        miniPhone('std', 'Voz y texto', 'Por defecto') +
        miniPhone('deaf', 'Persona sorda', 'Todo visual y vibración') +
        miniPhone('lowvision', 'Baja visión', 'Letra enorme, contraste máximo');
    },
    async (e) => {
      setCaption('Centinela', 'Antes de firmar, pregúntale.', 'Una segunda opinión, en el segundo que importa.');
      document.body.classList.remove('no-engine');
      $('trio').hidden = true;
      $('phone-wrap').hidden = false;
      setView(viewClosing, true);
      $('engine-title').textContent = 'En esta demo';
      if (!S.call) S.call = await api('/api/analyze-call', { preview: true, useClaude: false, text: PHRASES.map(plain).join(' '), iban: SCAM_IBAN });
      if (!S.doc) S.doc = await api('/api/analyze-document', { presetDocument: DFI_PRESET, amount_eur: DFI_PRESET.amount_eur, years: 10, gross_return_pct: 5 });
      if (e !== epoch) throw new Cancelled();
      const m = S.doc.step_2_verdict.cost_analysis.metrics;
      const stats = [
        ['9.000 €', 'a salvo en una llamada'],
        [`+${eur(m.loss_30y_vs_direct_index_eur)}`, 'en 30 años, solo por la comisión'],
        [S.call.total_latency_ms < 1 ? '< 1 ms' : `${S.call.total_latency_ms} ms`, 'tardó el veredicto de estafa']
      ];
      $('signals').innerHTML = `<div class="stats">${stats.map(([b, s], i) => `<div class="stat" style="animation-delay:${i * 0.18}s"><b>${b}</b><span>${s}</span></div>`).join('')}</div>`;
    }
  ]
};

/* ---------- RETO · Una estafa que Centinela no ha visto (reglas + lectura de Claude, en vivo) ---------- */
const CHALLENGES = [
  ['Bizum inverso', 'Hola, soy del departamento de seguridad de su banco. Hemos detectado un cargo raro. Para anularlo le va a llegar una solicitud de Bizum, acéptela y le devolvemos el dinero.'],
  ['Hijo en apuros', 'Mamá, se me ha roto el móvil, este es mi número nuevo. Necesito que me hagas una transferencia de 1.800 euros hoy, luego te lo explico, no me llames que no va el micro.'],
  ['Falso policía', 'Le habla el inspector Ramírez de la Policía Nacional. Su cuenta está siendo usada para blanqueo. Debe mover sus ahorros a una cuenta segura que le indicamos mientras investigamos.'],
  ['Mensaje normal', 'Mamá, el sábado comemos en casa. Si quieres te ayudo a mirar lo del plan de pensiones con calma el mes que viene.']
];
function markQuotes(text, quotes) {
  let html = esc(text);
  for (const q of quotes) {
    const safe = esc(q);
    const i = html.toLowerCase().indexOf(safe.toLowerCase());
    if (i >= 0) html = `${html.slice(0, i)}<mark>${html.slice(i, i + safe.length)}</mark>${html.slice(i + safe.length)}`;
  }
  return html;
}
async function runChallenge(text) {
  const e = ++epoch;
  hush();
  hidePush();
  $('signals').innerHTML = '';
  $('chain').innerHTML = '';
  setVerdict('');
  setTone('neutral');
  setRisk(0);
  setIsland('Centinela leyendo');
  setView(`<div class="chat"><div class="chat-head">Mensaje nuevo<b>Número desconocido</b></div><div class="msg" id="msg">${esc(text)}</div><div class="wait" id="wait">Leyendo el mensaje…</div></div>`);
  const t0 = performance.now();
  let data;
  try {
    data = await api('/api/analyze-call', { preview: true, text }); // con clave, Claude señala las tácticas y el código decide
  } catch (err) {
    data = null;
  }
  if (e !== epoch) return;
  const claude = (data && data.ok && data.step_2_verdict.claude_analysis) || { used: false };
  const secs = num((claude.latency_ms ? claude.latency_ms : performance.now() - t0) / 1000, 1); // tiempo real de la llamada a Claude
  if (!data || !data.ok) {
    $('wait').textContent = (data && data.error) || 'No se pudo analizar. Revisa la conexión.';
    setIsland('');
    return;
  }
  const fa = data.step_2_verdict.fraud_analysis;
  const byClaude = fa.signals.some((s) => s.source === 'CLAUDE');
  setRisk(fa.risk_score);
  const quotes = [];
  for (const s of fa.signals) {
    const fromClaude = s.source === 'CLAUDE';
    if (fromClaude) quotes.push(s.evidence);
    const ui = SIGNAL_UI[s.type];
    const [icon, title, sub] = ui ? ui(s, fa) : ['warn', s.label, fromClaude ? `«${s.evidence}»` : s.evidence];
    addSignal(s.type, icon, title, sub, fromClaude ? 'Claude' : 'reglas');
  }
  $('msg').innerHTML = markQuotes(text, quotes);
  $('wait').textContent = '';
  const scam = fa.verdict === 'ESTAFA';
  setIsland(scam ? 'Posible estafa' : '', scam);
  setTone(scam ? 'red' : 'green');
  const whyNot = claude.reason === 'SIN_CLAVE_DE_CLAUDE' ? 'falta la clave de Claude' : claude.error === 'CLAUDE_BUDGET_EXHAUSTED' ? 'límite de llamadas a Claude alcanzado' : /^TIMEOUT/.test(claude.error || '') ? 'Claude no respondió a tiempo' : 'Claude no disponible';
  const how = byClaude ? `leído por Claude en ${secs} s` : claude.used ? `Claude no ve tácticas · ${secs} s` : `solo reglas: ${whyNot}`;
  setVerdict(scam ? 'ESTAFA' : 'ADELANTE', how);
  showPush(scam ? 'red' : 'green', scam ? 'Creemos que es una estafa' : 'Sin señales de estafa', scam ? 'No envíes dinero ni des tus claves.' : 'Puedes seguir con tranquilidad.');
  if (scam) { shake($('phone')); sfx.alert(); } else sfx.ok();
  if (!fa.signals.length) addSignal('none', 'check2', 'Ninguna táctica de estafa', claude.used ? 'Reglas y lectura de Claude, sin hallazgos' : 'Solo reglas, sin hallazgos', '', true);
}
const ACT4 = {
  tag: 'Reto · Ponedlo a prueba',
  label: 'Reto',
  steps: [
    async () => {
      setCaption(ACT4.tag, 'Inventad una estafa.', 'Una que Centinela no haya visto nunca.');
      $('engine-title').textContent = 'Lo que detecta Centinela';
      $('challenge').hidden = false;
      $('challenge-chips').innerHTML = CHALLENGES.map(([label], i) => `<button type="button" data-challenge="${i}">${esc(label)}</button>`).join('');
      setView(`<div class="chat"><div class="chat-head">Mensajes<b>Sin mensajes nuevos</b></div><div class="wait">Escribe el mensaje a la izquierda</div></div>`);
      if (!FAST) $('challenge-text').focus();
    }
  ]
};

/* ---------- Navegación ---------- */
const ACTS = [ACT1, ACT2, ACT3, ACT4];

function renderHud() {
  $('hud-acts').innerHTML = ACTS.map((a, i) => `<button class="${i === act ? 'on' : ''}" data-act="${i}">${i + 1} · ${a.label}</button>`).join('') +
    ACTS[act].steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
}
async function runStep(i, e) {
  busy = true;
  try {
    await ACTS[act].steps[i](e);
  } catch (err) {
    if (!(err instanceof Cancelled)) console.error('[Escenario]', err);
  } finally {
    if (e === epoch) busy = false;
  }
}
/** Abre un paso reconstruyendo el acto desde el principio a toda velocidad (sin animaciones ni sonido). */
async function go(a, s, keepFast = false) {
  const e = ++epoch;
  act = Math.max(0, Math.min(ACTS.length - 1, a));
  step = Math.max(0, Math.min(ACTS[act].steps.length - 1, s));
  resetStage();
  renderHud();
  FAST = true;
  document.body.classList.add('fast');
  if (act < 2) await api('/api/reset').catch(() => {});
  for (let i = 0; i < step && e === epoch; i++) await runStep(i, e);
  if (e !== epoch) return;
  if (!keepFast) {
    FAST = false;
    document.body.classList.remove('fast');
  }
  await runStep(step, e);
}
function next() {
  if (busy) return go(act, step + 1 < ACTS[act].steps.length ? step + 1 : step); // corta la animación y salta
  if (step + 1 < ACTS[act].steps.length) {
    step += 1;
    renderHud();
    hush();
    return runStep(step, ++epoch);
  }
  if (act + 1 < ACTS.length - 1) return go(act + 1, 0); // el reto solo se abre con la tecla 4
  return null;
}
function prev() {
  if (step > 0) return go(act, step - 1);
  if (act > 0) return go(act - 1, ACTS[act - 1].steps.length - 1);
  return null;
}

document.addEventListener('keydown', (ev) => {
  if (ev.target.closest('textarea, input')) {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('challenge').requestSubmit(); }
    if (ev.key === 'Escape') ev.target.blur();
    return; // al escribir, las teclas no mueven la demo
  }
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key;
  if (['ArrowRight', ' ', 'Enter', 'PageDown'].includes(k)) { ev.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { ev.preventDefault(); prev(); }
  else if (['1', '2', '3', '4'].includes(k)) go(Number(k) - 1, 0);
  else if (k === 'r' || k === 'R') go(act, 0);
  else if (k === 'm' || k === 'M') { muted = !muted; if (muted) hush(); $('hud-note').textContent = muted ? 'Sonido apagado' : 'Sonido encendido'; }
  else if (k === 'f' || k === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
  else if (k === 'h' || k === 'H') document.body.classList.toggle('clean');
});
$('challenge').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = $('challenge-text').value.trim();
  if (text) runChallenge(text);
});
document.addEventListener('click', (ev) => {
  const chip = ev.target.closest('[data-challenge]');
  if (chip) {
    $('challenge-text').value = CHALLENGES[Number(chip.dataset.challenge)][1];
    return runChallenge($('challenge-text').value);
  }
  const actBtn = ev.target.closest('[data-act]');
  if (actBtn) return go(Number(actBtn.dataset.act), 0);
  if (ev.target.closest('[data-next]')) return next();
  return null;
});

const SOLO = params.get('solo') === '1'; // solo el móvil, sin escenario: para capturas de pantalla
function fit() {
  const h = window.innerHeight - 44;
  const root = document.documentElement.style;
  root.setProperty('--k', (SOLO ? (window.innerHeight * 0.96) / 844 : Math.min((h * 0.92) / 844, (window.innerWidth * 0.27) / 390)).toFixed(3));
  root.setProperty('--k3', Math.min((h * 0.66) / 844, (window.innerWidth * 0.165) / 390).toFixed(3));
}
window.addEventListener('resize', fit);
if (SOLO) document.body.classList.add('solo', 'clean');
fit();
if (params.get('limpio') === '1') document.body.classList.add('clean');
// Enlace directo a un paso: /escenario.html?acto=2&paso=3 (añade &rapido=1 para verlo sin animaciones)
go(Number(params.get('acto') || 1) - 1, Number(params.get('paso') || 1) - 1, params.get('rapido') === '1');
// /escenario.html?acto=4&reto=3 lanza directamente uno de los ejemplos del reto
if (params.get('reto')) setTimeout(() => { const c = CHALLENGES[Number(params.get('reto')) - 1]; if (c) { $('challenge-text').value = c[1]; runChallenge(c[1]); } }, 400);
