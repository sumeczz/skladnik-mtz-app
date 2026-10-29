export const CODE_TYPES = {
  code128: { label: 'Code 128', formats: ['CODE_128'] },
  gs1128: { label: 'GS1-128', formats: ['CODE_128'] },
  qr: { label: 'QR kód', formats: ['QR_CODE'] },
  ean13: { label: 'EAN-13', formats: ['EAN_13'] },
  ean8: { label: 'EAN-8', formats: ['EAN_8'] },
  code39: { label: 'Code 39', formats: ['CODE_39'] },
  dataMatrix: { label: 'Data Matrix', formats: ['DATA_MATRIX'] },
  itf: { label: 'ITF', formats: ['ITF'] },
};

export function calculateCheckDigit(payload) {
  if (!/^\d+$/.test(payload)) throw new Error('BAD_NUMERIC_INPUT');
  let sum = 0;
  let weight = 3;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += Number(payload[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function validateEan(value, type) {
  const expectedLength = type === 'ean13' ? 13 : 8;
  if (!new RegExp('^\\d{' + expectedLength + '}$').test(value)) {
    return { valid: false, reason: 'Neplatná délka kódu.' };
  }
  if (calculateCheckDigit(value.slice(0, -1)) !== value.at(-1)) {
    return { valid: false, reason: 'Neplatná kontrolní číslice.' };
  }
  return { valid: true };
}

import gs1AiRegistry from './gs1-ai-registry.json';

const GS = String.fromCharCode(29);
const AI_ENTRIES = Object.entries(gs1AiRegistry).sort(([a], [b]) => b.length - a.length);

function identifyAi(input, offset) {
  for (const [ai] of AI_ENTRIES) if (input.startsWith(ai, offset)) return ai;
  return null;
}
function fieldIsFixed(definition) { return definition.components.every((c) => c.fixedLength === true); }
function fixedFieldLength(definition) { return definition.components.reduce((sum, c) => sum + (c.fixedLength ? c.length : 0), 0); }
function validateDateComponent(format, value) {
  let year, month, day;
  if (['yymmd0', 'yymmdd', 'yymmddhh'].includes(format)) { year = 2000 + Number(value.slice(0, 2)); month = Number(value.slice(2, 4)); day = Number(value.slice(4, 6)); }
  else if (format === 'yyyymmdd') { year = Number(value.slice(0, 4)); month = Number(value.slice(4, 6)); day = Number(value.slice(6, 8)); }
  else return;
  if (month < 1 || month > 12 || day < 0 || day > 31) throw new Error('BAD_DATE');
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day === 0 ? format !== 'yymmd0' : day > maxDay) throw new Error('BAD_DATE');
}
function validateAiValue(ai, value) {
  const def = gs1AiRegistry[ai];
  if (!def) throw new Error('UNKNOWN_AI');
  if (!value.length) throw new Error('EMPTY_VALUE');
  if (fieldIsFixed(def) && value.length !== fixedFieldLength(def)) throw new Error('BAD_LENGTH');
  let dateCursor = 0;
  for (const component of def.components) {
    if (component.optional && dateCursor >= value.length) continue;
    const partLength = component.fixedLength ? component.length : value.length - dateCursor;
    const part = value.slice(dateCursor, dateCursor + partLength);
    if (component.type === 'N' && !/^\d+$/.test(part)) throw new Error('NON_NUMERIC');
    if (component.format) validateDateComponent(component.format, part);
    dateCursor += partLength;
  }
  if (!new RegExp('^(?:' + def.regex + ')$').test(value)) {
    const maxLength = Math.max(...def.components.map((c) => c.length));
    if (value.length > maxLength) throw new Error('TOO_LONG');
    if (def.components.every((c) => c.type === 'N') && !/^\d+$/.test(value)) throw new Error('NON_NUMERIC');
    if (def.components.some((c) => c.type === 'X') && !/^[!%-?A-Z_a-z\\x22]+$/.test(value)) throw new Error('BAD_CHARSET');
    throw new Error('BAD_FORMAT');
  }
  let cursor = 0;
  for (const c of def.components) {
    if (c.optional && cursor >= value.length) continue;
    const length = c.fixedLength ? c.length : value.length - cursor;
    const part = value.slice(cursor, cursor + length);
    if (c.fixedLength && part.length !== c.length) throw new Error('BAD_LENGTH');
    if (c.type === 'N' && !/^\d+$/.test(part)) throw new Error('NON_NUMERIC');
    if (c.checkDigit && part.length > 1 && calculateCheckDigit(part.slice(0, -1)) !== part.at(-1)) throw new Error('BAD_CHECK_DIGIT');
    if (c.format) validateDateComponent(c.format, part);
    cursor += length;
  }
}
function makeParseResult(aiList) {
  return { ai: aiList, humanReadable: aiList.map(({ ai, value }) => '(' + ai + ')' + value).join(''), elementString: aiList.map(({ ai, value }, i) => ai + value + (i < aiList.length - 1 && !fieldIsFixed(gs1AiRegistry[ai]) ? GS : '')).join(''), ambiguous: false };
}
export function parseGs1(rawInput) {
  if (typeof rawInput !== 'string' || !rawInput.length) throw new Error('EMPTY');
  let input = rawInput.trim();
  if (input.startsWith(']C1')) input = input.slice(3);
  input = input.replace(/<GS>/gi, GS).replace(/\\x1d/gi, GS).replace(/\\u001d/gi, GS);
  if (!input.length) throw new Error('EMPTY');
  if (/\([0-9]{2,4}\)/.test(input)) {
    const fields = [...input.matchAll(/\(([0-9]{2,4})\)/g)];
    if (!fields.length || fields[0].index !== 0) throw new Error('BAD_FORMAT');
    const seen = new Set();
    const parsed = fields.map((m, i) => {
      const ai = m[1];
      if (!gs1AiRegistry[ai]) throw new Error('UNKNOWN_AI');
      if (seen.has(ai)) throw new Error('DUPLICATE_AI');
      seen.add(ai);
      const start = m.index + m[0].length;
      const end = i + 1 < fields.length ? fields[i + 1].index : input.length;
      const value = input.slice(start, end).replaceAll(GS, '');
      validateAiValue(ai, value);
      return { ai, value };
    });
    return makeParseResult(parsed);
  }
  // Parse with bounded backtracking when a variable-length field has no GS.
  // AI-looking digits inside a field value are not sufficient evidence of a boundary:
  // accept an inferred split only if the complete remainder also validates uniquely.
  function parseFrom(offset, seen, list, solutions) {
    if (solutions.length > 1) return;
    if (offset === input.length) { solutions.push(list); return; }
    if (offset > input.length || input[offset] === GS) return;
    const ai = identifyAi(input, offset);
    if (!ai || seen.has(ai)) return;
    const nextSeen = new Set(seen); nextSeen.add(ai);
    const nextOffset = offset + ai.length;
    const def = gs1AiRegistry[ai];
    if (fieldIsFixed(def)) {
      const length = fixedFieldLength(def), value = input.slice(nextOffset, nextOffset + length);
      if (value.length !== length) return;
      try { validateAiValue(ai, value); } catch { return; }
      parseFrom(nextOffset + length, nextSeen, [...list, { ai, value }], solutions);
      return;
    }
    const sep = input.indexOf(GS, nextOffset);
    const end = sep < 0 ? input.length : sep;
    const candidates = [];
    if (sep >= 0) candidates.push(end);
    else {
      // Try each plausible next-AI boundary, but only retain fully valid parses.
      for (let candidate = nextOffset + 1; candidate < end; candidate += 1) {
        const nextAi = identifyAi(input, candidate);
        if (nextAi && !nextSeen.has(nextAi)) candidates.push(candidate);
      }
      candidates.push(end); // this variable field may be the final field
    }
    for (const boundary of candidates) {
      const value = input.slice(nextOffset, boundary);
      try { validateAiValue(ai, value); } catch { continue; }
      const next = sep >= 0 && boundary === end ? end + 1 : boundary;
      parseFrom(next, nextSeen, [...list, { ai, value }], solutions);
      if (solutions.length > 1) return;
    }
  }
  const solutions = [];
  parseFrom(0, new Set(), [], solutions);
  if (!solutions.length) {
    // Preserve useful validation errors for malformed single-field inputs.
    const ai = identifyAi(input, 0);
    if (!ai) throw new Error('UNKNOWN_AI');
    throw new Error('BAD_FORMAT');
  }
  if (solutions.length > 1) throw new Error('AMBIGUOUS_GS');
  return makeParseResult(solutions[0]);
}

export function validateScan({ value, type, format }) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return { accepted: false, reason: 'Kód neobsahuje žádná data.' };
  const config = CODE_TYPES[type];
  if (!config) return { accepted: false, reason: 'Nejdřív vyber typ kódu.' };
  if (!config.formats.includes(format)) return { accepted: false, ignored: true };
  if (type === 'ean13' || type === 'ean8') {
    const result = validateEan(normalized, type);
    return result.valid ? { accepted: true, value: normalized } : { accepted: false, reason: result.reason };
  }
  if (type === 'gs1128') {
    try {
      const parsed = parseGs1(normalized);
      if (parsed.ambiguous) return { accepted: false, reason: 'GS1-128 je nejednoznačný: chybí oddělovač GS (ASCII 29).' };
      return { accepted: true, value: parsed.humanReadable, rawValue: normalized, gs1: parsed };
    } catch (error) {
      const reasons = {
        BAD_CHECK_DIGIT: 'Neplatná kontrolní číslice v GS1-128.',
        BAD_LENGTH: 'Neplatná délka pole GS1.',
        BAD_DATE: 'Neplatné datum v GS1.',
        UNKNOWN_AI: 'Neznámý identifikátor pole (AI) v GS1.',
        BAD_FORMAT: 'Hodnota pole GS1 neodpovídá definici AI.',
        BAD_SEPARATOR: 'Neplatný oddělovač GS (ASCII 29) v GS1.',
        AMBIGUOUS_GS: 'Chybí oddělovač GS mezi proměnlivými poli.',
        EMPTY: 'Kód je prázdný.',
      };
      const reason = error.message === 'UNKNOWN_AI'
        ? 'Neznámý AI v načtených datech: ' + normalized.slice(0, 80) + (normalized.length > 80 ? '...' : '') + '. Pokud jde o běžný Code 128 (např. interní číslo), přepni typ na Code 128. GS1-128 musí obsahovat platná pole AI.'
        : reasons[error.message] ?? 'Kód není platný GS1-128.';
      return { accepted: false, reason };
    }
  }
  return { accepted: true, value: normalized };
}

export function createScanPipeline({ type, onResult, clock = () => Date.now(), cooldownMs = 2500 }) {
  const lastAccepted = new Map();
  return {
    accept(rawScan) {
      const checked = validateScan({ ...rawScan, type });
      if (checked.ignored) return { status: 'ignored' };
      if (!checked.accepted) {
        onResult({ status: 'rejected', reason: checked.reason, value: rawScan.value });
        return { status: 'rejected', reason: checked.reason };
      }
      const previousAt = lastAccepted.get(checked.value);
      const now = clock();
      if (previousAt !== undefined && now - previousAt < cooldownMs) return { status: 'cooldown' };
      lastAccepted.set(checked.value, now);
      const result = { status: 'accepted', value: checked.value, type, format: rawScan.format, source: rawScan.source ?? 'camera', at: now, gs1: checked.gs1 };
      onResult(result);
      return result;
    },
  };
}
