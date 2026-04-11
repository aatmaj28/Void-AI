-- LLM-as-a-Judge validation results for scoring engine output
CREATE TABLE llm_validations (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    gap_score DECIMAL(5,2),
    agreement_score INTEGER CHECK (agreement_score BETWEEN 1 AND 10),
    reasoning TEXT,
    red_flags TEXT,
    suggested_category VARCHAR(50),
    model_used VARCHAR(100),
    validated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ticker, validated_at)
);

CREATE INDEX idx_llm_validations_ticker ON llm_validations(ticker);
CREATE INDEX idx_llm_validations_date ON llm_validations(validated_at);
CREATE INDEX idx_llm_validations_agreement ON llm_validations(agreement_score);

COMMENT ON TABLE llm_validations IS 'LLM validation of scoring engine top picks; tracks agreement between formula and AI judge';
