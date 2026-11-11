#!/usr/bin/env bash
# Pasos reales de ElevenLabs, en orden y guardando la salida en fase2_logs/ (la clave nunca se imprime).
# Cada paso dice lo que va a gastar y PIDE CONFIRMACIÓN (s/N) antes de llamar. Uso:  bash scripts/medir_elevenlabs.sh
#   1) npm run tts:sample        -> public/samples/llamada_falso_broker.mp3   (~280 créditos)
#   2) npm run smoke:elevenlabs  -> voz + transcripción del audio de ejemplo  (~140 créditos)
#   3) npm run tts:precache      -> frases de los botones de la demo          (~1.530 créditos)
set -u
cd "$(dirname "$0")/.."
OUT="fase2_logs"
mkdir -p "$OUT"
echo "== 1/3 · audio de ejemplo de la llamada =="
node scripts/tts_sample_call.js 2>&1 | tee "$OUT/el_sample.txt"
echo "== 2/3 · prueba real mínima =="
node scripts/smoke_elevenlabs.js 2>&1 | tee "$OUT/el_smoke.txt"
echo
echo "Antes de seguir puedes escuchar la voz de Centinela (.cache/elevenlabs/prueba_voz_centinela.mp3)"
echo "y la llamada de ejemplo (public/samples/llamada_falso_broker.mp3)."
echo "== 3/3 · precaché de las frases de la demo =="
node scripts/tts_precache.js 2>&1 | tee "$OUT/el_precache.txt"
echo "Hecho. Salidas en $OUT/. Reinicia el servidor (Ctrl+C y npm start) para que use el código nuevo."
