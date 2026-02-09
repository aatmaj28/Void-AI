-- Scoring engine output: coverage, activity, quality, gap score per ticker (join to companies on ticker)
CREATE TABLE coverage_gap_scores (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    coverage_score DECIMAL(5,2),
    activity_score DECIMAL(5,2),
    quality_score DECIMAL(5,2),
    gap_score DECIMAL(5,2),
    opportunity_type VARCHAR(50),
    confidence DECIMAL(5,2),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coverage_gap_scores_ticker ON coverage_gap_scores(ticker);
CREATE INDEX idx_coverage_gap_scores_gap_score ON coverage_gap_scores(gap_score DESC);
CREATE INDEX idx_coverage_gap_scores_opportunity_type ON coverage_gap_scores(opportunity_type);

COMMENT ON TABLE coverage_gap_scores IS 'Scoring engine output; join to companies on ticker';
