-- Create companies table for storing S&P 500 company information
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255),
    sector VARCHAR(100),
    industry VARCHAR(200),
    market_cap BIGINT,
    exchange VARCHAR(50),
    country VARCHAR(100),
    cik VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_companies_ticker ON companies(ticker);
CREATE INDEX idx_companies_sector ON companies(sector);

-- Add comment to table
COMMENT ON TABLE companies IS 'Stores S&P 500 company information fetched from yfinance';

-- Add comments to important columns
COMMENT ON COLUMN companies.ticker IS 'Stock ticker symbol (e.g., AAPL, MSFT)';
COMMENT ON COLUMN companies.market_cap IS 'Market capitalization in dollars';
COMMENT ON COLUMN companies.cik IS 'Central Index Key for SEC filings';
COMMENT ON COLUMN companies.is_active IS 'Whether the company is currently active in S&P 500';
