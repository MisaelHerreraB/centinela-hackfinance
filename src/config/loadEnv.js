/**
 * Cargador mínimo de .env (sin dependencias; `node --env-file` exige Node >= 20.6 y el proyecto promete >= 18).
 *
 * - Lee el archivo .env de la raíz del proyecto si existe.
 * - Ignora comentarios y líneas vacías, acepta `export CLAVE=valor` y quita comillas.
 * - NO sobrescribe variables ya definidas en el entorno (aunque estén vacías):
 *   `ANTHROPIC_API_KEY= npm start` arranca sin Claude aunque .env tenga clave.
 * - NUNCA imprime ni devuelve valores: solo los nombres de las variables cargadas.
 *
 * En los tests (node --test) no se carga el .env del proyecto, para que la clave real del equipo
 * no se cuele en las pruebas. Se puede forzar un archivo con CENTINELA_ENV_FILE o desactivar con
 * CENTINELA_SKIP_DOTENV=1.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ENV_PATH = path.join(__dirname, '..', '..', '.env');

function parseEnv(content = '') {
  const out = {};
  for (const rawLine of String(content).replace(/^﻿/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = value.match(/^(["'])(.*)\1\s*(?:#.*)?$/);
    if (quoted) {
      value = quoted[2];
    } else {
      // Comentario al final de la línea: solo si va separado por un espacio (una clave puede llevar '#')
      value = value.replace(/\s+#.*$/, '').trim();
    }
    out[m[1]] = value;
  }
  return out;
}

function loadEnv(options = {}) {
  const explicitPath = options.path || process.env.CENTINELA_ENV_FILE;
  if (!explicitPath && (process.env.CENTINELA_SKIP_DOTENV === '1' || process.env.NODE_TEST_CONTEXT)) {
    return { path: null, found: false, skipped: true, loaded: [] };
  }
  const file = explicitPath || DEFAULT_ENV_PATH;
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return { path: file, found: false, skipped: false, loaded: [] };
  }
  const loaded = [];
  for (const [key, value] of Object.entries(parseEnv(content))) {
    if (process.env[key] !== undefined) continue; // lo ya definido manda
    if (value === '') continue; // `CLAVE=` vacío equivale a no ponerla
    process.env[key] = value;
    loaded.push(key);
  }
  return { path: file, found: true, skipped: false, loaded };
}

module.exports = { loadEnv, parseEnv, DEFAULT_ENV_PATH };
