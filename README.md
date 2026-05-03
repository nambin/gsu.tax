# GSU Tax Calculator

A zero-dependency, browser-based tool for processing Morgan Stanley MHTML reports to simplify tax filing for Alphabet GSU (Global Stock Units). This is written for Google employees in South Korea.

## Overview

This tool parses exported MHTML files from Morgan Stanley and calculates the relevant tax information, incorporating KRW-USD exchange rates for accurate local currency conversion. It simplifies the process of preparing data for annual tax returns.

> [!IMPORTANT]
> **Disclaimer:** This tool is provided for assistance purposes only. The final responsibility for tax filing and ensuring the validity of all data remains solely with the user. Please verify all calculations against your official financial statements.

## Key Features

- **MHTML Parsing:** Automatically extracts transaction data (acquisition dates, cost basis, shares, etc.) from Morgan Stanley's complex MHTML report format.
- **Exchange Rate Integration:** Uses pre-loaded historical KRW-USD exchange rates to calculate accurate gains in local currency. The CSV file was downloaded from https://ecos.bok.or.kr/#/SearchStat.
- **Bulk Processing:** Support for processing up to 150 MHTML files simultaneously.
- **CSV Export:** Generates two types of reports:
    - **Full Verification:** Detailed row-by-row breakdown for internal audit.
    - **Tax Filing:** Consolidated data formatted for easier tax reporting.
- **Privacy First:** All processing happens entirely in your browser. No data is uploaded to any server.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nambin/gsu.tax.git
   cd gsu.tax
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the development server:
```bash
npm run dev
```

To run tests:
```bash
npm test
```

To build for production:
```bash
npm run build
```

## How to Use

1. Export your transaction reports from Morgan Stanley as `.mhtml` files.
2. Open the GSU Tax Calculator.
3. Drag and drop the files into the designated zone.
4. Review the processing log for any errors.
5. Download the generated CSV files for your records and tax filing.

## License

This project is open-source. Please refer to the repository for licensing details.
