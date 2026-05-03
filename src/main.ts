import { parseMhtmlFromMorganStanley } from './parser';
import { parseExchangeRates, processTransactions } from './calculator';
import { generateFullCsv, generateTaxCsv } from './csv_generator';
import exchangeRateCsvStr from './won_dollar_exchange_rate.csv?raw';
import { ExchangeRate, MhtmlData, ProcessedTransaction } from './types';

let exchangeRates: ExchangeRate[] = [];
let parsedMhtmlList: MhtmlData[] = [];
let finalTransactions: ProcessedTransaction[] = [];

// initFailed: set to true in init() if the bundled exchange rate CSV fails to parse.
//   - Cannot be reset without a full page reload; the drop zone is permanently disabled.
//   - Prevents any upload attempt from proceeding.
//
// uploadHasError: set to true during handleFiles() when any individual file fails to parse,
//   the file count exceeds 150, or processTransactions() throws an error.
//   - Reset to false at the start of every new upload via resetState(), so the user can
//     correct their files and try again without reloading the page.
let initFailed = false;
let uploadHasError = false;

const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const logContainer = document.getElementById('log-container') as HTMLDivElement;
const btnFull = document.getElementById('download-full-btn') as HTMLButtonElement;
const btnTax = document.getElementById('download-tax-btn') as HTMLButtonElement;

/** Appends a styled message entry to the log panel. */
function logMessage(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  const el = document.createElement('div');
  el.className = `log-entry log-${type}`;
  el.textContent = msg;
  logContainer.appendChild(el);
  logContainer.scrollTop = logContainer.scrollHeight;
}

/** Clears all existing log entries from the log panel. Called at the start of handleFiles()
 *  so each upload session begins with a clean, uncluttered log. */
function clearLogs() {
  logContainer.innerHTML = '';
}

/** Resets all upload-related state in preparation for a new upload session.
 *  Called at the start of handleFiles() on every new file selection.
 *  Does NOT reset initFailed — an exchange rate load failure requires a page reload. */
function resetState() {
  parsedMhtmlList = [];
  finalTransactions = [];
  uploadHasError = false;
  btnFull.disabled = true;
  btnTax.disabled = true;
}

async function init() {
  try {
    logMessage('Loading exchange rates...', 'info');
    exchangeRates = parseExchangeRates(exchangeRateCsvStr);
    const earliest = exchangeRates[exchangeRates.length - 1].date;
    const latest = exchangeRates[0].date;
    logMessage(`Loaded ${exchangeRates.length} exchange rate records (${earliest} to ${latest}).`, 'success');
  } catch (err: any) {
    logMessage(`Failed to load exchange rates: ${err.message}`, 'error');
    logMessage('The application cannot function. Please reload the page.', 'error');
    initFailed = true;
    // Visually disable the drop zone so the user knows uploading is blocked
    dropZone.style.opacity = '0.4';
    dropZone.style.pointerEvents = 'none';
  }
}

async function handleFiles(files: FileList | null) {
  if (initFailed) {
    logMessage('Cannot process files: exchange rates failed to load. Please reload the page.', 'error');
    return;
  }

  // Idea #5: show a message when user cancels the file picker
  if (!files || files.length === 0) {
    logMessage('No files selected.', 'info');
    return;
  }

  clearLogs();
  resetState();

  if (files.length > 150) {
    logMessage(`Error: You uploaded ${files.length} files. Maximum allowed is 150.`, 'error');
    logMessage('Please reduce the number of files and try again.', 'info');
    uploadHasError = true;
    return;
  }

  logMessage(`Processing ${files.length} file(s)...`, 'info');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const content = await file.text();
      const parsed = parseMhtmlFromMorganStanley(content, file.name);
      parsedMhtmlList.push(parsed);
      logMessage(`[${file.name}] - ${parsed.transactions.length} transactions found`, 'success');
    } catch (err: any) {
      logMessage(`Error processing ${file.name}: ${err.message}`, 'error');
      uploadHasError = true;
      break;
    }
  }

  if (uploadHasError) {
    logMessage('Processing stopped due to errors. Please fix the errors and try again.', 'error');
    return;
  }

  try {
    finalTransactions = processTransactions(parsedMhtmlList, exchangeRates);
    // Log total transaction count summary.
    const totalTransactions = finalTransactions.length;
    const totalFiles = parsedMhtmlList.length;
    logMessage(`Successfully processed ${totalFiles} file(s) with ${totalTransactions} total transactions. Ready to download CSV.`, 'success');
    btnFull.disabled = false;
    btnTax.disabled = false;
  } catch (err: any) {
    logMessage(`Error calculating values: ${err.message}`, 'error');
    uploadHasError = true;
  }
}

// Event Listeners
dropZone.addEventListener('click', () => {
  fileInput.click();
});

dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
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
  await handleFiles(target.files);
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
  if (uploadHasError || finalTransactions.length === 0) return;
  const csv = generateFullCsv(finalTransactions);
  download('gsu_tax_full_verification.csv', csv);
});

btnTax.addEventListener('click', () => {
  if (uploadHasError || finalTransactions.length === 0) return;
  const csv = generateTaxCsv(finalTransactions);
  download('gsu_tax_korean_filing.csv', csv);
});

init();
