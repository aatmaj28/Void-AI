CREATE TABLE IF NOT EXISTS analyst_coverage_history (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(10) NOT NULL,
  analyst_count INTEGER DEFAULT 0,
  recommendation_key VARCHAR(50),
  recommendation_mean DECIMAL(8,4),
  target_mean_price DECIMAL(12,2),
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ticker, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analyst_coverage_history_ticker ON analyst_coverage_history(ticker);
CREATE INDEX IF NOT EXISTS idx_analyst_coverage_history_date ON analyst_coverage_history(snapshot_date);
