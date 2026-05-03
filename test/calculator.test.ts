import { describe, it, expect } from 'vitest';
import { parseExchangeRates, getExchangeRate, processTransactions } from '../src/calculator';
import { MhtmlData, ExchangeRate } from '../src/types';

describe('Calculator and Math Requirements', () => {
  it('should parse exchange rates correctly', () => {
    const csv = `Date,Rate\n2024/08/22,1330.5\n2024/06/25,1380.2\n`;
    const rates = parseExchangeRates(csv);
    expect(rates[0]).toEqual({ date: '2024-08-22', rate: 1330.5 });
    expect(rates[1]).toEqual({ date: '2024-06-25', rate: 1380.2 });
  });

  it('should sort exchange rates in descending order', () => {
    // Input is in ascending order
    const csv = `Date,Rate\n2024/01/01,1000\n2024/02/01,1100\n2024/03/01,1200\n`;
    const rates = parseExchangeRates(csv);
    expect(rates.length).toBe(3);
    // Should be descending: March, February, January
    expect(rates[0]).toEqual({ date: '2024-03-01', rate: 1200 });
    expect(rates[1]).toEqual({ date: '2024-02-01', rate: 1100 });
    expect(rates[2]).toEqual({ date: '2024-01-01', rate: 1000 });
  });

  it('should throw error if exchange rate CSV has less than two columns', () => {
    const csv = `Date\n2024/08/22\n`;
    expect(() => parseExchangeRates(csv)).toThrow(/Failed to parse exchange rate CSV/);
  });

  it('should throw error if exchange rate CSV 1st column is not date', () => {
    const csv = `Time,Rate\n2024/08/22,1330.5\n`;
    expect(() => parseExchangeRates(csv)).toThrow(/1st column must be 'date'/);
  });

  it('should throw error if exchange rate CSV 2nd column is not rate', () => {
    const csv = `Date,Value\n2024/08/22,1330.5\n`;
    expect(() => parseExchangeRates(csv)).toThrow(/2nd column must be 'rate'/);
  });

  it('should throw error for invalid exchange rate value', () => {
    const csv = `Date,Rate\n2024/08/22,INVALID\n`;
    expect(() => parseExchangeRates(csv)).toThrow(/Invalid exchange rate value: INVALID for date: 2024\/08\/22/);
  });

  it('should use most recent preceding date for exchange rate', () => {
    const rates: ExchangeRate[] = [
      { date: '2024-08-25', rate: 1000 },
      { date: '2024-08-20', rate: 1100 },
      { date: '2024-08-15', rate: 1200 },
    ];
    // Dates match exactly
    expect(getExchangeRate(rates, '2024-08-20')).toBe(1100);
    // Date not in list, use preceding
    expect(getExchangeRate(rates, '2024-08-22')).toBe(1100);
    expect(getExchangeRate(rates, '2024-08-18')).toBe(1200);
  });

  it('should sort results by transferDate asc, acquisitionDate asc, numberOfStocks asc', () => {
    // Use flat rate 1000 for all dates to keep the test focused on sorting
    const rates: ExchangeRate[] = [
      { date: '2024-09-22', rate: 1000 },
      { date: '2024-08-22', rate: 1000 },
      { date: '2024-06-01', rate: 1000 },
      { date: '2024-05-01', rate: 1000 },
    ];

    // Provide transactions in a random order across two MHTML files
    const mhtmlList: MhtmlData[] = [
      {
        // Case 3: different transferDate (2024-09-22, will sort last)
        filename: 'sep.mhtml',
        disbursementDate: '2024-09-22',
        settlementDate: '',
        transactions: [
          { acquisitionDate: '2024-06-01', typeOfMoney: '', costBasisPerShareUsd: 8, marketValuePerShareUsd: 10, shares: 1, gainOrLossUsd: 2 },
        ]
      },
      {
        filename: 'aug.mhtml',
        disbursementDate: '2024-08-22',
        settlementDate: '',
        transactions: [
          // Case 1: same transferDate, later acquisitionDate (will sort after 2024-05-01 rows)
          { acquisitionDate: '2024-06-01', typeOfMoney: '', costBasisPerShareUsd: 8, marketValuePerShareUsd: 10, shares: 2, gainOrLossUsd: 4 },
          // Case 2: same transferDate AND acquisitionDate, more shares (will sort after shares=1)
          { acquisitionDate: '2024-05-01', typeOfMoney: '', costBasisPerShareUsd: 8, marketValuePerShareUsd: 10, shares: 3, gainOrLossUsd: 6 },
          // Case 2: same transferDate AND acquisitionDate, fewer shares (will sort first among these)
          { acquisitionDate: '2024-05-01', typeOfMoney: '', costBasisPerShareUsd: 8, marketValuePerShareUsd: 10, shares: 1, gainOrLossUsd: 2 },
        ]
      }
    ];

    const results = processTransactions(mhtmlList, rates);
    expect(results.length).toBe(4);

    // Expected order: transferDate asc → acquisitionDate asc → numberOfStocks asc
    expect(results.map(r => [r.b_transferDate, r.g_acquisitionDate, r.a_numberOfStocks])).toEqual([
      ['2024-08-22', '2024-05-01', 1], // Case 2: same dates, fewer stocks
      ['2024-08-22', '2024-05-01', 3], // Case 2: same dates, more stocks
      ['2024-08-22', '2024-06-01', 2], // Case 1: same transferDate, later acquisitionDate
      ['2024-09-22', '2024-06-01', 1], // Case 3: different (later) transferDate
    ]);
  });

  it('should process transactions and round down to integer', () => {
    const rates: ExchangeRate[] = [
      { date: '2024-08-22', rate: 1330.5 }, // Transfer Date
      { date: '2024-06-25', rate: 1380.2 }, // Acquisition Date
    ];

    const mhtmlList: MhtmlData[] = [
      {
        filename: 'test.mhtml',
        disbursementDate: '2024-08-22',
        settlementDate: '',
        transactions: [
          {
            acquisitionDate: '2024-06-25',
            typeOfMoney: '',
            costBasisPerShareUsd: 100.11,
            marketValuePerShareUsd: 130.21,
            shares: 1.50,
            gainOrLossUsd: 45.15
          }
        ]
      }
    ];

    const results = processTransactions(mhtmlList, rates);
    expect(results.length).toBe(1);

    // Transfer Rate = 1330.5, Price = 130.21
    // Per share won = floor(1330.5 * 130.21) = floor(173244.405) = 173244
    // Total transfer won = floor(1.50 * 173244) = floor(259866.0) = 259866
    // Acquisition Rate = 1380.2, Price = 100.11
    // Per share won = floor(1380.2 * 100.11) = floor(138171.822) = 138171
    // Total acq won = floor(1.50 * 138171) = floor(207256.5) = 207256
    // Gain Loss = 259866 - 207256 = 52610
    expect(results[0]).toEqual({
      a_numberOfStocks: 1.50,
      b_transferDate: '2024-08-22',
      c_exchangeRateOnTransferDate: 1330.5,
      d_transferPriceUsd: 130.21,
      e_transferPriceWon: 173244,
      f_transferPriceTotalWon: 259866,
      g_acquisitionDate: '2024-06-25',
      h_exchangeRateOnAcquisitionDate: 1380.2,
      i_acquisitionPriceUsd: 100.11,
      j_acquisitionPriceWon: 138171,
      k_acquisitionPriceTotalWon: 207256,
      l_gainLossWon: 52610,
    });
  });

  it('should fallback to Settlement date when Disbursement date is missing', () => {
    const rates: ExchangeRate[] = [
      { date: '2024-08-22', rate: 1330.5 },
      { date: '2024-05-21', rate: 1300.1 },
    ];

    const mhtmlList: MhtmlData[] = [
      {
        filename: 'fallback.mhtml',
        disbursementDate: '', // missing
        settlementDate: '2024-08-22',
        transactions: [
          {
            acquisitionDate: '2024-05-21',
            typeOfMoney: '',
            costBasisPerShareUsd: 100,
            marketValuePerShareUsd: 110,
            shares: 10,
            gainOrLossUsd: 100
          }
        ]
      }
    ];

    const results = processTransactions(mhtmlList, rates);
    expect(results.length).toBe(1);
    expect(results[0]).toEqual({
      a_numberOfStocks: 10,
      b_transferDate: '2024-08-22',
      c_exchangeRateOnTransferDate: 1330.5,
      d_transferPriceUsd: 110,
      e_transferPriceWon: 146355,
      f_transferPriceTotalWon: 1463550,
      g_acquisitionDate: '2024-05-21',
      h_exchangeRateOnAcquisitionDate: 1300.1,
      i_acquisitionPriceUsd: 100,
      j_acquisitionPriceWon: 130009,
      k_acquisitionPriceTotalWon: 1300090,
      l_gainLossWon: 163460,
    });
  });

  it('should throw error if both Disbursement and Settlement dates are missing', () => {
    const rates: ExchangeRate[] = [{ date: '2024-01-01', rate: 1000 }];
    const mhtmlList: MhtmlData[] = [
      {
        filename: 'error.mhtml',
        disbursementDate: '',
        settlementDate: '',
        transactions: [
          {
            acquisitionDate: '2024-05-21',
            typeOfMoney: '',
            costBasisPerShareUsd: 100,
            marketValuePerShareUsd: 110,
            shares: 10,
            gainOrLossUsd: 100
          }
        ]
      }
    ];
    expect(() => processTransactions(mhtmlList, rates)).toThrow(/Both Disbursement date and Settlement date are missing/);
  });
});
