-- Add cap_type to companies: large (S&P 500), mid (S&P 400), small (Russell 2000)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS cap_type VARCHAR(20);

COMMENT ON COLUMN companies.cap_type IS 'Market cap category: large (S&P 500), mid (S&P 400), small (Russell 2000)';

CREATE INDEX IF NOT EXISTS idx_companies_cap_type ON companies(cap_type);
