# Step 4: Scoring Engine

After **Step 3** (analyst_coverage populated), run the scoring engine to compute **coverage_score**, **activity_score**, **quality_score**, and **gap_score** per ticker. The UI (dashboard, opportunities, screener, stock detail) reads from **coverage_gap_scores** and joined tables.

---

## 4.1 Create table in Supabase (if not already done)

Run in Supabase SQL Editor:

```sql
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
```

---

## 4.2 Run the scoring engine

From project root (after companies, stock_metrics, analyst_coverage are populated):

```bash
pip install -r scripts/requirements.txt   # if not already
python scripts/run_scoring_engine.py
```

- Reads **companies** (sector, market_cap), **stock_metrics** (volume, volatility, price_change_1m, etc.), **analyst_coverage** (analyst_count).
- Builds peer groups by **sector + size bucket** (mega / large / mid / small).
- Computes **coverage_score** (under-covered vs peers), **activity_score** (z-scores vs peers), **quality_score** (size, liquidity, price, completeness), **gap_score** = 0.5×coverage + 0.3×activity + 0.2×quality.
- Sets **opportunity_type**: High Priority (≥75), Strong Opportunity (≥60), Moderate Opportunity (≥45), Low Priority (&lt;45).
- Upserts into **coverage_gap_scores**.

---

## 4.3 UI

- **Dashboard** – Summary stats and top opportunities from `/api/opportunities` (companies + stock_metrics + analyst_coverage + coverage_gap_scores).
- **Opportunities** – Full list with filters and sort from same API.
- **Screener** – Same data, filtered by conditions.
- **Stock /[ticker]** – Single ticker from `/api/stock/[ticker]`.

Re-run the scoring engine whenever you refresh market or analyst data to update scores.
