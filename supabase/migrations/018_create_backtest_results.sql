-- Backtest results: stores quintile analysis for gap score validation
CREATE TABLE IF NOT EXISTS backtest_results (
    id SERIAL PRIMARY KEY,
    run_date TIMESTAMP NOT NULL DEFAULT NOW(),
    eval_date DATE NOT NULL,
    forward_days INTEGER NOT NULL DEFAULT 30,
    quintile INTEGER NOT NULL CHECK (quintile BETWEEN 1 AND 5),
    stock_count INTEGER NOT NULL,
    avg_gap_score DECIMAL(6,2),
    avg_return DECIMAL(8,5),
    median_return DECIMAL(8,5),
    hit_rate DECIMAL(5,4),
    best_ticker VARCHAR(10),
    best_return DECIMAL(8,5),
    worst_ticker VARCHAR(10),
    worst_return DECIMAL(8,5),
    UNIQUE(eval_date, forward_days, quintile)
);

-- Summary row per run (aggregate across quintiles)
CREATE TABLE IF NOT EXISTS backtest_summary (
    id SERIAL PRIMARY KEY,
    run_date TIMESTAMP NOT NULL DEFAULT NOW(),
    eval_dates_used TEXT,
    total_stocks INTEGER,
    forward_days INTEGER NOT NULL DEFAULT 30,
    q1_avg_return DECIMAL(8,5),
    q5_avg_return DECIMAL(8,5),
    q1_q5_spread DECIMAL(8,5),
    q1_hit_rate DECIMAL(5,4),
    spearman_corr DECIMAL(6,4),
    benchmark_return DECIMAL(8,5),
    q1_alpha DECIMAL(8,5),
    signal_is_valid BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_backtest_results_eval ON backtest_results(eval_date);
CREATE INDEX idx_backtest_results_quintile ON backtest_results(quintile);
CREATE INDEX idx_backtest_summary_run ON backtest_summary(run_date DESC);

COMMENT ON TABLE backtest_results IS 'Per-quintile backtest results validating gap score predictive power';
COMMENT ON TABLE backtest_summary IS 'Aggregate backtest summary with Q1-Q5 spread and signal validity';
