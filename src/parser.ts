import quotedPrintable from 'quoted-printable';
import utf8 from 'utf8';
import { MhtmlData, Transaction } from './types';

// Helper to format date strings like "August 22, 2024" to "YYYY-MM-DD"
function formatDate(dateStr: string, filename: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`[${filename}] Invalid date format: ${dateStr}`);
  }
  const year = d.getFullYear();
  if (year < 2006 || year > 2025) {
    throw new Error(`[${filename}] Date out of allowed range (2006-2025): ${dateStr}`);
  }
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to parse currency strings like "$167.77" or "−$508.33"
function parseCurrencyUsd(val: string, filename: string): number {
  let s = val.replace(/[$,]/g, '').trim();
  // Handle minus sign (can be true minus \u2212 or hyphen)
  if (s.startsWith('−') || s.startsWith('-')) {
    s = '-' + s.substring(1);
  }
  const num = parseFloat(s);
  if (isNaN(num)) {
    throw new Error(`[${filename}] Invalid currency value: ${val}`);
  }
  return num;
}

// Helper to parse and validate shares value — must be a positive number
export function parseSharesValue(val: string, filename: string): number {
  const num = parseFloat(val);
  if (isNaN(num)) {
    throw new Error(`[${filename}] Invalid shares value (non-numeric): ${val}`);
  }
  if (num <= 0) {
    throw new Error(`[${filename}] Invalid shares value (must be positive): ${val}`);
  }
  return num;
}

export function parseMhtmlFromMorganStanley(fileContent: string, filename: string): MhtmlData {
  const boundaryMatch = fileContent.match(/boundary="([^"]+)"/);
  if (!boundaryMatch) {
    throw new Error(`[${filename}] Could not find multipart boundary in MHTML header`);
  }
  const boundary = boundaryMatch[1];
  const parts = fileContent.split('--' + boundary);

  let htmlPart = '';
  for (const part of parts) {
    if (part.includes('Content-Type: text/html')) {
      // Find where headers end and content begins
      const headerEndIdx = part.indexOf('\n\n') > -1 ? part.indexOf('\n\n') : part.indexOf('\r\n\r\n');
      if (headerEndIdx > -1) {
        htmlPart = part.substring(headerEndIdx).trim();
      } else {
        htmlPart = part;
      }
      break;
    }
  }

  if (!htmlPart) {
    throw new Error(`[${filename}] Could not find text/html part in MHTML`);
  }

  // Decode Quoted-Printable
  let decodedHtml = '';
  try {
    const qpDecoded = quotedPrintable.decode(htmlPart);
    decodedHtml = utf8.decode(qpDecoded);
  } catch (e) {
    // Simple fallback if the library fails
    const cleaned = htmlPart.replace(/=\r?\n/g, '');
    decodedHtml = decodeURIComponent(cleaned.replace(/=([A-F0-9]{2})/g, '%$1'));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(decodedHtml, 'text/html');

  // Extract Disbursement Date and Settlement Date
  // They are usually in a div containing <span>Disbursement date</span> or <span>Settlement date</span>, next div has the content
  let disbursementDateRaw = '';
  let settlementDateRaw = '';
  const titles = doc.querySelectorAll('div[aria-label="title"]');
  for (let i = 0; i < titles.length; i++) {
    const titleText = titles[i].textContent || '';
    if (titleText.includes('Disbursement date')) {
      const parent = titles[i].parentElement;
      const contentDiv = parent?.querySelector('div[aria-label="content"]');
      if (contentDiv && contentDiv.textContent) {
        disbursementDateRaw = contentDiv.textContent.trim();
      }
    } else if (titleText.includes('Settlement date')) {
      const parent = titles[i].parentElement;
      const contentDiv = parent?.querySelector('div[aria-label="content"]');
      if (contentDiv && contentDiv.textContent) {
        settlementDateRaw = contentDiv.textContent.trim();
      }
    }
  }

  if (!disbursementDateRaw && !settlementDateRaw) {
    throw new Error(`[${filename}] Could not find Disbursement date or Settlement date`);
  }

  const disbursementDate = disbursementDateRaw ? formatDate(disbursementDateRaw, filename) : '';
  const settlementDate = settlementDateRaw ? formatDate(settlementDateRaw, filename) : '';

  // Extract Table Transactions
  const transactions: Transaction[] = [];

  // Find tables with headers matching our required columns
  const tables = doc.querySelectorAll('table');
  let tableFound = false;

  tables.forEach(table => {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim() || '');
    // Check if this table has our columns (case-insensitive, partial match)
    const hasAcq = headers.some(h => h.includes('Acquisition date'));
    const hasCost = headers.some(h => h.includes('Cost basis per share'));
    const hasMarket = headers.some(h => h.includes('Market value per share'));
    const hasShares = headers.some(h => h.includes('Shares'));
    const hasGainLoss = headers.some(h => h.includes('Gain or loss'));

    if (hasAcq && hasCost && hasMarket && hasShares && hasGainLoss) {
      tableFound = true;

      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 6) { // Expecting at least 6 columns
          // We assume the order based on the prompt's analysis:
          // 0: Acquisition date
          // 1: Type of money
          // 2: Cost basis per share
          // 3: Market value per share
          // 4: Shares
          // 5: Gain or loss

          // The actual values are usually deep inside the td's div/span structure
          const getCellText = (cell: Element) => {
            // To avoid getting the mobile headers (aria-hidden divs), we try to get the last text node or span
            const spans = cell.querySelectorAll('span');
            if (spans.length > 0) {
              return spans[spans.length - 1].textContent?.trim() || '';
            }
            return cell.textContent?.trim() || '';
          };

          const acqDateText = getCellText(cells[0]).replace(/Acquisition date/i, '').trim();
          const typeOfMoney = getCellText(cells[1]).replace(/Type of money/i, '').trim();
          // Remove "Cost basis per share" header and tax status labels like "non-covered" or "covered"
          const costBasisText = getCellText(cells[2])
            .replace(/Cost basis per share/i, '')
            .replace(/non-covered/i, '')
            .replace(/covered/i, '')
            .trim();
          const marketValueText = getCellText(cells[3]).replace(/Market value per share/i, '').trim();
          const sharesText = getCellText(cells[4]).replace(/Shares/i, '').trim();
          const gainLossText = getCellText(cells[5]).replace(/Gain or loss/i, '').trim();

          if (!acqDateText || !costBasisText || !marketValueText || !sharesText || !gainLossText) {
            throw new Error(`[${filename}] Empty required value in table row`);
          }

          transactions.push({
            acquisitionDate: formatDate(acqDateText, filename),
            typeOfMoney: typeOfMoney,
            costBasisPerShareUsd: parseCurrencyUsd(costBasisText, filename),
            marketValuePerShareUsd: parseCurrencyUsd(marketValueText, filename),
            shares: parseSharesValue(sharesText, filename),
            gainOrLossUsd: parseCurrencyUsd(gainLossText, filename)
          });
        }
      });
    }
  });

  if (!tableFound || transactions.length === 0) {
    throw new Error(`[${filename}] No valid transactions table found`);
  }

  return {
    filename,
    disbursementDate,
    settlementDate,
    transactions
  };
}
