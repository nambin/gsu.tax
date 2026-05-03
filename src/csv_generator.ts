import { ProcessedTransaction } from './types';
import Papa from 'papaparse';

export function generateFullCsv(data: ProcessedTransaction[]): string {
  const csvData = data.map(t => ({
    'Number of Stocks': t.a_numberOfStocks,
    'Transfer Date': t.b_transferDate,
    'Exchange Rate on Transfer Date': t.c_exchangeRateOnTransferDate,
    'Transfer Price (USD)': t.d_transferPriceUsd,
    'Transfer Price (Won)': t.e_transferPriceWon,
    'Transfer Price Total (Won)': t.f_transferPriceTotalWon,
    'Acquisition Date': t.g_acquisitionDate,
    'Exchange Rate on Acquisition Date': t.h_exchangeRateOnAcquisitionDate,
    'Acquisition Price (USD)': t.i_acquisitionPriceUsd,
    'Acquisition Price (Won)': t.j_acquisitionPriceWon,
    'Acquisition Price Total (Won)': t.k_acquisitionPriceTotalWon,
    'Gain/Loss (Won)': t.l_gainLossWon,
  }));

  return Papa.unparse(csvData);
}

export function generateTaxCsv(data: ProcessedTransaction[]): string {
  const csvData = data.map(t => ({
    '취득유형별 양도주식 수': t.a_numberOfStocks,
    '양도일자': t.b_transferDate,
    '주당양도가액': t.e_transferPriceWon,
    '양도가액': t.f_transferPriceTotalWon,
    '취득일자': t.g_acquisitionDate,
    '주당취득가액': t.j_acquisitionPriceWon,
    '취득가액': t.k_acquisitionPriceTotalWon,
  }));

  return Papa.unparse(csvData);
}
