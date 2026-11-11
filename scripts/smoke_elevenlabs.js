#!/usr/bin/env node
/**
 * Prueba real mínima de ElevenLabs (pide confirmación antes de gastar).
 * Uso:  npm run smoke:elevenlabs
 *   1. Consulta el saldo y la voz de Centinela (gratis).
 *   2. Voz: una frase corta con el modelo dinámico (unos 25 créditos la primera vez; después sale de la caché).
 *   3. Transcripción: el audio de ejemplo public/samples/llamada_falso_broker.mp3 con Scribe (unos 110 créditos
 *      la primera vez; después sale de la caché) y el ritmo de habla medido con sus marcas de tiempo.
 *   4. Latencias, créditos estimados y saldo real después.
 */
require('../src/config/loadEnv').loadEnv();

const fs = require('fs');
const path = require('path');
const { confirmSpend } = require('./lib/confirm');
const el = require('../src/services/elevenLabsService');
const { analyzeFraudRisk } = require('../src/engine/fraudEngine');

const SAMPLE = path.join(__dirname, '..', 'public', 'samples', 'llamada_falso_broker.mp3');
const PHRASE = 'Hola, soy Centinela. La voz funciona correctamente.';
const line = (label, value) => console.log(`${String(label).padEnd(26)} ${value}`);

(async () => {
  console.log('\n=== Centinela · prueba rápida de ElevenLabs ===\n');
  const status = el.getStatus();
  if (!status.configured) {
    console.log('No hay clave de ElevenLabs. Pon ELEVENLABS_API_KEY en el archivo .env y vuelve a ejecutar:');
    console.log('  npm run smoke:elevenlabs\n');
    console.log('Sin clave la app usa la voz y el reconocimiento del navegador. No se ha hecho ninguna llamada.\n');
    return;
  }
  let failures = 0;
  line('Voz de Centinela:', status.voice_id);
  line('Modelos:', `voz dinámica ${status.tts_model} · voz precacheada ${status.tts_model_precache} · transcripción ${status.stt_model}`);
  line('Tope por arranque:', `${status.credits_max} créditos estimados`);

  const before = await el.getSubscription();
  if (before.ok) line('Saldo de la cuenta:', `${before.credits_left} créditos de ${before.credits_limit} (plan ${before.tier})`);
  else {
    failures += 1;
    line('Saldo de la cuenta:', `FALLO · ${before.reason}`);
  }
  const voice = await el.getVoice();
  if (voice.ok) line('Voz disponible:', `sí · ${voice.name} (${voice.category || 'sin categoría'})`);
  else {
    failures += 1;
    line('Voz disponible:', `FALLO · ${voice.reason}`);
  }

  const hasSample = fs.existsSync(SAMPLE);
  const sampleBytes = hasSample ? fs.readFileSync(SAMPLE) : null;
  // MP3 a 128 kbps: 16.000 bytes por segundo
  const sampleSeconds = hasSample ? sampleBytes.length / 16000 : 0;
  const estimate = el.ttsCreditsFor(PHRASE, el.TTS_MODEL) + (hasSample ? el.sttCreditsFor(sampleSeconds) : 0);
  if (!hasSample) console.log('\nAviso: no existe public/samples/llamada_falso_broker.mp3 (se genera con "npm run tts:sample"). Solo se probará la voz.');
  if (!(await confirmSpend(`\n¿Hacer la prueba real gastando como mucho ~${estimate} créditos (menos si ya está en la caché)?`))) {
    console.log('Cancelado. No se ha gastado nada.\n');
    return;
  }
  el.configure({ tts: 'on', stt: 'on', resetUsage: true });

  console.log('\n1) Voz (Text-to-Speech)');
  const t0 = Date.now();
  const tts = await el.synthesizeSpeech(PHRASE);
  if (tts.ok) line('   Resultado:', `OK · ${tts.audioBuffer.length} bytes · modelo ${tts.model} · ${tts.source === 'CACHE' ? 'de la caché (0 créditos)' : `${Date.now() - t0} ms · ~${tts.credits_estimated} créditos`}`);
  else {
    failures += 1;
    line('   Resultado:', `FALLO · ${tts.reason}`);
  }

  if (hasSample) {
    console.log('\n2) Transcripción (Speech-to-Text, Scribe) del audio de ejemplo');
    const t1 = Date.now();
    const stt = await el.transcribeAudio({ audioBase64: sampleBytes.toString('base64'), mimeType: 'audio/mpeg', durationSec: sampleSeconds });
    if (stt.ok) {
      line('   Resultado:', `OK · modelo ${stt.model} · ${stt.cached ? 'de la caché (0 créditos)' : `${Date.now() - t1} ms · ~${stt.credits_estimated} créditos`}`);
      line('   Duración del audio:', `${stt.audio_duration_sec} s · ${stt.word_count} palabras`);
      line('   Ritmo de habla:', stt.speech_rate_wpm ? `${stt.speech_rate_wpm} palabras/min (medido con las marcas de tiempo de Scribe)` : 'no medido');
      line('   Texto:', `"${stt.text}"`);
      const verdict = analyzeFraudRisk({ text: stt.text, speech_rate_wpm: stt.speech_rate_wpm, speech_rate_source: stt.speech_rate_source });
      line('   Veredicto (solo reglas):', `${verdict.verdict} · riesgo ${verdict.risk_score} · presión acústica: ${verdict.prosody_analysis.acoustic_pressure_level}`);
      if (verdict.verdict !== 'ESTAFA') failures += 1;
    } else {
      failures += 1;
      line('   Resultado:', `FALLO · ${stt.code || ''} ${stt.reason}`);
    }
  }

  console.log('\n3) Gasto');
  const end = el.getStatus();
  line('   Estimado esta prueba:', `~${end.credits_used_estimated} créditos (${end.usage.tts_chars} caracteres de voz, ${end.usage.stt_seconds} s de audio)`);
  const ledger = el.readLedgerTotals();
  line('   Estimado acumulado:', `~${ledger.credits} créditos en ${ledger.entries} llamadas de pago registradas en .cache/elevenlabs/ledger.jsonl`);
  const after = await el.getSubscription();
  if (after.ok) {
    const real = before.ok ? after.credits_used - before.credits_used : null;
    line('   Saldo de la cuenta:', `${after.credits_left} créditos de ${after.credits_limit}${real !== null ? ` (gasto real de esta prueba según ElevenLabs: ${real})` : ''}`);
  }
  console.log(failures === 0 ? '\n✅ smoke:elevenlabs en verde\n' : `\n❌ smoke:elevenlabs con ${failures} fallo(s)\n`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((err) => {
  console.error(`\n❌ Error inesperado: ${err.message}\n`);
  process.exitCode = 1;
});
