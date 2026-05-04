**Role:** You are a Senior Full-stack Developer and Financial Systems Expert. 

**Objective:** Build a "GSU Tax Calculator". A client-side-only web application that parses Morgan Stanley MHTML reports to calculate Korean Capital Gains Tax (양도소득세). 

**Core Requirements:** 

**1. Zero-Server Architecture & Tech Stack:**

* All processing must happen in the browser for privacy. No data should be sent to any external server.
* Do not use any other extra dependencies such as Ruby or Jekyll or Node.JS. Using plain HTML/CSS/TypeScript is most desirable. But, You may use standard NPM packages for MIME/Quoted-Printable decoding and CSV operations.
* **Simple User Interface:** We don’t need any fancy UI styling or 1nimation. Please minimize the CSS decorations as much as possible.

**2. Input Handling & MHTML Decoding:**

* Implement a file upload zone that accepts multiple Morgan Stanley MHTML files. It'll allow up to 150 files. If users upload more than 150 files, it's an error. In that case, please inform the user to reduce the number of files in the logging view.
* **Crucial:** MHTML files are MIME multipart documents. You must implement logic to decode the Quoted-Printable encoding to extract the raw HTML DOM before parsing.

**3. Data Extraction from MHTML files:** Please analyze the provided sample MHTML files (`morgan-stanley-sale-2024-08-report.mhtml`, `morgan-stanley-sale-2024-09-report.mhtml`). Each file is expected to have (one or multiple) tables with the following columns. If it doesn’t, it’s considered an error:

* a) Acquisition date
* b) Type of money - The value is usually empty.
* c) Cost basis per share - The value is in USD.
* d) Market value per share - The value is in USD.
* e) Shares
* f) Gain or loss - It’s computed as (d - c) * e.
* *Note:* We’ll call each row a Transaction. One MHTML file can have multiple transactions. If any value of column a, c, d, e is empty, it’s considered an error.
* *Global Date:* Extract the **“Disbursement date”**. All Transactions in the same MHTML file share this same “Disbursement date”.

**4. Currency Conversion:**

* We provided a file (`won_dollar_exchange_rate.csv`) in the repository containing historical USD/Won exchange rates from 2006 to 2025. 
* When the exchange rate is unavailable for a given date, use the rate from the **most recent preceding date**.

**5. Output Specifications:** Allow users to download two CSV files formatted for Korean tax filing references. Please use the YYYY-MM-DD format for all dates. Rows should be ordered by column b, g, a (all ascending orders) listed below.

* **File 1 (Full Verification):** Includes comprehensive data for manual verification.
* **File 2 (Korean Tax Filing):** 15 columns formatted for Korean tax filing, in the following order:

| Column (Korean) | Source / Default |
|---|---|
| 주식 종목명 | Fixed: `알파벳 Class C` |
| 사업자등록번호 | Fixed: *(empty)* |
| 국내/국외 구분 | Fixed: `2` |
| 취득유형별 양도주식 수 | Column a (number of shares) |
| 세율구분 | Fixed: `61` |
| 주식등 종류 | Fixed: `61` |
| 양도물건 종류 | Fixed: `10` |
| 취득유형 | Fixed: `01` |
| 양도일자 | Column b (transfer date) |
| 주당양도가액 | Column e (transfer price per share in Won) |
| 양도가액 | Column f (total transfer price in Won) |
| 취득일자 | Column g (acquisition date) |
| 주당취득가액 | Column j (acquisition price per share in Won) |
| 취득가액 | Column k (total acquisition price in Won) |
| 필요경비 | Fixed: `0` |

**Columns list and logic:**
* a) “Number of Stocks” (Korean: 취득유형별 양도주식 수) - The number of shares (stocks) of each transaction.
* b) “Transfer Date” (Korean: 양도일자) - Disbursement date.
* c) “Exchange Rate on Transfer Date” - USD to Won exchange rate on Disbursement date.
* d) “Transfer Price (USD)” - Market value per share in USD.
* e) “Transfer Price (Won)” (Korean: 주당양도가액) - Market value per share in Won. Multiplication of columns c and d. Round down to the integer.
* f) “Transfer Price Total (Won)” (Korean: 양도가액) - Market value in Won. Multiplication of columns a,c, and d. Round down to the integer.
* g) “Acquisition Date” (Korean: 취득일자) - Acquisition Date.
* h) “Exchange Rate on Acquisition Date” - USD to Won exchange rate on Acquisition Date.
* i) “Acquisition Price (USD)” - Cost basis per share in USD.
* j) “Acquisition Price (Won)” (Korean: 주당취득가액) - Cost basis per share in Won. Multiplication of columns h and i. Round down to the integer.
* k) “Acquisition Price Total (Won)” (Korean: 취득가액) - Cost basis in Won. Multiplication of columns a, h, and i. Round down to the integer.
* l) “Gain/Loss (Won)” - Column f minus Column k.

**6. Unit Tests:**

* Create a dedicated TypeScript file with necessary classes (e.g., `Transaction`, `TransactionSet` for one input MHTML file).
* Create unit-tests covering the logging, error handling, and math requirements.

**7. Error Handling:**

* The goal is to provide trustworthy data, so stop processing immediately for any error (e.g., MHTML parsing error, malformed data).
* Do not allow outputting partial records. Users can download the output CSV files only when there is no detected error.
* *Date Rule:* This program only allows dates between 2006 and 2025. If any date is outside this range (e.g., 2005-12-31 or 2026-01-01), it is considered an error.

**8. Logging:** Display the processing status clearly to users without exposing sensitive information (especially prices). The TypeScript library is responsible for displaying proper logging to users.

* **On success:** Log the number of transactions per input MHTML file (e.g., "[Input file basename] - [X] transactions found").
* **On error:** Show the reason to the user (e.g., "Error: wrong date in [Input file basename]"). Ensure the UI updates to reflect this failure state securely.
