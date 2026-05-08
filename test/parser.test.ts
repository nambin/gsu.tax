import { describe, it, expect } from 'vitest';
import { parseMhtmlFromMorganStanley, parseSharesValue, formatDate, parseCurrencyUsd } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';

describe('Data Extraction Logic', () => {
  it('should correctly parse test-ms-one-record.mhtml', () => {
    const filePath = path.join(__dirname, 'fixtures', 'test-ms-one-record.mhtml');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseMhtmlFromMorganStanley(content, 'test-ms-one-record.mhtml');

    expect(result.filename).toBe('test-ms-one-record.mhtml');
    expect(result.disbursementDate).toBe('2024-08-22');
    expect(result.settlementDate).toBe('2024-08-22');

    expect(result.transactions.length).toBe(1);

    expect(result.transactions[0]).toEqual({
      acquisitionDate: '2024-06-25',
      typeOfMoney: '',
      costBasisPerShareUsd: 110.2,
      marketValuePerShareUsd: 100.1,
      shares: 1.5,
      gainOrLossUsd: -15.15
    });
  });

  it('should correctly parse test-ms-four-records.mhtml', () => {
    const filePath = path.join(__dirname, 'fixtures', 'test-ms-four-records.mhtml');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseMhtmlFromMorganStanley(content, 'test-ms-four-records.mhtml');

    expect(result.filename).toBe('test-ms-four-records.mhtml');
    expect(result.disbursementDate).toBe('2024-09-23');
    expect(result.settlementDate).toBe('2024-09-23');

    expect(result.transactions.length).toBe(4);

    expect(result.transactions[0]).toEqual({
      acquisitionDate: "2024-05-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 100,
      marketValuePerShareUsd: 150,
      shares: 1,
      gainOrLossUsd: 50
    });

    expect(result.transactions[1]).toEqual({
      acquisitionDate: "2024-05-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 100,
      marketValuePerShareUsd: 150,
      shares: 1,
      gainOrLossUsd: 50
    });

    expect(result.transactions[2]).toEqual({
      acquisitionDate: "2024-06-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 130,
      marketValuePerShareUsd: 150,
      shares: 2,
      gainOrLossUsd: 40
    });

    expect(result.transactions[3]).toEqual({
      acquisitionDate: "2024-07-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 155,
      marketValuePerShareUsd: 150,
      shares: 2,
      gainOrLossUsd: -10
    });
  });

  it('should correctly parse test-ms-four-records-kr.mhtml (Korean labels)', () => {
    // The Korean fixture is the English fixture with translated labels and dates;
    // the parsed result must be identical to the English one.
    const filePath = path.join(__dirname, 'fixtures', 'test-ms-four-records-kr.mhtml');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseMhtmlFromMorganStanley(content, 'test-ms-four-records-kr.mhtml');

    expect(result.filename).toBe('test-ms-four-records-kr.mhtml');
    expect(result.disbursementDate).toBe('2024-09-23');
    expect(result.settlementDate).toBe('2024-09-23');

    expect(result.transactions.length).toBe(4);

    expect(result.transactions[0]).toEqual({
      acquisitionDate: "2024-05-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 100,
      marketValuePerShareUsd: 150,
      shares: 1,
      gainOrLossUsd: 50
    });

    expect(result.transactions[1]).toEqual({
      acquisitionDate: "2024-05-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 100,
      marketValuePerShareUsd: 150,
      shares: 1,
      gainOrLossUsd: 50
    });

    expect(result.transactions[2]).toEqual({
      acquisitionDate: "2024-06-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 130,
      marketValuePerShareUsd: 150,
      shares: 2,
      gainOrLossUsd: 40
    });

    expect(result.transactions[3]).toEqual({
      acquisitionDate: "2024-07-25",
      typeOfMoney: "",
      costBasisPerShareUsd: 155,
      marketValuePerShareUsd: 150,
      shares: 2,
      gainOrLossUsd: -10
    });
  });
});

describe('formatDate Korean parsing', () => {
  it('parses standard "YYYY년 M월 D일"', () => {
    expect(formatDate('2024년 8월 22일', 'test.mhtml')).toBe('2024-08-22');
  });

  it('zero-pads single-digit month and day', () => {
    expect(formatDate('2024년 5월 25일', 'test.mhtml')).toBe('2024-05-25');
    expect(formatDate('2024년 12월 5일', 'test.mhtml')).toBe('2024-12-05');
    expect(formatDate('2024년 1월 1일', 'test.mhtml')).toBe('2024-01-01');
  });

  it('handles two-digit month and day', () => {
    expect(formatDate('2024년 11월 30일', 'test.mhtml')).toBe('2024-11-30');
    expect(formatDate('2024년 12월 31일', 'test.mhtml')).toBe('2024-12-31');
  });

  it('tolerates extra whitespace between fields', () => {
    expect(formatDate('  2024년   8월   22일  ', 'test.mhtml')).toBe('2024-08-22');
  });

  it('accepts year boundaries within the allowed range', () => {
    expect(formatDate('2006년 1월 1일', 'test.mhtml')).toBe('2006-01-01');
    expect(formatDate('2025년 12월 31일', 'test.mhtml')).toBe('2025-12-31');
  });

  it('throws when year is out of the allowed range', () => {
    expect(() => formatDate('2005년 12월 31일', 'test.mhtml')).toThrow(/Date out of allowed range/);
    expect(() => formatDate('2026년 1월 1일', 'test.mhtml')).toThrow(/Date out of allowed range/);
  });

  it('throws when the Korean date is malformed', () => {
    // Missing 일 — regex falls through to new Date(), which cannot parse this either.
    expect(() => formatDate('2024년 8월 22', 'test.mhtml')).toThrow(/Invalid date format/);
  });

  it('still parses English dates (regression guard)', () => {
    expect(formatDate('August 22, 2024', 'test.mhtml')).toBe('2024-08-22');
  });
});

describe('parseCurrencyUsd US$ marker', () => {
  it('strips the "US$" prefix on a positive amount', () => {
    expect(parseCurrencyUsd('US$197.57', 'test.mhtml')).toBe(197.57);
    expect(parseCurrencyUsd('US$200.00', 'test.mhtml')).toBe(200);
    expect(parseCurrencyUsd('US$0.00', 'test.mhtml')).toBe(0);
  });

  it('handles thousands separators with the "US$" prefix', () => {
    expect(parseCurrencyUsd('US$2,591.55', 'test.mhtml')).toBe(2591.55);
    expect(parseCurrencyUsd('US$1,234,567.89', 'test.mhtml')).toBe(1234567.89);
  });

  it('handles a true minus sign in front of "US$" (Korean format)', () => {
    // Korean MS reports use U+2212 (true minus) before the currency marker, e.g. "−US$74.35".
    expect(parseCurrencyUsd('−US$74.35', 'test.mhtml')).toBe(-74.35);
    expect(parseCurrencyUsd('−US$40.03', 'test.mhtml')).toBe(-40.03);
  });

  it('handles an ASCII hyphen in front of "US$"', () => {
    expect(parseCurrencyUsd('-US$10.00', 'test.mhtml')).toBe(-10);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseCurrencyUsd('  US$150.00  ', 'test.mhtml')).toBe(150);
  });

  it('still parses the bare "$" prefix (regression guard)', () => {
    expect(parseCurrencyUsd('$167.77', 'test.mhtml')).toBe(167.77);
    expect(parseCurrencyUsd('−$508.33', 'test.mhtml')).toBe(-508.33);
  });

  it('throws on malformed currency input', () => {
    expect(() => parseCurrencyUsd('US$abc', 'test.mhtml')).toThrow(/Invalid currency value/);
    expect(() => parseCurrencyUsd('US$', 'test.mhtml')).toThrow(/Invalid currency value/);
  });
});

describe('parseSharesValue', () => {
  it('should throw error for non-numeric shares value', () => {
    expect(() => parseSharesValue('abc', 'test.mhtml')).toThrow(/Invalid shares value \(non-numeric\): abc/);
    expect(() => parseSharesValue('', 'test.mhtml')).toThrow(/Invalid shares value \(non-numeric\)/);
  });

  it('should throw error for zero or negative shares value', () => {
    expect(() => parseSharesValue('0', 'test.mhtml')).toThrow(/Invalid shares value \(must be positive\): 0/);
    expect(() => parseSharesValue('-5', 'test.mhtml')).toThrow(/Invalid shares value \(must be positive\): -5/);
  });
});
