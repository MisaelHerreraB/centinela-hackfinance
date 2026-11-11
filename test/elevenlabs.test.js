/**
 * Tests de ElevenLabs (voz, transcripción y control de gasto). Ejecutar: npm test
 * No gastan créditos: ElevenLabs se simula en localhost y la caché va a una carpeta temporal.
 */

process.env.CENTINELA_SKIP_DOTENV = '1';

const test = require('node:test');
const { before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'centinela-el-test-'));
const mock = { requests: [], ttsStatus: 200, sttStatus: 200, sttBody: null };

// 4 palabras en 2 s -> con el mínimo de 3 s: 80 palabras/min. Las 40 palabras de abajo en 12 s -> 200.
function wordsOver(seconds, count) {
  const words = [];
  for (let i = 0; i < count; i++) {
    const start = (seconds / count) * i;
    words.push({ text: `palabra${i}`, start, end: start + (seconds / count) * 0.8, type: 'word' });
    words.push({ text: ' ', start: start + 0.1, end: start + 0.2, type: 'spacing' });
  }
  return words;
}

const elevenServer = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    const entry = { method: req.method, url: req.url, key: req.headers['xi-api-key'], raw: raw.toString('latin1') };
    mock.requests.push(entry);
    if (req.url.startsWith('/v1/text-to-speech/')) {
      entry.json = JSON.parse(raw.toString('utf8'));
      if (mock.ttsStatus !== 200) {
        res.writeHead(mock.ttsStatus, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ detail: { status: 'boom' } }));
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(Buffer.from(`MP3:${entry.json.model_id}:${entry.json.text}`));
    }
    if (req.url.startsWith('/v1/speech-to-text')) {
      if (mock.sttStatus !== 200) {
        res.writeHead(mock.sttStatus, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ detail: 'boom' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify(
          mock.sttBody || {
            language_code: 'spa',
            language_probability: 0.99,
            text: 'Te llamo de Quantum Ibérica Capital, tienes un 12% anual garantizado sin ningún riesgo.',
            words: wordsOver(12, 40),
            audio_duration_secs: 12.4
          }
        )
      );
    }
    if (req.url === '/v1/user/subscription') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ tier: 'free', character_count: 1200, character_limit: 10000 }));
    }
    res.writeHead(404);
    res.end('{}');
  });
});

let BASE;
let app;
let ai;
let el;
const AUDIO = `data:audio/webm;base64,${Buffer.from('audio-de-prueba-uno').toString('base64')}`;
const AUDIO_2 = `data:audio/webm;base64,${Buffer.from('audio-de-prueba-dos').toString('base64')}`;
const calls = (prefix) => mock.requests.filter((r) => r.url.startsWith(prefix));

before(async () => {
  await new Promise((r) => elevenServer.listen(0, '127.0.0.1', r));
  process.env.ELEVENLABS_BASE_URL = `http://127.0.0.1:${elevenServer.address().port}`;
  process.env.ELEVENLABS_CACHE_DIR = CACHE_DIR;
  process.env.MYINVESTOR_MCP_URL = 'http://127.0.0.1:9/mcp';
  for (const k of ['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_TTS', 'ELEVENLABS_STT', 'ELEVENLABS_MAX_CREDITS', 'ELEVENLABS_TTS_MODEL', 'ELEVENLABS_TTS_MODEL_PRECACHE', 'ELEVENLABS_STT_MODEL', 'ELEVENLABS_VOICE_ID']) delete process.env[k];
  app = require('../src/server').server;
  ai = require('../src/services/aiService');
  el = require('../src/services/elevenLabsService');
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  BASE = `http://localhost:${app.address().port}`;
});

after(() => {
  for (const s of [app, elevenServer]) {
    s.close();
    if (s.closeAllConnections) s.closeAllConnections();
  }
});

beforeEach(() => {
  mock.requests = [];
  mock.ttsStatus = 200;
  mock.sttStatus = 200;
  mock.sttBody = null;
  fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  ai.setRuntimeKeys({ anthropicKey: '', elevenLabsKey: 'xi-clave-falsa-de-test' });
  el.configure({ tts: 'on', stt: 'on', maxCredits: 3000, resetUsage: true });
});

async function tts(text) {
  const res = await fetch(`${BASE}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  const isAudio = (res.headers.get('content-type') || '').includes('audio/mpeg');
  return { isAudio, headers: res.headers, body: isAudio ? Buffer.from(await res.arrayBuffer()).toString('utf8') : await res.json() };
}
async function stt(body) {
  const res = await fetch(`${BASE}/api/stt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}
const state = async () => (await (await fetch(`${BASE}/api/state`)).json()).ai_status;

// =============================================================================
// Voz (TTS): modelo, caché, tope e interruptor
// =============================================================================
test('TTS: la primera vez llama a ElevenLabs con el modelo barato y español; la segunda sale de la caché sin gastar', async () => {
  const first = await tts('Hola Carmen,   esto es una prueba.');
  assert.equal(first.isAudio, true);
  assert.equal(first.headers.get('x-centinela-tts-source'), 'LIVE');
  assert.equal(first.headers.get('x-centinela-tts-model'), 'eleven_flash_v2_5');
  const req = calls('/v1/text-to-speech/')[0];
  assert.equal(req.url, '/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128');
  assert.equal(req.key, 'xi-clave-falsa-de-test');
  assert.equal(req.json.model_id, 'eleven_flash_v2_5');
  assert.equal(req.json.language_code, 'es');
  assert.equal(req.json.text, 'Hola Carmen, esto es una prueba.');

  const second = await tts('Hola Carmen, esto es una prueba.');
  assert.equal(second.isAudio, true);
  assert.equal(second.headers.get('x-centinela-tts-source'), 'CACHE');
  assert.equal(second.body, first.body);
  assert.equal(calls('/v1/text-to-speech/').length, 1, 'repetir la frase no vuelve a llamar');

  const s = (await state()).elevenlabs;
  assert.equal(s.credits_used_estimated, 16); // 32 caracteres x 0,5
  assert.equal(s.usage.tts_cache_hits, 1);
  assert.equal(s.cache.tts_files, 1);
  assert.ok(!JSON.stringify(await state()).includes('xi-clave-falsa-de-test'), 'la clave no sale en /api/state');
});

test('TTS: las frases precacheadas con el modelo de calidad se sirven aunque el dinámico sea otro', async () => {
  const text = 'Cuelga ahora mismo, Carmen.';
  const pre = await el.synthesizeSpeech(text, { model: el.TTS_MODEL_PRECACHE });
  assert.equal(pre.ok, true);
  assert.equal(pre.credits_estimated, 27); // multilingual: 1 crédito por carácter
  const req = calls('/v1/text-to-speech/')[0];
  assert.equal(req.json.model_id, 'eleven_multilingual_v2');
  assert.equal(req.json.language_code, undefined, 'multilingual_v2 no admite language_code');
  const served = await tts(text);
  assert.equal(served.headers.get('x-centinela-tts-source'), 'CACHE');
  assert.equal(served.headers.get('x-centinela-tts-model'), 'eleven_multilingual_v2');
  assert.equal(calls('/v1/text-to-speech/').length, 1);
});

test('TTS: al llegar al tope de créditos se usa la voz del navegador, /api/state lo indica y la caché sigue sirviendo', async () => {
  el.configure({ maxCredits: 20 });
  const a = await tts('Una frase de exactamente cuarenta letras.'); // 41 car. -> 21 créditos > 20
  assert.equal(a.isAudio, false);
  assert.equal(a.body.reason, 'ELEVENLABS_BUDGET_EXHAUSTED');
  assert.equal(a.body.fallback, 'WEB_SPEECH_API');
  assert.equal(calls('/v1/text-to-speech/').length, 0, 'no se llama si no cabe en el presupuesto');

  const b = await tts('Frase corta que cabe.'); // 21 car. -> 11 créditos
  assert.equal(b.isAudio, true);
  const c = await tts('Otra frase corta más.'); // otros 11: 22 > 20
  assert.equal(c.isAudio, false);
  assert.equal(c.body.reason, 'ELEVENLABS_BUDGET_EXHAUSTED');
  const d = await tts('Frase corta que cabe.');
  assert.equal(d.isAudio, true, 'lo que ya está en la caché no gasta y se sigue sirviendo');
  assert.equal(calls('/v1/text-to-speech/').length, 1);

  el.configure({ maxCredits: 11 });
  const s = (await state()).elevenlabs;
  assert.equal(s.credits_used_estimated, 11);
  assert.equal(s.budget_exhausted, true);
});

test('TTS: interruptor cache_only (ensayo) y off', async () => {
  await tts('Frase ya generada.');
  el.configure({ tts: 'cache_only' });
  const hit = await tts('Frase ya generada.');
  assert.equal(hit.isAudio, true);
  const miss = await tts('Frase nueva sin generar.');
  assert.equal(miss.isAudio, false);
  assert.equal(miss.body.reason, 'CACHE_ONLY_MISS');
  assert.equal(calls('/v1/text-to-speech/').length, 1, 'en cache_only nunca se llama a la API');
  assert.equal((await state()).elevenlabs.tts_mode, 'cache_only');

  // cache_only funciona incluso sin clave (plan B sin red)
  ai.setRuntimeKeys({ elevenLabsKey: '' });
  assert.equal((await tts('Frase ya generada.')).isAudio, true);

  el.configure({ tts: 'off' });
  const off = await tts('Frase ya generada.');
  assert.equal(off.isAudio, false);
  assert.equal(off.body.reason, 'TTS_OFF');
});

test('TTS: sin clave o con error de ElevenLabs se responde con el respaldo, sin audio y sin gastar', async () => {
  mock.ttsStatus = 401;
  const err = await tts('Frase con error.');
  assert.equal(err.isAudio, false);
  assert.match(err.body.reason, /HTTP_401/);
  assert.equal((await state()).elevenlabs.credits_used_estimated, 0);
  ai.setRuntimeKeys({ elevenLabsKey: '' });
  const noKey = await tts('Frase sin clave.');
  assert.equal(noKey.body.reason, 'NO_ELEVENLABS_KEY');
  assert.equal(calls('/v1/text-to-speech/').length, 1);
});

// =============================================================================
// Transcripción (STT, Scribe): modelo, ritmo de habla medido, caché, tope, respaldos
// =============================================================================
test('STT: usa scribe_v2 en español, mide las palabras por minuto con las marcas de tiempo y cachea por audio', async () => {
  const first = await stt({ audioBase64: AUDIO, mimeType: 'audio/webm', durationSec: 12 });
  assert.equal(first.ok, true);
  assert.equal(first.provider, 'ELEVENLABS_SCRIBE_LIVE_API');
  assert.equal(first.model, 'scribe_v2');
  assert.equal(first.cached, false);
  assert.equal(first.word_count, 40, 'solo cuentan las palabras, no los espacios');
  assert.equal(first.speech_rate_source, 'ELEVENLABS_SCRIBE');
  // 40 palabras entre el inicio de la primera (0 s) y el final de la última (11,94 s) -> 201 palabras/min
  assert.equal(first.speech_rate_wpm, 201);
  assert.equal(first.audio_duration_sec, 12.4);
  assert.equal(first.credits_estimated, 69); // 12,4 s x 330 créditos/min
  const req = calls('/v1/speech-to-text')[0];
  assert.match(req.raw, /name="model_id"\r\n\r\nscribe_v2/);
  assert.match(req.raw, /name="language_code"\r\n\r\nes/);
  assert.match(req.raw, /name="timestamps_granularity"\r\n\r\nword/);
  assert.match(req.raw, /audio-de-prueba-uno/);

  const second = await stt({ audioBase64: AUDIO, mimeType: 'audio/webm' });
  assert.equal(second.ok, true);
  assert.equal(second.cached, true);
  assert.equal(second.text, first.text);
  assert.equal(second.speech_rate_wpm, 201);
  assert.equal(calls('/v1/speech-to-text').length, 1, 'el mismo audio no se paga dos veces');
  const s = (await state()).elevenlabs;
  assert.equal(s.credits_used_estimated, 69);
  assert.equal(s.usage.stt_cache_hits, 1);
});

test('computeSpeechRate: sin marcas de tiempo o con una sola palabra no se inventa ninguna cifra', () => {
  assert.equal(el.computeSpeechRate([]).speech_rate_wpm, null);
  assert.equal(el.computeSpeechRate([{ text: 'hola', start: 0, end: 0.4, type: 'word' }]).speech_rate_wpm, null);
  assert.equal(el.computeSpeechRate([{ text: 'hola', type: 'word' }, { text: 'adiós', type: 'word' }]).speech_rate_wpm, null);
  assert.equal(el.computeSpeechRate(wordsOver(60, 150)).speech_rate_wpm, 150);
  assert.equal(el.computeSpeechRate([{ text: '(risas)', start: 0, end: 5, type: 'audio_event' }, { text: 'a', start: 5, end: 6, type: 'word' }]).speech_rate_wpm, null);
});

test('STT: tope de créditos, audio demasiado largo, error HTTP y falta de clave dan respaldo y no gastan', async () => {
  el.configure({ maxCredits: 50 });
  const budget = await stt({ audioBase64: AUDIO, mimeType: 'audio/webm', durationSec: 12 }); // 66 créditos > 50
  assert.equal(budget.ok, false);
  assert.equal(budget.code, 'ELEVENLABS_BUDGET_EXHAUSTED');
  assert.equal(budget.fallback, 'WEB_SPEECH_API');
  assert.equal(budget.text, '');
  assert.equal(calls('/v1/speech-to-text').length, 0);

  el.configure({ maxCredits: 3000 });
  const long = await stt({ audioBase64: AUDIO, mimeType: 'audio/mpeg', durationSec: 600 });
  assert.equal(long.code, 'AUDIO_TOO_LONG');
  assert.equal(calls('/v1/speech-to-text').length, 0);

  mock.sttStatus = 500;
  const http500 = await stt({ audioBase64: AUDIO, mimeType: 'audio/webm', durationSec: 5 });
  assert.equal(http500.ok, false);
  assert.match(http500.code, /HTTP_500/);
  assert.equal(http500.fallback, 'WEB_SPEECH_API');
  assert.equal((await state()).elevenlabs.credits_used_estimated, 0);

  ai.setRuntimeKeys({ elevenLabsKey: '' });
  const noKey = await stt({ audioBase64: AUDIO_2, mimeType: 'audio/webm' });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.provider, 'NO_ELEVENLABS_KEY');
  assert.equal(noKey.text, '');
  assert.match(noKey.reason, /clave de ElevenLabs/);
});

test('STT: interruptor cache_only sirve lo ya transcrito y no llama para audios nuevos', async () => {
  await stt({ audioBase64: AUDIO, mimeType: 'audio/webm', durationSec: 12 });
  el.configure({ stt: 'cache_only' });
  assert.equal((await stt({ audioBase64: AUDIO, mimeType: 'audio/webm' })).cached, true);
  const miss = await stt({ audioBase64: AUDIO_2, mimeType: 'audio/webm' });
  assert.equal(miss.ok, false);
  assert.equal(miss.code, 'CACHE_ONLY_MISS');
  assert.equal(calls('/v1/speech-to-text').length, 1);
});

test('El audio transcrito llega al motor con el ritmo MEDIDO (no simulado)', async () => {
  const t = await stt({ audioBase64: AUDIO, mimeType: 'audio/webm', durationSec: 12 });
  const res = await fetch(`${BASE}/api/analyze-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: t.text, speech_rate_wpm: t.speech_rate_wpm, speech_rate_source: t.speech_rate_source })
  });
  const fa = (await res.json()).step_2_verdict.fraud_analysis;
  assert.equal(fa.verdict, 'ESTAFA');
  assert.equal(fa.prosody_analysis.speech_rate_wpm, 201);
  assert.equal(fa.prosody_analysis.speech_rate_source, 'ELEVENLABS_SCRIBE');
  assert.match(fa.prosody_analysis.acoustic_pressure_level, /ALTA/);
});

// =============================================================================
// Registro de gasto, saldo, frases de la demo y archivos estáticos
// =============================================================================
test('Cada gasto real queda en el registro (ledger) y el saldo se consulta sin gastar', async () => {
  await tts('Frase para el registro.');
  await stt({ audioBase64: AUDIO, mimeType: 'audio/webm', durationSec: 12 });
  await tts('Frase para el registro.'); // caché: no se registra
  const totals = el.readLedgerTotals();
  assert.equal(totals.entries, 2);
  assert.equal(totals.credits, 12 + 69);
  const ledger = fs.readFileSync(path.join(CACHE_DIR, 'ledger.jsonl'), 'utf8');
  assert.ok(!ledger.includes('xi-clave-falsa-de-test'), 'la clave nunca se escribe en la caché');
  const sub = await el.getSubscription();
  assert.deepEqual({ ok: sub.ok, left: sub.credits_left, limit: sub.credits_limit }, { ok: true, left: 8800, limit: 10000 });
});

test('tts:precache recoge de la propia interfaz las frases de los Actos 1, 2 y 3 y de los ejemplos', async () => {
  const { collectDemoPhrases } = require('../scripts/lib/demoPhrases');
  const phrases = await collectDemoPhrases();
  const texts = phrases.map((p) => p.text);
  assert.ok(phrases.length >= 6, `solo ${phrases.length} frases`);
  assert.ok(texts.some((t) => /^Cuelga ahora mismo, Carmen\..*Quantum Ibérica Capital.*9000 euros/.test(t)), 'Acto 1');
  assert.ok(texts.some((t) => /^Atención, Carmen: en este producto pagas un 1,8% al año/.test(t)), 'Acto 2');
  assert.ok(texts.some((t) => /^Modo Baja Visión activado/.test(t)), 'Acto 3 (baja visión)');
  assert.ok(texts.includes('Modo estándar de voz y texto simultáneos activado.'), 'Acto 3 (estándar)');
  assert.ok(texts.some((t) => /MyInvestor Soporte Seguridad/.test(t)), 'ejemplo SMS');
  assert.ok(texts.some((t) => /Horizon Gold/.test(t)), 'ejemplo tasa de desbloqueo');
  assert.equal(new Set(texts).size, texts.length, 'sin frases repetidas');
  assert.equal(mock.requests.length, 0, 'recoger las frases no llama a ElevenLabs');
  // Lo que la interfaz pida a /api/tts con esas frases coincide con lo precacheado
  await el.synthesizeSpeech(texts[0], { model: el.TTS_MODEL_PRECACHE });
  assert.equal((await tts(texts[0])).headers.get('x-centinela-tts-source'), 'CACHE');
});

test('Los .mp3 de public/samples se sirven como audio', async () => {
  const dir = path.join(__dirname, '..', 'public', 'samples');
  const tmp = path.join(dir, `__test_${process.pid}.mp3`);
  fs.writeFileSync(tmp, 'ID3');
  try {
    const res = await fetch(`${BASE}/samples/${path.basename(tmp)}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  } finally {
    fs.unlinkSync(tmp);
  }
});
