import quotedPrintable from 'quoted-printable';
import utf8 from 'utf8';
import { MhtmlData, Transaction } from './types';

// Helper to format date strings like "August 22, 2024" or "2024년 8월 22일" to "YYYY-MM-DD".
// Dates before 2006 or after maxDate (the latest date in the exchange rate CSV) are rejected.
export function formatDate(dateStr: string, filename: string, maxDate: string): string {
  // Korean MS reports use "YYYY년 M월 D일"; the JS Date constructor cannot parse this.
  const krMatch = dateStr.match(/^\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*$/);
  const d = krMatch
    ? new Date(parseInt(krMatch[1]), parseInt(krMatch[2]) - 1, parseInt(krMatch[3]))
    : new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`[${filename}] Invalid date format: ${dateStr}`);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const formatted = `${year}-${month}-${day}`;
  if (year < 2006 || formatted > maxDate) {
    throw new Error(`[${filename}] Date out of allowed range (2006-01-01 to ${maxDate}): ${dateStr}`);
  }
  return formatted;
}

// Helper to parse currency strings like "$167.77", "−$508.33", or "US$167.77"
export function parseCurrencyUsd(val: string, filename: string): number {
  // Strip currency markers: "US$" (Korean MS reports), "$", and thousands separators.
  let s = val.replace(/US\$/g, '').replace(/[$,]/g, '').trim();
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

// maxDate: the latest date in the exchange rate CSV (YYYY-MM-DD); any report date after it is rejected.
export function parseMhtmlFromMorganStanley(fileContent: string, filename: string, maxDate: string): MhtmlData {
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
    const isDisbursement = titleText.includes('Disbursement date') || titleText.includes('지출 날짜');
    const isSettlement = titleText.includes('Settlement date') || titleText.includes('합의 날짜');
    if (isDisbursement) {
      const parent = titles[i].parentElement;
      const contentDiv = parent?.querySelector('div[aria-label="content"]');
      if (contentDiv && contentDiv.textContent) {
        disbursementDateRaw = contentDiv.textContent.trim();
      }
    } else if (isSettlement) {
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

  const disbursementDate = disbursementDateRaw ? formatDate(disbursementDateRaw, filename, maxDate) : '';
  const settlementDate = settlementDateRaw ? formatDate(settlementDateRaw, filename, maxDate) : '';

  // Extract Table Transactions
  const transactions: Transaction[] = [];

  // Find tables with headers matching our required columns
  const tables = doc.querySelectorAll('table');
  let tableFound = false;

  tables.forEach(table => {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim() || '');

    // Map column header text to its index (partial match) so the parser
    // does not depend on the column order in the MS report. Each column
    // accepts an English or Korean label.
    const findHeader = (en: string, kr: string) =>
      headers.findIndex(h => h.includes(en) || h.includes(kr));
    const idxAcq = findHeader('Acquisition date', '획득 날짜');
    const idxCost = findHeader('Cost basis per share', '주당 비용 기준');
    const idxMarket = findHeader('Market value per share', '주당 시가');
    const idxGainLoss = findHeader('Gain or loss', '이익 또는 손실');
    const idxType = findHeader('Type of money', '자금 유형'); // optional; usually empty
    // Korean "주" alone is too generic (it appears in 주당, 주식 etc.) — require an exact-trimmed match.
    const idxShares = headers.findIndex(h => h.includes('Shares') || h.trim() === '주');

    if (idxAcq < 0 || idxCost < 0 || idxMarket < 0 || idxShares < 0 || idxGainLoss < 0) {
      return;
    }

    tableFound = true;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const minCells = Math.max(idxAcq, idxCost, idxMarket, idxShares, idxGainLoss, idxType) + 1;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < minCells) return;

      // The actual values are usually deep inside the td's div/span structure.
      // Strip aria-hidden mobile-header divs (e.g. "Acquisition date" / "획득 날짜")
      // before reading text, so empty cells return "" in any language.
      const getCellText = (cell: Element) => {
        const clone = cell.cloneNode(true) as Element;
        clone.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
        const spans = clone.querySelectorAll('span');
        if (spans.length > 0) {
          return spans[spans.length - 1].textContent?.trim() || '';
        }
        return clone.textContent?.trim() || '';
      };

      const acqDateText = getCellText(cells[idxAcq]).replace(/Acquisition date/i, '').trim();
      const typeOfMoney = idxType >= 0
        ? getCellText(cells[idxType]).replace(/Type of money/i, '').trim()
        : '';
      // Remove "Cost basis per share" header and tax status labels like "non-covered" or "covered"
      const costBasisText = getCellText(cells[idxCost])
        .replace(/Cost basis per share/i, '')
        .replace(/non-covered/i, '')
        .replace(/covered/i, '')
        .trim();
      const marketValueText = getCellText(cells[idxMarket]).replace(/Market value per share/i, '').trim();
      const sharesText = getCellText(cells[idxShares]).replace(/Shares/i, '').trim();
      const gainLossText = getCellText(cells[idxGainLoss]).replace(/Gain or loss/i, '').trim();

      if (!acqDateText || !costBasisText || !marketValueText || !sharesText || !gainLossText) {
        throw new Error(`[${filename}] Empty required value in table row`);
      }

      transactions.push({
        acquisitionDate: formatDate(acqDateText, filename, maxDate),
        typeOfMoney: typeOfMoney,
        costBasisPerShareUsd: parseCurrencyUsd(costBasisText, filename),
        marketValuePerShareUsd: parseCurrencyUsd(marketValueText, filename),
        shares: parseSharesValue(sharesText, filename),
        gainOrLossUsd: parseCurrencyUsd(gainLossText, filename)
      });
    });
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
