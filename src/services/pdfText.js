/**
 * Extractor mínimo de texto de PDFs sin dependencias externas.
 * Sirve como respaldo cuando no hay clave de Claude: lee PDFs de texto sencillos
 * (FlateDecode / ASCII85Decode, fuentes Type1 estándar). No hace OCR: un PDF escaneado
 * o con fuentes incrustadas complejas devuelve poco o ningún texto, y entonces la
 * app pide al usuario los datos en lugar de inventarlos.
 */

const zlib = require('zlib');

function ascii85Decode(input) {
  let str = input.toString('latin1').replace(/\s+/g, '');
  if (str.startsWith('<~')) str = str.slice(2);
  const end = str.indexOf('~>');
  if (end !== -1) str = str.slice(0, end);

  const out = [];
  let group = [];
  const flush = (chars, finalGroup) => {
    const padded = chars.concat(Array(5 - chars.length).fill(84)); // 'u' - 33 = 84
    let value = 0;
    for (const c of padded) value = value * 85 + c;
    const bytes = [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
    out.push(...bytes.slice(0, finalGroup ? chars.length - 1 : 4));
  };

  for (const ch of str) {
    if (ch === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const code = ch.charCodeAt(0) - 33;
    if (code < 0 || code > 84) continue;
    group.push(code);
    if (group.length === 5) {
      flush(group, false);
      group = [];
    }
  }
  if (group.length > 1) flush(group, true);
  return Buffer.from(out);
}

function parseFilters(dict) {
  const arr = dict.match(/\/Filter\s*\[([^\]]*)\]/);
  if (arr) return (arr[1].match(/\/\w+/g) || []).map((f) => f.slice(1));
  const single = dict.match(/\/Filter\s*\/(\w+)/);
  return single ? [single[1]] : [];
}

function decodeStream(raw, filters) {
  let data = raw;
  for (const f of filters) {
    if (f === 'FlateDecode' || f === 'Fl') {
      try {
        data = zlib.inflateSync(data);
      } catch (e) {
        data = zlib.inflateRawSync(data.subarray(2));
      }
    } else if (f === 'ASCII85Decode' || f === 'A85') {
      data = ascii85Decode(data);
    } else {
      return null; // Imágenes (DCTDecode, JBIG2...) u otros filtros: no es texto
    }
  }
  return data;
}

function readLiteralString(buf, start) {
  // buf[start] === '(' ; devuelve [bytes, nextIndex]
  const bytes = [];
  let depth = 1;
  let i = start + 1;
  while (i < buf.length && depth > 0) {
    const c = buf[i];
    if (c === 0x5c) {
      // barra invertida
      const n = buf[i + 1];
      const map = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12, 0x28: 0x28, 0x29: 0x29, 0x5c: 0x5c };
      if (map[n] !== undefined) {
        bytes.push(map[n]);
        i += 2;
      } else if (n >= 0x30 && n <= 0x37) {
        let oct = '';
        let j = i + 1;
        while (j < buf.length && oct.length < 3 && buf[j] >= 0x30 && buf[j] <= 0x37) oct += String.fromCharCode(buf[j++]);
        bytes.push(parseInt(oct, 8) & 255);
        i = j;
      } else {
        i += 2; // salto de línea escapado u otro: se ignora
      }
      continue;
    }
    if (c === 0x28) depth++;
    if (c === 0x29) {
      depth--;
      if (depth === 0) break;
    }
    bytes.push(c);
    i++;
  }
  return [Buffer.from(bytes), i + 1];
}

function contentToText(content) {
  const lines = [];
  let line = '';
  const pushLine = () => {
    if (line.trim()) lines.push(line.trim());
    line = '';
  };
  let i = 0;
  let token = '';
  while (i < content.length) {
    const c = content[i];
    if (c === 0x28) {
      const [bytes, next] = readLiteralString(content, i);
      line += bytes.toString('latin1');
      i = next;
      token = '';
      continue;
    }
    if (c === 0x3c && content[i + 1] !== 0x3c) {
      const close = content.indexOf(0x3e, i);
      if (close === -1) break;
      const hex = content.subarray(i + 1, close).toString('latin1').replace(/\s+/g, '');
      if (/^[0-9a-fA-F]*$/.test(hex) && hex.length >= 2) {
        line += Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex').toString('latin1');
      }
      i = close + 1;
      token = '';
      continue;
    }
    const ch = String.fromCharCode(c);
    if (/[A-Za-z*'"]/.test(ch)) {
      token += ch;
    } else {
      if (token) {
        if (['Td', 'TD', 'T*', 'Tm', 'ET', "'", '"'].includes(token)) pushLine();
        token = '';
      }
    }
    i++;
  }
  pushLine();
  return lines.join('\n');
}

/**
 * Devuelve el texto legible de un PDF (Buffer o base64). Cadena vacía si no hay texto extraíble.
 */
function extractPdfText(input) {
  try {
    const buf = Buffer.isBuffer(input)
      ? input
      : Buffer.from(String(input).replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return '';

    const texts = [];
    const whole = buf.toString('latin1');
    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(whole)) !== null) {
      if (whole.slice(Math.max(0, m.index - 3), m.index) === 'end') continue; // "endstream"
      const dataStart = m.index + m[0].length;
      const objStart = whole.lastIndexOf(' obj', m.index);
      const dict = objStart >= 0 ? whole.slice(objStart, m.index) : '';
      const endIdx = buf.indexOf('endstream', dataStart);
      if (endIdx === -1) break;
      let raw = buf.subarray(dataStart, endIdx);
      const lengthMatch = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
      if (lengthMatch) raw = buf.subarray(dataStart, dataStart + Number(lengthMatch[1]));
      re.lastIndex = endIdx + 9;

      if (/\/Subtype\s*\/Image/.test(dict)) continue;
      const decoded = decodeStream(raw, parseFilters(dict));
      if (!decoded) continue;
      const asText = decoded.toString('latin1');
      if (!/\b(?:Tj|TJ)\b/.test(asText)) continue;
      const t = contentToText(decoded);
      if (t) texts.push(t);
    }
    return texts.join('\n').slice(0, 20000);
  } catch (e) {
    return '';
  }
}

module.exports = { extractPdfText, ascii85Decode };
