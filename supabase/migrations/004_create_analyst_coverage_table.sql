-- Analyst coverage per ticker (links to companies via ticker)
CREATE TABLE analyst_coverage (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    analyst_count INT DEFAULT 0,
    recommendation_key VARCHAR(50),
    recommendation_mean DECIMAL(4,2),
    target_mean_price DECIMAL(12,4),
    target_high_price DECIMAL(12,4),
    target_low_price DECIMAL(12,4),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analyst_coverage_ticker ON analyst_coverage(ticker);
CREATE INDEX idx_analyst_coverage_count ON analyst_coverage(analyst_count);

COMMENT ON TABLE analyst_coverage IS 'Analyst coverage and targets; join to companies on ticker';
