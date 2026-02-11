-- Add volume (latest day) and pe_ratio (trailing P/E from yfinance) for stock detail page
ALTER TABLE stock_metrics
  ADD COLUMN IF NOT EXISTS volume BIGINT,
  ADD COLUMN IF NOT EXISTS pe_ratio DECIMAL(12,4);

COMMENT ON COLUMN stock_metrics.volume IS 'Latest trading day volume (from yfinance)';
COMMENT ON COLUMN stock_metrics.pe_ratio IS 'Trailing P/E ratio (from yfinance info)';
