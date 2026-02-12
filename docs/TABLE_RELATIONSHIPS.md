# Table Relationships & Foreign Key Integrity

All tables are linked by `ticker` (stock symbol). The pipeline ensures **data completeness** and **FK integrity** by only inserting into child tables when the parent (`companies`) exists.

## Table Hierarchy

```
companies (parent)
├── market_data (child: FK to companies.ticker)
├── stock_metrics (child: FK to companies.ticker)
├── analyst_coverage (child: FK to companies.ticker)
└── coverage_gap_scores (child: FK to companies.ticker, computed by scoring engine)
```

## Foreign Key Constraints

Based on error messages, these FKs exist in Supabase:
- `fk_market_data_ticker` → `companies(ticker)`
- `fk_analyst_coverage_ticker` → `companies(ticker)`
- `fk_stock_metrics_ticker` → `companies(ticker)` (likely)
- `fk_coverage_gap_scores_ticker` → `companies(ticker)` (likely)

## Pipeline Insertion Logic

**Rule:** Only insert into child tables (`market_data`, `stock_metrics`, `analyst_coverage`) when:
1. We successfully fetched data (`metrics_row` exists)
2. We will insert/update the parent (`companies` row exists or will be created)

**Implementation in `pipeline_daily.py`:**

```python
if metrics_row:
    # All child tables only get data when parent (companies) exists
    chunk_market.extend(market_rows)      # market_data
    chunk_metrics.append(metrics_row)     # stock_metrics
    chunk_analyst.append(analyst_row)     # analyst_coverage
    # ... add to chunk_companies ...
else:
    # Failed ticker: skip all inserts (no orphan data)
    cat_failed += 1
```

**Upsert order (ensures FK is satisfied):**
1. `companies` (parent) - upserted first
2. `market_data` (child)
3. `stock_metrics` (child)
4. `analyst_coverage` (child)
5. `coverage_gap_scores` (child, computed separately by scoring engine)

## Data Completeness Guarantee

For any ticker in `companies`:
- ✅ `market_data` exists (if fetch succeeded)
- ✅ `stock_metrics` exists (if fetch succeeded)
- ✅ `analyst_coverage` exists (if fetch succeeded)
- ✅ `coverage_gap_scores` exists (if scoring engine ran)

**No orphan rows:** Child tables never have rows for tickers that don't exist in `companies`.

## Coverage Gap Scores

`coverage_gap_scores` is computed by `run_scoring_engine.py` which:
- Reads from `companies`, `stock_metrics`, `analyst_coverage`
- Computes scores and upserts into `coverage_gap_scores`
- Only processes tickers that exist in all three source tables

So `coverage_gap_scores` implicitly respects FK integrity (only tickers from `companies`).
