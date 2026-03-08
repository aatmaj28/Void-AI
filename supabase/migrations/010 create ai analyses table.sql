-- CrewAI-generated investment analyses with agent debate transcript
-- Caches structured analysis (hypothesis, bull/base/bear, catalysts, risks)
-- plus the full debate transcript showing each agent's reasoning chain.
-- Join to companies on ticker.

CREATE TABLE ai_analyses (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    hypothesis TEXT NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    bull_case JSONB NOT NULL,
    base_case JSONB NOT NULL,
    bear_case JSONB NOT NULL,
    catalysts JSONB NOT NULL,
    risks JSONB NOT NULL,
    debate_transcript JSONB,
    news_context JSONB,
    model_used VARCHAR(100) DEFAULT 'mistralai/mistral-medium-3.1',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    gap_score_at_generation DECIMAL(5,2),
    CONSTRAINT fk_ai_analyses_ticker FOREIGN KEY (ticker)
        REFERENCES companies(ticker) ON DELETE CASCADE
);

CREATE INDEX idx_ai_analyses_ticker ON ai_analyses(ticker);
CREATE INDEX idx_ai_analyses_expires ON ai_analyses(expires_at);
CREATE INDEX idx_ai_analyses_generated ON ai_analyses(generated_at DESC);

COMMENT ON TABLE ai_analyses IS 'CrewAI-generated investment analyses with debate transcript; cached and refreshed on demand or when gap scores change significantly';
COMMENT ON COLUMN ai_analyses.bull_case IS 'JSON: {"title": "Bull Case", "points": ["..."]}';
COMMENT ON COLUMN ai_analyses.base_case IS 'JSON: {"title": "Base Case", "points": ["..."]}';
COMMENT ON COLUMN ai_analyses.bear_case IS 'JSON: {"title": "Bear Case", "points": ["..."]}';
COMMENT ON COLUMN ai_analyses.catalysts IS 'JSON array: [{"event": "...", "date": "Q1 2026"}]';
COMMENT ON COLUMN ai_analyses.risks IS 'JSON array: [{"risk": "...", "severity": "high|medium|low"}]';
COMMENT ON COLUMN ai_analyses.debate_transcript IS 'JSON array: each agent step with agent name, role, summary, and full output';
COMMENT ON COLUMN ai_analyses.news_context IS 'JSON array: Finnhub news headlines used during analysis generation';
COMMENT ON COLUMN ai_analyses.expires_at IS 'NULL = no expiry; otherwise re-generate after this time';
COMMENT ON COLUMN ai_analyses.gap_score_at_generation IS 'Snapshot of gap_score when analysis was generated; used to detect stale analyses';