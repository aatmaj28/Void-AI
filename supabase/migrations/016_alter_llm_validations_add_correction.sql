-- Add score correction columns to llm_validations
-- adjusted_gap_score: the LLM's corrected score (0-100)
-- original_category: the scoring engine's original category before LLM review
ALTER TABLE llm_validations
    ADD COLUMN IF NOT EXISTS adjusted_gap_score DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS original_category VARCHAR(50);

-- Rename gap_score to be clearer (it stores the original engine score)
COMMENT ON COLUMN llm_validations.gap_score IS 'Original gap score from scoring engine';
COMMENT ON COLUMN llm_validations.adjusted_gap_score IS 'LLM-corrected gap score after validation';
COMMENT ON COLUMN llm_validations.original_category IS 'Original category assigned by scoring engine';
COMMENT ON COLUMN llm_validations.suggested_category IS 'Category suggested by LLM based on adjusted score';
