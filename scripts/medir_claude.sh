#!/usr/bin/env bash
# Mide Claude con la clave real que hay en .env (la clave nunca se imprime).
# Uso:  bash scripts/medir_claude.sh
#   1) npm run smoke:claude            -> fase2_logs/smoke.txt
#   2) npm run eval:holdout (Haiku)    -> fase2_logs/holdout_haiku.txt
#   3) npm run eval:holdout (Sonnet)   -> fase2_logs/holdout_sonnet.txt
# Si el paso 1 falla, se para ahí (no tiene sentido medir con algo roto).
set -u
cd "$(dirname "$0")/.."
OUT="fase2_logs"
mkdir -p "$OUT"
{ date; echo "node $(node -v)"; git rev-parse --short HEAD 2>/dev/null; } > "$OUT/entorno.txt" 2>&1

echo "1/3 · smoke:claude (unos 60 s)..."
node scripts/smoke_claude.js > "$OUT/smoke.txt" 2>&1
SMOKE=$?
tail -n 2 "$OUT/smoke.txt"
if [ "$SMOKE" -ne 0 ]; then
  echo "smoke:claude ha fallado: no se lanza eval:holdout. Detalle en $OUT/smoke.txt"
  exit 1
fi

echo "2/3 · eval:holdout con claude-haiku-5-5 (unos 60 s)..."
node src/evals/run_holdout.js --model=claude-haiku-5-5 > "$OUT/holdout_haiku.txt" 2>&1
grep -E "^(SOLO REGLAS|REGLAS \+ CLAUDE)" "$OUT/holdout_haiku.txt"

echo "3/3 · eval:holdout con claude-sonnet-5-5 (unos 90 s)..."
node src/evals/run_holdout.js --model=claude-sonnet-5-5 > "$OUT/holdout_sonnet.txt" 2>&1
grep -E "^(REGLAS \+ CLAUDE)" "$OUT/holdout_sonnet.txt"

echo "Hecho. Resultados en $OUT/"
