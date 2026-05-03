import { describe, it, expect } from 'vitest';
import { parseMhtmlFromMorganStanley } from '../src/parser';
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
});
