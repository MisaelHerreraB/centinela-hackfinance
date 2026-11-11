/**
 * ElevenLabs: voz (Text-to-Speech) y transcripción (Speech-to-Text, Scribe) con CONTROL DE GASTO.
 *
 * Verificado en la documentación oficial de ElevenLabs el 11-nov-2026:
 *  - TTS:  POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128  (JSON: text, model_id, language_code, voice_settings)
 *          eleven_multilingual_v2 = 1 crédito por carácter · eleven_flash_v2_5 = 0,5 créditos por carácter (API).
 *          Los modelos Turbo están desaconsejados en favor de Flash. `language_code` solo lo admiten Flash/Turbo v2.5.
 *  - STT:  POST /v1/speech-to-text  (multipart: file, model_id=scribe_v2, language_code, timestamps_granularity=word)
 *          Respuesta: text, words[{text,start,end,type}], audio_duration_secs. Coste: unos 330 créditos por minuto
 *          de audio (cifra de la página de precios; la referencia de la API no la da, por eso es configurable).
 *  - Saldo: GET /v1/user/subscription -> character_count / character_limit.
 *
 * Tres protecciones:
 *  1. Tope de créditos estimados por arranque (ELEVENLABS_MAX_CREDITS, 3000 por defecto).
 *  2. Caché en disco (.cache/elevenlabs/): repetir una frase o un audio no gasta nada.
 *  3. Interruptores ELEVENLABS_TTS / ELEVENLABS_STT = on | cache_only | off.
 * La clave nunca se imprime ni se guarda en la caché.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // "Sarah", voz de stock de ElevenLabs
const STT_MODEL = process.env.ELEVENLABS_STT_MODEL || 'scribe_v2';
// Respuestas dinámicas: el modelo barato y rápido. Frases fijas de la demo (precacheadas): el de calidad.
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || 'eleven_flash_v2_5';
const TTS_MODEL_PRECACHE = process.env.ELEVENLABS_TTS_MODEL_PRECACHE || 'eleven_multilingual_v2';
const CACHE_DIR = process.env.ELEVENLABS_CACHE_DIR || path.join(__dirname, '..', '..', '.cache', 'elevenlabs');
const STT_CREDITS_PER_MIN = Number(process.env.ELEVENLABS_STT_CREDITS_PER_MIN) > 0 ? Number(process.env.ELEVENLABS_STT_CREDITS_PER_MIN) : 330;
const STT_MAX_SECONDS = Number(process.env.ELEVENLABS_STT_MAX_SECONDS) > 0 ? Number(process.env.ELEVENLABS_STT_MAX_SECONDS) : 120;
const TTS_MAX_CHARS = 1200;
const TTS_CREDITS_PER_CHAR = {
  eleven_multilingual_v2: 1,
  eleven_flash_v2_5: 0.5,
  eleven_flash_v2: 0.5,
  eleven_turbo_v2_5: 0.5,
  eleven_turbo_v2: 0.5
};

function parseMode(value) {
  const v = String(value || 'on').trim().toLowerCase();
  return ['on', 'cache_only', 'off'].includes(v) ? v : 'on';
}

let apiKey = process.env.ELEVENLABS_API_KEY || '';
let ttsMode = parseMode(process.env.ELEVENLABS_TTS);
let sttMode = parseMode(process.env.ELEVENLABS_STT);
let maxCredits = process.env.ELEVENLABS_MAX_CREDITS !== undefined && process.env.ELEVENLABS_MAX_CREDITS !== '' && Number.isFinite(Number(process.env.ELEVENLABS_MAX_CREDITS))
  ? Math.max(0, Number(process.env.ELEVENLABS_MAX_CREDITS))
  : 3000;
let lastError = null;
const usage = { credits: 0, tts_requests: 0, tts_chars: 0, stt_requests: 0, stt_seconds: 0, tts_cache_hits: 0, stt_cache_hits: 0 };

function setApiKey(key) {
  if (typeof key === 'string') apiKey = key.trim();
}
// Para tests y scripts: cambia ajustes y pone el contador a cero.
function configure({ tts, stt, maxCredits: max, resetUsage = false } = {}) {
  if (tts !== undefined) ttsMode = parseMode(tts);
  if (stt !== undefined) sttMode = parseMode(stt);
  if (max !== undefined) maxCredits = Math.max(0, Number(max) || 0);
  if (resetUsage) {
    for (const k of Object.keys(usage)) usage[k] = 0;
    lastError = null;
  }
}

const round1 = (n) => Math.round(n * 10) / 10;
function ttsCreditsFor(text, model) {
  const rate = TTS_CREDITS_PER_CHAR[model] !== undefined ? TTS_CREDITS_PER_CHAR[model] : 1;
  return Math.ceil(String(text).length * rate);
}
function sttCreditsFor(seconds) {
  return Math.ceil((Math.max(0, Number(seconds) || 0) * STT_CREDITS_PER_MIN) / 60);
}
function creditsLeft() {
  return Math.max(0, maxCredits - usage.credits);
}

// ---------------------------------------------------------------- caché en disco
function sha256(...parts) {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(p).update('\u0000');
  return h.digest('hex');
}
function normalizeTtsText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}
function ttsCachePath(text, voiceId, model) {
  return path.join(CACHE_DIR, 'tts', `${sha256(voiceId, model, normalizeTtsText(text))}.mp3`);
}
function sttCachePath(buffer, model) {
  return path.join(CACHE_DIR, 'stt', `${sha256(model, 'es', buffer)}.json`);
}
function readIfExists(file) {
  try {
    return fs.readFileSync(file);
  } catch (e) {
    return null;
  }
}
function writeCache(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  } catch (e) {
    console.warn(`[Centinela] No se pudo escribir la caché de ElevenLabs: ${e.message}`);
  }
}
function countFiles(dir, ext) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).length;
  } catch (e) {
    return 0;
  }
}
// Registro de cada gasto real (para saber cuánto se ha gastado entre el servidor y los scripts).
function appendLedger(entry) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.appendFileSync(path.join(CACHE_DIR, 'ledger.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
  } catch (e) {
    /* el registro es informativo: si falla no se interrumpe nada */
  }
}
function readLedgerTotals() {
  const totals = { entries: 0, credits: 0, tts_chars: 0, stt_seconds: 0 };
  const raw = readIfExists(path.join(CACHE_DIR, 'ledger.jsonl'));
  if (!raw) return totals;
  for (const line of raw.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      totals.entries += 1;
      totals.credits += Number(e.credits) || 0;
      totals.tts_chars += Number(e.chars) || 0;
      totals.stt_seconds += Number(e.seconds) || 0;
    } catch (err) {
      /* línea ilegible: se ignora */
    }
  }
  totals.stt_seconds = round1(totals.stt_seconds);
  return totals;
}

function getStatus() {
  return {
    configured: Boolean(apiKey),
    voice_id: VOICE_ID,
    tts_mode: ttsMode,
    stt_mode: sttMode,
    tts_model: TTS_MODEL,
    tts_model_precache: TTS_MODEL_PRECACHE,
    stt_model: STT_MODEL,
    credits_used_estimated: usage.credits,
    credits_max: maxCredits,
    budget_exhausted: usage.credits >= maxCredits,
    usage: { ...usage, stt_seconds: round1(usage.stt_seconds) },
    cache: { tts_files: countFiles(path.join(CACHE_DIR, 'tts'), '.mp3'), stt_files: countFiles(path.join(CACHE_DIR, 'stt'), '.json') },
    last_error: lastError
  };
}

async function apiFetch(pathname, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}${pathname}`, { ...options, headers: { 'xi-api-key': apiKey, ...(options.headers || {}) }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
function failure(reason, extra = {}) {
  if (!['NO_ELEVENLABS_KEY', 'TTS_OFF', 'STT_OFF', 'CACHE_ONLY_MISS', 'EMPTY_TEXT', 'NO_AUDIO'].includes(reason)) lastError = reason;
  return { ok: false, reason, ...extra };
}
const errorReason = (err) => (err && err.name === 'AbortError' ? 'TIMEOUT' : `NETWORK_ERROR ${err && err.message ? err.message : ''}`.trim());

// ---------------------------------------------------------------- voz (TTS)
/**
 * Devuelve audio MP3 de `text`. Orden: caché (modelo de calidad y luego el dinámico) -> API si el interruptor
 * está en "on", hay clave y queda presupuesto. Si no, { ok:false, reason } y el cliente usa la voz del navegador.
 * `cacheOnly` fuerza no llamar a la API en esta petición. `model` elige el modelo si hay que generar.
 */
async function synthesizeSpeech(text, { model = TTS_MODEL, voiceId = VOICE_ID, voiceSettings = null, cacheOnly = false } = {}) {
  const clean = normalizeTtsText(text);
  if (!clean) return failure('EMPTY_TEXT');
  if (ttsMode === 'off') return failure('TTS_OFF');

  // Sin ajustes de voz especiales se aprovecha lo precacheado con cualquiera de los dos modelos.
  const candidates = voiceSettings ? [model] : [...new Set([TTS_MODEL_PRECACHE, model, TTS_MODEL])];
  const settingsKey = voiceSettings ? JSON.stringify(voiceSettings) : '';
  for (const m of candidates) {
    const cached = readIfExists(ttsCachePath(clean + settingsKey, voiceId, m));
    if (cached && cached.length > 0) {
      usage.tts_cache_hits += 1;
      return { ok: true, audioBuffer: cached, contentType: 'audio/mpeg', source: 'CACHE', model: m, chars: clean.length, credits_estimated: 0 };
    }
  }
  if (ttsMode === 'cache_only' || cacheOnly) return failure('CACHE_ONLY_MISS');
  if (!apiKey) return failure('NO_ELEVENLABS_KEY');
  if (clean.length > TTS_MAX_CHARS) return failure('TEXT_TOO_LONG', { chars: clean.length, max_chars: TTS_MAX_CHARS });
  const credits = ttsCreditsFor(clean, model);
  if (usage.credits + credits > maxCredits) return failure('ELEVENLABS_BUDGET_EXHAUSTED', { credits_needed: credits, credits_left: creditsLeft() });

  const t0 = Date.now();
  try {
    const body = {
      text: clean,
      model_id: model,
      voice_settings: voiceSettings || { stability: 0.65, similarity_boost: 0.8 }
    };
    // Forzar español evita lecturas "a la inglesa" de cifras y siglas; multilingual_v2 no admite el parámetro.
    if (/flash_v2_5|turbo_v2_5/.test(model)) body.language_code = 'es';
    const response = await apiFetch(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return failure(`HTTP_${response.status} ${errBody.slice(0, 200)}`.trim());
    }
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (audioBuffer.length === 0) return failure('EMPTY_AUDIO');
    usage.credits += credits;
    usage.tts_requests += 1;
    usage.tts_chars += clean.length;
    writeCache(ttsCachePath(clean + settingsKey, voiceId, model), audioBuffer);
    appendLedger({ kind: 'tts', model, voice_id: voiceId, chars: clean.length, credits });
    lastError = null;
    return { ok: true, audioBuffer, contentType: 'audio/mpeg', source: 'LIVE', model, chars: clean.length, credits_estimated: credits, latency_ms: Date.now() - t0 };
  } catch (err) {
    return failure(errorReason(err));
  }
}

// ---------------------------------------------------------------- transcripción (STT, Scribe)
// Palabras por minuto con las marcas de tiempo reales de Scribe (solo palabras, sin espacios ni eventos de audio).
function computeSpeechRate(words) {
  const spoken = (Array.isArray(words) ? words : []).filter(
    (w) => w && (w.type ? w.type === 'word' : Boolean(w.text)) && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end))
  );
  if (spoken.length < 2) return { word_count: spoken.length, speech_seconds: null, speech_rate_wpm: null };
  const seconds = Number(spoken[spoken.length - 1].end) - Number(spoken[0].start);
  if (!(seconds > 0)) return { word_count: spoken.length, speech_seconds: null, speech_rate_wpm: null };
  // Por debajo de 3 s la cifra no es fiable: se usa ese mínimo como denominador (igual que antes).
  return { word_count: spoken.length, speech_seconds: round1(seconds), speech_rate_wpm: Math.round(spoken.length / (Math.max(3, seconds) / 60)) };
}

function fileNameFor(mimeType = '') {
  const m = String(mimeType).toLowerCase();
  const ext = m.includes('mpeg') || m.includes('mp3') ? 'mp3' : m.includes('mp4') || m.includes('m4a') || m.includes('aac') ? 'm4a' : m.includes('wav') ? 'wav' : m.includes('ogg') ? 'ogg' : 'webm';
  return `audio.${ext}`;
}

/**
 * Transcribe un audio con Scribe. `durationSec` es la duración que conoce el cliente (grabación del micrófono
 * o metadatos del archivo): sirve para comprobar el presupuesto ANTES de gastar.
 */
async function transcribeAudio({ audioBase64, mimeType = 'audio/webm', durationSec = null } = {}) {
  // En la transcripción, `reason` es el mensaje para la persona (lo muestra la interfaz) y `code` el motivo técnico.
  const fallback = (code, message, extra = {}) => {
    failure(code);
    return { ok: false, provider: code.split(' ')[0], code, model: STT_MODEL, text: '', reason: message, fallback: 'WEB_SPEECH_API', ...extra };
  };
  if (!audioBase64) return fallback('NO_AUDIO', 'No se ha recibido audio.');
  // La cabecera puede llevar parámetros ("data:audio/webm;codecs=opus;base64,..."): se quita hasta la coma.
  const buffer = Buffer.from(String(audioBase64).replace(/^data:[^,]*,/, ''), 'base64');
  if (buffer.length === 0) return fallback('NO_AUDIO', 'No se ha recibido audio.');
  if (sttMode === 'off') return fallback('STT_OFF', 'La transcripción con ElevenLabs está desactivada (ELEVENLABS_STT=off).');

  const cacheFile = sttCachePath(buffer, STT_MODEL);
  const cachedRaw = readIfExists(cacheFile);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw.toString('utf8'));
      usage.stt_cache_hits += 1;
      return { ...cached, ok: true, cached: true, credits_estimated: 0, latency_ms: 0 };
    } catch (e) {
      /* caché dañada: se vuelve a transcribir */
    }
  }
  if (sttMode === 'cache_only') return fallback('CACHE_ONLY_MISS', 'Este audio no está en la caché y la transcripción está en modo solo caché (ELEVENLABS_STT=cache_only).');
  if (!apiKey) return fallback('NO_ELEVENLABS_KEY', 'Para transcribir audios hace falta la clave de ElevenLabs (botón API Keys).');

  const hinted = Number(durationSec) > 0 && Number.isFinite(Number(durationSec)) ? Number(durationSec) : null;
  if (hinted !== null && hinted > STT_MAX_SECONDS) {
    return fallback('AUDIO_TOO_LONG', `El audio dura ${Math.round(hinted)} s y el máximo es ${STT_MAX_SECONDS} s (para no gastar créditos de más).`);
  }
  // Sin duración conocida se supone un audio comprimido a 32 kbps (estimación prudente: tira por lo alto).
  const estimatedSeconds = hinted !== null ? hinted : Math.max(1, buffer.length / 4000);
  const estimate = sttCreditsFor(estimatedSeconds);
  if (usage.credits >= maxCredits || usage.credits + estimate > maxCredits) {
    return fallback('ELEVENLABS_BUDGET_EXHAUSTED', 'Límite de créditos de ElevenLabs alcanzado en esta sesión.', { credits_needed: estimate, credits_left: creditsLeft() });
  }

  const t0 = Date.now();
  try {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), fileNameFor(mimeType));
    formData.append('model_id', STT_MODEL);
    formData.append('language_code', 'es');
    formData.append('timestamps_granularity', 'word');
    formData.append('tag_audio_events', 'false');
    const response = await apiFetch('/v1/speech-to-text', { method: 'POST', body: formData }, 60000);
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return fallback(`HTTP_${response.status} ${errBody.slice(0, 200)}`.trim(), `No se pudo transcribir el audio (HTTP ${response.status}).`);
    }
    const data = await response.json();
    const rate = computeSpeechRate(data.words);
    const words = Array.isArray(data.words) ? data.words : [];
    const lastEnd = words.reduce((max, w) => (Number.isFinite(Number(w && w.end)) ? Math.max(max, Number(w.end)) : max), 0);
    const audioSeconds = Number(data.audio_duration_secs) > 0 ? Number(data.audio_duration_secs) : lastEnd > 0 ? lastEnd : estimatedSeconds;
    const credits = sttCreditsFor(audioSeconds);
    usage.credits += credits;
    usage.stt_requests += 1;
    usage.stt_seconds += audioSeconds;
    const result = {
      provider: 'ELEVENLABS_SCRIBE_LIVE_API',
      model: STT_MODEL,
      text: String(data.text || '').trim(),
      language_code: data.language_code || null,
      word_count: rate.word_count,
      speech_seconds: rate.speech_seconds,
      audio_duration_sec: round1(audioSeconds),
      speech_rate_wpm: rate.speech_rate_wpm,
      speech_rate_source: rate.speech_rate_wpm ? 'ELEVENLABS_SCRIBE' : null
    };
    writeCache(cacheFile, JSON.stringify(result));
    appendLedger({ kind: 'stt', model: STT_MODEL, seconds: round1(audioSeconds), credits });
    lastError = null;
    return { ...result, ok: true, cached: false, credits_estimated: credits, latency_ms: Date.now() - t0 };
  } catch (err) {
    return fallback(errorReason(err), 'No se pudo transcribir el audio (fallo de red o tiempo agotado).');
  }
}

// ---------------------------------------------------------------- consultas gratuitas (no gastan créditos)
async function getSubscription() {
  if (!apiKey) return { ok: false, reason: 'NO_ELEVENLABS_KEY' };
  try {
    const response = await apiFetch('/v1/user/subscription', { method: 'GET' }, 15000);
    if (!response.ok) return { ok: false, reason: `HTTP_${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`.trim() };
    const data = await response.json();
    const used = Number(data.character_count);
    const limit = Number(data.character_limit);
    return { ok: true, tier: data.tier || null, credits_used: used, credits_limit: limit, credits_left: Number.isFinite(limit - used) ? limit - used : null };
  } catch (err) {
    return { ok: false, reason: errorReason(err) };
  }
}
async function getVoice(voiceId = VOICE_ID) {
  if (!apiKey) return { ok: false, reason: 'NO_ELEVENLABS_KEY' };
  try {
    const response = await apiFetch(`/v1/voices/${encodeURIComponent(voiceId)}`, { method: 'GET' }, 15000);
    if (!response.ok) return { ok: false, reason: `HTTP_${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`.trim() };
    const data = await response.json();
    return { ok: true, voice_id: data.voice_id || voiceId, name: data.name || null, category: data.category || null, labels: data.labels || null };
  } catch (err) {
    return { ok: false, reason: errorReason(err) };
  }
}

module.exports = {
  VOICE_ID,
  STT_MODEL,
  TTS_MODEL,
  TTS_MODEL_PRECACHE,
  CACHE_DIR,
  STT_CREDITS_PER_MIN,
  setApiKey,
  configure,
  getStatus,
  ttsCreditsFor,
  sttCreditsFor,
  creditsLeft,
  normalizeTtsText,
  computeSpeechRate,
  synthesizeSpeech,
  transcribeAudio,
  getSubscription,
  getVoice,
  readLedgerTotals
};
