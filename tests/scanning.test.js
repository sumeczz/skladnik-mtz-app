import { describe, expect, it, vi } from 'vitest';
import { calculateCheckDigit, createScanPipeline, parseGs1, validateEan, validateScan } from '../src/core/scanning/pipeline.js';
import vectors from '../docs/test-vectors/gs1_vectors.json';
import gs1AiRegistry from '../src/core/scanning/gs1-ai-registry.json';
import { FakeScanSource } from '../src/core/scanning/scan-source.js';

describe('barcode validation', () => {
  it('calculates check digits from the reference vectors', () => {
    for (const vector of vectors.check_digit) expect(calculateCheckDigit(vector.payload)).toBe(vector.expected);
  });
  it('validates EAN-13 and EAN-8 checksums', () => {
    expect(validateEan('4006381333931', 'ean13').valid).toBe(true);
    expect(validateEan('4006381333932', 'ean13').valid).toBe(false);
    expect(validateEan('96385074', 'ean8').valid).toBe(true);
  });
  it('parses SSCC with optional symbology identifier', () => {
    expect(parseGs1(']C100106141412345678908').ai).toEqual([{ ai: '00', value: '106141412345678908' }]);
  });
  it('parses the photographed pallet fields AI 02, 11 and 37', () => {
    const parsed = parseGs1('(02)04045907295032(11)251105(37)7065');
    expect(parsed.ai).toEqual([
      { ai: '02', value: '04045907295032' },
      { ai: '11', value: '251105' },
      { ai: '37', value: '7065' },
    ]);
    expect(validateScan({ value: '020404590729503211251105377065', type: 'gs1128', format: 'CODE_128' }).accepted).toBe(true);
  });
  it('trims whitespace before parsing a GS1 symbology identifier', () => {
    expect(parseGs1('  ]C100106141412345678908  ').ai).toEqual([{ ai: '00', value: '106141412345678908' }]);
  });
  it('explains when plain Code 128 data is scanned in GS1-128 mode', () => {
    const result = validateScan({ value: '295030101609420', type: 'gs1128', format: 'CODE_128' });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('295030101609420');
    expect(result.reason).toContain('přepni typ na Code 128');
  });
  it('uses the current official GS1 AI registry, not a hand-maintained shortlist', () => {
    expect(Object.keys(gs1AiRegistry).length).toBeGreaterThanOrEqual(541);
    for (const [ai, definition] of Object.entries(gs1AiRegistry)) {
      expect(ai.length, `AI length ${ai}`).toBeGreaterThanOrEqual(2);
      expect(ai.length, `AI length ${ai}`).toBeLessThanOrEqual(4);
      expect(() => new RegExp('^(?:' + definition.regex + ')$'), `AI regex ${ai}`).not.toThrow();
    }
    for (const ai of ['03', '12', '16', '22', '235', '242', '253', '402', '415', '8003', '8004', '8006', '8008', '8010', '8012', '8200']) {
      expect(gs1AiRegistry[ai], `AI ${ai}`).toBeDefined();
    }
  });
  it('parses newer GS1 AIs and returns the human-readable AI-separated value', () => {
    const parsed = parseGs1('(03)04045907295032(12)260630(16)260630(22)VARIANT1(235)SERIAL123(242)123(8004)ASSET-123(8006)040459072950320101(8008)2606281230');
    expect(parsed.ai.map(({ ai }) => ai)).toEqual(['03', '12', '16', '22', '235', '242', '8004', '8006', '8008']);
    const result = validateScan({ value: '020404590729503211251105377065', type: 'gs1128', format: 'CODE_128' });
    expect(result.value).toBe('(02)04045907295032(11)251105(37)7065');
    expect(result.rawValue).toBe('020404590729503211251105377065');
  });
  it('accepts every valid GS1 parser reference vector', () => {
    for (const vector of vectors.parse_valid) {
      expect(parseGs1(vector.input).ai, vector.note).toEqual(vector.ai);
    }
  });
  it('rejects every invalid GS1 parser reference vector with the expected error', () => {
    for (const vector of vectors.parse_invalid) {
      expect(() => parseGs1(vector.input), vector.input).toThrow(vector.expected_error);
    }
  });
  it('keeps GS separators between variable-length fields', () => {
    const parsed = parseGs1('10LOT42\u001d21SN0001');
    expect(parsed.ai).toEqual([{ ai: '10', value: 'LOT42' }, { ai: '21', value: 'SN0001' }]);
  });
  it('rejects ambiguous GS1 input when a separator is missing', () => {
    expect(() => parseGs1('10LOT4221SN0001')).toThrow('AMBIGUOUS_GS');
  });
  it('rejects invalid check digits and unknown AIs', () => {
    expect(() => parseGs1('(00)106141412345678909')).toThrow('BAD_CHECK_DIGIT');
    expect(() => parseGs1('(88)ABC')).toThrow('UNKNOWN_AI');
  });
  it('filters a non-selected barcode format without showing an error', () => {
    expect(validateScan({ value: '4006381333931', type: 'qr', format: 'EAN_13' })).toEqual({ accepted: false, ignored: true });
  });
  it('accepts valid EAN and rejects bad checksum through the pipeline', () => {
    const onResult = vi.fn();
    const pipeline = createScanPipeline({ type: 'ean13', onResult, clock: () => 1000 });
    expect(pipeline.accept({ value: '4006381333931', format: 'EAN_13' }).status).toBe('accepted');
    expect(pipeline.accept({ value: '4006381333932', format: 'EAN_13' }).status).toBe('rejected');
  });
  it('applies per-value cooldown without dropping a different code', () => {
    let now = 1000;
    const onResult = vi.fn();
    const pipeline = createScanPipeline({ type: 'code128', onResult, clock: () => now, cooldownMs: 800 });
    expect(pipeline.accept({ value: 'A-1', format: 'CODE_128' }).status).toBe('accepted');
    expect(pipeline.accept({ value: 'A-1', format: 'CODE_128' }).status).toBe('cooldown');
    expect(pipeline.accept({ value: 'B-2', format: 'CODE_128' }).status).toBe('accepted');
    now += 801;
    expect(pipeline.accept({ value: 'A-1', format: 'CODE_128' }).status).toBe('accepted');
  });
  it('ignores repeated reads of the same code for 2.5 seconds by default', () => {
    let now = 1000;
    const onResult = vi.fn();
    const pipeline = createScanPipeline({ type: 'code128', onResult, clock: () => now });
    expect(pipeline.accept({ value: 'TOP', format: 'CODE_128' }).status).toBe('accepted');
    now += 300;
    expect(pipeline.accept({ value: 'MIDDLE', format: 'CODE_128' }).status).toBe('accepted');
    now += 300;
    expect(pipeline.accept({ value: 'TOP', format: 'CODE_128' }).status).toBe('cooldown');
    expect(pipeline.accept({ value: 'BOTTOM', format: 'CODE_128' }).status).toBe('accepted');
    now += 2200;
    expect(pipeline.accept({ value: 'TOP', format: 'CODE_128' }).status).toBe('accepted');
    expect(onResult.mock.calls.map(([result]) => result.value)).toEqual(['TOP', 'MIDDLE', 'BOTTOM', 'TOP']);
  });

  it('uses a fake source to emit scans only while running', async () => {
    const source = new FakeScanSource();
    const listener = vi.fn();
    source.subscribe(listener);
    source.emit('ignored-before-start');
    await source.start('ean13');
    source.emit('4006381333931');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ value: '4006381333931', format: 'EAN_13' }));
    await source.pause();
    source.emit('ignored-while-paused');
    expect(listener).toHaveBeenCalledTimes(1);
    await source.resume();
    source.emit('4006381333931');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
