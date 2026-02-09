-- Daily OHLCV data per ticker (links to companies via ticker)
CREATE TABLE market_data (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12,4),
    high DECIMAL(12,4),
    low DECIMAL(12,4),
    close DECIMAL(12,4),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ticker, date)
);

CREATE INDEX idx_market_data_ticker ON market_data(ticker);
CREATE INDEX idx_market_data_date ON market_data(date);
CREATE INDEX idx_market_data_ticker_date ON market_data(ticker, date);

COMMENT ON TABLE market_data IS 'Daily OHLCV price/volume data; join to companies on ticker';
