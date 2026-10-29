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

const FIXED_AI = new Map([
  ['00', 18], ['01', 14], ['02', 14], ['11', 6], ['13', 6], ['15', 6], ['17', 6],
  ['20', 2], ['410', 13], ['422', 3], ['7001', 13], ['8005', 6],
]);
const VARIABLE_AI = new Map([
  ['10', 20], ['21', 20], ['30', 8], ['37', 8], ['240', 30], ['241', 30],
  ['400', 30], ['401', 30], ['420', 20], ['421', 12], ['90', 30],
  ...Array.from({ length: 9 }, (_, index) => ['' + (91 + index), 90]),
]);
const NUMERIC_AI = new Set(['00', '01', '02', '11', '13', '15', '17', '20', '30', '37', '410', '422', '7001', '8005']);

function identifyAi(input, offset) {
  for (const length of [4, 3, 2]) {
    const ai = input.slice(offset, offset + length);
    if (FIXED_AI.has(ai) || VARIABLE_AI.has(ai)) return ai;
    if (/^310[0-5]$/.test(ai)) return ai;
  }
  return null;
}

function validateAiValue(ai, value) {
  const fixedLength = FIXED_AI.get(ai) ?? (/^310[0-5]$/.test(ai) ? 6 : undefined);
  const maxLength = fixedLength ?? VARIABLE_AI.get(ai);
  if (fixedLength !== undefined && value.length !== fixedLength) throw new Error('BAD_LENGTH');
  if (!value.length) throw new Error('EMPTY_VALUE');
  if (maxLength !== undefined && value.length > maxLength) throw new Error('TOO_LONG');
  if (NUMERIC_AI.has(ai) || /^310[0-5]$/.test(ai)) {
    if (!/^\d+$/.test(value)) throw new Error('NON_NUMERIC');
  } else if (!/^[0-9A-Za-z!"%&'()*+,.\-/ :;<>?_=]+$/.test(value)) {
    throw new Error('BAD_CHARSET');
  }
  if (['00', '01', '02'].includes(ai)) {
    if (calculateCheckDigit(value.slice(0, -1)) !== value.at(-1)) throw new Error('BAD_CHECK_DIGIT');
  }
  if (['11', '13', '15', '17'].includes(ai)) {
    if (!/^\d{6}$/.test(value)) throw new Error('NON_NUMERIC');
    const yy = Number(value.slice(0, 2));
    const month = Number(value.slice(2, 4));
    const day = Number(value.slice(4, 6));
    const year = 2000 + yy;
    const days = day === 0 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : new Date(Date.UTC(year, month - 1, day)).getUTCDate();
    if (month < 1 || month > 12 || day > days || day < 0) throw new Error('BAD_DATE');
  }
}

export function parseGs1(rawInput) {
  if (typeof rawInput !== 'string' || !rawInput.length) throw new Error('EMPTY');
  let input = rawInput.trim();
  input = input.startsWith(']C1') ? input.slice(3) : input;
  if (/\([0-9]{2,4}\)/.test(input)) {
    const fields = [...input.matchAll(/\(([0-9]{2,4})\)/g)];
    if (!fields.length || fields[0].index !== 0) throw new Error('BAD_FORMAT');
    const ais = new Set();
    const parsed = fields.map((match, index) => {
      const ai = match[1];
      if (!FIXED_AI.has(ai) && !VARIABLE_AI.has(ai) && !/^310[0-5]$/.test(ai)) throw new Error('UNKNOWN_AI');
      if (ais.has(ai)) throw new Error('DUPLICATE_AI');
      ais.add(ai);
      const start = match.index + match[0].length;
      const end = index + 1 < fields.length ? fields[index + 1].index : input.length;
      const value = input.slice(start, end);
      validateAiValue(ai, value);
      return { ai, value };
    });
    return { ai: parsed, humanReadable: parsed.map(({ ai, value }) => '(' + ai + ')' + value).join(''), elementString: parsed.map(({ ai, value }, index) => ai + value + (index < parsed.length - 1 && VARIABLE_AI.has(ai) ? String.fromCharCode(29) : '')).join(''), ambiguous: false };
  }

  const aiList = [];
  const seen = new Set();
  let offset = 0;
  while (offset < input.length) {
    if (input[offset] === String.fromCharCode(29)) { offset += 1; continue; }
    const ai = identifyAi(input, offset);
    if (!ai) throw new Error('UNKNOWN_AI');
    if (seen.has(ai)) throw new Error('DUPLICATE_AI');
    seen.add(ai);
    offset += ai.length;
    const fixedLength = FIXED_AI.get(ai) ?? (/^310[0-5]$/.test(ai) ? 6 : undefined);
    let value;
    if (fixedLength !== undefined) {
      value = input.slice(offset, offset + fixedLength);
      offset += value.length;
      if (value.length !== fixedLength) throw new Error('BAD_LENGTH');
    } else {
      const separator = input.indexOf(String.fromCharCode(29), offset);
      const end = separator === -1 ? input.length : separator;
      value = input.slice(offset, end);
      offset = end;
      if (separator !== -1) offset += 1;
      else {
        for (let candidate = offset - value.length + 1; candidate < end - 1; candidate += 1) {
          const nextAi = identifyAi(input, candidate);
          if (!nextAi) continue;
          const nextFixedLength = FIXED_AI.get(nextAi) ?? (/^310[0-5]$/.test(nextAi) ? 6 : undefined);
          const remainingLength = end - candidate - nextAi.length;
          if (nextFixedLength !== undefined ? remainingLength >= nextFixedLength : remainingLength >= 1) {
            throw new Error('AMBIGUOUS_GS');
          }
        }
      }
    }
    validateAiValue(ai, value);
    aiList.push({ ai, value });
  }
  return {
    ai: aiList,
    humanReadable: aiList.map(({ ai, value }) => '(' + ai + ')' + value).join(''),
    elementString: input,
    ambiguous: false,
  };
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
      return { accepted: true, value: normalized, gs1: parsed };
    } catch (error) {
      const reasons = {
        BAD_CHECK_DIGIT: 'Neplatná kontrolní číslice v GS1-128.',
        BAD_LENGTH: 'Neplatná délka pole GS1.',
        BAD_DATE: 'Neplatné datum v GS1.',
        UNKNOWN_AI: 'Neznámý identifikátor pole (AI) v GS1.',
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
