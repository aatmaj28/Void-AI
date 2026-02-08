# 🚀 Quick Start: Create Companies Table

## Copy this SQL and run it in Supabase:

**Supabase SQL Editor URL:**
https://supabase.com/dashboard/project/jlwpktzfaqbvweluvvce/sql/new

---

## SQL to Execute:

```sql
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255),
    sector VARCHAR(100),
    industry VARCHAR(200),
    market_cap BIGINT,
    exchange VARCHAR(50),
    country VARCHAR(100),
    cik VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_ticker ON companies(ticker);
CREATE INDEX idx_companies_sector ON companies(sector);
```

---

## Steps:
1. Click the URL above to open Supabase SQL Editor
2. Copy the SQL above
3. Paste into the editor
4. Click "Run" (or press Ctrl+Enter)
5. Done! ✅

---

## Verify it worked:
```sql
SELECT * FROM companies LIMIT 1;
```

If you see column headers (id, ticker, name, etc.) with no errors, you're all set!
