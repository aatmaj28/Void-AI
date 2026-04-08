-- Stores daily snapshots of aggregate gap score metrics for the dashboard trend chart
CREATE TABLE IF NOT EXISTS gap_score_history (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  avg_score DECIMAL(8,4),
  opportunities_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gap_score_history_date ON gap_score_history(date);

COMMENT ON TABLE gap_score_history IS 'Daily aggregate snapshots: avg gap score and opportunity count across all tracked stocks';
