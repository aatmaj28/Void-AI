-- ML-optimized weights for the scoring engine
CREATE TABLE ml_learned_weights (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(50) NOT NULL,
    w_coverage DECIMAL(6,4),
    w_activity DECIMAL(6,4),
    w_quality DECIMAL(6,4),
    r_squared DECIMAL(8,6),
    spearman_corr DECIMAL(8,6),
    hit_rate DECIMAL(6,4),
    sample_count INTEGER,
    eval_dates TEXT,
    trained_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_ml_weights_model ON ml_learned_weights(model_name);
CREATE INDEX idx_ml_weights_trained ON ml_learned_weights(trained_at DESC);

COMMENT ON TABLE ml_learned_weights IS 'Learned scoring weights from ML optimization; used by pipeline when USE_ML_WEIGHTS=true';
