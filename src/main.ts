import { parseMhtmlFromMorganStanley } from './parser';
import { parseExchangeRates, processTransactions } from './calculator';
import { generateFullCsv, generateTaxCsv } from './csv_generator';
import exchangeRateCsvStr from './won_dollar_exchange_rate.csv?raw';
import { ExchangeRate, MhtmlData, ProcessedTransaction } from './types';

let exchangeRates: ExchangeRate[] = [];
let parsedMhtmlList: MhtmlData[] = [];
let finalTransactions: ProcessedTransaction[] = [];
let hasError = false;

const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const logContainer = document.getElementById('log-container') as HTMLDivElement;
const btnFull = document.getElementById('download-full-btn') as HTMLButtonElement;
const btnTax = document.getElementById('download-tax-btn') as HTMLButtonElement;

function logMessage(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  const el = document.createElement('div');
  el.className = `log-entry log-${type}`;
  el.textContent = msg;
  logContainer.appendChild(el);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLogs() {
  logContainer.innerHTML = '';
}

function resetState() {
  parsedMhtmlList = [];
  finalTransactions = [];
  hasError = false;
  btnFull.disabled = true;
  btnTax.disabled = true;
}

async function init() {
  try {
    logMessage('Loading exchange rates...', 'info');
    exchangeRates = parseExchangeRates(exchangeRateCsvStr);
    logMessage(`Loaded ${exchangeRates.length} exchange rate records.`, 'success');
  } catch (err: any) {
    logMessage(`Failed to load exchange rates: ${err.message}`, 'error');
    hasError = true;
  }
}

async function handleFiles(files: FileList | null) {
  if (!files || files.length === 0) return;
  if (hasError && exchangeRates.length === 0) {
    logMessage('Cannot process files without exchange rates.', 'error');
    return;
  }

  clearLogs();
  resetState();

  if (files.length > 150) {
    logMessage(`Error: You uploaded ${files.length} files. Maximum allowed is 150.`, 'error');
    logMessage('Please reduce the number of files and try again.', 'info');
    hasError = true;
    return;
  }

  logMessage(`Processing ${files.length} files...`, 'info');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const content = await file.text();
      const parsed = parseMhtmlFromMorganStanley(content, file.name);
      parsedMhtmlList.push(parsed);
      logMessage(`[${file.name}] - ${parsed.transactions.length} transactions found`, 'success');
    } catch (err: any) {
      logMessage(`Error processing ${file.name}: ${err.message}`, 'error');
      hasError = true;
      break;
    }
  }

  if (hasError) {
    logMessage('Processing stopped due to errors. Please fix the errors and try again.', 'error');
    return;
  }

  try {
    finalTransactions = processTransactions(parsedMhtmlList, exchangeRates);
    logMessage(`Successfully processed all files. Ready to download CSV.`, 'success');
    btnFull.disabled = false;
    btnTax.disabled = false;
  } catch (err: any) {
    logMessage(`Error calculating values: ${err.message}`, 'error');
    hasError = true;
  }
}

// Event Listeners
dropZone.addEventListener('click', () => {
  fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files) {
    handleFiles(e.dataTransfer.files);
  }
});

fileInput.addEventListener('change', async (e) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    await handleFiles(target.files);
  }
  // Reset input so the same files can be selected again
  target.value = '';
});

function download(filename: string, text: string) {
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), text], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

btnFull.addEventListener('click', () => {
  if (hasError || finalTransactions.length === 0) return;
  const csv = generateFullCsv(finalTransactions);
  download('gsu_tax_full_verification.csv', csv);
});

btnTax.addEventListener('click', () => {
  if (hasError || finalTransactions.length === 0) return;
  const csv = generateTaxCsv(finalTransactions);
  download('gsu_tax_korean_filing.csv', csv);
});

init();
