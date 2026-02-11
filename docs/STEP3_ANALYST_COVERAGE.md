# Step 3: Analyst Coverage

After **Step 2** (market_data and stock_metrics), this step fills **analyst_coverage** (analyst count, recommendation, targets). Joins to **companies** on `ticker`.

---

## 3.1 Create table in Supabase (if not already done)

Run in Supabase SQL Editor:

```sql
CREATE TABLE analyst_coverage (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    analyst_count INT DEFAULT 0,
    recommendation_key VARCHAR(50),
    recommendation_mean DECIMAL(4,2),
    target_mean_price DECIMAL(12,4),
    target_high_price DECIMAL(12,4),
    target_low_price DECIMAL(12,4),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_analyst_coverage_ticker ON analyst_coverage(ticker);
CREATE INDEX idx_analyst_coverage_count ON analyst_coverage(analyst_count);
```

---

## 3.2 Export from Colab to CSV

1. Open **`scripts/colab_export_analyst_coverage.py`** in your project.
2. Copy the **entire file** into a Google Colab cell and run it.
3. Wait ~2–5 min for all ~500 tickers.
4. Download **analyst_coverage.csv**.
5. Put it in your project: **void ai/scripts/**.

---

## 3.3 Import CSV into Supabase

From project root:

```bash
python scripts/import_analyst_coverage.py
```

Or with a custom path:

```bash
python scripts/import_analyst_coverage.py --file path/to/analyst_coverage.csv
```

- Upserts on **ticker** (insert if new, update if exists).
- Tickers join with **companies** via `ticker`.

---

## Joining with companies

```sql
-- Companies with analyst coverage
SELECT c.ticker, c.name, c.sector, a.analyst_count, a.recommendation_key, a.target_mean_price
FROM companies c
JOIN analyst_coverage a ON c.ticker = a.ticker
ORDER BY a.analyst_count DESC;
```
