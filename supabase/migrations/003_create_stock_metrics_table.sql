-- Calculated metrics per ticker (links to companies via ticker)
CREATE TABLE stock_metrics (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    avg_volume_20d BIGINT,
    volatility_20d DECIMAL(8,4),
    price_change_1m DECIMAL(8,4),
    price_change_3m DECIMAL(8,4),
    current_price DECIMAL(12,4),
    year_high DECIMAL(12,4),
    year_low DECIMAL(12,4),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stock_metrics_ticker ON stock_metrics(ticker);

COMMENT ON TABLE stock_metrics IS 'Per-ticker metrics (volume, volatility, price changes); join to companies on ticker';
