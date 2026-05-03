export interface Transaction {
  /** Format: YYYY-MM-DD */
  acquisitionDate: string;
  /** Usually empty in the MHTML report. */
  typeOfMoney: string;
  costBasisPerShareUsd: number;
  marketValuePerShareUsd: number;
  shares: number;
  /** Computed as (market value - cost basis) * shares. */
  gainOrLossUsd: number;
}

export interface MhtmlData {
  filename: string;
  /** Format: YYYY-MM-DD. Shared by all Transactions in the file. */
  disbursementDate: string;
  transactions: Transaction[];
}

export interface ExchangeRate {
  /** Format: YYYY-MM-DD */
  date: string;
  /** USD to Won exchange rate */
  rate: number;
}

export interface ProcessedTransaction {
  /** a) (Korean: 취득유형별 양도주식 수) */
  a_numberOfStocks: number;
  /** b) (Korean: 양도일자) Format: YYYY-MM-DD */
  b_transferDate: string;
  /** c) USD to Won exchange rate on Disbursement date. */
  c_exchangeRateOnTransferDate: number;
  /** d) Market value per share. */
  d_transferPriceUsd: number;
  /** e) (Korean: 주당양도가액) Multiplication of columns c and d. Rounded down to the integer. */
  e_transferPriceWon: number;
  /** f) (Korean: 양도가액) Multiplication of columns a and e. Rounded down to the integer. */
  f_transferPriceTotalWon: number;
  /** g) (Korean: 취득일자) Format: YYYY-MM-DD */
  g_acquisitionDate: string;
  /** h) USD to Won exchange rate on Acquisition Date. */
  h_exchangeRateOnAcquisitionDate: number;
  /** i) Cost basis per share. */
  i_acquisitionPriceUsd: number;
  /** j) (Korean: 주당취득가액) Multiplication of columns h and i. Rounded down to the integer. */
  j_acquisitionPriceWon: number;
  /** k) (Korean: 취득가액) Multiplication of columns a and j. Rounded down to the integer. */
  k_acquisitionPriceTotalWon: number;
  /** l) Column f minus Column k. */
  l_gainLossWon: number;
}
