# Step 2: Market Data & Stock Metrics

After **Step 1** (companies table populated), this step fills **market_data** (daily OHLCV) and **stock_metrics** (calculated metrics). Both join to **companies** on `ticker`.

---

## 2.1 Create tables in Supabase (if not already done)

Run in Supabase SQL Editor:

**market_data** (daily price/volume per ticker):

```sql
CREATE TABLE market_data (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12,4),
    high DECIMAL(12,4),
    low DECIMAL(12,4),
    close DECIMAL(12,4),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ticker, date)
);
CREATE INDEX idx_market_data_ticker ON market_data(ticker);
CREATE INDEX idx_market_data_date ON market_data(date);
CREATE INDEX idx_market_data_ticker_date ON market_data(ticker, date);
```

**stock_metrics** (one row per ticker):

```sql
CREATE TABLE stock_metrics (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    avg_volume_20d BIGINT,
    volatility_20d DECIMAL(8,4),
    price_change_1m DECIMAL(8,4),
    price_change_3m DECIMAL(8,4),
    current_price DECIMAL(12,4),
    year_high DECIMAL(12,4),
    year_low DECIMAL(12,4),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_stock_metrics_ticker ON stock_metrics(ticker);
```

---

## 2.2 Export from Colab to CSV

1. Open **`scripts/colab_export_market_data.py`** in your project.
2. Copy the **entire file** into a Google Colab cell and run it.
3. Wait ~10–20 min for all ~500 tickers (1y history each).
4. Download the two CSVs: **market_data.csv**, **stock_metrics.csv**.
5. Put both files in your project: **void ai/scripts/**.

---

## 2.3 Import CSVs into Supabase

From project root:

```bash
pip install -r scripts/requirements.txt   # if not already
python scripts/import_market_data.py
```

Or with custom paths:

```bash
python scripts/import_market_data.py --market-data path/to/market_data.csv --stock-metrics path/to/stock_metrics.csv
```

- **market_data**: upserted on `(ticker, date)`.
- **stock_metrics**: upserted on `ticker`.
- Tickers join with **companies** via `ticker`.

---

## Joining with companies

Example queries:

```sql
-- Companies with their latest metrics
SELECT c.ticker, c.name, c.sector, m.current_price, m.volatility_20d, m.price_change_1m
FROM companies c
JOIN stock_metrics m ON c.ticker = m.ticker;

-- Daily data for a ticker
SELECT * FROM market_data WHERE ticker = 'AAPL' ORDER BY date DESC LIMIT 30;
```
