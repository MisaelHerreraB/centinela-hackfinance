#!/usr/bin/env node
/**
 * Genera UNA VEZ el audio de ejemplo de la llamada del falso bróker (guion del Acto 1, unos 20 s) con una voz
 * de stock de ElevenLabs DISTINTA de la de Centinela, y lo guarda en public/samples/llamada_falso_broker.mp3.
 * Con ese archivo la demo de "subir audio" usa una transcripción real de Scribe y un ritmo de habla medido.
 * Uso:  npm run tts:sample        (dice lo que cuesta y pide confirmación)
 *
 * La voz es sintética y de la biblioteca estándar: nunca una voz clonada de una persona real.
 */
require('../src/config/loadEnv').loadEnv();

const fs = require('fs');
const path = require('path');
const { confirmSpend, hasFlag } = require('./lib/confirm');
const el = require('../src/services/elevenLabsService');

// Voz de stock "George" (masculina). Se puede cambiar con ELEVENLABS_SAMPLE_VOICE_ID.
const SAMPLE_VOICE_ID = process.env.ELEVENLABS_SAMPLE_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const MODEL = 'eleven_multilingual_v2';
const OUT = path.join(__dirname, '..', 'public', 'samples', 'llamada_falso_broker.mp3');
// Guion del Acto 1. El IBAN no se lee en voz alta (alargaría el audio y nadie lo dicta así por teléfono).
const SCRIPT =
  'Hola Carmen, te llamo de Quantum Ibérica Capital. Te activamos hoy el Bono VIP con un 12% anual garantizado sin ningún riesgo. ' +
  'Quedan las últimas plazas solo por hoy, en los próximos 15 minutos. Transfiere ahora mismo 9.000 euros a la cuenta que te acabo de enviar por mensaje.';

(async () => {
  console.log('\n=== Centinela · audio de ejemplo de la llamada del falso bróker ===\n');
  if (fs.existsSync(OUT) && !hasFlag('force')) {
    console.log(`Ya existe ${path.relative(process.cwd(), OUT)}. No se gasta nada. (Para regenerarlo: npm run tts:sample -- --force)\n`);
    return;
  }
  if (!el.getStatus().configured) {
    console.log('Falta ELEVENLABS_API_KEY en .env. No se ha hecho ninguna llamada.\n');
    return;
  }
  const credits = el.ttsCreditsFor(SCRIPT, MODEL);
  console.log(`Guion (${SCRIPT.length} caracteres):\n  "${SCRIPT}"\n`);
  const voice = await el.getVoice(SAMPLE_VOICE_ID); // consulta gratuita
  if (voice.ok) console.log(`Voz: ${voice.name} (${voice.category || 'sin categoría'}) · ${SAMPLE_VOICE_ID}`);
  else console.log(`Aviso: no he podido comprobar la voz ${SAMPLE_VOICE_ID} (${voice.reason}). Si falla, pon otra voz de stock en ELEVENLABS_SAMPLE_VOICE_ID.`);
  if (voice.ok && voice.category && !['premade', 'default'].includes(String(voice.category).toLowerCase())) {
    console.log(`La voz ${SAMPLE_VOICE_ID} es de tipo "${voice.category}", no de stock. Usa una voz de la biblioteca estándar. No se ha gastado nada.\n`);
    process.exitCode = 1;
    return;
  }
  const sub = await el.getSubscription();
  if (sub.ok) console.log(`Saldo de la cuenta: ${sub.credits_left} créditos de ${sub.credits_limit}.`);

  if (!(await confirmSpend(`\n¿Generar el audio gastando ~${credits} créditos de ElevenLabs (modelo ${MODEL})?`))) {
    console.log('Cancelado. No se ha gastado nada.\n');
    return;
  }
  el.configure({ tts: 'on', resetUsage: true });
  // Algo más rápido de lo normal, como un vendedor con prisa. Si la API no admite "speed", se repite sin él.
  let res = await el.synthesizeSpeech(SCRIPT, { model: MODEL, voiceId: SAMPLE_VOICE_ID, voiceSettings: { stability: 0.45, similarity_boost: 0.8, speed: 1.15 } });
  if (!res.ok && /^HTTP_4(00|22)/.test(res.reason) && /speed/i.test(res.reason)) {
    console.log('La API no ha aceptado el ajuste de velocidad; se genera a velocidad normal.');
    res = await el.synthesizeSpeech(SCRIPT, { model: MODEL, voiceId: SAMPLE_VOICE_ID, voiceSettings: { stability: 0.45, similarity_boost: 0.8 } });
  }
  if (!res.ok) {
    console.log(`❌ No se ha podido generar: ${res.reason}\n`);
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, res.audioBuffer);
  console.log(`✅ Guardado en ${path.relative(process.cwd(), OUT)} (${Math.round(res.audioBuffer.length / 1024)} KB) · ${res.latency_ms} ms · ~${res.credits_estimated} créditos.`);
  console.log('Escúchalo antes de usarlo en la demo. Siguiente paso: npm run smoke:elevenlabs (lo transcribe y mide el ritmo).\n');
})().catch((err) => {
  console.error(`\n❌ Error inesperado: ${err.message}\n`);
  process.exitCode = 1;
});
