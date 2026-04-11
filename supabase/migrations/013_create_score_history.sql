-- Daily score snapshots for backtesting and ML training
CREATE TABLE score_history (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    snapshot_date DATE NOT NULL,
    coverage_score DECIMAL(5,2),
    activity_score DECIMAL(5,2),
    quality_score DECIMAL(5,2),
    gap_score DECIMAL(5,2),
    confidence DECIMAL(5,2),
    opportunity_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ticker, snapshot_date)
);

CREATE INDEX idx_score_history_ticker ON score_history(ticker);
CREATE INDEX idx_score_history_date ON score_history(snapshot_date);
CREATE INDEX idx_score_history_gap ON score_history(gap_score DESC);

COMMENT ON TABLE score_history IS 'Daily snapshots of scoring engine output for backtesting and ML weight optimization';
