import { describe, expect, it } from 'vitest';
import { csvCell, csvRows } from './download';
import { parseRatesCsv } from './json';

describe('csvCell', () => {
  it('neutralizes formula triggers in user text', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-2+3')).toBe("'-2+3");
  });

  it('leaves numbers — including stringified negatives — and plain text alone', () => {
    expect(csvCell(-42.5)).toBe('-42.5');
    expect(csvCell('-42.50')).toBe('-42.50');
    expect(csvCell('Increment 1')).toBe('Increment 1');
  });

  it('quotes embedded delimiters, quotes, and CR/LF', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('a\rb')).toBe('"a\rb"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
});

describe('csvRows', () => {
  it('emits a UTF-8 BOM and CRLF line endings', () => {
    const out = csvRows([
      ['a', 1],
      ['b', 2],
    ]);
    expect(out.startsWith('\uFEFF')).toBe(true);
    expect(out).toContain('a,1\r\nb,2\r\n');
  });
});

describe('parseRatesCsv', () => {
  it('parses quoted LCATs containing commas', () => {
    expect(parseRatesCsv('LCAT,Direct\n"Engineer, Senior",100.5\nAnalyst,80')).toEqual([
      { lcat: 'Engineer, Senior', direct: 100.5 },
      { lcat: 'Analyst', direct: 80 },
    ]);
  });

  it('keeps a first data row whose LCAT merely contains "Direct"', () => {
    expect(parseRatesCsv('Direct Labor Lead,85\nAnalyst,80')).toEqual([
      { lcat: 'Direct Labor Lead', direct: 85 },
      { lcat: 'Analyst', direct: 80 },
    ]);
  });

  it('skips unparseable rows and handles CRLF input', () => {
    expect(parseRatesCsv('LCAT,Direct\r\nEng,abc\r\nTest,75\r\n')).toEqual([{ lcat: 'Test', direct: 75 }]);
  });
});
