import { describe, expect, it } from 'vitest';
import bwipjs from 'bwip-js';
import { parseGs1 } from '../src/core/scanning/pipeline.js';

describe('generated pallet GS1-128 labels', () => {
  it('renders a GS1-128 symbol carrying expiry date and batch/lot fields', () => {
    const parsed = parseGs1('(01)04045907295032(17)271231(10)LOT-ABC-42');
    expect(parsed.ai).toEqual([
      { ai: '01', value: '04045907295032' },
      { ai: '17', value: '271231' },
      { ai: '10', value: 'LOT-ABC-42' },
    ]);

    const svg = bwipjs.toSVG({
      bcid: 'gs1-128',
      text: parsed.humanReadable,
      scale: 2,
      height: 14,
      includetext: true,
      textxalign: 'center',
      backgroundcolor: 'FFFFFF',
      barcolor: '17231A',
      padding: 8,
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg.length).toBeGreaterThan(1000);
  });
});
