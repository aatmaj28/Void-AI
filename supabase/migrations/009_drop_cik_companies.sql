-- Remove cik from companies; yfinance does not provide it and SEC filings use SEC company_tickers.json
ALTER TABLE companies
DROP COLUMN IF EXISTS cik;
