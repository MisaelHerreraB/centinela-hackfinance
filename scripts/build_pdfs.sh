#!/usr/bin/env bash
# Regenera los PDF de presentacion/ a partir de sus HTML (macOS o Linux con Google Chrome).
# Uso:  bash scripts/build_pdfs.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-}"
if [ -z "$CHROME" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then CHROME="$c"; break; fi
  done
fi
[ -n "$CHROME" ] || { echo "No encuentro Google Chrome. Ábrelo y usa Imprimir > Guardar como PDF."; exit 1; }

build() {
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 \
    --print-to-pdf="presentacion/$2" "file://$PWD/presentacion/$1" 2>/dev/null
  echo "OK presentacion/$2"
}
build centinela_pitch_deck.html CENTINELA_PRESENTACION_PITCH_DECK.pdf
build centinela_one_pager.html CENTINELA_ONE_PAGER_TECNICO.pdf
