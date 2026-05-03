import { ExchangeRate, MhtmlData, ProcessedTransaction } from './types';
import Papa from 'papaparse';

/**
 * Parses exchange rate CSV content.
 * Expected format: 1st column 'Date' (YYYY/MM/DD), 2nd column 'Rate'.
 * Returns an array of ExchangeRate objects sorted by date in descending order.
 */
export function parseExchangeRates(csvContent: string): ExchangeRate[] {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error('Failed to parse exchange rate CSV');
  }

  const fields = result.meta.fields || [];
  if (fields.length < 2) {
    throw new Error('Exchange rate CSV must have at least two columns');
  }

  const dateCol = fields[0];
  const rateCol = fields[1];
  if (!dateCol.toLowerCase().includes('date')) {
    throw new Error(`Exchange rate CSV 1st column must be 'date', found '${dateCol}'`);
  }
  if (!rateCol.toLowerCase().includes('rate')) {
    throw new Error(`Exchange rate CSV 2nd column must be 'rate', found '${rateCol}'`);
  }

  const rates: ExchangeRate[] = [];
  for (const row of result.data as any[]) {
    let dateStr = row[dateCol];
    let rateStr = row[rateCol];

    if (!dateStr || !rateStr) continue;

    // Parse YYYY/MM/DD format and convert to YYYY-MM-DD
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) continue;

    const year = dateParts[0].trim();
    const month = dateParts[1].trim().padStart(2, '0');
    const dayOfMonth = dateParts[2].trim().padStart(2, '0');

    if (year.length !== 4) continue;
    const formattedDate = `${year}-${month}-${dayOfMonth}`;

    const rate = parseFloat(rateStr.replace(/[^\d.]/g, ''));
    if (isNaN(rate)) {
      throw new Error(`Invalid exchange rate value: ${rateStr} for date: ${dateStr}`);
    }
    rates.push({ date: formattedDate, rate });
  }

  // Sort descending by date (newest first) to easily find the most recent preceding date
  rates.sort((a, b) => b.date.localeCompare(a.date));
  return rates;
}

export function getExchangeRate(rates: ExchangeRate[], targetDate: string): number {
  // Find the rate for the target date or the most recent preceding date
  for (const rateObj of rates) {
    if (rateObj.date <= targetDate) {
      return rateObj.rate;
    }
  }
  throw new Error(`Could not find exchange rate for date ${targetDate} or earlier`);
}

/**
 * Processes parsed MHTML data into a list of transactions with KRW values.
 * Applies exchange rates based on disbursement and acquisition dates.
 * Follows Korean tax regulations by rounding down all KRW values to the nearest integer.
 */
export function processTransactions(
  mhtmlDataList: MhtmlData[],
  exchangeRates: ExchangeRate[]
): ProcessedTransaction[] {
  const result: ProcessedTransaction[] = [];

  for (const mhtmlData of mhtmlDataList) {
    const transferDate = mhtmlData.disbursementDate;
    const exchangeRateOnTransferDate = getExchangeRate(exchangeRates, transferDate);

    for (const t of mhtmlData.transactions) {
      const exchangeRateOnAcquisitionDate = getExchangeRate(exchangeRates, t.acquisitionDate);

      const numberOfStocks = t.shares;
      const transferPriceUsd = t.marketValuePerShareUsd;
      const transferPriceWon = Math.floor(exchangeRateOnTransferDate * transferPriceUsd);
      const transferPriceTotalWon = Math.floor(numberOfStocks * transferPriceWon);

      const acquisitionDate = t.acquisitionDate;
      const acquisitionPriceUsd = t.costBasisPerShareUsd;
      const acquisitionPriceWon = Math.floor(exchangeRateOnAcquisitionDate * acquisitionPriceUsd);
      const acquisitionPriceTotalWon = Math.floor(numberOfStocks * acquisitionPriceWon);

      const gainLossWon = transferPriceTotalWon - acquisitionPriceTotalWon;

      result.push({
        a_numberOfStocks: numberOfStocks,
        b_transferDate: transferDate,
        c_exchangeRateOnTransferDate: exchangeRateOnTransferDate,
        d_transferPriceUsd: transferPriceUsd,
        e_transferPriceWon: transferPriceWon,
        f_transferPriceTotalWon: transferPriceTotalWon,
        g_acquisitionDate: acquisitionDate,
        h_exchangeRateOnAcquisitionDate: exchangeRateOnAcquisitionDate,
        i_acquisitionPriceUsd: acquisitionPriceUsd,
        j_acquisitionPriceWon: acquisitionPriceWon,
        k_acquisitionPriceTotalWon: acquisitionPriceTotalWon,
        l_gainLossWon: gainLossWon,
      });
    }
  }

  // Sort rows: transferDate (asc), acquisitionDate (asc), numberOfStocks (asc)
  result.sort((t1, t2) => {
    if (t1.b_transferDate !== t2.b_transferDate) {
      return t1.b_transferDate.localeCompare(t2.b_transferDate);
    }
    if (t1.g_acquisitionDate !== t2.g_acquisitionDate) {
      return t1.g_acquisitionDate.localeCompare(t2.g_acquisitionDate);
    }
    return t1.a_numberOfStocks - t2.a_numberOfStocks;
  });

  return result;
}
