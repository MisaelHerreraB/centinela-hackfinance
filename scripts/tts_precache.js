#!/usr/bin/env node
/**
 * Precachea con ElevenLabs las frases habladas de los botones de la demo (Actos 1, 2 y 3 y los ejemplos).
 * Uso:
 *   npm run tts:precache                 frases de los 3 actos + los 2 ejemplos de estafa
 *   npm run tts:precache -- --all        además, el resto de documentos del selector
 *   npm run tts:precache -- --list       solo enseña las frases y lo que costarían (no gasta nada)
 *   npm run tts:precache -- --model=eleven_flash_v2_5     modelo barato (la mitad de créditos)
 *   npm run tts:precache -- --max-credits=4000            sube el tope solo para esta ejecución
 *
 * Antes de llamar dice cuántos caracteres y créditos va a gastar y pide confirmación.
 * Lo ya precacheado no se vuelve a pagar. El audio queda en .cache/elevenlabs/ (fuera de git):
 * después se puede ensayar con ELEVENLABS_TTS=cache_only sin gastar nada.
 */
require('../src/config/loadEnv').loadEnv();

const { collectDemoPhrases } = require('./lib/demoPhrases');
const { confirmSpend, hasFlag, flagValue } = require('./lib/confirm');
const el = require('../src/services/elevenLabsService');

(async () => {
  console.log('\n=== Centinela · precaché de voz (ElevenLabs) ===\n');
  const model = flagValue('model', el.TTS_MODEL_PRECACHE);
  const phrases = await collectDemoPhrases({ all: hasFlag('all') });

  // ¿Qué falta por generar? Lo que ya está en la caché no cuesta nada.
  el.configure({ tts: 'cache_only' });
  const pending = [];
  for (const p of phrases) {
    const cached = await el.synthesizeSpeech(p.text, { model });
    const credits = cached.ok ? 0 : el.ttsCreditsFor(p.text, model);
    console.log(`${cached.ok ? '✔ en caché ' : '· pendiente'} ${String(p.text.length).padStart(4)} car. ${String(credits).padStart(5)} créd.  ${p.label}`);
    if (!cached.ok) pending.push({ ...p, credits });
  }
  const chars = pending.reduce((a, p) => a + p.text.length, 0);
  const credits = pending.reduce((a, p) => a + p.credits, 0);
  console.log(`\nVoz: ${el.VOICE_ID} · modelo: ${model}`);
  console.log(`Pendiente: ${pending.length} frase(s), ${chars} caracteres, ~${credits} créditos.`);

  if (hasFlag('list') || pending.length === 0) {
    console.log(pending.length === 0 ? '\nTodo está ya en la caché. No se gasta nada.\n' : '\n(--list: no se ha generado nada)\n');
    process.exit(0);
  }
  if (!el.getStatus().configured) {
    console.log('\nFalta ELEVENLABS_API_KEY en .env. No se ha hecho ninguna llamada.\n');
    process.exit(0);
  }
  const maxFlag = flagValue('max-credits');
  if (maxFlag) el.configure({ maxCredits: Number(maxFlag) });
  const cap = el.getStatus().credits_max;
  if (credits > cap) {
    console.log(`\nEsto supera el tope de ${cap} créditos (ELEVENLABS_MAX_CREDITS). Si quieres seguir: npm run tts:precache -- --max-credits=${credits}\n`);
    process.exit(1);
  }
  const sub = await el.getSubscription();
  if (sub.ok) console.log(`Saldo de la cuenta: ${sub.credits_left} créditos de ${sub.credits_limit} (plan ${sub.tier}).`);
  else console.log(/missing the permission/.test(sub.reason) ? 'Saldo: no se puede consultar con esta clave (le falta el permiso "user_read").' : `No he podido consultar el saldo (${sub.reason}).`);

  if (!(await confirmSpend(`\n¿Generar ${pending.length} frase(s) gastando ~${credits} créditos de ElevenLabs?`))) {
    console.log('Cancelado. No se ha gastado nada.\n');
    process.exit(0);
  }

  el.configure({ tts: 'on', resetUsage: true });
  let failed = 0;
  for (const p of pending) {
    const res = await el.synthesizeSpeech(p.text, { model });
    if (res.ok) console.log(`✅ ${p.label} · ${res.latency_ms} ms · ${res.credits_estimated} créditos`);
    else {
      failed += 1;
      console.log(`❌ ${p.label} · ${res.reason}`);
    }
  }
  const status = el.getStatus();
  console.log(`\nGastado en esta ejecución: ~${status.credits_used_estimated} créditos (${status.usage.tts_chars} caracteres).`);
  const after = await el.getSubscription();
  if (after.ok) console.log(`Saldo de la cuenta ahora: ${after.credits_left} créditos de ${after.credits_limit}.`);
  console.log(`Audios en caché: ${status.cache.tts_files}. Para ensayar sin gastar: ELEVENLABS_TTS=cache_only en .env.\n`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error(`\n❌ Error inesperado: ${err.message}\n`);
  process.exit(1);
});
