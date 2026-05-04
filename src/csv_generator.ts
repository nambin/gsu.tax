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
    '주식 종목명': '알파벳 Class C',
    '사업자등록번호': '',
    '국내/국외 구분': 2,
    '취득유형별 양도주식 수': t.a_numberOfStocks,
    '세율구분': 61,
    '주식등 종류': 61,
    '양도물건 종류': 10,
    '취득유형': '="01"',
    '양도일자': t.b_transferDate,
    '주당양도가액': t.e_transferPriceWon,
    '양도가액': t.f_transferPriceTotalWon,
    '취득일자': t.g_acquisitionDate,
    '주당취득가액': t.j_acquisitionPriceWon,
    '취득가액': t.k_acquisitionPriceTotalWon,
    '필요경비': 0,
  }));

  return Papa.unparse(csvData);
}
