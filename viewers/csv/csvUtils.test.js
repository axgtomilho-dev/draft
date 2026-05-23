import { describe, it, expect } from 'vitest'
import {
  detectDelimiter,
  parseCSV,
  isNumeric,
  formatCellForCopy,
  toQuotedCSV,
  delimiterLabel,
} from './csvUtils'

/* ── isNumeric ── */
describe('isNumeric', () => {
  it('detects integers', () => {
    expect(isNumeric('42')).toBe(true)
    expect(isNumeric('-7')).toBe(true)
    expect(isNumeric('0')).toBe(true)
  })

  it('detects decimals', () => {
    expect(isNumeric('3.14')).toBe(true)
    expect(isNumeric('-0.5')).toBe(true)
    expect(isNumeric('159.90')).toBe(true)
  })

  it('detects scientific notation', () => {
    expect(isNumeric('1e10')).toBe(true)
    expect(isNumeric('2.5E-3')).toBe(true)
    expect(isNumeric('-1.2e+4')).toBe(true)
  })

  it('trims whitespace', () => {
    expect(isNumeric('  42  ')).toBe(true)
    expect(isNumeric(' 3.14 ')).toBe(true)
  })

  it('rejects non-numeric values', () => {
    expect(isNumeric('')).toBe(false)
    expect(isNumeric(null)).toBe(false)
    expect(isNumeric(undefined)).toBe(false)
    expect(isNumeric('abc')).toBe(false)
    expect(isNumeric('12px')).toBe(false)
    expect(isNumeric('hello 42')).toBe(false)
  })
})

/* ── formatCellForCopy ── */
describe('formatCellForCopy', () => {
  it('wraps empty strings in double quotes', () => {
    expect(formatCellForCopy('')).toBe('""')
  })

  it('wraps null/undefined in double quotes', () => {
    expect(formatCellForCopy(null)).toBe('""')
    expect(formatCellForCopy(undefined)).toBe('""')
  })

  it('returns bare numbers', () => {
    expect(formatCellForCopy('42')).toBe('42')
    expect(formatCellForCopy('3.14')).toBe('3.14')
    expect(formatCellForCopy(' 100 ')).toBe('100')
  })

  it('wraps strings in double quotes', () => {
    expect(formatCellForCopy('hello')).toBe('"hello"')
    expect(formatCellForCopy('Pedido A')).toBe('"Pedido A"')
  })

  it('escapes inner double quotes', () => {
    expect(formatCellForCopy('say "hello"')).toBe('"say ""hello"""')
  })
})

/* ── detectDelimiter ── */
describe('detectDelimiter', () => {
  it('detects comma delimiter', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6'
    expect(detectDelimiter(csv)).toBe(',')
  })

  it('detects tab delimiter', () => {
    const tsv = 'a\tb\tc\n1\t2\t3\n4\t5\t6'
    expect(detectDelimiter(tsv)).toBe('\t')
  })

  it('detects semicolon delimiter', () => {
    const csv = 'a;b;c\n1;2;3\n4;5;6'
    expect(detectDelimiter(csv)).toBe(';')
  })

  it('detects pipe delimiter', () => {
    const csv = 'a|b|c\n1|2|3\n4|5|6'
    expect(detectDelimiter(csv)).toBe('|')
  })

  it('ignores delimiters inside quotes', () => {
    const csv = '"a,b",c,d\n"1,2",3,4'
    // commas inside quotes should not be counted; there are 2 real commas per line
    expect(detectDelimiter(csv)).toBe(',')
  })

  it('returns comma for empty text', () => {
    expect(detectDelimiter('')).toBe(',')
    expect(detectDelimiter('   \n  ')).toBe(',')
  })
})

/* ── parseCSV ── */
describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const result = parseCSV('a,b,c\n1,2,3')
    expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles quoted fields', () => {
    const result = parseCSV('"hello world","test",123')
    expect(result).toEqual([['hello world', 'test', '123']])
  })

  it('handles escaped double quotes', () => {
    const result = parseCSV('"say ""hello""",b')
    expect(result).toEqual([['say "hello"', 'b']])
  })

  it('handles CRLF line endings', () => {
    const result = parseCSV('a,b\r\n1,2\r\n3,4')
    expect(result).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('handles fields with newlines inside quotes', () => {
    const result = parseCSV('"line1\nline2",b\nc,d')
    expect(result).toEqual([['line1\nline2', 'b'], ['c', 'd']])
  })

  it('handles empty fields', () => {
    const result = parseCSV('a,,c\n,2,')
    expect(result).toEqual([['a', '', 'c'], ['', '2', '']])
  })

  it('skips blank lines', () => {
    const result = parseCSV('a,b\n\n1,2\n\n')
    expect(result).toEqual([['a', 'b'], ['1', '2']])
  })

  it('uses custom delimiter', () => {
    const result = parseCSV('a;b;c\n1;2;3', ';')
    expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles tab delimiter', () => {
    const result = parseCSV('a\tb\tc\n1\t2\t3', '\t')
    expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles single row without trailing newline', () => {
    const result = parseCSV('a,b,c')
    expect(result).toEqual([['a', 'b', 'c']])
  })
})

/* ── toQuotedCSV ── */
describe('toQuotedCSV', () => {
  it('produces quoted CSV output', () => {
    const headers = ['name', 'age', 'city']
    const rows = [['Alice', '30', 'SP'], ['Bob', '25', 'RJ']]
    const result = toQuotedCSV(headers, rows)
    expect(result).toBe('"name","age","city"\n"Alice",30,"SP"\n"Bob",25,"RJ"')
  })

  it('handles empty strings', () => {
    const headers = ['a', 'b']
    const rows = [['', 'test']]
    const result = toQuotedCSV(headers, rows)
    expect(result).toBe('"a","b"\n"","test"')
  })

  it('uses custom delimiter', () => {
    const headers = ['a', 'b']
    const rows = [['1', 'x']]
    const result = toQuotedCSV(headers, rows, ';')
    expect(result).toBe('"a";"b"\n1;"x"')
  })
})

/* ── delimiterLabel ── */
describe('delimiterLabel', () => {
  it('returns labels for known delimiters', () => {
    expect(delimiterLabel(',')).toBe('Virgula (,)')
    expect(delimiterLabel('\t')).toBe('Tab')
    expect(delimiterLabel(';')).toBe('Ponto e virgula (;)')
    expect(delimiterLabel('|')).toBe('Pipe (|)')
  })

  it('returns the delimiter itself for unknown values', () => {
    expect(delimiterLabel('^')).toBe('^')
  })
})
